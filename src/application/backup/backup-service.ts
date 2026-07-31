import { z } from "zod";

import {
  stableStringify,
  utf8ByteLength,
} from "../../domain/canonical.js";
import type { BackupMetadata } from "../../domain/models.js";
import {
  canonicalizeSnapshot,
  type DomainSnapshotV1,
  type SerializationLimits,
  validateDomainSnapshot,
} from "../../domain/serialization/snapshot.js";
import { PersistenceError } from "../errors/persistence-error.js";
import type { ChecksumProvider } from "../ports/checksum-provider.js";
import type {
  BackupFileStore,
  StoredBackupFile,
} from "../ports/backup-file-store.js";
import type { DomainRepository } from "../ports/domain-repository.js";

export const PORTABLE_BACKUP_FORMAT = "AHORRO_PERSONAL_BACKUP";
export const PORTABLE_BACKUP_ENVELOPE_VERSION = 1;
export const GROSS_PROJECTION_WARNING =
  "La proyección muestra valores brutos estimados. No incluye retenciones, impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor real puede ser menor.";

export const DEFAULT_PORTABLE_BACKUP_LIMITS: SerializationLimits = {
  maximumBytes: 10 * 1024 * 1024,
  maximumDepth: 20,
  maximumGoals: 100,
  maximumMovements: 10_000,
  maximumRatePeriods: 1_000,
};

const backupEnvelopeSchema = z
  .object({
    format: z.literal(PORTABLE_BACKUP_FORMAT),
    envelopeVersion: z.literal(PORTABLE_BACKUP_ENVELOPE_VERSION),
    disclaimer: z.literal(GROSS_PROJECTION_WARNING),
    checksum: z
      .object({
        algorithm: z.literal("SHA-256"),
        value: z.string().regex(/^[a-f0-9]{64}$/),
        scope: z.literal("CANONICAL_SNAPSHOT_JSON"),
      })
      .strict(),
    snapshot: z.unknown(),
  })
  .strict();

export interface BackupClock {
  now(): string;
}

export interface BackupIdGenerator {
  nextId(): string;
}

export interface BackupServiceOptions {
  readonly appVersion: string;
  readonly rulesVersion: string;
  readonly limits?: SerializationLimits;
}

export interface ImportPreview {
  readonly confirmationToken: string;
  readonly sourceFileName: string;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly goalCount: number;
  readonly movementCount: number;
  readonly dateRangeStart?: string;
  readonly dateRangeEnd?: string;
  readonly checksumVerified: true;
  readonly fileSizeBytes: number;
  readonly mode: "FULL_REPLACE";
  readonly confirmationRequired: true;
  readonly currentStateWillBeReplaced: boolean;
}

export interface ImportReplacementResult {
  readonly importedGoalCount: number;
  readonly importedMovementCount: number;
  readonly rollbackBackup?: StoredBackupFile;
}

interface PendingImport {
  readonly snapshot: DomainSnapshotV1;
  readonly sourceFileName: string;
  readonly fileSizeBytes: number;
  readonly checksum: string;
  readonly dateRangeStart?: string;
  readonly dateRangeEnd?: string;
}

interface DateRange {
  readonly start?: string;
  readonly end?: string;
}

function calculateDateRange(snapshot: DomainSnapshotV1): DateRange {
  const dates: string[] = [];
  for (const goal of snapshot.goals) {
    if (goal.startDate !== undefined) dates.push(goal.startDate);
    if (goal.targetDate !== undefined) dates.push(goal.targetDate);
  }
  for (const movement of snapshot.movements) {
    dates.push(movement.effectiveDate);
  }
  for (const period of snapshot.ratePeriods) {
    dates.push(period.startDate);
    if (period.endDate !== undefined) dates.push(period.endDate);
  }
  for (const close of snapshot.closes) {
    dates.push(close.periodStart, close.periodEnd);
  }
  dates.sort();
  const first = dates[0];
  const last = dates.at(-1);
  return {
    ...(first === undefined ? {} : { start: first }),
    ...(last === undefined ? {} : { end: last }),
  };
}

function fileDate(utcInstant: string): string {
  return utcInstant.replaceAll("-", "").replaceAll(":", "").replace(".000Z", "Z");
}

function snapshotHeader(
  options: BackupServiceOptions,
  exportedAt: string,
): {
  readonly appVersion: string;
  readonly rulesVersion: string;
  readonly exportedAt: string;
} {
  return {
    appVersion: options.appVersion,
    rulesVersion: options.rulesVersion,
    exportedAt,
  };
}

export class BackupService {
  readonly #repository: DomainRepository;
  readonly #files: BackupFileStore;
  readonly #checksums: ChecksumProvider;
  readonly #clock: BackupClock;
  readonly #ids: BackupIdGenerator;
  readonly #options: BackupServiceOptions;
  readonly #limits: SerializationLimits;
  readonly #pendingImports = new Map<string, PendingImport>();

  public constructor(
    repository: DomainRepository,
    files: BackupFileStore,
    checksums: ChecksumProvider,
    clock: BackupClock,
    ids: BackupIdGenerator,
    options: BackupServiceOptions,
  ) {
    this.#repository = repository;
    this.#files = files;
    this.#checksums = checksums;
    this.#clock = clock;
    this.#ids = ids;
    this.#options = options;
    this.#limits = options.limits ?? DEFAULT_PORTABLE_BACKUP_LIMITS;
  }

  async #createEnvelope(snapshot: DomainSnapshotV1): Promise<{
    readonly contents: string;
    readonly checksum: string;
  }> {
    const canonical = canonicalizeSnapshot(snapshot);
    const snapshotJson = stableStringify(canonical);
    const checksum = await this.#checksums.sha256Hex(snapshotJson);
    const contents = stableStringify({
      format: PORTABLE_BACKUP_FORMAT,
      envelopeVersion: PORTABLE_BACKUP_ENVELOPE_VERSION,
      disclaimer: GROSS_PROJECTION_WARNING,
      checksum: {
        algorithm: "SHA-256",
        value: checksum,
        scope: "CANONICAL_SNAPSHOT_JSON",
      },
      snapshot: canonical,
    });
    if (utf8ByteLength(contents) > this.#limits.maximumBytes) {
      throw new PersistenceError(
        "BACKUP_FILE_TOO_LARGE",
        "La copia excede el tamaño permitido.",
      );
    }
    return { contents, checksum };
  }

  #metadata(
    operation: BackupMetadata["operation"],
    snapshot: DomainSnapshotV1,
    checksum: string,
    fileSizeBytes: number,
    sourceFileName: string,
    now: string,
    rollbackBackupId?: string,
  ): BackupMetadata {
    const range = calculateDateRange(snapshot);
    return {
      id: this.#ids.nextId(),
      operation,
      schemaVersion: snapshot.schemaVersion,
      appVersion: snapshot.appVersion,
      rulesVersion: snapshot.rulesVersion,
      createdAt: now,
      ...(operation === "EXPORT" || operation === "AUTO_BACKUP"
        ? { exportedAt: now }
        : {}),
      ...(operation === "IMPORT_REPLACE" ? { importedAt: now } : {}),
      fileSizeBytes,
      checksumAlgorithm: "SHA-256",
      checksum,
      goalCount: snapshot.goals.length,
      movementCount: snapshot.movements.length,
      ...(range.start === undefined ? {} : { dateRangeStart: range.start }),
      ...(range.end === undefined ? {} : { dateRangeEnd: range.end }),
      sourceFileName,
      result: "SUCCESS",
      ...(rollbackBackupId === undefined ? {} : { rollbackBackupId }),
    };
  }

  public async exportPortableBackup(): Promise<StoredBackupFile> {
    const now = this.#clock.now();
    const snapshot = await this.#repository.loadSnapshot(
      snapshotHeader(this.#options, now),
    );
    const envelope = await this.#createEnvelope(snapshot);
    const displayName =
      `ahorro-personal-${fileDate(now)}-${this.#ids.nextId()}.json`;
    const stored = await this.#files.writeAtomic(
      displayName,
      envelope.contents,
    );
    const metadata = this.#metadata(
      "EXPORT",
      snapshot,
      envelope.checksum,
      stored.sizeBytes,
      stored.displayName,
      now,
    );
    await this.#repository.appendBackupMetadata(metadata);
    return stored;
  }

  async #parseEnvelope(contents: string): Promise<{
    readonly snapshot: DomainSnapshotV1;
    readonly checksum: string;
  }> {
    if (utf8ByteLength(contents) > this.#limits.maximumBytes) {
      throw new PersistenceError(
        "BACKUP_FILE_TOO_LARGE",
        "La copia excede el tamaño permitido.",
      );
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(contents);
    } catch {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "El archivo no contiene JSON válido.",
      );
    }
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "envelopeVersion" in candidate &&
      (candidate as { envelopeVersion?: unknown }).envelopeVersion !==
        PORTABLE_BACKUP_ENVELOPE_VERSION
    ) {
      throw new PersistenceError(
        "DATABASE_INCOMPATIBLE",
        "La versión de la copia no es compatible.",
      );
    }
    const parsedEnvelope = backupEnvelopeSchema.safeParse(candidate);
    if (!parsedEnvelope.success) {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "El archivo no cumple el formato de copia portable.",
      );
    }
    let snapshot: DomainSnapshotV1;
    try {
      snapshot = canonicalizeSnapshot(
        validateDomainSnapshot(parsedEnvelope.data.snapshot, this.#limits),
      );
    } catch {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "Los datos de la copia no superaron la validación.",
      );
    }
    const checksum = await this.#checksums.sha256Hex(
      stableStringify(snapshot),
    );
    if (checksum !== parsedEnvelope.data.checksum.value) {
      throw new PersistenceError(
        "BACKUP_CHECKSUM_MISMATCH",
        "La copia parece dañada o modificada.",
      );
    }
    return { snapshot, checksum };
  }

  public async previewImport(reference: string): Promise<ImportPreview> {
    const selected = await this.#files.readSelected(reference);
    const { snapshot, checksum } = await this.#parseEnvelope(selected.contents);
    const token = this.#ids.nextId();
    const range = calculateDateRange(snapshot);
    const plan: PendingImport = {
      snapshot,
      sourceFileName: selected.displayName,
      fileSizeBytes: selected.sizeBytes,
      checksum,
      ...(range.start === undefined ? {} : { dateRangeStart: range.start }),
      ...(range.end === undefined ? {} : { dateRangeEnd: range.end }),
    };
    const currentStateWillBeReplaced =
      await this.#repository.hasDomainState();
    if (currentStateWillBeReplaced) {
      await this.#repository.appendBackupMetadata(
        this.#metadata(
          "IMPORT_PREVIEW",
          snapshot,
          checksum,
          selected.sizeBytes,
          selected.displayName,
          this.#clock.now(),
        ),
      );
    }
    this.#pendingImports.set(token, plan);
    return {
      confirmationToken: token,
      sourceFileName: selected.displayName,
      schemaVersion: snapshot.schemaVersion,
      appVersion: snapshot.appVersion,
      exportedAt: snapshot.exportedAt,
      goalCount: snapshot.goals.length,
      movementCount: snapshot.movements.length,
      ...(range.start === undefined ? {} : { dateRangeStart: range.start }),
      ...(range.end === undefined ? {} : { dateRangeEnd: range.end }),
      checksumVerified: true,
      fileSizeBytes: selected.sizeBytes,
      mode: "FULL_REPLACE",
      confirmationRequired: true,
      currentStateWillBeReplaced,
    };
  }

  public async replaceFromPreview(
    confirmationToken: string,
    confirmed: boolean,
  ): Promise<ImportReplacementResult> {
    if (!confirmed) {
      throw new PersistenceError(
        "IMPORT_CONFIRMATION_REQUIRED",
        "La importación requiere confirmación explícita.",
      );
    }
    const pending = this.#pendingImports.get(confirmationToken);
    if (pending === undefined) {
      throw new PersistenceError(
        "IMPORT_PREVIEW_EXPIRED",
        "La vista previa ya no está disponible. Seleccione la copia nuevamente.",
      );
    }
    this.#pendingImports.delete(confirmationToken);
    const now = this.#clock.now();
    let rollbackBackup: StoredBackupFile | undefined;
    let rollbackMetadata: BackupMetadata | undefined;
    if (await this.#repository.hasDomainState()) {
      const current = await this.#repository.loadSnapshot(
        snapshotHeader(this.#options, now),
      );
      const rollbackEnvelope = await this.#createEnvelope(current);
      const rollbackName =
        `ahorro-personal-respaldo-${fileDate(now)}-${this.#ids.nextId()}.json`;
      rollbackBackup = await this.#files.writeAtomic(
        rollbackName,
        rollbackEnvelope.contents,
      );
      rollbackMetadata = this.#metadata(
        "AUTO_BACKUP",
        current,
        rollbackEnvelope.checksum,
        rollbackBackup.sizeBytes,
        rollbackBackup.displayName,
        now,
      );
    }
    const importMetadata = this.#metadata(
      "IMPORT_REPLACE",
      pending.snapshot,
      pending.checksum,
      pending.fileSizeBytes,
      pending.sourceFileName,
      now,
      rollbackMetadata?.id,
    );
    await this.#repository.replaceSnapshot(pending.snapshot, {
      additionalBackupMetadata: [
        ...(rollbackMetadata === undefined ? [] : [rollbackMetadata]),
        importMetadata,
      ],
    });
    return {
      importedGoalCount: pending.snapshot.goals.length,
      importedMovementCount: pending.snapshot.movements.length,
      ...(rollbackBackup === undefined ? {} : { rollbackBackup }),
    };
  }
}

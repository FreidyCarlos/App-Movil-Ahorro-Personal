import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  BackupService,
  GROSS_PROJECTION_WARNING,
  PORTABLE_BACKUP_FORMAT,
  PersistenceError,
  SQLiteDomainRepository,
  canonicalizeSnapshot,
  initializeDatabase,
  stableStringify,
  type BackupClock,
  type BackupFileStore,
  type BackupIdGenerator,
  type DomainSnapshotV1,
  type SelectedBackupFile,
  type StoredBackupFile,
} from "../src/index.js";
import {
  NodeSha256ChecksumProvider,
  SafeNodeBackupFileStore,
  openNodeSqliteDatabase,
} from "../src/node.js";
import { NOW, id } from "./helpers.js";
import {
  PERSISTENCE_LIMITS,
  persistenceSnapshot,
} from "./persistence-helpers.js";

class FixedClock implements BackupClock {
  public now(): string {
    return NOW;
  }
}

class SequenceIds implements BackupIdGenerator {
  #value: number;

  public constructor(start = 100) {
    this.#value = start;
  }

  public nextId(): string {
    const value = id(this.#value);
    this.#value += 1;
    return value;
  }
}

class FailingWriteStore implements BackupFileStore {
  readonly #delegate: BackupFileStore;

  public constructor(delegate: BackupFileStore) {
    this.#delegate = delegate;
  }

  public async writeAtomic(
    _displayName: string,
    _contents: string,
  ): Promise<StoredBackupFile> {
    throw new PersistenceError(
      "FILE_OPERATION_FAILED",
      "Fallo de espacio simulado.",
    );
  }

  public async readSelected(reference: string): Promise<SelectedBackupFile> {
    return this.#delegate.readSelected(reference);
  }

  public async deleteStored(reference: string): Promise<void> {
    return this.#delegate.deleteStored(reference);
  }
}

class CorruptingWriteStore implements BackupFileStore {
  readonly #delegate: BackupFileStore;
  public lastWrittenReference: string | undefined;

  public constructor(delegate: BackupFileStore) {
    this.#delegate = delegate;
  }

  public async writeAtomic(
    displayName: string,
    contents: string,
  ): Promise<StoredBackupFile> {
    const stored = await this.#delegate.writeAtomic(
      displayName,
      contents.replace("La proyección", "Xa proyección"),
    );
    this.lastWrittenReference = stored.reference;
    return stored;
  }

  public async readSelected(reference: string): Promise<SelectedBackupFile> {
    return this.#delegate.readSelected(reference);
  }

  public async deleteStored(reference: string): Promise<void> {
    return this.#delegate.deleteStored(reference);
  }
}

interface TestEnvironment {
  readonly root: string;
  readonly databasePath: string;
  readonly backupDirectory: string;
  readonly database: ReturnType<typeof openNodeSqliteDatabase>;
  readonly repository: SQLiteDomainRepository;
  readonly files: SafeNodeBackupFileStore;
  readonly checksum: NodeSha256ChecksumProvider;
}

async function environment(
  maximumBytes = PERSISTENCE_LIMITS.maximumBytes,
): Promise<TestEnvironment> {
  const root = await mkdtemp(join(tmpdir(), "ahorro-backup-"));
  const databasePath = join(root, "app.db");
  const backupDirectory = join(root, "backups");
  await mkdir(backupDirectory, { recursive: true });
  const database = openNodeSqliteDatabase(databasePath);
  await initializeDatabase(database, NOW);
  return {
    root,
    databasePath,
    backupDirectory,
    database,
    repository: new SQLiteDomainRepository(database, {
      ...PERSISTENCE_LIMITS,
      maximumBytes,
    }),
    files: new SafeNodeBackupFileStore({
      exportDirectory: backupDirectory,
      allowedImportDirectories: [backupDirectory],
      maximumBytes,
    }),
    checksum: new NodeSha256ChecksumProvider(),
  };
}

function service(
  testEnvironment: TestEnvironment,
  files: BackupFileStore = testEnvironment.files,
  ids: BackupIdGenerator = new SequenceIds(),
): BackupService {
  return new BackupService(
    testEnvironment.repository,
    files,
    testEnvironment.checksum,
    new FixedClock(),
    ids,
    {
      appVersion: "0.1.0",
      rulesVersion: "financial-rules-1",
      limits: PERSISTENCE_LIMITS,
    },
  );
}

async function closeAndRemove(testEnvironment: TestEnvironment): Promise<void> {
  testEnvironment.database.close();
  await rm(testEnvironment.root, { recursive: true, force: true });
}

async function writeEnvelope(
  testEnvironment: TestEnvironment,
  snapshot: DomainSnapshotV1,
  displayName: string,
): Promise<StoredBackupFile> {
  const canonical = canonicalizeSnapshot(snapshot);
  const checksum = await testEnvironment.checksum.sha256Hex(
    stableStringify(canonical),
  );
  return testEnvironment.files.writeAtomic(
    displayName,
    stableStringify({
      format: PORTABLE_BACKUP_FORMAT,
      envelopeVersion: 1,
      disclaimer: GROSS_PROJECTION_WARNING,
      checksum: {
        algorithm: "SHA-256",
        value: checksum,
        scope: "CANONICAL_SNAPSHOT_JSON",
      },
      snapshot: canonical,
    }),
  );
}

describe("exportación e importación portable", () => {
  it("importa en una base vacía sin inventar un respaldo anterior", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      const imported = await writeEnvelope(
        testEnvironment,
        persistenceSnapshot("Primera importación"),
        "first-import.json",
      );
      const preview = await backupService.previewImport(imported.reference);
      const result = await backupService.replaceFromPreview(
        preview.confirmationToken,
        true,
      );
      expect(preview).toMatchObject({
        mode: "FULL_REPLACE",
        confirmationRequired: true,
        currentStateWillBeReplaced: false,
      });
      expect(result.rollbackBackup).toBeUndefined();
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Primera importación",
      );
      const state = await testEnvironment.repository.loadSnapshot({
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
        exportedAt: NOW,
      });
      expect(state.backupMetadata.map(({ operation }) => operation)).toEqual([
        "IMPORT_REPLACE",
      ]);
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("exporta, resume, respalda y reemplaza todo de forma verificable", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Estado exportado"),
      );
      const exported = await backupService.exportPortableBackup();
      expect(exported.displayName).toMatch(/^ahorro-personal-.*\.json$/);
      expect(exported.sizeBytes).toBeGreaterThan(0);
      expect(
        JSON.parse(await readFile(exported.reference, "utf8")).disclaimer,
      ).toBe(GROSS_PROJECTION_WARNING);

      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Estado antes de importar"),
      );
      const preview = await backupService.previewImport(exported.reference);
      expect(preview).toMatchObject({
        goalCount: 1,
        movementCount: 1,
        checksumVerified: true,
        schemaVersion: 1,
        dateRangeStart: "2026-02-01",
        dateRangeEnd: "2026-02-01",
        mode: "FULL_REPLACE",
        confirmationRequired: true,
        currentStateWillBeReplaced: true,
      });
      const result = await backupService.replaceFromPreview(
        preview.confirmationToken,
        true,
      );
      expect(result).toMatchObject({
        importedGoalCount: 1,
        importedMovementCount: 1,
      });
      expect(result.rollbackBackup).toBeDefined();
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Estado exportado",
      );
      const importedState = await testEnvironment.repository.loadSnapshot({
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
        exportedAt: NOW,
      });
      expect(importedState.backupMetadata.map(({ operation }) => operation))
        .toEqual(["AUTO_BACKUP", "IMPORT_REPLACE"]);

      const rollbackPreview = await backupService.previewImport(
        result.rollbackBackup!.reference,
      );
      expect(rollbackPreview.goalCount).toBe(1);
      expect(
        JSON.parse(
          (await testEnvironment.files.readSelected(
            result.rollbackBackup!.reference,
          )).contents,
        ).snapshot.goals[0].name,
      ).toBe("Estado antes de importar");
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("exige confirmación y descarta tokens consumidos", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Original"),
      );
      const exported = await backupService.exportPortableBackup();
      const preview = await backupService.previewImport(exported.reference);
      await expect(
        backupService.replaceFromPreview(preview.confirmationToken, false),
      ).rejects.toMatchObject({ code: "IMPORT_CONFIRMATION_REQUIRED" });
      await backupService.replaceFromPreview(preview.confirmationToken, true);
      await expect(
        backupService.replaceFromPreview(preview.confirmationToken, true),
      ).rejects.toMatchObject({ code: "IMPORT_PREVIEW_EXPIRED" });
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("rechaza checksum alterado y versión futura antes de escribir", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Original"),
      );
      const exported = await backupService.exportPortableBackup();
      const originalContents = await readFile(exported.reference, "utf8");
      const tampered = originalContents.replace(
        "Original",
        "Alterado",
      );
      const tamperedFile = await testEnvironment.files.writeAtomic(
        "tampered.json",
        tampered,
      );
      await expect(
        backupService.previewImport(tamperedFile.reference),
      ).rejects.toMatchObject({ code: "BACKUP_CHECKSUM_MISMATCH" });

      const future = await testEnvironment.files.writeAtomic(
        "future.json",
        JSON.stringify({
          format: PORTABLE_BACKUP_FORMAT,
          envelopeVersion: 99,
        }),
      );
      await expect(
        backupService.previewImport(future.reference),
      ).rejects.toMatchObject({ code: "DATABASE_INCOMPATIBLE" });
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Original",
      );
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("rechaza JSON corrupto y sobres con estructura desconocida", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      const corrupt = await testEnvironment.files.writeAtomic(
        "corrupt.json",
        "{not-json",
      );
      const unknown = await testEnvironment.files.writeAtomic(
        "unknown.json",
        JSON.stringify({
          format: PORTABLE_BACKUP_FORMAT,
          envelopeVersion: 1,
          unexpected: true,
        }),
      );
      await expect(
        backupService.previewImport(corrupt.reference),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      await expect(
        backupService.previewImport(unknown.reference),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      expect(await testEnvironment.repository.hasDomainState()).toBe(false);
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("rechaza claves JSON duplicadas aunque usen escapes equivalentes", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Sin ambigüedad"),
      );
      const exported = await backupService.exportPortableBackup();
      const contents = await readFile(exported.reference, "utf8");
      const duplicated = contents.replace(
        `"format":"${PORTABLE_BACKUP_FORMAT}"`,
        `"format":"${PORTABLE_BACKUP_FORMAT}","\\u0066ormat":"${PORTABLE_BACKUP_FORMAT}"`,
      );
      const file = await testEnvironment.files.writeAtomic(
        "duplicate-key.json",
        duplicated,
      );
      await expect(
        backupService.previewImport(file.reference),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Sin ambigüedad",
      );
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("mantiene una sola vista previa vigente para acotar memoria y reintentos", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Primera"),
      );
      const firstFile = await backupService.exportPortableBackup();
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Segunda"),
      );
      const secondFile = await backupService.exportPortableBackup();
      const first = await backupService.previewImport(firstFile.reference);
      const second = await backupService.previewImport(secondFile.reference);

      await expect(
        backupService.replaceFromPreview(first.confirmationToken, true),
      ).rejects.toMatchObject({ code: "IMPORT_PREVIEW_EXPIRED" });
      await expect(
        backupService.replaceFromPreview(second.confirmationToken, false),
      ).rejects.toMatchObject({ code: "IMPORT_CONFIRMATION_REQUIRED" });
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("no modifica SQLite cuando falla el respaldo automático", async () => {
    const testEnvironment = await environment();
    try {
      const workingService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Estado conservado"),
      );
      const exported = await workingService.exportPortableBackup();
      const failingService = service(
        testEnvironment,
        new FailingWriteStore(testEnvironment.files),
        new SequenceIds(500),
      );
      const preview = await failingService.previewImport(exported.reference);
      await expect(
        failingService.replaceFromPreview(preview.confirmationToken, true),
      ).rejects.toMatchObject({ code: "FILE_OPERATION_FAILED" });
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Estado conservado",
      );
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("no reemplaza SQLite si el respaldo escrito no supera la verificación", async () => {
    const testEnvironment = await environment();
    try {
      const workingService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Estado verificable"),
      );
      const imported = await workingService.exportPortableBackup();
      const corruptingStore = new CorruptingWriteStore(testEnvironment.files);
      const corruptingService = service(
        testEnvironment,
        corruptingStore,
        new SequenceIds(700),
      );
      const preview = await corruptingService.previewImport(imported.reference);
      await expect(
        corruptingService.replaceFromPreview(preview.confirmationToken, true),
      ).rejects.toMatchObject({ code: "FILE_OPERATION_FAILED" });
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Estado verificable",
      );
      await expect(
        testEnvironment.files.readSelected(corruptingStore.lastWrittenReference!),
      ).rejects.toMatchObject({ code: "FILE_OPERATION_FAILED" });
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("revierte SQLite si falla una escritura después de confirmar", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Estado seguro"),
      );
      const imported = await writeEnvelope(
        testEnvironment,
        persistenceSnapshot("Importación no confirmada"),
        "write-failure.json",
      );
      const preview = await backupService.previewImport(imported.reference);
      await testEnvironment.database.exec(
        `CREATE TRIGGER simulate_import_failure
         BEFORE INSERT ON goals
         BEGIN
           SELECT RAISE(ABORT, 'simulated import failure');
         END`,
      );
      await expect(
        backupService.replaceFromPreview(preview.confirmationToken, true),
      ).rejects.toMatchObject({ code: "DATABASE_CONSTRAINT" });
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Estado seguro",
      );
      expect(await testEnvironment.repository.listMovements(id(1))).toHaveLength(1);
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("rechaza movimientos duplicados durante la vista previa", async () => {
    const testEnvironment = await environment();
    try {
      const backupService = service(testEnvironment);
      await testEnvironment.repository.replaceSnapshot(
        persistenceSnapshot("Estado seguro"),
      );
      const duplicate = persistenceSnapshot("Importación duplicada");
      const secondMovement = {
        ...duplicate.movements[0]!,
        id: id(7),
        currentRevisionId: id(8),
      };
      const snapshotWithDuplicateKey: DomainSnapshotV1 = {
        ...duplicate,
        movements: [...duplicate.movements, secondMovement],
        movementRevisions: [
          ...duplicate.movementRevisions,
          {
            id: id(8),
            movementId: id(7),
            revisionNumber: 1,
            snapshot: { ...secondMovement },
            reason: "Registro inicial",
            createdAt: NOW,
          },
        ],
      };
      const imported = await writeEnvelope(
        testEnvironment,
        snapshotWithDuplicateKey,
        "duplicate.json",
      );
      await expect(
        backupService.previewImport(imported.reference),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      expect((await testEnvironment.repository.listGoals())[0]?.name).toBe(
        "Estado seguro",
      );
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });
});

describe("controles del adaptador de archivos", () => {
  it("rechaza extensión engañosa, ubicación no autorizada y tamaño previo", async () => {
    const testEnvironment = await environment(256);
    try {
      const textFile = join(testEnvironment.backupDirectory, "fake.txt");
      const largeFile = join(testEnvironment.backupDirectory, "large.json");
      const outsideFile = join(testEnvironment.root, "outside.json");
      await writeFile(textFile, "{}", "utf8");
      await writeFile(largeFile, "x".repeat(257), "utf8");
      await writeFile(outsideFile, "{}", "utf8");
      await expect(
        testEnvironment.files.readSelected(textFile),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      await expect(
        testEnvironment.files.readSelected(largeFile),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_TOO_LARGE" });
      await expect(
        testEnvironment.files.readSelected(outsideFile),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      await expect(
        testEnvironment.files.writeAtomic(
          "too-large.json",
          "x".repeat(257),
        ),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_TOO_LARGE" });
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });

  it("rechaza nombres inseguros, duplicados y selecciones que son carpetas", async () => {
    const testEnvironment = await environment();
    try {
      expect(
        () =>
          new SafeNodeBackupFileStore({
            exportDirectory: testEnvironment.backupDirectory,
            allowedImportDirectories: [testEnvironment.backupDirectory],
            maximumBytes: 0,
          }),
      ).toThrowError(PersistenceError);
      await expect(
        testEnvironment.files.writeAtomic("../escape.json", "{}"),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
      await testEnvironment.files.writeAtomic("same.json", "{}");
      await expect(
        testEnvironment.files.writeAtomic("same.json", "{}"),
      ).rejects.toMatchObject({ code: "FILE_OPERATION_FAILED" });
      const directorySelection = join(
        testEnvironment.backupDirectory,
        "directory.json",
      );
      await mkdir(directorySelection);
      await expect(
        testEnvironment.files.readSelected(directorySelection),
      ).rejects.toMatchObject({ code: "BACKUP_FILE_INVALID" });
    } finally {
      await closeAndRemove(testEnvironment);
    }
  });
});

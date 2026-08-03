import { stableStringify } from "../../domain/canonical.js";
import {
  COP_ROUNDING_POLICY_VERSION,
  DEFAULT_NUMERIC_LIMITS,
  NUMERIC_POLICY_VERSION,
} from "../../domain/decimal.js";
import type {
  DomainRepository,
  DomainStateUpdater,
  SnapshotHeader,
  SnapshotReplaceOptions,
} from "../../application/ports/domain-repository.js";
import type {
  BackupMetadata,
  SavingsGoal,
  SavingsMovement,
} from "../../domain/models.js";
import {
  type DomainSnapshotV1,
  type SerializationLimits,
  DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
  DOMAIN_SNAPSHOT_SCHEMA_VERSION,
  RATE_EQUIVALENCE_POLICY_VERSION,
  canonicalizeSnapshot,
  validateDomainSnapshot,
} from "../../domain/serialization/snapshot.js";
import {
  backupMetadataSchema,
  savingsGoalSchema,
  savingsMovementSchema,
} from "../../domain/validation/schemas.js";
import {
  PersistenceError,
  asPersistenceError,
} from "../../application/errors/persistence-error.js";
import type {
  SqlDatabase,
  SqlParameters,
  SqlPrimitive,
  SqlRow,
} from "../database/sql-database.js";

interface PayloadRow extends SqlRow {
  readonly payload_json: string;
}

interface CountRow extends SqlRow {
  readonly count: number;
}

interface DomainStateCountRow extends SqlRow {
  readonly settings_count: number;
  readonly other_count: number;
}

interface IndexedRow extends SqlRow {
  readonly id: string;
}

interface GoalRow extends PayloadRow {
  readonly id: string;
  readonly active_configuration_id: string;
  readonly status: string;
  readonly sort_order: number;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

interface MovementRow extends PayloadRow {
  readonly id: string;
  readonly goal_id: string;
  readonly type: string;
  readonly effective_date: string;
  readonly recorded_at: string;
  readonly status: string;
  readonly deduplication_key: string | null;
  readonly current_revision_id: string;
  readonly updated_at: string;
}

function parsePayload<T>(row: PayloadRow, label: string): T {
  try {
    return JSON.parse(row.payload_json) as T;
  } catch {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      `La base contiene un registro ${label} que no puede recuperarse.`,
    );
  }
}

function parseGoalRow(row: GoalRow): SavingsGoal {
  const parsed = savingsGoalSchema.safeParse(parsePayload(row, "de meta"));
  if (!parsed.success) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "La meta almacenada no supera la validación.",
    );
  }
  const goal = parsed.data as SavingsGoal;
  if (
    row.id !== goal.id ||
    row.active_configuration_id !== goal.activeConfigurationId ||
    row.status !== goal.status ||
    row.sort_order !== goal.sortOrder ||
    row.updated_at !== goal.updatedAt ||
    row.deleted_at !== (goal.deletedAt ?? null)
  ) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "Las columnas de la meta no coinciden con su carga validada.",
    );
  }
  return goal;
}

function parseMovementRow(row: MovementRow): SavingsMovement {
  const parsed = savingsMovementSchema.safeParse(
    parsePayload(row, "de movimiento"),
  );
  if (!parsed.success) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "El movimiento almacenado no supera la validación.",
    );
  }
  const movement = parsed.data as SavingsMovement;
  if (
    row.id !== movement.id ||
    row.goal_id !== movement.goalId ||
    row.type !== movement.type ||
    row.effective_date !== movement.effectiveDate ||
    row.recorded_at !== movement.recordedAt ||
    row.status !== movement.status ||
    row.deduplication_key !== (movement.deduplicationKey ?? null) ||
    row.current_revision_id !== movement.currentRevisionId ||
    row.updated_at !== movement.updatedAt
  ) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "Las columnas del movimiento no coinciden con su carga validada.",
    );
  }
  return movement;
}

async function readPayloads<T>(
  database: SqlDatabase,
  table: string,
  label: string,
): Promise<T[]> {
  const allowedTables = new Set([
    "goals",
    "plan_configurations",
    "simple_configurations",
    "rate_definitions",
    "rate_periods",
    "product_configurations",
    "movements",
    "movement_revisions",
    "actual_period_closes",
    "backup_metadata",
  ]);
  if (!allowedTables.has(table)) {
    throw new PersistenceError(
      "DATABASE_OPERATION_FAILED",
      "Se solicitó una colección de persistencia desconocida.",
    );
  }
  const rows = await database.all<PayloadRow>(
    `SELECT payload_json FROM ${table} ORDER BY id`,
  );
  return rows.map((row) => parsePayload<T>(row, label));
}

async function readSettings(database: SqlDatabase): Promise<unknown> {
  const row = await database.get<PayloadRow>(
    "SELECT payload_json FROM app_settings WHERE singleton_key = 1",
  );
  if (row === undefined) {
    throw new PersistenceError(
      "DATABASE_NOT_INITIALIZED",
      "La base todavía no contiene la configuración inicial.",
    );
  }
  return parsePayload(row, "de configuración");
}

async function verifyIndexedCollection(
  database: SqlDatabase,
  table: string,
  columns: readonly string[],
  expected: readonly Readonly<Record<string, SqlPrimitive>>[],
): Promise<void> {
  const allowed = new Map<string, readonly string[]>([
    [
      "goals",
      [
        "active_configuration_id",
        "status",
        "sort_order",
        "updated_at",
        "deleted_at",
      ],
    ],
    [
      "plan_configurations",
      [
        "goal_id",
        "revision_number",
        "projection_mode",
        "effective_from",
        "is_active",
        "created_at",
        "supersedes_id",
      ],
    ],
    ["simple_configurations", ["configuration_id"]],
    [
      "rate_definitions",
      [
        "original_type",
        "original_value",
        "canonical_effective_annual_rate",
        "conversion_method",
        "rules_version",
        "created_at",
      ],
    ],
    [
      "product_configurations",
      [
        "configuration_id",
        "product_model",
        "created_at",
        "supersedes_id",
      ],
    ],
    [
      "rate_periods",
      [
        "goal_id",
        "configuration_id",
        "rate_definition_id",
        "purpose",
        "start_date",
        "end_date",
        "created_at",
        "supersedes_id",
      ],
    ],
    [
      "movements",
      [
        "goal_id",
        "type",
        "effective_date",
        "recorded_at",
        "status",
        "deduplication_key",
        "current_revision_id",
        "updated_at",
      ],
    ],
    [
      "movement_revisions",
      [
        "movement_id",
        "revision_number",
        "created_at",
        "supersedes_id",
      ],
    ],
    [
      "actual_period_closes",
      [
        "goal_id",
        "configuration_revision_id",
        "period_start",
        "period_end",
        "status",
        "closed_at",
      ],
    ],
    [
      "backup_metadata",
      ["operation", "created_at", "result", "rollback_backup_id"],
    ],
    ["app_settings", ["singleton_key", "schema_version", "updated_at"]],
  ]);
  const permittedColumns = allowed.get(table);
  if (
    permittedColumns === undefined ||
    columns.length !== permittedColumns.length ||
    columns.some((column, index) => column !== permittedColumns[index])
  ) {
    throw new PersistenceError(
      "DATABASE_OPERATION_FAILED",
      "La verificación solicitó columnas desconocidas.",
    );
  }
  const rows = await database.all<IndexedRow>(
    `SELECT id, ${columns.join(", ")} FROM ${table} ORDER BY id`,
  );
  if (rows.length !== expected.length) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "La cantidad de filas no coincide con el estado reconstruido.",
      { table },
    );
  }
  for (const expectedRow of expected) {
    const row = rows.find((candidate) => candidate.id === expectedRow["id"]);
    if (
      row === undefined ||
      Object.entries(expectedRow).some(
        ([column, value]) => row[column] !== value,
      )
    ) {
      throw new PersistenceError(
        "DATABASE_CORRUPT",
        "Las columnas relacionales no coinciden con su carga validada.",
        { table },
      );
    }
  }
}

async function verifyIndexedState(
  database: SqlDatabase,
  snapshot: DomainSnapshotV1,
): Promise<void> {
  await verifyIndexedCollection(
    database,
    "goals",
    [
      "active_configuration_id",
      "status",
      "sort_order",
      "updated_at",
      "deleted_at",
    ],
    snapshot.goals.map((goal) => ({
      id: goal.id,
      active_configuration_id: goal.activeConfigurationId,
      status: goal.status,
      sort_order: goal.sortOrder,
      updated_at: goal.updatedAt,
      deleted_at: goal.deletedAt ?? null,
    })),
  );
  await verifyIndexedCollection(
    database,
    "plan_configurations",
    [
      "goal_id",
      "revision_number",
      "projection_mode",
      "effective_from",
      "is_active",
      "created_at",
      "supersedes_id",
    ],
    snapshot.configurations.map((configuration) => ({
      id: configuration.id,
      goal_id: configuration.goalId,
      revision_number: configuration.revisionNumber,
      projection_mode: configuration.projectionMode,
      effective_from: configuration.effectiveFrom,
      is_active: configuration.isActive ? 1 : 0,
      created_at: configuration.createdAt,
      supersedes_id: configuration.supersedesId ?? null,
    })),
  );
  await verifyIndexedCollection(
    database,
    "simple_configurations",
    ["configuration_id"],
    snapshot.simpleConfigurations.map((simple) => ({
      id: simple.id,
      configuration_id: simple.configurationId,
    })),
  );
  await verifyIndexedCollection(
    database,
    "rate_definitions",
    [
      "original_type",
      "original_value",
      "canonical_effective_annual_rate",
      "conversion_method",
      "rules_version",
      "created_at",
    ],
    snapshot.rateDefinitions.map((rate) => ({
      id: rate.id,
      original_type: rate.originalType,
      original_value: rate.originalValue,
      canonical_effective_annual_rate:
        rate.canonicalEffectiveAnnualRate ?? null,
      conversion_method: rate.conversionMethod ?? null,
      rules_version: rate.rulesVersion,
      created_at: rate.createdAt,
    })),
  );
  await verifyIndexedCollection(
    database,
    "product_configurations",
    ["configuration_id", "product_model", "created_at", "supersedes_id"],
    snapshot.productConfigurations.map((product) => ({
      id: product.id,
      configuration_id: product.configurationId,
      product_model: product.productModel,
      created_at: product.createdAt,
      supersedes_id: product.supersedesId ?? null,
    })),
  );
  await verifyIndexedCollection(
    database,
    "rate_periods",
    [
      "goal_id",
      "configuration_id",
      "rate_definition_id",
      "purpose",
      "start_date",
      "end_date",
      "created_at",
      "supersedes_id",
    ],
    snapshot.ratePeriods.map((period) => ({
      id: period.id,
      goal_id: period.goalId,
      configuration_id: period.configurationId,
      rate_definition_id: period.rateDefinitionId,
      purpose: period.purpose,
      start_date: period.startDate,
      end_date: period.endDate ?? null,
      created_at: period.createdAt,
      supersedes_id: period.supersedesId ?? null,
    })),
  );
  await verifyIndexedCollection(
    database,
    "movements",
    [
      "goal_id",
      "type",
      "effective_date",
      "recorded_at",
      "status",
      "deduplication_key",
      "current_revision_id",
      "updated_at",
    ],
    snapshot.movements.map((movement) => ({
      id: movement.id,
      goal_id: movement.goalId,
      type: movement.type,
      effective_date: movement.effectiveDate,
      recorded_at: movement.recordedAt,
      status: movement.status,
      deduplication_key: movement.deduplicationKey ?? null,
      current_revision_id: movement.currentRevisionId,
      updated_at: movement.updatedAt,
    })),
  );
  await verifyIndexedCollection(
    database,
    "movement_revisions",
    ["movement_id", "revision_number", "created_at", "supersedes_id"],
    snapshot.movementRevisions.map((revision) => ({
      id: revision.id,
      movement_id: revision.movementId,
      revision_number: revision.revisionNumber,
      created_at: revision.createdAt,
      supersedes_id: revision.supersedesId ?? null,
    })),
  );
  await verifyIndexedCollection(
    database,
    "actual_period_closes",
    [
      "goal_id",
      "configuration_revision_id",
      "period_start",
      "period_end",
      "status",
      "closed_at",
    ],
    snapshot.closes.map((close) => ({
      id: close.id,
      goal_id: close.goalId,
      configuration_revision_id: close.configurationRevisionId,
      period_start: close.periodStart,
      period_end: close.periodEnd,
      status: close.status,
      closed_at: close.closedAt,
    })),
  );
  await verifyIndexedCollection(
    database,
    "backup_metadata",
    ["operation", "created_at", "result", "rollback_backup_id"],
    snapshot.backupMetadata.map((metadata) => ({
      id: metadata.id,
      operation: metadata.operation,
      created_at: metadata.createdAt,
      result: metadata.result,
      rollback_backup_id: metadata.rollbackBackupId ?? null,
    })),
  );
  await verifyIndexedCollection(
    database,
    "app_settings",
    ["singleton_key", "schema_version", "updated_at"],
    [
      {
        id: snapshot.settings.id,
        singleton_key: 1,
        schema_version: snapshot.settings.schemaVersion,
        updated_at: snapshot.settings.updatedAt,
      },
    ],
  );
}

async function loadSnapshotFrom(
  database: SqlDatabase,
  header: SnapshotHeader,
  limits: SerializationLimits,
): Promise<DomainSnapshotV1> {
  const candidate = {
    schemaVersion: DOMAIN_SNAPSHOT_SCHEMA_VERSION,
    ...header,
    policyMetadata: {
      numericPolicyVersion: NUMERIC_POLICY_VERSION,
      maximumAmountCop: DEFAULT_NUMERIC_LIMITS.maximumAmount,
      maximumRatePercent: DEFAULT_NUMERIC_LIMITS.maximumRatePercent,
      maximumCanonicalEffectiveAnnualRate:
        DEFAULT_NUMERIC_LIMITS.maximumCanonicalEffectiveAnnualRate,
      roundingPolicyVersion: COP_ROUNDING_POLICY_VERSION,
      rateEquivalencePolicyVersion: RATE_EQUIVALENCE_POLICY_VERSION,
      rateEquivalenceTolerance: DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
    },
    goals: await readPayloads(database, "goals", "de meta"),
    configurations: await readPayloads(
      database,
      "plan_configurations",
      "de configuración",
    ),
    simpleConfigurations: await readPayloads(
      database,
      "simple_configurations",
      "de proyección simple",
    ),
    rateDefinitions: await readPayloads(
      database,
      "rate_definitions",
      "de tasa",
    ),
    ratePeriods: await readPayloads(
      database,
      "rate_periods",
      "de periodo de tasa",
    ),
    productConfigurations: await readPayloads(
      database,
      "product_configurations",
      "de producto",
    ),
    movements: await readPayloads(database, "movements", "de movimiento"),
    movementRevisions: await readPayloads(
      database,
      "movement_revisions",
      "de revisión de movimiento",
    ),
    closes: await readPayloads(
      database,
      "actual_period_closes",
      "de cierre",
    ),
    backupMetadata: await readPayloads(
      database,
      "backup_metadata",
      "de respaldo",
    ),
    settings: await readSettings(database),
  };
  try {
    const validated = canonicalizeSnapshot(
      validateDomainSnapshot(candidate, limits),
    );
    await verifyIndexedState(database, validated);
    return validated;
  } catch (error) {
    throw asPersistenceError(
      error,
      "DATABASE_CORRUPT",
      "Los datos locales no superaron la validación de integridad.",
    );
  }
}

async function clearDomainTables(database: SqlDatabase): Promise<void> {
  for (const table of [
    "actual_period_closes",
    "movement_revisions",
    "movements",
    "rate_periods",
    "product_configurations",
    "simple_configurations",
    "rate_definitions",
    "plan_configurations",
    "goals",
    "backup_metadata",
    "app_settings",
  ]) {
    await database.exec(`DELETE FROM ${table}`);
  }
}

async function insert(
  database: SqlDatabase,
  sql: string,
  parameters: SqlParameters,
): Promise<void> {
  await database.run(sql, parameters);
}

async function insertSnapshot(
  database: SqlDatabase,
  snapshot: DomainSnapshotV1,
): Promise<void> {
  for (const goal of snapshot.goals) {
    await insert(
      database,
      `INSERT INTO goals(
        id, active_configuration_id, status, sort_order, updated_at, deleted_at,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        goal.id,
        goal.activeConfigurationId,
        goal.status,
        goal.sortOrder,
        goal.updatedAt,
        goal.deletedAt ?? null,
        stableStringify(goal),
      ],
    );
  }
  for (const configuration of snapshot.configurations) {
    await insert(
      database,
      `INSERT INTO plan_configurations(
        id, goal_id, revision_number, projection_mode, effective_from,
        is_active, created_at, supersedes_id, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        configuration.id,
        configuration.goalId,
        configuration.revisionNumber,
        configuration.projectionMode,
        configuration.effectiveFrom,
        configuration.isActive ? 1 : 0,
        configuration.createdAt,
        configuration.supersedesId ?? null,
        stableStringify(configuration),
      ],
    );
  }
  for (const simple of snapshot.simpleConfigurations) {
    await insert(
      database,
      `INSERT INTO simple_configurations(id, configuration_id, payload_json)
       VALUES (?, ?, ?)`,
      [simple.id, simple.configurationId, stableStringify(simple)],
    );
  }
  for (const rate of snapshot.rateDefinitions) {
    await insert(
      database,
      `INSERT INTO rate_definitions(
        id, original_type, original_value, canonical_effective_annual_rate,
        conversion_method, rules_version, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rate.id,
        rate.originalType,
        rate.originalValue,
        rate.canonicalEffectiveAnnualRate ?? null,
        rate.conversionMethod ?? null,
        rate.rulesVersion,
        rate.createdAt,
        stableStringify(rate),
      ],
    );
  }
  for (const product of snapshot.productConfigurations) {
    await insert(
      database,
      `INSERT INTO product_configurations(
        id, configuration_id, product_model, created_at, supersedes_id,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.configurationId,
        product.productModel,
        product.createdAt,
        product.supersedesId ?? null,
        stableStringify(product),
      ],
    );
  }
  for (const period of snapshot.ratePeriods) {
    await insert(
      database,
      `INSERT INTO rate_periods(
        id, goal_id, configuration_id, rate_definition_id, purpose,
        start_date, end_date, created_at, supersedes_id, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        period.id,
        period.goalId,
        period.configurationId,
        period.rateDefinitionId,
        period.purpose,
        period.startDate,
        period.endDate ?? null,
        period.createdAt,
        period.supersedesId ?? null,
        stableStringify(period),
      ],
    );
  }
  for (const movement of snapshot.movements) {
    await insert(
      database,
      `INSERT INTO movements(
        id, goal_id, type, effective_date, recorded_at, status,
        deduplication_key, current_revision_id, updated_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movement.id,
        movement.goalId,
        movement.type,
        movement.effectiveDate,
        movement.recordedAt,
        movement.status,
        movement.deduplicationKey ?? null,
        movement.currentRevisionId,
        movement.updatedAt,
        stableStringify(movement),
      ],
    );
  }
  for (const revision of snapshot.movementRevisions) {
    await insert(
      database,
      `INSERT INTO movement_revisions(
        id, movement_id, revision_number, created_at, supersedes_id, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        revision.id,
        revision.movementId,
        revision.revisionNumber,
        revision.createdAt,
        revision.supersedesId ?? null,
        stableStringify(revision),
      ],
    );
  }
  for (const close of snapshot.closes) {
    await insert(
      database,
      `INSERT INTO actual_period_closes(
        id, goal_id, configuration_revision_id, period_start, period_end,
        status, closed_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        close.id,
        close.goalId,
        close.configurationRevisionId,
        close.periodStart,
        close.periodEnd,
        close.status,
        close.closedAt,
        stableStringify(close),
      ],
    );
  }
  for (const metadata of snapshot.backupMetadata) {
    await insertBackupMetadata(database, metadata as BackupMetadata);
  }
  await insert(
    database,
    `INSERT INTO app_settings(
      id, singleton_key, schema_version, updated_at, payload_json
    ) VALUES (?, 1, ?, ?, ?)`,
    [
      snapshot.settings.id,
      snapshot.settings.schemaVersion,
      snapshot.settings.updatedAt,
      stableStringify(snapshot.settings),
    ],
  );
}

async function insertBackupMetadata(
  database: SqlDatabase,
  metadata: BackupMetadata,
): Promise<void> {
  const extended = metadata as BackupMetadata & {
    readonly rollbackBackupId?: string;
  };
  await insert(
    database,
    `INSERT INTO backup_metadata(
      id, operation, created_at, result, rollback_backup_id, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      metadata.id,
      metadata.operation,
      metadata.createdAt,
      metadata.result,
      extended.rollbackBackupId ?? null,
      stableStringify(metadata),
    ],
  );
}

function snapshotsEqual(
  left: DomainSnapshotV1,
  right: DomainSnapshotV1,
): boolean {
  return stableStringify(canonicalizeSnapshot(left)) ===
    stableStringify(canonicalizeSnapshot(right));
}

export class SQLiteDomainRepository implements DomainRepository {
  readonly #database: SqlDatabase;
  readonly #limits: SerializationLimits;

  public constructor(database: SqlDatabase, limits: SerializationLimits) {
    this.#database = database;
    this.#limits = limits;
  }

  public async hasDomainState(): Promise<boolean> {
    const row = await this.#database.get<DomainStateCountRow>(
      `SELECT
        (SELECT COUNT(*) FROM app_settings) AS settings_count,
        (SELECT COUNT(*) FROM goals) +
        (SELECT COUNT(*) FROM plan_configurations) +
        (SELECT COUNT(*) FROM simple_configurations) +
        (SELECT COUNT(*) FROM rate_definitions) +
        (SELECT COUNT(*) FROM rate_periods) +
        (SELECT COUNT(*) FROM product_configurations) +
        (SELECT COUNT(*) FROM movements) +
        (SELECT COUNT(*) FROM movement_revisions) +
        (SELECT COUNT(*) FROM actual_period_closes) +
        (SELECT COUNT(*) FROM backup_metadata) AS other_count`,
    );
    if (row?.settings_count === 1) {
      return true;
    }
    if (row?.settings_count === 0 && row.other_count === 0) {
      return false;
    }
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "La base local está incompleta. El archivo se conservó sin reinicializar.",
    );
  }

  public async loadSnapshot(
    header: SnapshotHeader,
  ): Promise<DomainSnapshotV1> {
    return loadSnapshotFrom(this.#database, header, this.#limits);
  }

  public async replaceSnapshot(
    candidate: unknown,
    options: SnapshotReplaceOptions = {},
  ): Promise<DomainSnapshotV1> {
    const validated = canonicalizeSnapshot(
      validateDomainSnapshot(candidate, this.#limits),
    );
    try {
      return await this.#database.withExclusiveTransaction(
        async (transaction) => {
          await clearDomainTables(transaction);
          await insertSnapshot(transaction, validated);
          const reloaded = await loadSnapshotFrom(
            transaction,
            {
              appVersion: validated.appVersion,
              rulesVersion: validated.rulesVersion,
              exportedAt: validated.exportedAt,
            },
            this.#limits,
          );
          if (!snapshotsEqual(reloaded, validated)) {
            throw new PersistenceError(
              "DATABASE_OPERATION_FAILED",
              "La verificación posterior a la escritura no coincidió.",
            );
          }
          for (const metadata of options.additionalBackupMetadata ?? []) {
            const parsed = backupMetadataSchema.parse(
              metadata,
            ) as BackupMetadata;
            await insertBackupMetadata(transaction, parsed);
          }
          return reloaded;
        },
      );
    } catch (error) {
      throw asPersistenceError(
        error,
        "DATABASE_CONSTRAINT",
        "No fue posible guardar los datos. La operación fue revertida.",
      );
    }
  }

  public async updateSnapshot(
    header: SnapshotHeader,
    updater: DomainStateUpdater,
  ): Promise<DomainSnapshotV1> {
    try {
      return await this.#database.withExclusiveTransaction(
        async (transaction) => {
          const current = await loadSnapshotFrom(
            transaction,
            header,
            this.#limits,
          );
          const validated = canonicalizeSnapshot(
            validateDomainSnapshot(updater(current), this.#limits),
          );
          await clearDomainTables(transaction);
          await insertSnapshot(transaction, validated);
          const reloaded = await loadSnapshotFrom(
            transaction,
            {
              appVersion: validated.appVersion,
              rulesVersion: validated.rulesVersion,
              exportedAt: validated.exportedAt,
            },
            this.#limits,
          );
          if (!snapshotsEqual(reloaded, validated)) {
            throw new PersistenceError(
              "DATABASE_OPERATION_FAILED",
              "La verificación posterior a la escritura no coincidió.",
            );
          }
          return reloaded;
        },
      );
    } catch (error) {
      throw asPersistenceError(
        error,
        "DATABASE_CONSTRAINT",
        "No fue posible actualizar los datos. La operación fue revertida.",
      );
    }
  }

  public async appendBackupMetadata(
    candidate: unknown,
  ): Promise<BackupMetadata> {
    const metadata = backupMetadataSchema.parse(candidate) as BackupMetadata;
    try {
      await this.#database.withExclusiveTransaction(async (transaction) => {
        await insertBackupMetadata(transaction, metadata);
      });
      return metadata;
    } catch (error) {
      throw asPersistenceError(
        error,
        "DATABASE_CONSTRAINT",
        "No fue posible registrar la operación de respaldo.",
      );
    }
  }

  public async getGoal(id: string): Promise<SavingsGoal | undefined> {
    const row = await this.#database.get<GoalRow>(
      `SELECT id, active_configuration_id, status, sort_order, updated_at,
              deleted_at, payload_json
       FROM goals WHERE id = ?`,
      [id],
    );
    if (row === undefined) {
      return undefined;
    }
    return parseGoalRow(row);
  }

  public async listGoals(
    includeDeleted = false,
  ): Promise<readonly SavingsGoal[]> {
    const rows = await this.#database.all<GoalRow>(
      `SELECT id, active_configuration_id, status, sort_order, updated_at,
              deleted_at, payload_json
       FROM goals ORDER BY sort_order, id`,
    );
    const goals = rows.map(parseGoalRow);
    return includeDeleted
      ? goals
      : goals.filter((goal) => goal.deletedAt === undefined);
  }

  public async listMovements(
    goalId: string,
  ): Promise<readonly SavingsMovement[]> {
    const rows = await this.#database.all<MovementRow>(
      `SELECT id, goal_id, type, effective_date, recorded_at, status,
              deduplication_key, current_revision_id, updated_at, payload_json
       FROM movements
       ORDER BY effective_date, recorded_at, id`,
    );
    return rows
      .map(parseMovementRow)
      .filter((movement) => movement.goalId === goalId);
  }
}

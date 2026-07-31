import { nonCryptographicDigest } from "../../domain/canonical.js";
import {
  PersistenceError,
  asPersistenceError,
} from "../../application/errors/persistence-error.js";
import type { SqlDatabase, SqlRow } from "./sql-database.js";

export const DATABASE_APPLICATION_ID = 1_095_258_706;
export const DATABASE_SCHEMA_VERSION = 1;

export interface DatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
  readonly checksum: string;
}

const MIGRATION_001_STATEMENTS = [
  `CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE app_metadata (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    schema_version INTEGER NOT NULL,
    integrity_status TEXT NOT NULL CHECK (integrity_status IN ('HEALTHY', 'BLOCKED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    active_configuration_id TEXT NOT NULL,
    status TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    FOREIGN KEY (active_configuration_id) REFERENCES plan_configurations(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE TABLE plan_configurations (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    revision_number INTEGER NOT NULL CHECK (revision_number > 0),
    projection_mode TEXT NOT NULL CHECK (projection_mode IN ('SIMPLE', 'ADVANCED')),
    effective_from TEXT NOT NULL,
    is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    supersedes_id TEXT,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    UNIQUE (goal_id, revision_number),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (supersedes_id) REFERENCES plan_configurations(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE UNIQUE INDEX one_active_configuration_per_goal
    ON plan_configurations(goal_id) WHERE is_active = 1`,
  `CREATE INDEX plan_configurations_goal_revision
    ON plan_configurations(goal_id, revision_number DESC)`,
  `CREATE TABLE simple_configurations (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    FOREIGN KEY (configuration_id) REFERENCES plan_configurations(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE TABLE rate_definitions (
    id TEXT PRIMARY KEY,
    original_type TEXT NOT NULL,
    original_value TEXT NOT NULL,
    canonical_effective_annual_rate TEXT,
    conversion_method TEXT,
    rules_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760)
  ) STRICT`,
  `CREATE TABLE product_configurations (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL UNIQUE,
    product_model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    supersedes_id TEXT,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    FOREIGN KEY (configuration_id) REFERENCES plan_configurations(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (supersedes_id) REFERENCES product_configurations(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE TABLE rate_periods (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    configuration_id TEXT NOT NULL,
    rate_definition_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL,
    supersedes_id TEXT,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (configuration_id) REFERENCES plan_configurations(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (rate_definition_id) REFERENCES rate_definitions(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (supersedes_id) REFERENCES rate_periods(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE INDEX rate_periods_schedule
    ON rate_periods(configuration_id, purpose, start_date)`,
  `CREATE TABLE movements (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    type TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'VOIDED')),
    deduplication_key TEXT,
    current_revision_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    UNIQUE (goal_id, deduplication_key),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (current_revision_id) REFERENCES movement_revisions(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE INDEX movements_goal_date
    ON movements(goal_id, effective_date, recorded_at, id)`,
  `CREATE TABLE movement_revisions (
    id TEXT PRIMARY KEY,
    movement_id TEXT NOT NULL,
    revision_number INTEGER NOT NULL CHECK (revision_number > 0),
    created_at TEXT NOT NULL,
    supersedes_id TEXT,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    UNIQUE (movement_id, revision_number),
    FOREIGN KEY (movement_id) REFERENCES movements(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (supersedes_id) REFERENCES movement_revisions(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE TABLE actual_period_closes (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    configuration_revision_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('VALID', 'STALE', 'VOIDED')),
    closed_at TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (configuration_revision_id) REFERENCES plan_configurations(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE INDEX closes_goal_period
    ON actual_period_closes(goal_id, period_start, period_end)`,
  `CREATE TABLE backup_metadata (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    created_at TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAILED')),
    rollback_backup_id TEXT,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760),
    FOREIGN KEY (rollback_backup_id) REFERENCES backup_metadata(id)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE INDEX backup_metadata_created
    ON backup_metadata(created_at DESC)`,
  `CREATE TABLE app_settings (
    id TEXT PRIMARY KEY,
    singleton_key INTEGER NOT NULL DEFAULT 1 CHECK (singleton_key = 1) UNIQUE,
    schema_version INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (length(payload_json) BETWEEN 2 AND 10485760)
  ) STRICT`,
  `PRAGMA application_id = ${DATABASE_APPLICATION_ID}`,
] as const;

function migrationChecksum(statements: readonly string[]): string {
  return nonCryptographicDigest(statements);
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    name: "initial_domain_schema",
    statements: MIGRATION_001_STATEMENTS,
    checksum: migrationChecksum(MIGRATION_001_STATEMENTS),
  },
];

interface PragmaRow extends SqlRow {
  readonly application_id?: number;
  readonly user_version?: number;
  readonly foreign_keys?: number;
  readonly quick_check?: string;
}

interface MigrationRow extends SqlRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

function scalarNumber(row: SqlRow | undefined): number | undefined {
  if (row === undefined) {
    return undefined;
  }
  const value = Object.values(row)[0];
  return typeof value === "number" ? value : undefined;
}

function scalarText(row: SqlRow | undefined): string | undefined {
  if (row === undefined) {
    return undefined;
  }
  const value = Object.values(row)[0];
  return typeof value === "string" ? value : undefined;
}

export async function configureDatabaseConnection(
  database: SqlDatabase,
): Promise<void> {
  await database.exec("PRAGMA foreign_keys = ON");
  await database.exec("PRAGMA journal_mode = WAL");
  await database.exec("PRAGMA synchronous = FULL");
  await database.exec("PRAGMA busy_timeout = 5000");
  await database.exec("PRAGMA trusted_schema = OFF");
  const foreignKeys = scalarNumber(
    await database.get<PragmaRow>("PRAGMA foreign_keys"),
  );
  if (foreignKeys !== 1) {
    throw new PersistenceError(
      "DATABASE_OPERATION_FAILED",
      "SQLite no pudo activar la integridad referencial.",
    );
  }
}

export async function verifyDatabaseIntegrity(
  database: SqlDatabase,
): Promise<void> {
  let quickCheck: string | undefined;
  try {
    quickCheck = scalarText(
      await database.get<PragmaRow>("PRAGMA quick_check(1)"),
    );
  } catch (error) {
    throw asPersistenceError(
      error,
      "DATABASE_CORRUPT",
      "No fue posible verificar la integridad de la base.",
    );
  }
  if (quickCheck !== "ok") {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "La base local no superó la verificación de integridad.",
    );
  }
  const violations = await database.all<SqlRow>("PRAGMA foreign_key_check");
  if (violations.length > 0) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "La base local contiene relaciones inválidas.",
      { violationCount: violations.length },
    );
  }
}

async function readCurrentVersion(database: SqlDatabase): Promise<number> {
  const version = scalarNumber(
    await database.get<PragmaRow>("PRAGMA user_version"),
  );
  if (version === undefined) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "No fue posible leer la versión de la base.",
    );
  }
  return version;
}

async function assertRecognizedDatabase(database: SqlDatabase): Promise<void> {
  const applicationId =
    scalarNumber(await database.get<PragmaRow>("PRAGMA application_id")) ?? 0;
  const tables = await database.all<SqlRow>(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  if (applicationId === 0 && tables.length === 0) {
    return;
  }
  if (applicationId !== DATABASE_APPLICATION_ID) {
    throw new PersistenceError(
      "DATABASE_INCOMPATIBLE",
      "El archivo SQLite no pertenece a esta aplicación.",
    );
  }
}

async function verifyMigrationHistory(
  database: SqlDatabase,
  currentVersion: number,
): Promise<void> {
  const rows = await database.all<MigrationRow>(
    "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
  );
  if (rows.length !== currentVersion) {
    throw new PersistenceError(
      "DATABASE_INCOMPATIBLE",
      "El historial de migraciones está incompleto.",
    );
  }
  for (const [index, row] of rows.entries()) {
    const known = DATABASE_MIGRATIONS.find(
      (migration) => migration.version === row.version,
    );
    if (
      row.version !== index + 1 ||
      known === undefined ||
      known.name !== row.name ||
      known.checksum !== row.checksum
    ) {
      throw new PersistenceError(
        "DATABASE_INCOMPATIBLE",
        "El historial de migraciones no coincide con esta versión.",
        { version: row.version },
      );
    }
  }
}

export async function migrateDatabase(
  database: SqlDatabase,
  now: string,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
): Promise<number> {
  await configureDatabaseConnection(database);
  await verifyDatabaseIntegrity(database);
  await assertRecognizedDatabase(database);
  let currentVersion = await readCurrentVersion(database);
  const targetVersion = migrations.at(-1)?.version ?? 0;
  if (currentVersion > targetVersion) {
    throw new PersistenceError(
      "DATABASE_INCOMPATIBLE",
      "La base fue creada por una versión más reciente de la aplicación.",
      { currentVersion, targetVersion },
    );
  }
  if (currentVersion > 0) {
    try {
      await verifyMigrationHistory(database, currentVersion);
    } catch (error) {
      throw asPersistenceError(
        error,
        "DATABASE_INCOMPATIBLE",
        "No fue posible validar el historial de migraciones.",
      );
    }
  }
  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }
    if (migration.version !== currentVersion + 1) {
      throw new PersistenceError(
        "MIGRATION_FAILED",
        "La secuencia de migraciones contiene un salto de versión.",
      );
    }
    try {
      await database.withExclusiveTransaction(async (transaction) => {
        for (const statement of migration.statements) {
          await transaction.exec(statement);
        }
        await transaction.exec(`PRAGMA user_version = ${migration.version}`);
        await transaction.run(
          `INSERT INTO schema_migrations(version, name, checksum, applied_at)
           VALUES (?, ?, ?, ?)`,
          [migration.version, migration.name, migration.checksum, now],
        );
        await transaction.run(
          `INSERT INTO app_metadata(
             singleton_id, schema_version, integrity_status, created_at, updated_at
           ) VALUES (1, ?, 'HEALTHY', ?, ?)
           ON CONFLICT(singleton_id) DO UPDATE SET
             schema_version = excluded.schema_version,
             integrity_status = 'HEALTHY',
             updated_at = excluded.updated_at`,
          [migration.version, now, now],
        );
      });
    } catch (error) {
      throw asPersistenceError(
        error,
        "MIGRATION_FAILED",
        "No fue posible actualizar la base local. El archivo se conservó.",
      );
    }
    currentVersion = await readCurrentVersion(database);
    if (currentVersion !== migration.version) {
      throw new PersistenceError(
        "MIGRATION_FAILED",
        "SQLite no confirmó la versión de la migración.",
      );
    }
  }
  await verifyMigrationHistory(database, currentVersion);
  await verifyDatabaseIntegrity(database);
  return currentVersion;
}

import {
  DATABASE_SCHEMA_VERSION,
  migrateDatabase,
  verifyDatabaseIntegrity,
} from "./migrations.js";
import { PersistenceError } from "../../application/errors/persistence-error.js";
import type { SqlDatabase, SqlRow } from "./sql-database.js";

export interface DatabaseInitializationResult {
  readonly schemaVersion: number;
  readonly integrityStatus: "HEALTHY";
}

interface MetadataRow extends SqlRow {
  readonly schema_version: number;
  readonly integrity_status: string;
}

export async function initializeDatabase(
  database: SqlDatabase,
  now: string,
): Promise<DatabaseInitializationResult> {
  const schemaVersion = await migrateDatabase(database, now);
  if (schemaVersion !== DATABASE_SCHEMA_VERSION) {
    throw new PersistenceError(
      "DATABASE_INCOMPATIBLE",
      "La versión de la base no coincide con la aplicación.",
      { schemaVersion, expected: DATABASE_SCHEMA_VERSION },
    );
  }
  await verifyDatabaseIntegrity(database);
  const metadata = await database.get<MetadataRow>(
    `SELECT schema_version, integrity_status
     FROM app_metadata WHERE singleton_id = 1`,
  );
  if (
    metadata === undefined ||
    metadata.schema_version !== DATABASE_SCHEMA_VERSION ||
    metadata.integrity_status !== "HEALTHY"
  ) {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "Los metadatos internos de la base son inválidos.",
    );
  }
  return {
    schemaVersion,
    integrityStatus: "HEALTHY",
  };
}

import type {
  SqlDatabase,
  SqlParameters,
  SqlRow,
  SqlRunResult,
} from "./sql-database.js";

interface ExpoSqliteRunResultLike {
  readonly changes: number;
  readonly lastInsertRowId: number;
}

export interface ExpoSqliteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    parameters: readonly (string | number | null | Uint8Array)[],
  ): Promise<ExpoSqliteRunResultLike>;
  getFirstAsync<T>(
    sql: string,
    parameters: readonly (string | number | null | Uint8Array)[],
  ): Promise<T | null>;
  getAllAsync<T>(
    sql: string,
    parameters: readonly (string | number | null | Uint8Array)[],
  ): Promise<T[]>;
  withExclusiveTransactionAsync<T>(
    operation: (transaction: ExpoSqliteDatabaseLike) => Promise<T>,
  ): Promise<T>;
}

/**
 * Adaptador sin importación directa de Expo. La Fase 4 entregará el objeto
 * obtenido de `expo-sqlite.openDatabaseAsync`.
 */
export class ExpoSqliteDatabaseAdapter implements SqlDatabase {
  readonly #database: ExpoSqliteDatabaseLike;

  public constructor(database: ExpoSqliteDatabaseLike) {
    this.#database = database;
  }

  public async exec(sql: string): Promise<void> {
    await this.#database.execAsync(sql);
  }

  public async run(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<SqlRunResult> {
    return this.#database.runAsync(sql, parameters);
  }

  public async get<T extends SqlRow>(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<T | undefined> {
    return (await this.#database.getFirstAsync<T>(sql, parameters)) ?? undefined;
  }

  public async all<T extends SqlRow>(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<readonly T[]> {
    return this.#database.getAllAsync<T>(sql, parameters);
  }

  public async withExclusiveTransaction<T>(
    operation: (transaction: SqlDatabase) => Promise<T>,
  ): Promise<T> {
    return this.#database.withExclusiveTransactionAsync(async (transaction) =>
      operation(new ExpoSqliteDatabaseAdapter(transaction)),
    );
  }
}

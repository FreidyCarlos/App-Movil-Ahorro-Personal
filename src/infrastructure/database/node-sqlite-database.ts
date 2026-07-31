import { DatabaseSync } from "node:sqlite";

import type {
  SqlDatabase,
  SqlParameters,
  SqlRow,
  SqlRunResult,
} from "./sql-database.js";
import { PersistenceError } from "../../application/errors/persistence-error.js";

export interface NodeSqliteDatabaseOptions {
  readonly timeoutMilliseconds?: number;
}

export class NodeSqliteDatabase implements SqlDatabase {
  readonly #database: DatabaseSync;
  #transactionRunning = false;

  public constructor(
    path: string,
    options: NodeSqliteDatabaseOptions = {},
  ) {
    const database = new DatabaseSync(path, {
      allowExtension: false,
      defensive: true,
      timeout: options.timeoutMilliseconds ?? 5_000,
    });
    try {
      database.prepare("PRAGMA schema_version").get();
    } catch (error) {
      database.close();
      throw error;
    }
    this.#database = database;
  }

  public async exec(sql: string): Promise<void> {
    this.#database.exec(sql);
  }

  public async run(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<SqlRunResult> {
    const result = this.#database.prepare(sql).run(...parameters);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  public async get<T extends SqlRow>(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<T | undefined> {
    return this.#database.prepare(sql).get(...parameters) as T | undefined;
  }

  public async all<T extends SqlRow>(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<readonly T[]> {
    return this.#database.prepare(sql).all(...parameters) as T[];
  }

  public async withExclusiveTransaction<T>(
    operation: (transaction: SqlDatabase) => Promise<T>,
  ): Promise<T> {
    if (this.#transactionRunning) {
      throw new Error("No se permiten transacciones SQLite anidadas.");
    }
    this.#transactionRunning = true;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation(this);
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      if (this.#database.isTransaction) {
        this.#database.exec("ROLLBACK");
      }
      throw error;
    } finally {
      this.#transactionRunning = false;
    }
  }

  public close(): void {
    this.#database.close();
  }
}

export function openNodeSqliteDatabase(
  path: string,
  options: NodeSqliteDatabaseOptions = {},
): NodeSqliteDatabase {
  try {
    return new NodeSqliteDatabase(path, options);
  } catch {
    throw new PersistenceError(
      "DATABASE_CORRUPT",
      "No fue posible abrir la base local. El archivo se conservó.",
    );
  }
}

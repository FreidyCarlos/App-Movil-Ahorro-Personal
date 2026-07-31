export type SqlPrimitive = string | number | null | Uint8Array;
export type SqlParameters = readonly SqlPrimitive[];
export type SqlRow = Readonly<Record<string, SqlPrimitive>>;

export interface SqlRunResult {
  readonly changes: number;
  readonly lastInsertRowId: number;
}

export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, parameters?: SqlParameters): Promise<SqlRunResult>;
  get<T extends SqlRow>(
    sql: string,
    parameters?: SqlParameters,
  ): Promise<T | undefined>;
  all<T extends SqlRow>(
    sql: string,
    parameters?: SqlParameters,
  ): Promise<readonly T[]>;
  withExclusiveTransaction<T>(
    operation: (transaction: SqlDatabase) => Promise<T>,
  ): Promise<T>;
}

import {
  ExpoSqliteDatabaseAdapter,
  type ExpoSqliteDatabaseLike,
  type SqlRow,
} from "../src/index.js";

class FakeExpoDatabase implements ExpoSqliteDatabaseLike {
  readonly calls: string[] = [];
  readonly #firstValue: SqlRow | null;

  public constructor(firstValue: SqlRow | null = { value: "row" }) {
    this.#firstValue = firstValue;
  }

  public async execAsync(sql: string): Promise<void> {
    this.calls.push(`exec:${sql}`);
  }

  public async runAsync(
    sql: string,
    parameters: readonly (string | number | null | Uint8Array)[],
  ): Promise<{ readonly changes: number; readonly lastInsertRowId: number }> {
    this.calls.push(`run:${sql}:${parameters.join(",")}`);
    return { changes: 1, lastInsertRowId: 7 };
  }

  public async getFirstAsync<T>(
    sql: string,
    parameters: readonly (string | number | null | Uint8Array)[],
  ): Promise<T | null> {
    this.calls.push(`get:${sql}:${parameters.join(",")}`);
    return this.#firstValue as T | null;
  }

  public async getAllAsync<T>(
    sql: string,
    parameters: readonly (string | number | null | Uint8Array)[],
  ): Promise<T[]> {
    this.calls.push(`all:${sql}:${parameters.join(",")}`);
    return [{ value: "one" }, { value: "two" }] as T[];
  }

  public async withExclusiveTransactionAsync<T>(
    operation: (transaction: ExpoSqliteDatabaseLike) => Promise<T>,
  ): Promise<T> {
    this.calls.push("transaction:start");
    const transaction = new FakeExpoDatabase({ value: "transaction" });
    const result = await operation(transaction);
    this.calls.push(...transaction.calls, "transaction:commit");
    return result;
  }
}

describe("adaptador estructural de expo-sqlite", () => {
  it("delega parámetros y usa el objeto exclusivo de la transacción", async () => {
    const fake = new FakeExpoDatabase();
    const adapter = new ExpoSqliteDatabaseAdapter(fake);
    await adapter.exec("PRAGMA foreign_keys = ON");
    expect(await adapter.run("INSERT", ["safe", 1])).toEqual({
      changes: 1,
      lastInsertRowId: 7,
    });
    expect(await adapter.get<SqlRow>("SELECT one", ["x"])).toEqual({
      value: "row",
    });
    expect(await adapter.all<SqlRow>("SELECT all")).toHaveLength(2);
    const transactionValue = await adapter.withExclusiveTransaction(
      async (transaction) =>
        (await transaction.get<SqlRow>("SELECT tx"))?.["value"],
    );
    expect(transactionValue).toBe("transaction");
    expect(fake.calls).toContain("get:SELECT tx:");
  });

  it("convierte el null de Expo en ausencia de fila", async () => {
    const adapter = new ExpoSqliteDatabaseAdapter(new FakeExpoDatabase(null));
    expect(await adapter.get<SqlRow>("SELECT empty")).toBeUndefined();
  });
});

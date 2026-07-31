import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  DATABASE_APPLICATION_ID,
  DATABASE_MIGRATIONS,
  PersistenceError,
  SQLiteDomainRepository,
  initializeDatabase,
  migrateDatabase,
  nonCryptographicDigest,
  type DatabaseMigration,
  type SqlRow,
} from "../src/index.js";
import {
  NodeSqliteDatabase,
  openNodeSqliteDatabase,
} from "../src/node.js";
import { NOW, id } from "./helpers.js";
import {
  PERSISTENCE_LIMITS,
  persistenceSnapshot,
} from "./persistence-helpers.js";

interface PragmaRow extends SqlRow {
  readonly application_id?: number;
  readonly user_version?: number;
  readonly foreign_keys?: number;
}

async function temporaryDatabase(): Promise<{
  readonly root: string;
  readonly path: string;
  readonly database: NodeSqliteDatabase;
}> {
  const root = await mkdtemp(join(tmpdir(), "ahorro-sqlite-"));
  const path = join(root, "app.db");
  return {
    root,
    path,
    database: openNodeSqliteDatabase(path),
  };
}

async function cleanup(
  database: NodeSqliteDatabase | undefined,
  root: string,
): Promise<void> {
  database?.close();
  await rm(root, { recursive: true, force: true });
}

describe("migraciones e inicialización SQLite", () => {
  it("crea la versión inicial, activa claves foráneas y registra la aplicación", async () => {
    const temporary = await temporaryDatabase();
    try {
      const result = await initializeDatabase(temporary.database, NOW);
      expect(result).toEqual({
        schemaVersion: 1,
        integrityStatus: "HEALTHY",
      });
      const application = await temporary.database.get<PragmaRow>(
        "PRAGMA application_id",
      );
      const version = await temporary.database.get<PragmaRow>(
        "PRAGMA user_version",
      );
      const foreignKeys = await temporary.database.get<PragmaRow>(
        "PRAGMA foreign_keys",
      );
      expect(Object.values(application ?? {})[0]).toBe(
        DATABASE_APPLICATION_ID,
      );
      expect(Object.values(version ?? {})[0]).toBe(1);
      expect(Object.values(foreignKeys ?? {})[0]).toBe(1);
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("revierte por completo una migración interrumpida", async () => {
    const temporary = await temporaryDatabase();
    const statements = [
      "CREATE TABLE should_rollback(id TEXT PRIMARY KEY) STRICT",
      "INSERT INTO missing_table(id) VALUES ('failure')",
      "PRAGMA user_version = 2",
    ] as const;
    const failingMigration: DatabaseMigration = {
      version: 2,
      name: "forced_failure",
      statements,
      checksum: nonCryptographicDigest(statements),
    };
    try {
      await expect(
        migrateDatabase(temporary.database, NOW, [
          ...DATABASE_MIGRATIONS,
          failingMigration,
        ]),
      ).rejects.toMatchObject({ code: "MIGRATION_FAILED" });
      const version = await temporary.database.get<PragmaRow>(
        "PRAGMA user_version",
      );
      const rolledBackTable = await temporary.database.get<SqlRow>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'should_rollback'`,
      );
      expect(Object.values(version ?? {})[0]).toBe(1);
      expect(rolledBackTable).toBeUndefined();
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("rechaza una versión futura sin reinicializar ni vaciar el archivo", async () => {
    const temporary = await temporaryDatabase();
    try {
      await initializeDatabase(temporary.database, NOW);
      await temporary.database.exec("PRAGMA user_version = 99");
      await expect(
        initializeDatabase(temporary.database, NOW),
      ).rejects.toMatchObject({ code: "DATABASE_INCOMPATIBLE" });
      const version = await temporary.database.get<PragmaRow>(
        "PRAGMA user_version",
      );
      expect(Object.values(version ?? {})[0]).toBe(99);
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("rechaza un historial de migraciones alterado", async () => {
    const temporary = await temporaryDatabase();
    try {
      await initializeDatabase(temporary.database, NOW);
      await temporary.database.run(
        "UPDATE schema_migrations SET checksum = ? WHERE version = 1",
        ["fnv1a64:0000000000000000"],
      );
      await expect(
        initializeDatabase(temporary.database, NOW),
      ).rejects.toMatchObject({ code: "DATABASE_INCOMPATIBLE" });
      const stored = await temporary.database.get<SqlRow>(
        "SELECT checksum FROM schema_migrations WHERE version = 1",
      );
      expect(Object.values(stored ?? {})[0]).toBe(
        "fnv1a64:0000000000000000",
      );
      await temporary.database.run(
        "UPDATE schema_migrations SET checksum = ? WHERE version = 1",
        [DATABASE_MIGRATIONS[0]!.checksum],
      );
      await temporary.database.run(
        "DELETE FROM schema_migrations WHERE version = 1",
      );
      await expect(
        initializeDatabase(temporary.database, NOW),
      ).rejects.toMatchObject({ code: "DATABASE_INCOMPATIBLE" });
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("no adopta una base ajena ni una secuencia con saltos", async () => {
    const unrelated = await temporaryDatabase();
    try {
      await unrelated.database.exec(
        "CREATE TABLE unrelated(id TEXT PRIMARY KEY) STRICT",
      );
      await expect(
        initializeDatabase(unrelated.database, NOW),
      ).rejects.toMatchObject({ code: "DATABASE_INCOMPATIBLE" });
      expect(
        await unrelated.database.get<SqlRow>(
          "SELECT name FROM sqlite_master WHERE name = 'unrelated'",
        ),
      ).toBeDefined();
    } finally {
      await cleanup(unrelated.database, unrelated.root);
    }

    const skipped = await temporaryDatabase();
    try {
      await expect(
        migrateDatabase(skipped.database, NOW, [
          {
            version: 2,
            name: "invalid_gap",
            statements: [],
            checksum: nonCryptographicDigest([]),
          },
        ]),
      ).rejects.toMatchObject({ code: "MIGRATION_FAILED" });
      const tables = await skipped.database.all<SqlRow>(
        "SELECT name FROM sqlite_master WHERE name = 'schema_migrations'",
      );
      expect(tables).toHaveLength(0);
    } finally {
      await cleanup(skipped.database, skipped.root);
    }
  });

  it("conserva byte por byte un archivo que no es una base SQLite", async () => {
    const root = await mkdtemp(join(tmpdir(), "ahorro-corrupt-"));
    const path = join(root, "damaged.db");
    const original = Buffer.from("not-a-sqlite-database", "utf8");
    await writeFile(path, original);
    try {
      expect(() => openNodeSqliteDatabase(path)).toThrowError(
        PersistenceError,
      );
      expect(await readFile(path)).toEqual(original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("repositorio SQLite transaccional", () => {
  it("persiste, reinicia y reconstruye el snapshot validado", async () => {
    const temporary = await temporaryDatabase();
    let database: NodeSqliteDatabase | undefined = temporary.database;
    try {
      await initializeDatabase(database, NOW);
      const repository = new SQLiteDomainRepository(
        database,
        PERSISTENCE_LIMITS,
      );
      const source = persistenceSnapshot();
      await repository.replaceSnapshot(source);
      database.close();
      database = openNodeSqliteDatabase(temporary.path);
      await initializeDatabase(database, NOW);
      const reopened = new SQLiteDomainRepository(
        database,
        PERSISTENCE_LIMITS,
      );
      const restored = await reopened.loadSnapshot({
        appVersion: source.appVersion,
        rulesVersion: source.rulesVersion,
        exportedAt: source.exportedAt,
      });
      expect(restored).toEqual(source);
      expect((await reopened.listGoals())[0]?.name).toBe(
        "Fondo de emergencia",
      );
      expect(await reopened.listMovements(id(1))).toHaveLength(1);
    } finally {
      await cleanup(database, temporary.root);
    }
  });

  it("parametriza contenido hostil sin alterar el esquema", async () => {
    const temporary = await temporaryDatabase();
    try {
      await initializeDatabase(temporary.database, NOW);
      const repository = new SQLiteDomainRepository(
        temporary.database,
        PERSISTENCE_LIMITS,
      );
      const hostile = persistenceSnapshot(`Meta'); DROP TABLE goals; --`);
      await repository.replaceSnapshot(hostile);
      expect((await repository.listGoals())[0]?.name).toBe(
        `Meta'); DROP TABLE goals; --`,
      );
      const table = await temporary.database.get<SqlRow>(
        "SELECT name FROM sqlite_master WHERE name = 'goals'",
      );
      expect(table).toBeDefined();
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("serializa cambios de aplicación dentro de una unidad de trabajo", async () => {
    const temporary = await temporaryDatabase();
    try {
      await initializeDatabase(temporary.database, NOW);
      const repository = new SQLiteDomainRepository(
        temporary.database,
        PERSISTENCE_LIMITS,
      );
      const initial = persistenceSnapshot("Antes");
      await repository.replaceSnapshot(initial);
      const header = {
        appVersion: initial.appVersion,
        rulesVersion: initial.rulesVersion,
        exportedAt: initial.exportedAt,
      };
      await repository.updateSnapshot(header, (current) => ({
        ...current,
        goals: current.goals.map((goal) => ({
          ...goal,
          name: "Después",
        })),
      }));
      expect((await repository.listGoals())[0]?.name).toBe("Después");

      await expect(
        repository.updateSnapshot(header, () => {
          throw new Error("interrupción simulada");
        }),
      ).rejects.toMatchObject({ code: "DATABASE_CONSTRAINT" });
      expect((await repository.listGoals())[0]?.name).toBe("Después");
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("revierte el reemplazo completo si una restricción falla a mitad", async () => {
    const temporary = await temporaryDatabase();
    try {
      await initializeDatabase(temporary.database, NOW);
      const repository = new SQLiteDomainRepository(
        temporary.database,
        PERSISTENCE_LIMITS,
      );
      const original = persistenceSnapshot("Original");
      await repository.replaceSnapshot(original);
      await temporary.database.exec(
        `CREATE TRIGGER simulate_storage_failure
         BEFORE INSERT ON goals
         BEGIN
           SELECT RAISE(ABORT, 'simulated storage failure');
         END`,
      );
      await expect(
        repository.replaceSnapshot(
          persistenceSnapshot("No debe persistir"),
        ),
      ).rejects.toMatchObject({ code: "DATABASE_CONSTRAINT" });
      expect((await repository.listGoals())[0]?.name).toBe("Original");
      expect(await repository.listMovements(id(1))).toHaveLength(1);
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("bloquea relaciones huérfanas y cargas JSON manipuladas", async () => {
    const temporary = await temporaryDatabase();
    try {
      await initializeDatabase(temporary.database, NOW);
      const repository = new SQLiteDomainRepository(
        temporary.database,
        PERSISTENCE_LIMITS,
      );
      await repository.replaceSnapshot(persistenceSnapshot());
      await temporary.database.exec("PRAGMA foreign_keys = OFF");
      await temporary.database.run(
        "UPDATE plan_configurations SET goal_id = ? WHERE id = ?",
        [id(999), id(2)],
      );
      await temporary.database.exec("PRAGMA foreign_keys = ON");
      await expect(
        initializeDatabase(temporary.database, NOW),
      ).rejects.toMatchObject({ code: "DATABASE_CORRUPT" });

      await temporary.database.exec("PRAGMA foreign_keys = OFF");
      await temporary.database.run(
        "UPDATE plan_configurations SET goal_id = ? WHERE id = ?",
        [id(1), id(2)],
      );
      await temporary.database.run(
        "UPDATE goals SET status = 'ARCHIVED' WHERE id = ?",
        [id(1)],
      );
      await expect(repository.listGoals()).rejects.toMatchObject({
        code: "DATABASE_CORRUPT",
      });
      await temporary.database.run(
        "UPDATE goals SET status = 'ACTIVE' WHERE id = ?",
        [id(1)],
      );
      await temporary.database.run(
        "UPDATE goals SET payload_json = ? WHERE id = ?",
        ["{broken", id(1)],
      );
      await temporary.database.exec("PRAGMA foreign_keys = ON");
      await expect(repository.getGoal(id(1))).rejects.toMatchObject({
        code: "DATABASE_CORRUPT",
      });
    } finally {
      await cleanup(temporary.database, temporary.root);
    }
  });

  it("revierte una escritura abierta si la conexión se cierra", async () => {
    const temporary = await temporaryDatabase();
    let database: NodeSqliteDatabase | undefined = temporary.database;
    try {
      await initializeDatabase(database, NOW);
      const repository = new SQLiteDomainRepository(
        database,
        PERSISTENCE_LIMITS,
      );
      await repository.replaceSnapshot(persistenceSnapshot());
      await database.exec("BEGIN IMMEDIATE");
      await database.run(
        "UPDATE goals SET status = 'ARCHIVED' WHERE id = ?",
        [id(1)],
      );
      database.close();
      database = openNodeSqliteDatabase(temporary.path);
      await initializeDatabase(database, NOW);
      const row = await database.get<SqlRow>(
        "SELECT status FROM goals WHERE id = ?",
        [id(1)],
      );
      expect(Object.values(row ?? {})[0]).toBe("ACTIVE");
    } finally {
      await cleanup(database, temporary.root);
    }
  });
});

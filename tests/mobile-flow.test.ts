import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  MOBILE_PRIMARY_NAVIGATION,
  MobileSavingsService,
  SQLiteDomainRepository,
  createEmptyDomainSnapshot,
  initializeDatabase,
  validateDomainSnapshot,
  validateSimpleGoalForm,
} from "../src/index.js";
import {
  NodeSqliteDatabase,
  openNodeSqliteDatabase,
} from "../src/node.js";
import { PersistenceError } from "../src/application/errors/persistence-error.js";
import { safeUserMessage } from "../src/mobile/presentation/safe-error.js";
import { NOW, id } from "./helpers.js";
import { PERSISTENCE_LIMITS } from "./persistence-helpers.js";

describe("formulario móvil de meta simple", () => {
  it("valida una meta mensual y calcula el total sin rendimiento", () => {
    const result = validateSimpleGoalForm({
      name: "  Fondo de emergencia  ",
      periodicAmount: "200000",
      periodicity: "MONTHLY",
      numberOfPeriods: "18",
      startDate: "",
    });
    expect(result).toEqual({
      success: true,
      data: {
        name: "Fondo de emergencia",
        periodicAmount: "200000",
        periodicity: "MONTHLY",
        numberOfPeriods: 18,
      },
      projectedTotal: "3600000",
    });
  });

  it("valida una meta anual y rechaza límites o fechas inválidas", () => {
    const annual = validateSimpleGoalForm({
      name: "Viaje",
      periodicAmount: "3000000",
      periodicity: "YEARLY",
      numberOfPeriods: "5",
      startDate: "2026-08-01",
    });
    expect(annual.success && annual.projectedTotal).toBe("15000000");

    const invalid = validateSimpleGoalForm({
      name: "",
      periodicAmount: "NaN",
      periodicity: "YEARLY",
      numberOfPeriods: "101",
      startDate: "2026-02-30",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(Object.keys(invalid.errors).sort()).toEqual([
        "name",
        "numberOfPeriods",
        "periodicAmount",
        "startDate",
      ]);
    }
  });
});

describe("flujo vertical móvil sobre persistencia real", () => {
  it("inicializa, guarda y reconstruye una meta tras reabrir SQLite", async () => {
    const root = await mkdtemp(join(tmpdir(), "ahorro-mobile-flow-"));
    const path = join(root, "mobile.db");
    let database: NodeSqliteDatabase | undefined =
      openNodeSqliteDatabase(path);
    let nextId = 10;
    const ids = { nextId: () => id(nextId++) };
    const clock = {
      now: () => NOW,
      today: () => "2026-07-30",
    };
    try {
      await initializeDatabase(database, NOW);
      let repository = new SQLiteDomainRepository(
        database,
        PERSISTENCE_LIMITS,
      );
      await repository.replaceSnapshot(
        createEmptyDomainSnapshot({
          appVersion: "0.1.0",
          rulesVersion: "financial-rules-1",
          now: NOW,
          settingsId: id(4),
        }),
      );
      let service = new MobileSavingsService(repository, clock, ids, {
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
      });
      const created = await service.createSimpleGoal({
        name: "Fondo móvil",
        periodicAmount: "200000",
        periodicity: "MONTHLY",
        numberOfPeriods: 18,
      });
      expect(created.projectedTotal).toBe("3600000");
      expect(created.projectedYield).toBe("0");

      database.close();
      database = openNodeSqliteDatabase(path);
      await initializeDatabase(database, NOW);
      repository = new SQLiteDomainRepository(database, PERSISTENCE_LIMITS);
      service = new MobileSavingsService(repository, clock, ids, {
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
      });
      expect(await service.listSimpleGoals()).toEqual([created]);

      const snapshot = await repository.loadSnapshot({
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
        exportedAt: NOW,
      });
      expect("projectionResults" in snapshot).toBe(false);
      expect(validateDomainSnapshot(snapshot, PERSISTENCE_LIMITS)).toEqual(
        snapshot,
      );
    } finally {
      database?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("contratos móviles seguros", () => {
  it("mantiene las rutas principales explícitas y sin duplicados", () => {
    expect(MOBILE_PRIMARY_NAVIGATION).toEqual(["/", "/new-goal", "/data"]);
    expect(new Set(MOBILE_PRIMARY_NAVIGATION).size).toBe(
      MOBILE_PRIMARY_NAVIGATION.length,
    );
  });

  it("no expone trazas internas para errores desconocidos", () => {
    expect(safeUserMessage(new Error("token=secreto"))).toBe(
      "Ocurrió un error inesperado. Tus datos existentes no fueron reemplazados.",
    );
    expect(
      safeUserMessage(
        new PersistenceError(
          "BACKUP_CHECKSUM_MISMATCH",
          "La copia parece dañada o modificada.",
        ),
      ),
    ).toBe("La copia parece dañada o modificada.");
  });
});

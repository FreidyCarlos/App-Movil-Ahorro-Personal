import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MobileSavingsService,
  BackupService,
  SQLiteDomainRepository,
  canonicalizeSnapshot,
  createEmptyDomainSnapshot,
  initializeDatabase,
  validateDomainSnapshot,
  validateAdvancedGoalForm,
  type DomainRepository,
  type DomainSnapshotV1,
  type DomainStateUpdater,
  type SavingsGoal,
  type SavingsMovement,
  type SnapshotHeader,
} from "../src/index.js";
import {
  NodeSqliteDatabase,
  NodeSha256ChecksumProvider,
  SafeNodeBackupFileStore,
  openNodeSqliteDatabase,
} from "../src/node.js";
import { id } from "./helpers.js";
import { PERSISTENCE_LIMITS } from "./persistence-helpers.js";

const NOW = "2026-01-10T12:00:00.000Z";

class MemoryRepository implements DomainRepository {
  public constructor(private snapshot: DomainSnapshotV1) {}

  public async hasDomainState(): Promise<boolean> {
    return true;
  }

  public async loadSnapshot(header: SnapshotHeader): Promise<DomainSnapshotV1> {
    return { ...this.snapshot, ...header };
  }

  public async replaceSnapshot(candidate: unknown): Promise<DomainSnapshotV1> {
    this.snapshot = canonicalizeSnapshot(
      validateDomainSnapshot(candidate, PERSISTENCE_LIMITS),
    );
    return this.snapshot;
  }

  public async updateSnapshot(
    header: SnapshotHeader,
    updater: DomainStateUpdater,
  ): Promise<DomainSnapshotV1> {
    this.snapshot = canonicalizeSnapshot(
      validateDomainSnapshot(
        updater({ ...this.snapshot, ...header }),
        PERSISTENCE_LIMITS,
      ),
    );
    return this.snapshot;
  }

  public async appendBackupMetadata(): Promise<never> {
    throw new Error("No se usa en esta prueba.");
  }

  public async getGoal(goalId: string): Promise<SavingsGoal | undefined> {
    return this.snapshot.goals.find((goal) => goal.id === goalId) as
      | SavingsGoal
      | undefined;
  }

  public async listGoals(includeDeleted = false): Promise<readonly SavingsGoal[]> {
    return (includeDeleted
      ? this.snapshot.goals
      : this.snapshot.goals.filter((goal) => goal.deletedAt === undefined)) as readonly SavingsGoal[];
  }

  public async listMovements(goalId: string): Promise<readonly SavingsMovement[]> {
    return this.snapshot.movements.filter(
      (movement) => movement.goalId === goalId,
    ) as readonly SavingsMovement[];
  }
}

function advancedForm(
  overrides: Partial<Parameters<typeof validateAdvancedGoalForm>[0]> = {},
) {
  return validateAdvancedGoalForm({
    name: "Fondo con seguimiento",
    periodicAmount: "200",
    periodicity: "MONTHLY",
    numberOfPeriods: "3",
    startDate: "2026-01-01",
    targetAmount: "1000",
    initialBalance: "100",
    yieldChoice: "ZERO",
    rateValue: "",
    otherRateType: "EM",
    capitalizationPeriodsPerYear: "",
    ...overrides,
  });
}

describe("formulario avanzado progresivo", () => {
  it("conserva los datos básicos y valida las cuatro rutas de rendimiento", () => {
    const zero = advancedForm();
    expect(zero.success).toBe(true);
    if (zero.success) {
      expect(zero.data.periodicAmount).toBe("200");
      expect(zero.data.yieldChoice).toBe("ZERO");
      expect(zero.projectedEndDate).toBe("2026-04-01");
    }

    const ea = advancedForm({ yieldChoice: "EA", rateValue: "12.5" });
    expect(ea.success && ea.data.rateValue).toBe("12.5");

    const other = advancedForm({
      yieldChoice: "OTHER",
      otherRateType: "NOMINAL_ANNUAL_DUE",
      rateValue: "12",
      capitalizationPeriodsPerYear: "12",
    });
    expect(other.success && other.data.otherRateType).toBe(
      "NOMINAL_ANNUAL_DUE",
    );

    const unknown = advancedForm({ yieldChoice: "UNKNOWN" });
    expect(unknown.success).toBe(false);
    if (!unknown.success) {
      expect(unknown.errors.yieldChoice).toContain("No se usará una tasa inventada");
    }
  });
});

describe("recorrido funcional avanzado sobre SQLite real", () => {
  let root: string;
  let database: NodeSqliteDatabase;
  let repository: SQLiteDomainRepository;
  let service: MobileSavingsService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "ahorro-functional-"));
    database = openNodeSqliteDatabase(join(root, "functional.db"));
    await initializeDatabase(database, NOW);
    repository = new SQLiteDomainRepository(
      database,
      PERSISTENCE_LIMITS,
    );
    await repository.replaceSnapshot(
      createEmptyDomainSnapshot({
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
        now: NOW,
        settingsId: id(1),
      }),
    );
    let nextId = 100;
    service = new MobileSavingsService(
      repository,
      { now: () => NOW, today: () => "2026-01-10" },
      { nextId: () => id(nextId++) },
      { appVersion: "0.1.0", rulesVersion: "financial-rules-1" },
    );
  });

  afterEach(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });

  it("crea metas simple y avanzada independientes y reconstruye sus proyecciones", async () => {
    await service.createSimpleGoal({
      name: "Meta simple",
      periodicAmount: "300",
      periodicity: "MONTHLY",
      numberOfPeriods: 2,
    });
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    const advanced = await service.createAdvancedGoal(validation.data);

    expect(advanced.projectionMode).toBe("ADVANCED");
    expect(advanced.projectedTotal).toBe("700");
    expect(advanced.projectedYield).toBe("0");
    expect(advanced.actualBalance).toBe("100");

    const goals = await service.listGoals();
    expect(goals).toHaveLength(2);
    expect(goals.map(({ projectionMode }) => projectionMode)).toEqual([
      "SIMPLE",
      "ADVANCED",
    ]);
  });

  it("registra realidad, cierra, compara, actualiza y anula sin borrar historial", async () => {
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);

    for (const movement of [
      { type: "CONTRIBUTION" as const, amount: "200" },
      { type: "EXTRA_CONTRIBUTION" as const, amount: "50" },
      { type: "YIELD" as const, amount: "10" },
      { type: "WITHDRAWAL" as const, amount: "20" },
      { type: "ADJUSTMENT" as const, amount: "-5", note: "Conciliación" },
    ]) {
      detail = await service.registerMovement({
        goalId: detail.id,
        type: movement.type,
        amount: movement.amount,
        effectiveDate: "2026-01-15",
        ...(movement.note === undefined ? {} : { note: movement.note }),
      });
    }
    expect(detail.actualBalance).toBe("335");
    expect(detail.actualContributions).toBe("200");
    expect(detail.actualExtraContributions).toBe("50");
    expect(detail.actualYield).toBe("10");
    expect(detail.actualWithdrawals).toBe("20");
    expect(detail.adjustments).toBe("-5");

    detail = await service.closeActualPeriod(detail.id, "2026-02-01");
    expect(detail.latestClose?.closingBalance).toBe("335");
    expect(detail.updatedProjection?.initialBalance).toBe("335");
    expect(detail.comparison?.actualBalance).toBe("335");

    const withdrawal = detail.movements.find(
      ({ type }) => type === "WITHDRAWAL",
    );
    expect(withdrawal).toBeDefined();
    detail = await service.voidMovement(
      detail.id,
      withdrawal?.id ?? "",
      "Registro duplicado",
    );
    expect(detail.actualBalance).toBe("355");
    expect(detail.movements.find(({ id: movementId }) => movementId === withdrawal?.id)?.status).toBe(
      "VOIDED",
    );
    expect(detail.latestClose).toBeUndefined();
  });

  it("corrige un movimiento con una nueva revisión e invalida el cierre afectado", async () => {
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);
    detail = await service.registerMovement({
      goalId: detail.id,
      type: "CONTRIBUTION",
      amount: "200",
      effectiveDate: "2026-01-15",
      note: "Valor inicialmente registrado",
    });
    const movement = detail.movements[0];
    expect(movement).toBeDefined();
    detail = await service.closeActualPeriod(detail.id, "2026-02-01");
    expect(detail.latestClose).toBeDefined();

    detail = await service.reviseMovement({
      goalId: detail.id,
      movementId: movement?.id ?? "",
      type: "EXTRA_CONTRIBUTION",
      amount: "250",
      effectiveDate: "2026-01-20",
      note: "Valor verificado",
      reason: "Corrección contra el registro original",
    });

    expect(detail.actualBalance).toBe("350");
    expect(detail.actualContributions).toBe("0");
    expect(detail.actualExtraContributions).toBe("250");
    expect(detail.latestClose).toBeUndefined();
    expect(detail.movements[0]).toMatchObject({
      id: movement?.id,
      type: "EXTRA_CONTRIBUTION",
      amount: "250",
      effectiveDate: "2026-01-20",
      note: "Valor verificado",
      status: "ACTIVE",
    });

    const snapshot = await repository.loadSnapshot({
      appVersion: "0.1.0",
      rulesVersion: "financial-rules-1",
      exportedAt: NOW,
    });
    const revisions = snapshot.movementRevisions
      .filter(({ movementId }) => movementId === movement?.id)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
    expect(revisions).toHaveLength(2);
    expect(revisions[0]?.snapshot.amount).toBe("200");
    expect(revisions[1]).toMatchObject({
      revisionNumber: 2,
      reason: "Corrección contra el registro original",
      supersedesId: revisions[0]?.id,
    });
    expect(revisions[1]?.snapshot.amount).toBe("250");
  });

  it("cambia estados sin eliminar la meta ni sus movimientos", async () => {
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);
    detail = await service.registerMovement({
      goalId: detail.id,
      type: "CONTRIBUTION",
      amount: "100",
      effectiveDate: "2026-01-15",
    });
    detail = await service.changeGoalStatus(detail.id, "ARCHIVED");
    expect(detail.status).toBe("ARCHIVED");
    expect(detail.movements).toHaveLength(1);
    detail = await service.changeGoalStatus(detail.id, "PAUSED");
    expect(detail.status).toBe("PAUSED");
    expect(detail.actualBalance).toBe("200");
  });

  it("exporta, inspecciona y recupera una meta avanzada completa", async () => {
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);
    detail = await service.registerMovement({
      goalId: detail.id,
      type: "CONTRIBUTION",
      amount: "200",
      effectiveDate: "2026-01-15",
    });
    const registeredMovement = detail.movements[0];
    detail = await service.reviseMovement({
      goalId: detail.id,
      movementId: registeredMovement?.id ?? "",
      type: "CONTRIBUTION",
      amount: "250",
      effectiveDate: "2026-01-15",
      reason: "Valor confirmado antes del cierre",
    });
    detail = await service.closeActualPeriod(detail.id, "2026-02-01");
    detail = await service.reviseAdvancedContribution({
      goalId: detail.id,
      periodicAmount: "300",
      effectiveFrom: "2026-02-01",
      reason: "Nueva capacidad mensual",
    });

    const backupDirectory = join(root, "backups");
    await mkdir(backupDirectory);
    let backupId = 900;
    const backups = new BackupService(
      repository,
      new SafeNodeBackupFileStore({
        exportDirectory: backupDirectory,
        allowedImportDirectories: [backupDirectory],
        maximumBytes: PERSISTENCE_LIMITS.maximumBytes,
      }),
      new NodeSha256ChecksumProvider(),
      { now: () => NOW },
      { nextId: () => id(backupId++) },
      {
        appVersion: "0.1.0",
        rulesVersion: "financial-rules-1",
        limits: PERSISTENCE_LIMITS,
      },
    );
    const exported = await backups.exportPortableBackup();
    const preview = await backups.previewImport(exported.reference);
    expect(preview).toMatchObject({
      checksumVerified: true,
      goalCount: 1,
      movementCount: 1,
      confirmationRequired: true,
    });

    await service.changeGoalStatus(detail.id, "ARCHIVED");
    const imported = await backups.replaceFromPreview(
      preview.confirmationToken,
      true,
    );
    expect(imported.rollbackBackup).toBeDefined();
    const restored = await service.getGoal(detail.id);
    expect(restored.status).toBe("ACTIVE");
    expect(restored.configurationRevisionNumber).toBe(2);
    expect(restored.movements).toHaveLength(1);
    expect(restored.movements[0]?.amount).toBe("250");
    expect(restored.originalProjection?.finalBalance).toBe("700");
    const restoredSnapshot = await repository.loadSnapshot({
      appVersion: "0.1.0",
      rulesVersion: "financial-rules-1",
      exportedAt: NOW,
    });
    expect(
      restoredSnapshot.movementRevisions.filter(
        ({ movementId }) => movementId === registeredMovement?.id,
      ),
    ).toHaveLength(2);
  });

  it("revisa un supuesto con motivo y vigencia y conserva la ruta avanzada al pasar a simple", async () => {
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);
    detail = await service.closeActualPeriod(detail.id, "2026-02-01");

    detail = await service.reviseAdvancedContribution({
      goalId: detail.id,
      periodicAmount: "300",
      effectiveFrom: "2026-02-01",
      reason: "Aumentó la capacidad mensual",
    });
    expect(detail.configurationRevisionNumber).toBe(2);
    expect(detail.configurationEffectiveFrom).toBe("2026-02-01");
    expect(detail.periodicAmount).toBe("300");
    expect(detail.originalProjection?.finalBalance).toBe("700");
    expect(detail.updatedProjection?.projectedContributions).toBe("600");

    detail = await service.convertAdvancedGoalToSimple({
      goalId: detail.id,
      periodicAmount: "300",
      periodicity: "MONTHLY",
      numberOfPeriods: 2,
      startDate: "2026-02-01",
    });
    expect(detail.projectionMode).toBe("SIMPLE");
    expect(detail.configurationRevisionNumber).toBe(3);
    expect(detail.projectedTotal).toBe("600");

    const snapshot = await repository.loadSnapshot({
      appVersion: "0.1.0",
      rulesVersion: "financial-rules-1",
      exportedAt: NOW,
    });
    const revisions = snapshot.configurations
      .filter((configuration) => configuration.goalId === detail.id)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
    expect(revisions.map(({ projectionMode }) => projectionMode)).toEqual([
      "ADVANCED",
      "ADVANCED",
      "SIMPLE",
    ]);
    expect(revisions.map(({ isActive }) => isActive)).toEqual([
      false,
      false,
      true,
    ]);
    expect(revisions[1]?.changeReason).toBe("Aumentó la capacidad mensual");
  });
});

describe("casos de uso avanzados antes del adaptador", () => {
  it("mantiene un snapshot válido al registrar el primer movimiento", async () => {
    let nextId = 500;
    const service = new MobileSavingsService(
      new MemoryRepository(
        createEmptyDomainSnapshot({
          appVersion: "0.1.0",
          rulesVersion: "financial-rules-1",
          now: NOW,
          settingsId: id(499),
        }),
      ),
      { now: () => NOW, today: () => "2026-01-10" },
      { nextId: () => id(nextId++) },
      { appVersion: "0.1.0", rulesVersion: "financial-rules-1" },
    );
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    const goal = await service.createAdvancedGoal(validation.data);
    const detail = await service.registerMovement({
      goalId: goal.id,
      type: "CONTRIBUTION",
      amount: "100",
      effectiveDate: "2026-01-15",
    });
    expect(detail.actualBalance).toBe("200");
  });

  it("mantiene un snapshot válido al corregir un movimiento", async () => {
    let nextId = 600;
    const service = new MobileSavingsService(
      new MemoryRepository(
        createEmptyDomainSnapshot({
          appVersion: "0.1.0",
          rulesVersion: "financial-rules-1",
          now: NOW,
          settingsId: id(599),
        }),
      ),
      { now: () => NOW, today: () => "2026-01-10" },
      { nextId: () => id(nextId++) },
      { appVersion: "0.1.0", rulesVersion: "financial-rules-1" },
    );
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);
    detail = await service.registerMovement({
      goalId: detail.id,
      type: "CONTRIBUTION",
      amount: "100",
      effectiveDate: "2026-01-15",
    });
    detail = await service.reviseMovement({
      goalId: detail.id,
      movementId: detail.movements[0]?.id ?? "",
      type: "CONTRIBUTION",
      amount: "125",
      effectiveDate: "2026-01-15",
      reason: "Valor verificado",
    });
    expect(detail.actualBalance).toBe("225");
  });

  it("mantiene relaciones válidas al crear una revisión de supuestos", async () => {
    let nextId = 700;
    const service = new MobileSavingsService(
      new MemoryRepository(
        createEmptyDomainSnapshot({
          appVersion: "0.1.0",
          rulesVersion: "financial-rules-1",
          now: NOW,
          settingsId: id(699),
        }),
      ),
      { now: () => NOW, today: () => "2026-01-10" },
      { nextId: () => id(nextId++) },
      { appVersion: "0.1.0", rulesVersion: "financial-rules-1" },
    );
    const validation = advancedForm();
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    let detail = await service.createAdvancedGoal(validation.data);
    detail = await service.closeActualPeriod(detail.id, "2026-02-01");
    detail = await service.reviseAdvancedContribution({
      goalId: detail.id,
      periodicAmount: "300",
      effectiveFrom: "2026-02-01",
      reason: "Cambio verificable",
    });
    expect(detail.configurationRevisionNumber).toBe(2);
  });
});

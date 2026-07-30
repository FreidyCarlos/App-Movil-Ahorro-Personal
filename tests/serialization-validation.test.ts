import {
  DOMAIN_SNAPSHOT_SCHEMA_VERSION,
  DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
  DomainError,
  type DomainSnapshotV1,
  appSettingsSchema,
  calculateSimpleProjection,
  compareProjectionWithActual,
  createActualPeriodClose,
  createSimpleProjectionResult,
  domainSnapshotV1Schema,
  interestRateDefinitionSchema,
  savingsMovementSchema,
  simpleProjectionConfigurationSchema,
  utcInstantSchema,
  parseDomainSnapshot,
  savingsPlanConfigurationSchema,
  serializeDomainSnapshot,
  validateDomainSnapshot,
} from "../src/index.js";
import {
  NOW,
  flexibleProduct,
  id,
  movement,
  normalizedRate,
  ratePeriod,
} from "./helpers.js";

const LIMITS = {
  maximumBytes: 1_000_000,
  maximumDepth: 20,
  maximumGoals: 100,
  maximumMovements: 10_000,
  maximumRatePeriods: 1000,
  rateEquivalenceTolerance: "0.000000000000000001",
};

function snapshotValue<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validSnapshot(): DomainSnapshotV1 {
  const rate = normalizedRate();
  return {
    schemaVersion: DOMAIN_SNAPSHOT_SCHEMA_VERSION,
    appVersion: "0.1.0",
    rulesVersion: "financial-rules-1",
    exportedAt: NOW,
    policyMetadata: {
      numericPolicyVersion: "numeric-policy-cop-v1" as const,
      maximumAmountCop: "10000000000" as const,
      maximumRatePercent: "100" as const,
      maximumCanonicalEffectiveAnnualRate: "1" as const,
      roundingPolicyVersion: "cop-half-up-0-v1" as const,
      rateEquivalencePolicyVersion: "rate-equivalence-tolerance-v1" as const,
      rateEquivalenceTolerance: "0.000000000000000001" as const,
    },
    goals: [
      {
        id: id(1),
        name: "Emergencias",
        currency: "COP" as const,
        status: "ACTIVE" as const,
        sortOrder: 0,
        activeConfigurationId: id(2),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    configurations: [
      {
        id: id(2),
        goalId: id(1),
        revisionNumber: 1,
        projectionMode: "SIMPLE" as const,
        effectiveFrom: "2026-01-01",
        simpleProjectionConfigurationId: id(3),
        createdAt: NOW,
        rulesVersion: "financial-rules-1",
        isActive: true,
      },
    ],
    simpleConfigurations: [
      {
        id: id(3),
        configurationId: id(2),
        periodicAmount: "100000",
        periodicity: "MONTHLY" as const,
        numberOfPeriods: 12,
        projectedTotal: "1200000",
        calculationMethod: "SIMPLE_UNIFORM_SUM_V1" as const,
      },
    ],
    rateDefinitions: [
      snapshotValue<DomainSnapshotV1["rateDefinitions"][number]>(rate),
    ],
    ratePeriods: [],
    productConfigurations: [],
    movements: [],
    movementRevisions: [],
    closes: [],
    projectionResults: [],
    comparisonResults: [],
    backupMetadata: [],
    settings: {
      id: id(4),
      schemaVersion: 1,
      theme: "SYSTEM" as const,
      locale: "es-CO" as const,
      currencyDisplay: "COP_SYMBOL" as const,
      reduceMotion: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  };
}

describe("validación estricta del dominio", () => {
  it("exige SIMPLE con configuración simple y ADVANCED con datos explícitos", () => {
    expect(
      savingsPlanConfigurationSchema.safeParse(validSnapshot().configurations[0]).success,
    ).toBe(true);
    expect(
      savingsPlanConfigurationSchema.safeParse({
        ...validSnapshot().configurations[0],
        simpleProjectionConfigurationId: undefined,
      }).success,
    ).toBe(false);
    expect(
      savingsPlanConfigurationSchema.safeParse({
        ...validSnapshot().configurations[0],
        projectionMode: "ADVANCED",
        simpleProjectionConfigurationId: undefined,
      }).success,
    ).toBe(false);
  });

  it("rechaza tipos de tasa desconocidos y UNKNOWN convertido", () => {
    expect(
      interestRateDefinitionSchema.safeParse({
        ...normalizedRate(),
        originalType: "INVENTED",
      }).success,
    ).toBe(false);
    expect(
      interestRateDefinitionSchema.safeParse({
        ...normalizedRate(),
        originalType: "UNKNOWN",
      }).success,
    ).toBe(false);
  });

  it("valida preferencias sin permitir claves financieras ocultas", () => {
    expect(
      appSettingsSchema.safeParse({
        ...validSnapshot().settings,
        bankPassword: "nunca",
      }).success,
    ).toBe(false);
  });

  it("rechaza instantes no UTC, movimientos cero y total simple manipulado", () => {
    expect(utcInstantSchema.safeParse("2026-07-30T07:00:00-05:00").success).toBe(false);
    expect(
      savingsMovementSchema.safeParse({
        id: id(50),
        goalId: id(1),
        type: "CONTRIBUTION",
        amount: "0",
        effectiveDate: "2026-01-01",
        recordedAt: NOW,
        currentRevisionId: id(51),
        status: "ACTIVE",
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
    expect(
      simpleProjectionConfigurationSchema.safeParse({
        ...validSnapshot().simpleConfigurations[0],
        projectedTotal: "999",
      }).success,
    ).toBe(false);
    const baseMovement = movement(90);
    expect(
      savingsMovementSchema.safeParse({
        ...baseMovement,
        amount: "-1",
      }).success,
    ).toBe(false);
    expect(
      savingsMovementSchema.safeParse({
        ...baseMovement,
        type: "ADJUSTMENT",
      }).success,
    ).toBe(false);
    expect(
      savingsMovementSchema.safeParse({
        ...baseMovement,
        status: "VOIDED",
      }).success,
    ).toBe(false);
  });
});

describe("serialización versionada", () => {
  it("realiza ida y vuelta determinista y conserva la tasa original/equivalente", () => {
    const first = serializeDomainSnapshot(validSnapshot(), LIMITS);
    const parsed = parseDomainSnapshot(first, LIMITS);
    const second = serializeDomainSnapshot(parsed, LIMITS);
    expect(second).toBe(first);
    expect(parsed.rateDefinitions[0]?.originalValue).toBe("10");
    expect(parsed.rateDefinitions[0]?.canonicalEffectiveAnnualRate).toBe("0.1");
    expect(DEFAULT_RATE_EQUIVALENCE_TOLERANCE).toBe(
      "0.000000000000000001",
    );

    const { rateEquivalenceTolerance: _omitted, ...limitsWithDefault } = LIMITS;
    expect(() =>
      validateDomainSnapshot(validSnapshot(), limitsWithDefault),
    ).not.toThrow();
  });

  it("rechaza una equivalencia o método de conversión manipulado", () => {
    const tampered = validSnapshot();
    const current = tampered.rateDefinitions[0];
    expect(current).toBeDefined();
    tampered.rateDefinitions[0] = {
      ...(current as (typeof tampered.rateDefinitions)[number]),
      canonicalEffectiveAnnualRate: "0.2",
    };
    expect(() => validateDomainSnapshot(tampered, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const periodicTampered = validSnapshot();
    const periodic = periodicTampered.rateDefinitions[0]!;
    periodicTampered.rateDefinitions[0] = {
      ...periodic,
      equivalentPeriodicRate: "0.3",
    };
    expect(() => validateDomainSnapshot(periodicTampered, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const formulaTampered = validSnapshot();
    formulaTampered.rateDefinitions[0] = {
      ...formulaTampered.rateDefinitions[0]!,
      conversionFormula: "EA = j",
    };
    expect(() => validateDomainSnapshot(formulaTampered, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const withinTolerance = validSnapshot();
    withinTolerance.rateDefinitions[0] = {
      ...withinTolerance.rateDefinitions[0]!,
      canonicalEffectiveAnnualRate: "0.1000000000000000005",
    };
    expect(() => validateDomainSnapshot(withinTolerance, LIMITS)).not.toThrow();

    const excessiveRate = validSnapshot();
    excessiveRate.rateDefinitions[0] = {
      ...excessiveRate.rateDefinitions[0]!,
      originalValue: "101",
      canonicalEffectiveAnnualRate: "1.01",
      equivalentPeriodicRate: "1.01",
    };
    expect(() => validateDomainSnapshot(excessiveRate, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );
  });

  it("rechaza JSON corrupto, versión futura y claves desconocidas", () => {
    expect(() => parseDomainSnapshot("{", LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );
    expect(() =>
      parseDomainSnapshot(
        JSON.stringify({ ...validSnapshot(), schemaVersion: 999 }),
        LIMITS,
      ),
    ).toThrowError(expect.objectContaining({ code: "INCOMPATIBLE_VERSION" }));
    expect(() =>
      validateDomainSnapshot({ ...validSnapshot(), execute: "code" }, LIMITS),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    const ambiguous = validSnapshot();
    const { projectionMode: _projectionMode, ...withoutProjectionMode } =
      ambiguous.configurations[0]!;
    expect(() =>
      parseDomainSnapshot(
        JSON.stringify({
          ...ambiguous,
          configurations: [withoutProjectionMode],
        }),
        LIMITS,
      ),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));
  });

  it("rechaza archivo grande y objetos demasiado profundos antes de aceptarlos", () => {
    const json = JSON.stringify(validSnapshot());
    expect(() =>
      parseDomainSnapshot(json, { ...LIMITS, maximumBytes: 10 }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    expect(() =>
      serializeDomainSnapshot(validSnapshot(), {
        ...LIMITS,
        maximumBytes: 100,
      }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    let deep: unknown = "leaf";
    for (let index = 0; index < 30; index += 1) {
      deep = { child: deep };
    }
    expect(() =>
      validateDomainSnapshot(deep, { ...LIMITS, maximumDepth: 10 }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => validateDomainSnapshot(cyclic, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );
  });

  it("exige límites y tolerancia explícitos válidos", () => {
    expect(() =>
      validateDomainSnapshot(validSnapshot(), { ...LIMITS, maximumGoals: 0 }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(() =>
      validateDomainSnapshot(validSnapshot(), {
        ...LIMITS,
        rateEquivalenceTolerance: "-1",
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  });

  it("rechaza identificadores duplicados y relaciones huérfanas", () => {
    const duplicate = validSnapshot();
    duplicate.goals.push({ ...duplicate.goals[0] } as (typeof duplicate.goals)[number]);
    expect(() => validateDomainSnapshot(duplicate, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const orphan = validSnapshot();
    const existingConfiguration = orphan.configurations[0];
    expect(existingConfiguration).toBeDefined();
    orphan.configurations[0] = {
      ...(existingConfiguration as (typeof orphan.configurations)[number]),
      goalId: id(999),
    };
    expect(() => validateDomainSnapshot(orphan, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );
  });

  it("rechaza configuración activa, configuración simple y producto inconsistentes", () => {
    const missingActive = validSnapshot();
    missingActive.goals[0] = {
      ...missingActive.goals[0]!,
      activeConfigurationId: id(999),
    };
    expect(() => validateDomainSnapshot(missingActive, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const wrongSimple = validSnapshot();
    wrongSimple.simpleConfigurations[0] = {
      ...wrongSimple.simpleConfigurations[0]!,
      configurationId: id(999),
    };
    expect(() => validateDomainSnapshot(wrongSimple, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const orphanProduct = validSnapshot();
    orphanProduct.productConfigurations.push(
      snapshotValue<DomainSnapshotV1["productConfigurations"][number]>(
        flexibleProduct({ id: id(700), configurationId: id(999) }),
      ),
    );
    expect(() => validateDomainSnapshot(orphanProduct, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const missingProductReference = validSnapshot();
    missingProductReference.configurations[0] = {
      ...missingProductReference.configurations[0]!,
      projectionMode: "ADVANCED",
      initialBalance: "0",
      contributionTiming: "END_OF_DAY",
      productConfigurationId: id(999),
    };
    expect(() =>
      validateDomainSnapshot(missingProductReference, LIMITS),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));
  });

  it("rechaza movimientos, revisiones y periodos de tasa huérfanos o superpuestos", () => {
    const orphanMovement = validSnapshot();
    orphanMovement.movements.push(movement(1, { goalId: id(999) }));
    expect(() => validateDomainSnapshot(orphanMovement, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const orphanRevision = validSnapshot();
    const snapshotMovement = movement(2);
    orphanRevision.movementRevisions.push({
      id: id(710),
      movementId: snapshotMovement.id,
      revisionNumber: 2,
      snapshot: snapshotMovement,
      reason: "Corrección",
      createdAt: NOW,
    });
    expect(() => validateDomainSnapshot(orphanRevision, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const overlappingPeriods = validSnapshot();
    const rateId = overlappingPeriods.rateDefinitions[0]!.id;
    overlappingPeriods.ratePeriods.push(
      ratePeriod({ rateDefinitionId: rateId, endDate: "2026-08-01" }),
      ratePeriod({
        id: id(301),
        rateDefinitionId: rateId,
        startDate: "2026-07-01",
        endDate: "2026-12-01",
      }),
    );
    expect(() =>
      validateDomainSnapshot(overlappingPeriods, LIMITS),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));
  });

  it("rechaza cierres, proyecciones y comparaciones con referencias inválidas", () => {
    const orphanClose = validSnapshot();
    orphanClose.closes.push({
      ...createActualPeriodClose("0", [], {
        id: id(720),
        goalId: id(1),
        periodStart: "2026-01-01",
        periodEnd: "2026-02-01",
        configurationRevisionId: id(2),
        closedAt: NOW,
      }),
      configurationRevisionId: id(999),
    });
    expect(() => validateDomainSnapshot(orphanClose, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const orphanProjection = validSnapshot();
    const projection = createSimpleProjectionResult(
      calculateSimpleProjection({
        periodicAmount: "100",
        periodicity: "MONTHLY",
        numberOfPeriods: 1,
        startDate: "2026-01-01",
      }),
      {
        id: id(730),
        goalId: id(1),
        configurationRevisionId: id(2),
        cutoffDate: "2026-01-01",
        calculatedAt: NOW,
      },
    );
    orphanProjection.projectionResults.push(
      snapshotValue<DomainSnapshotV1["projectionResults"][number]>({
        ...projection,
        configurationRevisionId: id(999),
      }),
    );
    expect(() => validateDomainSnapshot(orphanProjection, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    const orphanComparison = validSnapshot();
    const validProjection = createSimpleProjectionResult(
      calculateSimpleProjection({
        periodicAmount: "100",
        periodicity: "MONTHLY",
        numberOfPeriods: 1,
        startDate: "2026-01-01",
      }),
      {
        id: id(731),
        goalId: id(1),
        configurationRevisionId: id(2),
        cutoffDate: "2026-01-01",
        calculatedAt: NOW,
      },
    );
    orphanComparison.projectionResults.push(
      snapshotValue<DomainSnapshotV1["projectionResults"][number]>(
        validProjection,
      ),
    );
    const comparison = compareProjectionWithActual({
      id: id(732),
      goalId: id(1),
      projection: validProjection,
      actual: {
        openingBalance: "0",
        contributions: "100",
        extraContributions: "0",
        withdrawals: "0",
        actualYield: "0",
        adjustments: "0",
        closingBalance: "100",
        movementIds: [],
      },
      cutoffDate: "2026-02-01",
      onTrackTolerance: "0",
      calculatedAt: NOW,
    });
    orphanComparison.comparisonResults.push(
      snapshotValue<DomainSnapshotV1["comparisonResults"][number]>({
        ...comparison,
        projectionResultId: id(999),
      }),
    );
    expect(() =>
      validateDomainSnapshot(orphanComparison, LIMITS),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));
  });

  it("aplica límites de cantidad después de validar el esquema", () => {
    const tooManyMovements = validSnapshot();
    tooManyMovements.movements.push(movement(1), movement(2));
    expect(() =>
      validateDomainSnapshot(tooManyMovements, {
        ...LIMITS,
        maximumMovements: 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    const tooManyPeriods = validSnapshot();
    const rateId = tooManyPeriods.rateDefinitions[0]!.id;
    tooManyPeriods.ratePeriods.push(
      ratePeriod({ rateDefinitionId: rateId, endDate: "2026-07-01" }),
      ratePeriod({
        id: id(301),
        rateDefinitionId: rateId,
        startDate: "2026-07-01",
        endDate: "2027-01-01",
      }),
    );
    expect(() =>
      validateDomainSnapshot(tooManyPeriods, {
        ...LIMITS,
        maximumRatePeriods: 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    const excessiveAmount = validSnapshot();
    excessiveAmount.movements.push(
      movement(10, { amount: "10000000001" }),
    );
    expect(() => validateDomainSnapshot(excessiveAmount, LIMITS)).toThrowError(
      expect.objectContaining({ code: "SERIALIZATION_ERROR" }),
    );

    expect(() =>
      validateDomainSnapshot(validSnapshot(), {
        ...LIMITS,
        numericLimits: { maximumAmount: "50000" },
      }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));

    expect(() =>
      validateDomainSnapshot(validSnapshot(), {
        ...LIMITS,
        numericLimits: { maximumRatePercent: "5" },
      }),
    ).toThrowError(expect.objectContaining({ code: "SERIALIZATION_ERROR" }));
  });

  it("no acepta números no finitos ni funciones como JSON de dominio", () => {
    expect(
      domainSnapshotV1Schema.safeParse({
        ...validSnapshot(),
        settings: { ...validSnapshot().settings, schemaVersion: Number.NaN },
      }).success,
    ).toBe(false);
    expect(() =>
      serializeDomainSnapshot(
        { ...validSnapshot(), injected: () => "no" },
        LIMITS,
      ),
    ).toThrow(DomainError);
  });
});

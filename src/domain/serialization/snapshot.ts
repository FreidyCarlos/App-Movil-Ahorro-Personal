import { z } from "zod";
import { Decimal } from "decimal.js";

import { stableStringify, utf8ByteLength } from "../canonical.js";
import {
  COP_ROUNDING_POLICY_VERSION,
  DEFAULT_NUMERIC_LIMITS,
  NUMERIC_POLICY_VERSION,
  parseDecimal,
  resolveNumericLimits,
  type NumericLimits,
  type ResolvedNumericLimits,
} from "../decimal.js";
import { DomainError, assertDomain } from "../errors.js";
import {
  FINANCIAL_PRECISION,
  normalizeInterestRate,
  type InterestRateInput,
} from "../calculations/rates.js";
import {
  actualPeriodCloseSchema,
  appSettingsSchema,
  backupMetadataSchema,
  financialProductConfigurationSchema,
  interestRateDefinitionSchema,
  movementRevisionSchema,
  savingsGoalSchema,
  savingsMovementSchema,
  savingsPlanConfigurationSchema,
  simpleProjectionConfigurationSchema,
  utcInstantSchema,
  yieldRatePeriodSchema,
} from "../validation/schemas.js";

export const DOMAIN_SNAPSHOT_SCHEMA_VERSION = 1;
export const RATE_EQUIVALENCE_POLICY_VERSION =
  "rate-equivalence-tolerance-v1";
export const DEFAULT_RATE_EQUIVALENCE_TOLERANCE = "0.000000000000000001";

export const domainSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal(DOMAIN_SNAPSHOT_SCHEMA_VERSION),
    appVersion: z.string().min(1).max(80),
    rulesVersion: z.string().min(1).max(80),
    exportedAt: utcInstantSchema,
    policyMetadata: z
      .object({
        numericPolicyVersion: z.literal(NUMERIC_POLICY_VERSION),
        maximumAmountCop: z.literal(DEFAULT_NUMERIC_LIMITS.maximumAmount),
        maximumRatePercent: z.literal(
          DEFAULT_NUMERIC_LIMITS.maximumRatePercent,
        ),
        maximumCanonicalEffectiveAnnualRate: z.literal(
          DEFAULT_NUMERIC_LIMITS.maximumCanonicalEffectiveAnnualRate,
        ),
        roundingPolicyVersion: z.literal(COP_ROUNDING_POLICY_VERSION),
        rateEquivalencePolicyVersion: z.literal(
          RATE_EQUIVALENCE_POLICY_VERSION,
        ),
        rateEquivalenceTolerance: z.literal(
          DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
        ),
      })
      .strict(),
    goals: z.array(savingsGoalSchema),
    configurations: z.array(savingsPlanConfigurationSchema),
    simpleConfigurations: z.array(simpleProjectionConfigurationSchema),
    rateDefinitions: z.array(interestRateDefinitionSchema),
    ratePeriods: z.array(yieldRatePeriodSchema),
    productConfigurations: z.array(financialProductConfigurationSchema),
    movements: z.array(savingsMovementSchema),
    movementRevisions: z.array(movementRevisionSchema),
    closes: z.array(actualPeriodCloseSchema),
    backupMetadata: z.array(backupMetadataSchema),
    settings: appSettingsSchema,
  })
  .strict();

export type DomainSnapshotV1 = z.infer<typeof domainSnapshotV1Schema>;

function orderedById<T extends Readonly<{ id: string }>>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((left, right) => left.id.localeCompare(right.id));
}

export function canonicalizeSnapshot(
  snapshot: DomainSnapshotV1,
): DomainSnapshotV1 {
  return {
    ...snapshot,
    goals: orderedById(snapshot.goals),
    configurations: orderedById(snapshot.configurations),
    simpleConfigurations: orderedById(snapshot.simpleConfigurations),
    rateDefinitions: orderedById(snapshot.rateDefinitions),
    ratePeriods: orderedById(snapshot.ratePeriods),
    productConfigurations: orderedById(snapshot.productConfigurations),
    movements: orderedById(snapshot.movements),
    movementRevisions: orderedById(snapshot.movementRevisions),
    closes: orderedById(snapshot.closes),
    backupMetadata: orderedById(snapshot.backupMetadata),
  };
}

export interface SerializationLimits {
  readonly maximumBytes: number;
  readonly maximumDepth: number;
  readonly maximumGoals: number;
  readonly maximumMovements: number;
  readonly maximumRatePeriods: number;
  readonly rateEquivalenceTolerance?: string;
  readonly numericLimits?: NumericLimits;
}

function calculateDepth(value: unknown, depth = 0): number {
  let maximum = depth;
  const pending: Array<{ readonly value: unknown; readonly depth: number }> = [
    { value, depth },
  ];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) {
      break;
    }
    maximum = Math.max(maximum, current.depth);
    if (current.value === null || typeof current.value !== "object") {
      continue;
    }
    assertDomain(
      !seen.has(current.value),
      "SERIALIZATION_ERROR",
      "No se permiten ciclos en una copia.",
    );
    seen.add(current.value);
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Readonly<Record<string, unknown>>);
    for (const child of children) {
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return maximum;
}

function validateUniqueIds(
  label: string,
  entries: readonly Readonly<{ id: string }>[],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    assertDomain(
      !seen.has(entry.id),
      "SERIALIZATION_ERROR",
      `Identificador duplicado en ${label}.`,
      { id: entry.id },
    );
    seen.add(entry.id);
  }
}

function toRateInput(
  definition: DomainSnapshotV1["rateDefinitions"][number],
): InterestRateInput {
  return {
    id: definition.id,
    originalValue: definition.originalValue,
    originalType: definition.originalType,
    originalPeriodicity: definition.originalPeriodicity,
    ...(definition.capitalizationPeriodsPerYear === undefined
      ? {}
      : {
          capitalizationPeriodsPerYear:
            definition.capitalizationPeriodsPerYear,
        }),
    timing: definition.timing,
    variability: definition.variability,
    effectiveFrom: definition.effectiveFrom,
    ...(definition.sourceName === undefined
      ? {}
      : { sourceName: definition.sourceName }),
    ...(definition.sourceUrl === undefined
      ? {}
      : { sourceUrl: definition.sourceUrl }),
    ...(definition.sourceNote === undefined
      ? {}
      : { sourceNote: definition.sourceNote }),
    ...(definition.consultedAt === undefined
      ? {}
      : { consultedAt: definition.consultedAt }),
    createdAt: definition.createdAt,
    rulesVersion: definition.rulesVersion,
  };
}

function validateRateEquivalences(
  snapshot: DomainSnapshotV1,
  toleranceInput: string,
  numericLimits: NumericLimits | undefined,
): void {
  let tolerance: Decimal;
  try {
    tolerance = new Decimal(toleranceInput);
  } catch {
    throw new DomainError(
      "INVALID_CONFIGURATION",
      "La tolerancia de equivalencia no es decimal.",
    );
  }
  assertDomain(
    tolerance.isFinite() && tolerance.greaterThanOrEqualTo(0),
    "INVALID_CONFIGURATION",
    "La tolerancia de equivalencia debe ser finita y no negativa.",
  );

  for (const definition of snapshot.rateDefinitions) {
    let recomputed: ReturnType<typeof normalizeInterestRate>;
    try {
      recomputed = normalizeInterestRate(
        toRateInput(definition),
        numericLimits,
      );
    } catch (error) {
      if (error instanceof DomainError) {
        throw new DomainError(
          "SERIALIZATION_ERROR",
          "Una tasa importada no cumple la política financiera vigente.",
          { rateDefinitionId: definition.id, causeCode: error.code },
        );
      }
      throw error;
    }
    const imported = new Decimal(definition.canonicalEffectiveAnnualRate ?? "NaN");
    const expected = new Decimal(recomputed.canonicalEffectiveAnnualRate ?? "NaN");
    const absoluteDifference = imported.minus(expected).abs();
    const relativeDifference = expected.isZero()
      ? absoluteDifference
      : absoluteDifference.dividedBy(expected.abs());
    assertDomain(
      imported.isFinite() &&
        (absoluteDifference.lessThanOrEqualTo(tolerance) ||
          relativeDifference.lessThanOrEqualTo(tolerance)) &&
        definition.conversionMethod === recomputed.conversionMethod &&
        definition.conversionFormula === recomputed.conversionFormula &&
        definition.calculationPrecision === FINANCIAL_PRECISION,
      "SERIALIZATION_ERROR",
      "La equivalencia de una tasa no coincide con sus datos originales.",
      { rateDefinitionId: definition.id },
    );
    if (recomputed.equivalentPeriodicRate !== undefined) {
      const importedPeriodic = new Decimal(
        definition.equivalentPeriodicRate ?? "NaN",
      );
      const expectedPeriodic = new Decimal(recomputed.equivalentPeriodicRate);
      const periodicDifference = importedPeriodic.minus(expectedPeriodic).abs();
      const relativePeriodicDifference = expectedPeriodic.isZero()
        ? periodicDifference
        : periodicDifference.dividedBy(expectedPeriodic.abs());
      assertDomain(
        importedPeriodic.isFinite() &&
          (periodicDifference.lessThanOrEqualTo(tolerance) ||
            relativePeriodicDifference.lessThanOrEqualTo(tolerance)),
        "SERIALIZATION_ERROR",
        "La tasa periódica equivalente no coincide con los datos originales.",
        { rateDefinitionId: definition.id },
      );
    }
  }
}

function validateImportedAmount(
  value: string | undefined,
  field: string,
  limits: ResolvedNumericLimits,
  allowNegative = false,
): void {
  if (value === undefined) {
    return;
  }
  const parsed = parseDecimal(value, {
    allowNegative,
    field,
  });
  assertDomain(
    parsed.abs().lessThanOrEqualTo(limits.maximumAmount),
    "SERIALIZATION_ERROR",
    "Un monto importado excede el máximo técnico permitido.",
    { field, maximum: limits.maximumAmount },
  );
}

function validateSnapshotNumericPolicy(
  snapshot: DomainSnapshotV1,
  configuredLimits: NumericLimits | undefined,
): void {
  const limits = resolveNumericLimits(configuredLimits);
  for (const goal of snapshot.goals) {
    validateImportedAmount(goal.targetAmount, `goals.${goal.id}.targetAmount`, limits);
    validateImportedAmount(goal.initialBalance, `goals.${goal.id}.initialBalance`, limits);
  }
  for (const configuration of snapshot.configurations) {
    validateImportedAmount(
      configuration.targetAmount,
      `configurations.${configuration.id}.targetAmount`,
      limits,
    );
    validateImportedAmount(
      configuration.initialBalance,
      `configurations.${configuration.id}.initialBalance`,
      limits,
    );
    validateImportedAmount(
      configuration.periodicContributionAmount,
      `configurations.${configuration.id}.periodicContributionAmount`,
      limits,
    );
  }
  for (const simple of snapshot.simpleConfigurations) {
    validateImportedAmount(
      simple.periodicAmount,
      `simpleConfigurations.${simple.id}.periodicAmount`,
      limits,
    );
  }
  for (const product of snapshot.productConfigurations) {
    validateImportedAmount(
      product.minimumBalance,
      `productConfigurations.${product.id}.minimumBalance`,
      limits,
    );
  }
  for (const movement of snapshot.movements) {
    validateImportedAmount(
      movement.amount,
      `movements.${movement.id}.amount`,
      limits,
      movement.type === "ADJUSTMENT",
    );
  }
  for (const revision of snapshot.movementRevisions) {
    validateImportedAmount(
      revision.snapshot.amount,
      `movementRevisions.${revision.id}.snapshot.amount`,
      limits,
      revision.snapshot.type === "ADJUSTMENT",
    );
  }
  for (const close of snapshot.closes) {
    for (const [field, value] of Object.entries({
      openingBalance: close.openingBalance,
      contributions: close.contributions,
      extraContributions: close.extraContributions,
      withdrawals: close.withdrawals,
      actualYield: close.actualYield,
      closingBalance: close.closingBalance,
      quantizedClosingBalance: close.quantizedClosingBalance,
    })) {
      validateImportedAmount(value, `closes.${close.id}.${field}`, limits);
    }
    validateImportedAmount(
      close.adjustments,
      `closes.${close.id}.adjustments`,
      limits,
      true,
    );
  }
}

function validateSnapshotRelations(
  snapshot: DomainSnapshotV1,
  rateEquivalenceTolerance: string,
  numericLimits: NumericLimits | undefined,
): void {
  validateUniqueIds("goals", snapshot.goals);
  validateUniqueIds("configurations", snapshot.configurations);
  validateUniqueIds("simpleConfigurations", snapshot.simpleConfigurations);
  validateUniqueIds("rateDefinitions", snapshot.rateDefinitions);
  validateUniqueIds("ratePeriods", snapshot.ratePeriods);
  validateUniqueIds("productConfigurations", snapshot.productConfigurations);
  validateUniqueIds("movements", snapshot.movements);
  validateUniqueIds("movementRevisions", snapshot.movementRevisions);
  validateUniqueIds("closes", snapshot.closes);
  validateUniqueIds("backupMetadata", snapshot.backupMetadata);

  const goalIds = new Set(snapshot.goals.map(({ id }) => id));
  const configurationIds = new Set(snapshot.configurations.map(({ id }) => id));
  const configurationsById = new Map(
    snapshot.configurations.map((configuration) => [configuration.id, configuration]),
  );
  const simpleConfigurationsById = new Map(
    snapshot.simpleConfigurations.map((configuration) => [
      configuration.id,
      configuration,
    ]),
  );
  const productsById = new Map(
    snapshot.productConfigurations.map((product) => [product.id, product]),
  );
  const rateDefinitionsById = new Map(
    snapshot.rateDefinitions.map((definition) => [definition.id, definition]),
  );
  const movementsById = new Map(
    snapshot.movements.map((movement) => [movement.id, movement]),
  );
  const movementRevisionsById = new Map(
    snapshot.movementRevisions.map((revision) => [revision.id, revision]),
  );
  const ratePeriodsById = new Map(
    snapshot.ratePeriods.map((period) => [period.id, period]),
  );
  for (const goal of snapshot.goals) {
    const active = configurationsById.get(goal.activeConfigurationId);
    assertDomain(
      active !== undefined && active.goalId === goal.id && active.isActive,
      "SERIALIZATION_ERROR",
      "La configuración activa de la meta no existe o no le pertenece.",
      { goalId: goal.id },
    );
    const activeCount = snapshot.configurations.filter(
      (configuration) => configuration.goalId === goal.id && configuration.isActive,
    ).length;
    assertDomain(
      activeCount === 1,
      "SERIALIZATION_ERROR",
      "Cada meta debe tener exactamente una configuración activa.",
      { goalId: goal.id },
    );
  }
  for (const configuration of snapshot.configurations) {
    assertDomain(
      goalIds.has(configuration.goalId),
      "SERIALIZATION_ERROR",
      "Configuración huérfana.",
      { configurationId: configuration.id },
    );
    if (configuration.projectionMode === "SIMPLE") {
      const simple =
        configuration.simpleProjectionConfigurationId === undefined
          ? undefined
          : simpleConfigurationsById.get(
              configuration.simpleProjectionConfigurationId,
            );
      assertDomain(
        simple !== undefined && simple.configurationId === configuration.id,
        "SERIALIZATION_ERROR",
        "La configuración simple no existe o no corresponde a su revisión.",
        { configurationId: configuration.id },
      );
    }
    if (configuration.productConfigurationId !== undefined) {
      const product = productsById.get(configuration.productConfigurationId);
      assertDomain(
        configuration.projectionMode === "ADVANCED" &&
          product !== undefined &&
          product.configurationId === configuration.id,
        "SERIALIZATION_ERROR",
        "El producto no existe, no corresponde o se asignó a una revisión simple.",
        { configurationId: configuration.id },
      );
    }
    if (configuration.supersedesId !== undefined) {
      const previous = configurationsById.get(configuration.supersedesId);
      assertDomain(
        previous !== undefined &&
          previous.goalId === configuration.goalId &&
          previous.revisionNumber < configuration.revisionNumber,
        "SERIALIZATION_ERROR",
        "La cadena de revisiones de la configuración es inválida.",
        { configurationId: configuration.id },
      );
    }
  }
  for (const simple of snapshot.simpleConfigurations) {
    const owner = configurationsById.get(simple.configurationId);
    assertDomain(
      owner !== undefined &&
        owner.simpleProjectionConfigurationId === simple.id,
      "SERIALIZATION_ERROR",
      "Configuración simple huérfana o no declarada por su revisión.",
      { simpleConfigurationId: simple.id },
    );
  }
  for (const product of snapshot.productConfigurations) {
    const owner = configurationsById.get(product.configurationId);
    assertDomain(
      owner !== undefined &&
        owner.projectionMode === "ADVANCED" &&
        owner.productConfigurationId === product.id,
      "SERIALIZATION_ERROR",
      "Configuración de producto huérfana o no declarada por su revisión.",
      { productConfigurationId: product.id },
    );
    if (product.supersedesId !== undefined) {
      const previous = productsById.get(product.supersedesId);
      const previousOwner =
        previous === undefined
          ? undefined
          : configurationsById.get(previous.configurationId);
      assertDomain(
        previous !== undefined &&
          previousOwner !== undefined &&
          owner !== undefined &&
          previousOwner.goalId === owner.goalId,
        "SERIALIZATION_ERROR",
        "La cadena de revisiones del producto es inválida.",
        { productConfigurationId: product.id },
      );
    }
  }
  const deduplicationKeys = new Set<string>();
  for (const movement of snapshot.movements) {
    const currentRevision = movementRevisionsById.get(
      movement.currentRevisionId,
    );
    assertDomain(
      goalIds.has(movement.goalId) &&
        currentRevision !== undefined &&
        currentRevision.movementId === movement.id &&
        stableStringify(currentRevision.snapshot) === stableStringify(movement),
      "SERIALIZATION_ERROR",
      "Movimiento huérfano o revisión vigente inconsistente.",
      { movementId: movement.id },
    );
    if (movement.deduplicationKey !== undefined) {
      const key = `${movement.goalId}:${movement.deduplicationKey}`;
      assertDomain(
        !deduplicationKeys.has(key),
        "SERIALIZATION_ERROR",
        "La copia contiene movimientos duplicados.",
        { movementId: movement.id },
      );
      deduplicationKeys.add(key);
    }
  }
  for (const revision of snapshot.movementRevisions) {
    const movement = movementsById.get(revision.movementId);
    assertDomain(
      movement !== undefined &&
        revision.snapshot.id === revision.movementId &&
        revision.snapshot.goalId === movement.goalId,
      "SERIALIZATION_ERROR",
      "Revisión de movimiento huérfana o inconsistente.",
      { revisionId: revision.id },
    );
    if (revision.supersedesId !== undefined) {
      const previous = movementRevisionsById.get(revision.supersedesId);
      assertDomain(
        previous !== undefined &&
          previous.movementId === revision.movementId &&
          previous.revisionNumber < revision.revisionNumber,
        "SERIALIZATION_ERROR",
        "La cadena de revisiones del movimiento es inválida.",
        { revisionId: revision.id },
      );
    }
  }
  for (const period of snapshot.ratePeriods) {
    const configuration = configurationsById.get(period.configurationId);
    const rate = rateDefinitionsById.get(period.rateDefinitionId);
    assertDomain(
      goalIds.has(period.goalId) &&
        configuration !== undefined &&
        configuration.goalId === period.goalId &&
        rate !== undefined &&
        rate.effectiveFrom <= period.startDate,
      "SERIALIZATION_ERROR",
      "Periodo de tasa con relación o vigencia inválida.",
      { periodId: period.id },
    );
    if (period.supersedesId !== undefined) {
      const previous = ratePeriodsById.get(period.supersedesId);
      assertDomain(
        previous !== undefined &&
          previous.configurationId === period.configurationId &&
          previous.purpose === period.purpose,
        "SERIALIZATION_ERROR",
        "La cadena de periodos de tasa es inválida.",
        { periodId: period.id },
      );
    }
  }
  const periodGroups = new Map<string, typeof snapshot.ratePeriods>();
  for (const period of snapshot.ratePeriods) {
    const key = `${period.configurationId}:${period.purpose}`;
    const group = periodGroups.get(key) ?? [];
    periodGroups.set(key, [...group, period]);
  }
  for (const periods of periodGroups.values()) {
    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      assertDomain(
        current !== undefined &&
          next !== undefined &&
          current.endDate !== undefined &&
          current.endDate <= next.startDate,
        "SERIALIZATION_ERROR",
        "La copia contiene periodos de tasa superpuestos.",
      );
    }
  }
  for (const close of snapshot.closes) {
    const configuration = configurationsById.get(
      close.configurationRevisionId,
    );
    assertDomain(
      goalIds.has(close.goalId) &&
        configuration !== undefined &&
        configuration.goalId === close.goalId,
      "SERIALIZATION_ERROR",
      "Cierre huérfano.",
      { closeId: close.id },
    );
  }
  const backupIds = new Set(snapshot.backupMetadata.map(({ id }) => id));
  for (const metadata of snapshot.backupMetadata) {
    assertDomain(
      metadata.rollbackBackupId === undefined ||
        (metadata.rollbackBackupId !== metadata.id &&
          backupIds.has(metadata.rollbackBackupId)),
      "SERIALIZATION_ERROR",
      "Metadato de respaldo con relación inválida.",
      { backupMetadataId: metadata.id },
    );
  }
  assertDomain(
    snapshot.settings.schemaVersion === snapshot.schemaVersion,
    "SERIALIZATION_ERROR",
    "La versión de preferencias no coincide con el snapshot.",
  );
  validateRateEquivalences(
    snapshot,
    rateEquivalenceTolerance,
    numericLimits,
  );
}

export function validateDomainSnapshot(
  candidate: unknown,
  limits: SerializationLimits,
): DomainSnapshotV1 {
  assertDomain(
    Number.isInteger(limits.maximumDepth) && limits.maximumDepth > 0,
    "INVALID_CONFIGURATION",
    "maximumDepth debe ser positivo.",
  );
  for (const [name, value] of Object.entries({
    maximumBytes: limits.maximumBytes,
    maximumGoals: limits.maximumGoals,
    maximumMovements: limits.maximumMovements,
    maximumRatePeriods: limits.maximumRatePeriods,
  })) {
    assertDomain(
      Number.isInteger(value) && value > 0,
      "INVALID_CONFIGURATION",
      `${name} debe ser un entero positivo.`,
    );
  }
  assertDomain(
    calculateDepth(candidate) <= limits.maximumDepth,
    "SERIALIZATION_ERROR",
    "La estructura excede la profundidad permitida.",
  );
  const parsed = domainSnapshotV1Schema.safeParse(candidate);
  if (!parsed.success) {
    throw new DomainError("SERIALIZATION_ERROR", "La copia no cumple el esquema.", {
      issues: parsed.error.issues.map(({ path, message }) => ({
        path: path.join("."),
        message,
      })),
    });
  }
  assertDomain(
    parsed.data.goals.length <= limits.maximumGoals,
    "SERIALIZATION_ERROR",
    "La copia excede el número de metas permitido.",
  );
  assertDomain(
    parsed.data.movements.length <= limits.maximumMovements,
    "SERIALIZATION_ERROR",
    "La copia excede el número de movimientos permitido.",
  );
  assertDomain(
    parsed.data.ratePeriods.length <= limits.maximumRatePeriods,
    "SERIALIZATION_ERROR",
    "La copia excede el número de periodos de tasa permitido.",
  );
  validateSnapshotRelations(
    parsed.data,
    limits.rateEquivalenceTolerance ??
      DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
    limits.numericLimits,
  );
  validateSnapshotNumericPolicy(parsed.data, limits.numericLimits);
  return parsed.data;
}

export function serializeDomainSnapshot(
  snapshot: unknown,
  limits: SerializationLimits,
): string {
  const validated = validateDomainSnapshot(snapshot, limits);
  const serialized = stableStringify(validated);
  assertDomain(
    utf8ByteLength(serialized) <= limits.maximumBytes,
    "SERIALIZATION_ERROR",
    "La copia excede el tamaño permitido.",
  );
  return serialized;
}

export function parseDomainSnapshot(
  serialized: string,
  limits: SerializationLimits,
): DomainSnapshotV1 {
  assertDomain(
    utf8ByteLength(serialized) <= limits.maximumBytes,
    "SERIALIZATION_ERROR",
    "El archivo excede el tamaño permitido.",
  );
  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    throw new DomainError("SERIALIZATION_ERROR", "El contenido no es JSON válido.");
  }
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "schemaVersion" in candidate &&
    (candidate as { schemaVersion?: unknown }).schemaVersion !==
      DOMAIN_SNAPSHOT_SCHEMA_VERSION
  ) {
    throw new DomainError(
      "INCOMPATIBLE_VERSION",
      "La versión de la copia no es compatible.",
      {
        schemaVersion: (candidate as { schemaVersion?: unknown }).schemaVersion,
      },
    );
  }
  return validateDomainSnapshot(candidate, limits);
}

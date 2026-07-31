import { nonCryptographicDigest } from "../canonical.js";
import { addCalendarMonths, addCalendarYears, type CivilDate } from "../date.js";
import {
  FinancialDecimal,
  canonicalDecimal,
  parseDecimal,
  resolveNumericLimits,
  type NumericLimits,
} from "../decimal.js";
import { assertDomain } from "../errors.js";
import type {
  ProjectionResult,
  SimplePeriodicity,
  SimpleProjectionConfiguration,
  UtcInstant,
  Uuid,
} from "../models.js";
import {
  FINANCIAL_PRECISION,
  FINANCIAL_RULES_VERSION,
} from "./rates.js";

export interface SimpleProjectionInput {
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: CivilDate;
}

export interface SimpleProjectionCalculation {
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: CivilDate;
  readonly projectedEndDate?: CivilDate;
  readonly projectedTotal: string;
  readonly projectedYield: "0";
  readonly calculationMethod: "SIMPLE_UNIFORM_SUM_V1";
}

export function calculateSimpleProjection(
  input: SimpleProjectionInput,
  limits?: NumericLimits,
): SimpleProjectionCalculation {
  const resolvedLimits = resolveNumericLimits(limits);
  const amount = parseDecimal(input.periodicAmount, {
    allowZero: false,
    field: "periodicAmount",
    maximum: resolvedLimits.maximumAmount,
  });
  assertDomain(
    Number.isInteger(input.numberOfPeriods),
    "INVALID_CONFIGURATION",
    "La cantidad de periodos debe ser entera.",
  );
  const maximum = input.periodicity === "MONTHLY" ? 1200 : 100;
  assertDomain(
    input.numberOfPeriods >= 1 && input.numberOfPeriods <= maximum,
    "INVALID_CONFIGURATION",
    `La cantidad de periodos debe estar entre 1 y ${maximum}.`,
    { periodicity: input.periodicity },
  );

  const projectedTotal = amount.times(new FinancialDecimal(input.numberOfPeriods));
  assertDomain(
    projectedTotal.lessThanOrEqualTo(resolvedLimits.maximumAmount),
    "INVALID_DECIMAL",
    "El total proyectado excede el máximo técnico permitido.",
    { maximum: resolvedLimits.maximumAmount },
  );
  const projectedEndDate =
    input.startDate === undefined
      ? undefined
      : input.periodicity === "MONTHLY"
        ? addCalendarMonths(input.startDate, input.numberOfPeriods)
        : addCalendarYears(input.startDate, input.numberOfPeriods);

  return {
    periodicAmount: canonicalDecimal(amount),
    periodicity: input.periodicity,
    numberOfPeriods: input.numberOfPeriods,
    ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
    ...(projectedEndDate === undefined ? {} : { projectedEndDate }),
    projectedTotal: canonicalDecimal(projectedTotal),
    projectedYield: "0",
    calculationMethod: "SIMPLE_UNIFORM_SUM_V1",
  };
}

export function toSimpleProjectionConfiguration(
  calculation: SimpleProjectionCalculation,
  identity: { readonly id: Uuid; readonly configurationId: Uuid },
): SimpleProjectionConfiguration {
  return {
    id: identity.id,
    configurationId: identity.configurationId,
    periodicAmount: calculation.periodicAmount,
    periodicity: calculation.periodicity,
    numberOfPeriods: calculation.numberOfPeriods,
    ...(calculation.startDate === undefined ? {} : { startDate: calculation.startDate }),
    calculationMethod: calculation.calculationMethod,
  };
}

export interface SimpleProjectionResultMetadata {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly configurationRevisionId: Uuid;
  readonly cutoffDate: CivilDate;
  readonly calculatedAt: UtcInstant;
  readonly rulesVersion?: string;
  readonly roundingPolicyVersion?: string;
}

export function createSimpleProjectionResult(
  calculation: SimpleProjectionCalculation,
  metadata: SimpleProjectionResultMetadata,
): ProjectionResult {
  const projectedEndDate = calculation.projectedEndDate ?? metadata.cutoffDate;
  return {
    id: metadata.id,
    goalId: metadata.goalId,
    configurationRevisionId: metadata.configurationRevisionId,
    projectionKind: "ORIGINAL",
    projectionMode: "SIMPLE",
    cutoffDate: metadata.cutoffDate,
    projectedEndDate,
    initialBalance: "0",
    projectedContributions: calculation.projectedTotal,
    projectedExtraContributions: "0",
    projectedWithdrawals: "0",
    projectedYield: "0",
    finalBalance: calculation.projectedTotal,
    trajectory: [],
    ratePeriodIds: [],
    inputDigest: nonCryptographicDigest(calculation),
    rulesVersion: metadata.rulesVersion ?? FINANCIAL_RULES_VERSION,
    precision: FINANCIAL_PRECISION,
    roundingPolicyVersion: metadata.roundingPolicyVersion ?? "UNQUANTIZED_V1",
    status: "CALCULATED",
    blockingReasons: [],
    calculatedAt: metadata.calculatedAt,
  };
}

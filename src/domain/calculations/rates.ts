import type { Decimal } from "decimal.js";

import {
  dayCountFractions,
  parseCivilDate,
  type CivilDate,
  type DayCountConvention,
} from "../date.js";
import {
  FinancialDecimal,
  canonicalDecimal,
  parseDecimal,
  resolveNumericLimits,
  type NumericLimits,
} from "../decimal.js";
import { DomainError, assertDomain } from "../errors.js";
import type {
  InterestRateDefinition,
  RatePeriodicity,
  RateTiming,
  RateType,
  RateVariability,
  UtcInstant,
  Uuid,
  YieldRatePeriod,
} from "../models.js";

export const FINANCIAL_RULES_VERSION = "financial-rules-1";
export const FINANCIAL_PRECISION = 50;

export interface InterestRateInput {
  readonly id: Uuid;
  readonly originalValue?: string;
  readonly originalType: RateType;
  readonly originalPeriodicity: RatePeriodicity;
  readonly capitalizationPeriodsPerYear?: number;
  readonly timing: RateTiming;
  readonly variability: RateVariability;
  readonly effectiveFrom: CivilDate;
  readonly sourceName?: string;
  readonly sourceUrl?: string;
  readonly sourceNote?: string;
  readonly consultedAt?: CivilDate;
  readonly createdAt: UtcInstant;
  readonly rulesVersion?: string;
}

export type RateInputAssessment =
  | {
      readonly status: "VALID";
      readonly definition: InterestRateDefinition;
      readonly blockingReasons: readonly [];
    }
  | {
      readonly status: "BLOCKED";
      readonly blockingReasons: readonly string[];
    };

interface Conversion {
  readonly annual: Decimal;
  readonly periodic?: Decimal;
  readonly method: string;
  readonly formula: string;
}

const EFFECTIVE_PERIODS: Readonly<Partial<Record<RatePeriodicity, number>>> = {
  ANNUAL: 1,
  SEMIANNUAL: 2,
  QUARTERLY: 4,
  BIMONTHLY: 6,
  MONTHLY: 12,
};

function percentToDecimal(value: string, limits: NumericLimits): Decimal {
  return parseDecimal(value, {
    field: "originalValue",
    maximum: limits.maximumRatePercent,
  }).dividedBy(100);
}

function effectiveToAnnual(periodicRate: Decimal, periodsPerYear: number): Decimal {
  return periodicRate.plus(1).pow(periodsPerYear).minus(1);
}

function requirePeriods(input: InterestRateInput): number {
  const periods = input.capitalizationPeriodsPerYear;
  assertDomain(
    Number.isInteger(periods) && (periods ?? 0) > 0 && (periods ?? 0) <= 366,
    "RATE_DATA_INCOMPLETE",
    "La tasa requiere una periodicidad de capitalización explícita.",
    { field: "capitalizationPeriodsPerYear" },
  );
  return periods as number;
}

function requireTiming(input: InterestRateInput, expected: RateTiming): void {
  assertDomain(
    input.timing === expected,
    "RATE_DATA_INCOMPLETE",
    `La modalidad debe ser ${expected}.`,
    { expected, actual: input.timing },
  );
}

function requirePeriodicity(
  input: InterestRateInput,
  expected: RatePeriodicity,
): void {
  assertDomain(
    input.originalPeriodicity === expected,
    "RATE_DATA_INCOMPLETE",
    `La periodicidad debe ser ${expected}.`,
    { expected, actual: input.originalPeriodicity },
  );
}

function convertRate(
  input: InterestRateInput,
  rate: Decimal,
): Conversion {
  switch (input.originalType) {
    case "ZERO":
      requirePeriodicity(input, "NOT_APPLICABLE");
      requireTiming(input, "NOT_APPLICABLE");
      assertDomain(rate.isZero(), "INVALID_DECIMAL", "ZERO debe conservar valor original 0.");
      return {
        annual: new FinancialDecimal(0),
        periodic: new FinancialDecimal(0),
        method: "ZERO_V1",
        formula: "EA = 0",
      };
    case "EA":
      requirePeriodicity(input, "ANNUAL");
      requireTiming(input, "DUE");
      return {
        annual: rate,
        periodic: rate,
        method: "EA_IDENTITY_V1",
        formula: "EA = i_a",
      };
    case "EM":
      requirePeriodicity(input, "MONTHLY");
      requireTiming(input, "DUE");
      return {
        annual: effectiveToAnnual(rate, 12),
        periodic: rate,
        method: "EM_TO_EA_V1",
        formula: "EA = (1 + i_m)^12 - 1",
      };
    case "ET":
      requirePeriodicity(input, "QUARTERLY");
      requireTiming(input, "DUE");
      return {
        annual: effectiveToAnnual(rate, 4),
        periodic: rate,
        method: "ET_TO_EA_V1",
        formula: "EA = (1 + i_t)^4 - 1",
      };
    case "ES":
      requirePeriodicity(input, "SEMIANNUAL");
      requireTiming(input, "DUE");
      return {
        annual: effectiveToAnnual(rate, 2),
        periodic: rate,
        method: "ES_TO_EA_V1",
        formula: "EA = (1 + i_s)^2 - 1",
      };
    case "NMV": {
      requirePeriodicity(input, "MONTHLY");
      requireTiming(input, "DUE");
      if (input.capitalizationPeriodsPerYear !== undefined) {
        assertDomain(
          input.capitalizationPeriodsPerYear === 12,
          "RATE_DATA_INCOMPLETE",
          "N.M.V. requiere 12 capitalizaciones por año.",
        );
      }
      const periodic = rate.dividedBy(12);
      return {
        annual: effectiveToAnnual(periodic, 12),
        periodic,
        method: "NMV_TO_EA_V1",
        formula: "i_m = j/12; EA = (1 + j/12)^12 - 1",
      };
    }
    case "NTV": {
      requirePeriodicity(input, "QUARTERLY");
      requireTiming(input, "DUE");
      if (input.capitalizationPeriodsPerYear !== undefined) {
        assertDomain(
          input.capitalizationPeriodsPerYear === 4,
          "RATE_DATA_INCOMPLETE",
          "N.T.V. requiere 4 capitalizaciones por año.",
        );
      }
      const periodic = rate.dividedBy(4);
      return {
        annual: effectiveToAnnual(periodic, 4),
        periodic,
        method: "NTV_TO_EA_V1",
        formula: "i_t = j/4; EA = (1 + j/4)^4 - 1",
      };
    }
    case "NOMINAL_ANNUAL_DUE": {
      requireTiming(input, "DUE");
      const periods = requirePeriods(input);
      const declaredPeriods = EFFECTIVE_PERIODS[input.originalPeriodicity];
      assertDomain(
        input.originalPeriodicity === "CUSTOM" || declaredPeriods === periods,
        "RATE_DATA_INCOMPLETE",
        "La periodicidad declarada no coincide con la capitalización.",
      );
      const periodic = rate.dividedBy(periods);
      return {
        annual: effectiveToAnnual(periodic, periods),
        periodic,
        method: "NOMINAL_ANNUAL_DUE_TO_EA_V1",
        formula: "i_p = j/n; EA = (1 + j/n)^n - 1",
      };
    }
    case "NOMINAL_ANNUAL_ADVANCE": {
      requireTiming(input, "ADVANCE");
      const periods = requirePeriods(input);
      const declaredPeriods = EFFECTIVE_PERIODS[input.originalPeriodicity];
      assertDomain(
        input.originalPeriodicity === "CUSTOM" || declaredPeriods === periods,
        "RATE_DATA_INCOMPLETE",
        "La periodicidad declarada no coincide con la capitalización.",
      );
      const discount = rate.dividedBy(periods);
      assertDomain(
        discount.lessThan(1),
        "INVALID_DECIMAL",
        "La tasa periódica anticipada debe ser menor que 100 %.",
      );
      const periodic = discount.dividedBy(new FinancialDecimal(1).minus(discount));
      return {
        annual: new FinancialDecimal(1).minus(discount).pow(-periods).minus(1),
        periodic,
        method: "NOMINAL_ANNUAL_ADVANCE_TO_EA_V1",
        formula: "d = j/n; i_v = d/(1-d); EA = (1-d)^(-n) - 1",
      };
    }
    case "CUSTOM_EFFECTIVE_PERIODIC": {
      requireTiming(input, "DUE");
      const periods =
        input.originalPeriodicity === "CUSTOM"
          ? requirePeriods(input)
          : EFFECTIVE_PERIODS[input.originalPeriodicity];
      assertDomain(
        periods !== undefined,
        "RATE_DATA_INCOMPLETE",
        "La tasa efectiva personalizada requiere periodicidad compatible.",
      );
      return {
        annual: effectiveToAnnual(rate, periods),
        periodic: rate,
        method: "CUSTOM_EFFECTIVE_PERIODIC_TO_EA_V1",
        formula: "EA = (1 + i_p)^n - 1",
      };
    }
    case "UNKNOWN":
      throw new DomainError(
        "RATE_DATA_INCOMPLETE",
        "No estoy seguro bloquea la conversión hasta completar los datos.",
        { field: "originalType" },
      );
  }
}

function copyOptionalRateFields(
  input: InterestRateInput,
): Pick<
  InterestRateDefinition,
  "sourceName" | "sourceUrl" | "sourceNote" | "consultedAt"
> {
  return {
    ...(input.sourceName === undefined ? {} : { sourceName: input.sourceName }),
    ...(input.sourceUrl === undefined ? {} : { sourceUrl: input.sourceUrl }),
    ...(input.sourceNote === undefined ? {} : { sourceNote: input.sourceNote }),
    ...(input.consultedAt === undefined ? {} : { consultedAt: input.consultedAt }),
  };
}

export function normalizeInterestRate(
  input: InterestRateInput,
  limits?: NumericLimits,
): InterestRateDefinition {
  const resolvedLimits = resolveNumericLimits(limits);
  parseCivilDate(input.effectiveFrom);
  if (input.consultedAt !== undefined) {
    parseCivilDate(input.consultedAt);
  }
  if (input.originalType === "UNKNOWN") {
    throw new DomainError(
      "RATE_DATA_INCOMPLETE",
      "No estoy seguro no crea una definición de tasa.",
      { field: "originalType" },
    );
  }
  assertDomain(
    input.originalValue !== undefined,
    "RATE_DATA_INCOMPLETE",
    "La tasa requiere un valor original.",
  );
  const originalRate = percentToDecimal(input.originalValue, resolvedLimits);
  const conversion = convertRate(input, originalRate);
  assertDomain(
    conversion.annual.lessThanOrEqualTo(
      resolvedLimits.maximumCanonicalEffectiveAnnualRate,
    ),
    "INVALID_DECIMAL",
    "La tasa equivalente E.A. excede el máximo técnico permitido.",
    {
      maximumCanonicalEffectiveAnnualRate:
        resolvedLimits.maximumCanonicalEffectiveAnnualRate,
    },
  );

  return {
    id: input.id,
    originalValue: input.originalValue,
    originalType: input.originalType,
    originalPeriodicity: input.originalPeriodicity,
    ...(input.capitalizationPeriodsPerYear === undefined
      ? {}
      : { capitalizationPeriodsPerYear: input.capitalizationPeriodsPerYear }),
    timing: input.timing,
    variability: input.variability,
    effectiveFrom: input.effectiveFrom,
    canonicalEffectiveAnnualRate: canonicalDecimal(conversion.annual),
    ...(conversion.periodic === undefined
      ? {}
      : { equivalentPeriodicRate: canonicalDecimal(conversion.periodic) }),
    conversionMethod: conversion.method,
    conversionFormula: conversion.formula,
    calculationPrecision: FINANCIAL_PRECISION,
    conversionStatus: "VALID",
    blockingReasons: [],
    createdAt: input.createdAt,
    rulesVersion: input.rulesVersion ?? FINANCIAL_RULES_VERSION,
    ...copyOptionalRateFields(input),
  };
}

export function assessInterestRateInput(
  input: InterestRateInput,
  limits?: NumericLimits,
): RateInputAssessment {
  if (input.originalType === "UNKNOWN") {
    return {
      status: "BLOCKED",
      blockingReasons: ["RATE_TYPE_UNKNOWN"],
    };
  }
  try {
    return {
      status: "VALID",
      definition: normalizeInterestRate(input, limits),
      blockingReasons: [],
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        status: "BLOCKED",
        blockingReasons: [error.code],
      };
    }
    throw error;
  }
}

export function effectiveRateEquivalent(
  originRate: string,
  originPeriodsPerYear: number,
  destinationPeriodsPerYear: number,
  limits?: NumericLimits,
): string {
  const resolvedLimits = resolveNumericLimits(limits);
  assertDomain(
    Number.isInteger(originPeriodsPerYear) && originPeriodsPerYear > 0,
    "INVALID_CONFIGURATION",
    "La periodicidad de origen debe ser un entero positivo.",
  );
  assertDomain(
    Number.isInteger(destinationPeriodsPerYear) && destinationPeriodsPerYear > 0,
    "INVALID_CONFIGURATION",
    "La periodicidad de destino debe ser un entero positivo.",
  );
  const rate = parseDecimal(originRate, {
    field: "originRate",
    maximum: resolvedLimits.maximumCanonicalEffectiveAnnualRate,
  });
  const exponent = new FinancialDecimal(originPeriodsPerYear).dividedBy(
    destinationPeriodsPerYear,
  );
  const equivalent = rate.plus(1).pow(exponent).minus(1);
  assertDomain(
    equivalent.lessThanOrEqualTo(
      resolvedLimits.maximumCanonicalEffectiveAnnualRate,
    ),
    "INVALID_DECIMAL",
    "La tasa efectiva equivalente excede el máximo técnico permitido.",
  );
  return canonicalDecimal(equivalent);
}

export function effectiveRateForInterval(
  canonicalEffectiveAnnualRate: string,
  start: CivilDate,
  end: CivilDate,
  convention: DayCountConvention,
  limits?: NumericLimits,
): string {
  const resolvedLimits = resolveNumericLimits(limits);
  const annualRate = parseDecimal(canonicalEffectiveAnnualRate, {
    field: "canonicalEffectiveAnnualRate",
    maximum: resolvedLimits.maximumCanonicalEffectiveAnnualRate,
  });
  let factor = new FinancialDecimal(1);
  for (const segment of dayCountFractions(start, end, convention)) {
    factor = factor.times(
      annualRate.plus(1).pow(new FinancialDecimal(segment.fraction)),
    );
  }
  return canonicalDecimal(factor.minus(1));
}

export interface ResolvedRatePeriod {
  readonly period: YieldRatePeriod;
  readonly rate: InterestRateDefinition;
}

export function resolveRateSchedule(
  periods: readonly YieldRatePeriod[],
  definitions: ReadonlyMap<Uuid, InterestRateDefinition>,
  start: CivilDate,
  end: CivilDate,
): readonly ResolvedRatePeriod[] {
  assertDomain(start < end, "INVALID_DATE", "La proyección requiere un intervalo positivo.");
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    assertDomain(
      current !== undefined && next !== undefined,
      "INVALID_CONFIGURATION",
      "Periodo de tasa inválido.",
    );
    assertDomain(
      current.endDate !== undefined && current.endDate <= next.startDate,
      "RATE_PERIOD_OVERLAP",
      "Los periodos de tasa se superponen.",
      { periodId: current.id, nextPeriodId: next.id },
    );
  }
  const resolved: ResolvedRatePeriod[] = [];
  let cursor = start;

  for (const period of sorted) {
    const periodEnd = period.endDate ?? end;
    assertDomain(
      period.startDate < periodEnd,
      "INVALID_CONFIGURATION",
      "Cada periodo de tasa debe tener duración positiva.",
      { periodId: period.id },
    );
    if (periodEnd <= start || period.startDate >= end) {
      continue;
    }
    assertDomain(
      period.startDate <= cursor,
      period.startDate < cursor ? "RATE_PERIOD_OVERLAP" : "RATE_PERIOD_GAP",
      period.startDate < cursor
        ? "Los periodos de tasa se superponen."
        : "Existe un espacio sin tasa explícita.",
      { cursor, periodStart: period.startDate },
    );
    const rate = definitions.get(period.rateDefinitionId);
    assertDomain(
      rate !== undefined,
      "RATE_DATA_INCOMPLETE",
      "No existe la definición de tasa referenciada.",
      { rateDefinitionId: period.rateDefinitionId },
    );
    assertDomain(
      rate.conversionStatus === "VALID" &&
        rate.canonicalEffectiveAnnualRate !== undefined,
      "RATE_DATA_INCOMPLETE",
      "La tasa del periodo no está normalizada.",
      { rateDefinitionId: rate.id },
    );
    resolved.push({ period, rate });
    cursor = periodEnd < end ? periodEnd : end;
    if (cursor === end) {
      break;
    }
  }

  assertDomain(
    cursor === end,
    "RATE_PERIOD_GAP",
    "La proyección termina en un espacio sin tasa explícita.",
    { cursor, end },
  );
  return resolved;
}

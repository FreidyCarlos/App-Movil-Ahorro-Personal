import type { Decimal } from "decimal.js";

import { nonCryptographicDigest } from "../canonical.js";
import {
  addCivilDays,
  compareCivilDates,
  exactCalendarMonthsBetween,
  type CivilDate,
} from "../date.js";
import {
  FinancialDecimal,
  canonicalDecimal,
  parseDecimal,
  resolveNumericLimits,
  type NumericLimits,
  type ResolvedNumericLimits,
} from "../decimal.js";
import { assertDomain } from "../errors.js";
import type {
  ContributionTiming,
  FinancialProductConfiguration,
  InterestRateDefinition,
  MovementType,
  ProjectionPoint,
  ProjectionResult,
  UtcInstant,
  Uuid,
  YieldRatePeriod,
} from "../models.js";
import {
  FINANCIAL_PRECISION,
  FINANCIAL_RULES_VERSION,
  effectiveRateForInterval,
  effectiveRateEquivalent,
  resolveRateSchedule,
  type ResolvedRatePeriod,
} from "./rates.js";

export interface ProjectedEvent {
  readonly id: Uuid;
  readonly date: CivilDate;
  readonly type: Exclude<MovementType, "YIELD" | "ADJUSTMENT">;
  readonly amount: string;
  readonly sequence: number;
}

export interface AdvancedProjectionInput {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly configurationRevisionId: Uuid;
  readonly projectionKind: "ORIGINAL" | "UPDATED";
  readonly startDate: CivilDate;
  readonly endDate: CivilDate;
  readonly initialBalance: string;
  readonly targetAmount?: string;
  readonly contributionTiming?: ContributionTiming;
  readonly product: FinancialProductConfiguration;
  readonly ratePeriods: readonly YieldRatePeriod[];
  readonly rateDefinitions: ReadonlyMap<Uuid, InterestRateDefinition>;
  readonly events: readonly ProjectedEvent[];
  readonly calculatedAt: UtcInstant;
  readonly rulesVersion?: string;
  readonly roundingPolicyVersion?: string;
}

interface EffectiveEvent extends ProjectedEvent {
  readonly effectiveDate: CivilDate;
}

export const DEFAULT_CONTRIBUTION_TIMING: ContributionTiming = "END_OF_DAY";

function validateProduct(
  product: FinancialProductConfiguration,
  events: readonly ProjectedEvent[],
  definitions: ReadonlyMap<Uuid, InterestRateDefinition>,
  endDate: CivilDate,
): void {
  assertDomain(
    product.dayCountConvention !== "PRODUCT_DEFINED",
    "PRODUCT_CONSTRAINT",
    "El producto requiere una convención de días concreta.",
  );
  assertDomain(
    product.capitalizationFrequency !== "OTHER",
    "PRODUCT_CONSTRAINT",
    "La capitalización OTHER no está soportada.",
  );
  assertDomain(
    product.unsupportedConditions.length === 0,
    "PRODUCT_CONSTRAINT",
    "Existen condiciones comerciales que el motor no soporta.",
    { unsupportedConditions: product.unsupportedConditions },
  );
  if (product.productModel === "FIXED_TERM_SIMPLE") {
    assertDomain(
      product.maturityDate !== undefined,
      "PRODUCT_CONSTRAINT",
      "El plazo fijo simple requiere fecha de vencimiento.",
    );
    assertDomain(
      product.capitalizationFrequency === "AT_MATURITY" &&
        product.yieldPaymentDestination === "MATURITY",
      "PRODUCT_CONSTRAINT",
      "El plazo fijo simple solo admite pago al vencimiento.",
    );
    assertDomain(events.length === 0, "PRODUCT_CONSTRAINT", "El plazo fijo simple no admite eventos.");
    assertDomain(
      product.maturityDate === endDate,
      "PRODUCT_CONSTRAINT",
      "El horizonte debe finalizar en el vencimiento del plazo fijo.",
    );
    for (const definition of definitions.values()) {
      assertDomain(
        definition.variability === "FIXED",
        "PRODUCT_CONSTRAINT",
        "El plazo fijo simple no admite tasa variable.",
      );
    }
  } else {
    assertDomain(
      product.yieldPaymentDestination === "CAPITALIZED" ||
        product.productModel === "NO_YIELD",
      "PRODUCT_CONSTRAINT",
      "El MVP solo proyecta rendimientos capitalizados en productos flexibles.",
    );
    assertDomain(
      product.capitalizationFrequency !== "AT_MATURITY" ||
        product.productModel === "NO_YIELD",
      "PRODUCT_CONSTRAINT",
      "La capitalización al vencimiento requiere el modelo de plazo fijo simple.",
    );
    if (product.capitalizationFrequency === "MONTHLY") {
      assertDomain(
        events.length === 0,
        "PRODUCT_CONSTRAINT",
        "La capitalización mensual con movimientos intermedios requiere un calendario de acreditación aún no soportado.",
      );
    }
  }
}

function rateAt(
  schedule: readonly ResolvedRatePeriod[],
  date: CivilDate,
): ResolvedRatePeriod {
  const found = schedule.find(({ period }) => {
    const end = period.endDate;
    return period.startDate <= date && (end === undefined || date < end);
  });
  assertDomain(found !== undefined, "RATE_PERIOD_GAP", "No existe tasa para el intervalo.", {
    date,
  });
  return found;
}

function addEventToBalance(
  event: EffectiveEvent,
  balance: Decimal,
  totals: {
    contributions: Decimal;
    extraContributions: Decimal;
    withdrawals: Decimal;
  },
  product: FinancialProductConfiguration,
  limits: ResolvedNumericLimits,
): Decimal {
  const amount = parseDecimal(event.amount, {
    allowZero: false,
    field: `events.${event.id}.amount`,
    maximum: limits.maximumAmount,
  });
  switch (event.type) {
    case "CONTRIBUTION":
      assertDomain(
        product.additionalContributionsAllowed,
        "PRODUCT_CONSTRAINT",
        "El producto no admite aportes adicionales.",
      );
      totals.contributions = totals.contributions.plus(amount);
      return assertBalanceWithinLimit(balance.plus(amount), limits);
    case "EXTRA_CONTRIBUTION":
      assertDomain(
        product.additionalContributionsAllowed,
        "PRODUCT_CONSTRAINT",
        "El producto no admite aportes extraordinarios.",
      );
      totals.extraContributions = totals.extraContributions.plus(amount);
      return assertBalanceWithinLimit(balance.plus(amount), limits);
    case "WITHDRAWAL":
      assertDomain(product.withdrawalsAllowed, "PRODUCT_CONSTRAINT", "El producto no admite retiros.");
      assertDomain(
        amount.lessThanOrEqualTo(balance),
        "INSUFFICIENT_BALANCE",
        "El retiro excede el saldo proyectado.",
        { eventId: event.id },
      );
      totals.withdrawals = totals.withdrawals.plus(amount);
      return balance.minus(amount);
  }
}

function assertBalanceWithinLimit(
  balance: Decimal,
  limits: ResolvedNumericLimits,
): Decimal {
  assertDomain(
    balance.lessThanOrEqualTo(limits.maximumAmount),
    "INVALID_DECIMAL",
    "El saldo proyectado excede el máximo técnico permitido.",
    { maximum: limits.maximumAmount },
  );
  return balance;
}

export function calculateAdvancedProjection(
  input: AdvancedProjectionInput,
  limits?: NumericLimits,
): ProjectionResult {
  const resolvedLimits = resolveNumericLimits(limits);
  const contributionTiming =
    input.contributionTiming ?? DEFAULT_CONTRIBUTION_TIMING;
  assertDomain(
    compareCivilDates(input.startDate, input.endDate) < 0,
    "INVALID_DATE",
    "La fecha final debe ser posterior a la inicial.",
  );
  validateProduct(input.product, input.events, input.rateDefinitions, input.endDate);
  const initialBalance = parseDecimal(input.initialBalance, {
    field: "initialBalance",
    maximum: resolvedLimits.maximumAmount,
  });
  const target =
    input.targetAmount === undefined
      ? undefined
      : parseDecimal(input.targetAmount, {
          allowZero: false,
          field: "targetAmount",
          maximum: resolvedLimits.maximumAmount,
        });

  const schedule =
    input.product.productModel === "NO_YIELD"
      ? []
      : resolveRateSchedule(
          input.ratePeriods,
          input.rateDefinitions,
          input.startDate,
          input.endDate,
        );
  const expectedPurpose =
    input.projectionKind === "ORIGINAL"
      ? "ORIGINAL_PROJECTION"
      : "UPDATED_PROJECTION";
  assertDomain(
    schedule.every(({ period }) => period.purpose === expectedPurpose),
    "INVALID_CONFIGURATION",
    "El propósito del periodo de tasa no coincide con la proyección.",
  );
  if (input.product.productModel === "FIXED_TERM_SIMPLE") {
    const fixedRates = new Set(
      schedule.map(({ rate }) => rate.canonicalEffectiveAnnualRate),
    );
    assertDomain(
      fixedRates.size === 1,
      "PRODUCT_CONSTRAINT",
      "El plazo fijo simple requiere una sola tasa fija durante toda la vigencia.",
    );
  }
  if (input.product.capitalizationFrequency === "MONTHLY") {
    assertDomain(
      schedule.length === 1 &&
        exactCalendarMonthsBetween(input.startDate, input.endDate) !== undefined,
      "PRODUCT_CONSTRAINT",
      "La capitalización mensual requiere una tasa única y meses calendario completos.",
    );
  }

  const effectiveEvents: EffectiveEvent[] = input.events.map((event) => {
    assertDomain(
      compareCivilDates(event.date, input.startDate) >= 0 &&
        compareCivilDates(event.date, input.endDate) <= 0,
      "INVALID_DATE",
      "El evento está fuera del horizonte de proyección.",
      { eventId: event.id },
    );
    return {
      ...event,
      effectiveDate:
        contributionTiming === "START_OF_DAY"
          ? event.date
          : addCivilDays(event.date, 1),
    };
  });
  for (const event of effectiveEvents) {
    assertDomain(
      event.effectiveDate <= input.endDate,
      "INVALID_DATE",
      "Un evento al final del día queda fuera del horizonte.",
      { eventId: event.id },
    );
  }
  effectiveEvents.sort(
    (a, b) =>
      a.effectiveDate.localeCompare(b.effectiveDate) ||
      a.sequence - b.sequence ||
      a.id.localeCompare(b.id),
  );

  const boundaries = new Set<CivilDate>([input.startDate, input.endDate]);
  for (const event of effectiveEvents) {
    boundaries.add(event.effectiveDate);
  }
  for (const { period } of schedule) {
    if (period.startDate > input.startDate && period.startDate < input.endDate) {
      boundaries.add(period.startDate);
    }
    if (
      period.endDate !== undefined &&
      period.endDate > input.startDate &&
      period.endDate < input.endDate
    ) {
      boundaries.add(period.endDate);
    }
  }
  const orderedBoundaries = [...boundaries].sort();

  let balance = initialBalance;
  let projectedYield = new FinancialDecimal(0);
  const totals = {
    contributions: new FinancialDecimal(0),
    extraContributions: new FinancialDecimal(0),
    withdrawals: new FinancialDecimal(0),
  };
  let targetReachedDate: CivilDate | undefined =
    target !== undefined && balance.greaterThanOrEqualTo(target)
      ? input.startDate
      : undefined;
  const trajectory: ProjectionPoint[] = [];

  let previousBoundary = input.startDate;
  for (let index = 0; index < orderedBoundaries.length; index += 1) {
    const boundary = orderedBoundaries[index];
    assertDomain(boundary !== undefined, "INVALID_CONFIGURATION", "Límite inválido.");

    if (previousBoundary < boundary && !balance.isZero()) {
      let intervalRate = "0";
      if (input.product.productModel !== "NO_YIELD") {
        const active = rateAt(schedule, previousBoundary);
        if (input.product.capitalizationFrequency === "MONTHLY") {
          const months = exactCalendarMonthsBetween(previousBoundary, boundary);
          assertDomain(
            months !== undefined,
            "PRODUCT_CONSTRAINT",
            "El intervalo no contiene meses calendario completos.",
          );
          const monthlyRate = new FinancialDecimal(
            effectiveRateEquivalent(
              active.rate.canonicalEffectiveAnnualRate as string,
              1,
              12,
            ),
          );
          intervalRate = canonicalDecimal(monthlyRate.plus(1).pow(months).minus(1));
        } else {
          intervalRate = effectiveRateForInterval(
            active.rate.canonicalEffectiveAnnualRate as string,
            previousBoundary,
            boundary,
            input.product.dayCountConvention,
          );
        }
      }
      const interest = balance.times(new FinancialDecimal(intervalRate));
      balance = assertBalanceWithinLimit(
        balance.plus(interest),
        resolvedLimits,
      );
      projectedYield = projectedYield.plus(interest);
      if (
        targetReachedDate === undefined &&
        target !== undefined &&
        balance.greaterThanOrEqualTo(target)
      ) {
        targetReachedDate = boundary;
      }
    }

    const eventIds: Uuid[] = [];
    for (const event of effectiveEvents.filter((entry) => entry.effectiveDate === boundary)) {
      balance = addEventToBalance(
        event,
        balance,
        totals,
        input.product,
        resolvedLimits,
      );
      eventIds.push(event.id);
    }
    if (
      targetReachedDate === undefined &&
      target !== undefined &&
      balance.greaterThanOrEqualTo(target)
    ) {
      targetReachedDate = boundary;
    }

    trajectory.push({
      date: boundary,
      balance: canonicalDecimal(balance),
      contributions: canonicalDecimal(totals.contributions),
      extraContributions: canonicalDecimal(totals.extraContributions),
      withdrawals: canonicalDecimal(totals.withdrawals),
      projectedYield: canonicalDecimal(projectedYield),
      eventIds,
    });
    previousBoundary = boundary;
  }

  const digestInput = {
    ...input,
    contributionTiming,
    rateDefinitions: [...input.rateDefinitions.entries()],
  };
  return {
    id: input.id,
    goalId: input.goalId,
    configurationRevisionId: input.configurationRevisionId,
    projectionKind: input.projectionKind,
    projectionMode: "ADVANCED",
    cutoffDate: input.startDate,
    projectedEndDate: input.endDate,
    ...(targetReachedDate === undefined ? {} : { targetReachedDate }),
    initialBalance: canonicalDecimal(initialBalance),
    projectedContributions: canonicalDecimal(totals.contributions),
    projectedExtraContributions: canonicalDecimal(totals.extraContributions),
    projectedWithdrawals: canonicalDecimal(totals.withdrawals),
    projectedYield: canonicalDecimal(projectedYield),
    finalBalance: canonicalDecimal(balance),
    trajectory,
    ratePeriodIds: schedule.map(({ period }) => period.id),
    inputDigest: nonCryptographicDigest(digestInput),
    rulesVersion: input.rulesVersion ?? FINANCIAL_RULES_VERSION,
    precision: FINANCIAL_PRECISION,
    roundingPolicyVersion: input.roundingPolicyVersion ?? "UNQUANTIZED_V1",
    status: "CALCULATED",
    blockingReasons: [],
    calculatedAt: input.calculatedAt,
  };
}

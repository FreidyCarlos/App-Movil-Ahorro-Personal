import {
  FinancialDecimal,
  canonicalDecimal,
  parseDecimal,
  resolveNumericLimits,
  type NumericLimits,
} from "../decimal.js";
import { assertDomain } from "../errors.js";
import type { CivilDate, DayCountConvention } from "../date.js";
import { effectiveRateEquivalent, effectiveRateForInterval } from "./rates.js";

export interface CapitalizationResult {
  readonly principal: string;
  readonly periodicRate: string;
  readonly periods: number;
  readonly grossYield: string;
  readonly finalBalance: string;
}

export function compoundEffectivePeriods(
  principalInput: string,
  periodicRateInput: string,
  periods: number,
  limits?: NumericLimits,
): CapitalizationResult {
  const resolvedLimits = resolveNumericLimits(limits);
  const principal = parseDecimal(principalInput, {
    field: "principal",
    maximum: resolvedLimits.maximumAmount,
  });
  const periodicRate = parseDecimal(periodicRateInput, {
    field: "periodicRate",
    maximum: resolvedLimits.maximumCanonicalEffectiveAnnualRate,
  });
  assertDomain(
    Number.isInteger(periods) && periods >= 0,
    "INVALID_CONFIGURATION",
    "La cantidad de periodos debe ser un entero no negativo.",
  );
  const finalBalance = principal.times(periodicRate.plus(1).pow(periods));
  assertDomain(
    finalBalance.lessThanOrEqualTo(resolvedLimits.maximumAmount),
    "INVALID_DECIMAL",
    "El saldo capitalizado excede el máximo técnico permitido.",
    { maximum: resolvedLimits.maximumAmount },
  );
  return {
    principal: canonicalDecimal(principal),
    periodicRate: canonicalDecimal(periodicRate),
    periods,
    grossYield: canonicalDecimal(finalBalance.minus(principal)),
    finalBalance: canonicalDecimal(finalBalance),
  };
}

export function calculateMonthlyCapitalizationFromEa(
  principal: string,
  canonicalEffectiveAnnualRate: string,
  completeMonths: number,
  limits?: NumericLimits,
): CapitalizationResult {
  const monthlyRate = effectiveRateEquivalent(
    canonicalEffectiveAnnualRate,
    1,
    12,
  );
  return compoundEffectivePeriods(principal, monthlyRate, completeMonths, limits);
}

export interface MaturityResult {
  readonly principal: string;
  readonly intervalRate: string;
  readonly grossYield: string;
  readonly finalBalance: string;
  readonly startDate: CivilDate;
  readonly maturityDate: CivilDate;
  readonly dayCountConvention: DayCountConvention;
}

export function calculateMaturityValue(
  principalInput: string,
  canonicalEffectiveAnnualRate: string,
  startDate: CivilDate,
  maturityDate: CivilDate,
  dayCountConvention: DayCountConvention,
  limits?: NumericLimits,
): MaturityResult {
  const resolvedLimits = resolveNumericLimits(limits);
  const principal = parseDecimal(principalInput, {
    field: "principal",
    maximum: resolvedLimits.maximumAmount,
  });
  const intervalRate = effectiveRateForInterval(
    canonicalEffectiveAnnualRate,
    startDate,
    maturityDate,
    dayCountConvention,
  );
  const grossYield = principal.times(new FinancialDecimal(intervalRate));
  assertDomain(
    principal.plus(grossYield).lessThanOrEqualTo(resolvedLimits.maximumAmount),
    "INVALID_DECIMAL",
    "El valor al vencimiento excede el máximo técnico permitido.",
    { maximum: resolvedLimits.maximumAmount },
  );
  return {
    principal: canonicalDecimal(principal),
    intervalRate,
    grossYield: canonicalDecimal(grossYield),
    finalBalance: canonicalDecimal(principal.plus(grossYield)),
    startDate,
    maturityDate,
    dayCountConvention,
  };
}

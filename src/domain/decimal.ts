import { Decimal } from "decimal.js";

import { DomainError, assertDomain } from "./errors.js";

export const FinancialDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -1000,
  toExpPos: 1000,
});

const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SIGNED_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export interface NumericLimits {
  readonly maximumAmount?: string;
  readonly maximumRatePercent?: string;
  readonly maximumCanonicalEffectiveAnnualRate?: string;
}

export interface ResolvedNumericLimits {
  readonly maximumAmount: string;
  readonly maximumRatePercent: string;
  readonly maximumCanonicalEffectiveAnnualRate: string;
}

export const NUMERIC_POLICY_VERSION = "numeric-policy-cop-v1";
export const TECHNICAL_MAXIMUM_AMOUNT_COP = "10000000000";
export const TECHNICAL_MAXIMUM_RATE_PERCENT = "100";
export const TECHNICAL_MAXIMUM_CANONICAL_EA = "1";

export const DEFAULT_NUMERIC_LIMITS: ResolvedNumericLimits = Object.freeze({
  maximumAmount: TECHNICAL_MAXIMUM_AMOUNT_COP,
  maximumRatePercent: TECHNICAL_MAXIMUM_RATE_PERCENT,
  maximumCanonicalEffectiveAnnualRate: TECHNICAL_MAXIMUM_CANONICAL_EA,
});

export function resolveNumericLimits(
  limits: NumericLimits = DEFAULT_NUMERIC_LIMITS,
): ResolvedNumericLimits {
  const resolved = {
    maximumAmount: limits.maximumAmount ?? DEFAULT_NUMERIC_LIMITS.maximumAmount,
    maximumRatePercent:
      limits.maximumRatePercent ?? DEFAULT_NUMERIC_LIMITS.maximumRatePercent,
    maximumCanonicalEffectiveAnnualRate:
      limits.maximumCanonicalEffectiveAnnualRate ??
      DEFAULT_NUMERIC_LIMITS.maximumCanonicalEffectiveAnnualRate,
  };
  for (const [field, value, ceiling] of [
    [
      "maximumAmount",
      resolved.maximumAmount,
      TECHNICAL_MAXIMUM_AMOUNT_COP,
    ],
    [
      "maximumRatePercent",
      resolved.maximumRatePercent,
      TECHNICAL_MAXIMUM_RATE_PERCENT,
    ],
    [
      "maximumCanonicalEffectiveAnnualRate",
      resolved.maximumCanonicalEffectiveAnnualRate,
      TECHNICAL_MAXIMUM_CANONICAL_EA,
    ],
  ] as const) {
    const parsed = parseDecimal(value, { allowZero: false, field });
    assertDomain(
      parsed.lessThanOrEqualTo(ceiling),
      "INVALID_CONFIGURATION",
      `${field} excede el techo técnico de ${NUMERIC_POLICY_VERSION}.`,
      { field, ceiling },
    );
  }
  return resolved;
}

export const COP_ROUNDING_POLICY_VERSION = "cop-half-up-0-v1";
export const COP_ROUNDING_SCALE = 0;

export function quantizeCop(value: Decimal.Value): string {
  return quantizeDecimal(value, COP_ROUNDING_SCALE, Decimal.ROUND_HALF_UP);
}

export function parseDecimal(
  input: string,
  options: {
    readonly allowNegative?: boolean;
    readonly allowZero?: boolean;
    readonly field?: string;
    readonly maximum?: string | undefined;
  } = {},
): Decimal {
  const field = options.field ?? "value";
  const pattern = options.allowNegative === true ? SIGNED_DECIMAL : UNSIGNED_DECIMAL;

  assertDomain(
    typeof input === "string" && pattern.test(input),
    "INVALID_DECIMAL",
    `${field} debe ser un string decimal canónico.`,
    { field },
  );

  let value: Decimal;
  try {
    value = new FinancialDecimal(input);
  } catch {
    throw new DomainError("INVALID_DECIMAL", `${field} no es un decimal válido.`, {
      field,
    });
  }

  assertDomain(value.isFinite(), "INVALID_DECIMAL", `${field} debe ser finito.`, {
    field,
  });
  assertDomain(
    options.allowNegative === true || value.greaterThanOrEqualTo(0),
    "INVALID_DECIMAL",
    `${field} no puede ser negativo.`,
    { field },
  );
  assertDomain(
    options.allowZero !== false || !value.isZero(),
    "INVALID_DECIMAL",
    `${field} debe ser distinto de cero.`,
    { field },
  );

  if (options.maximum !== undefined) {
    const maximum = parseDecimal(options.maximum, {
      allowZero: false,
      field: `${field}.maximum`,
    });
    assertDomain(
      value.lessThanOrEqualTo(maximum),
      "INVALID_DECIMAL",
      `${field} excede el límite configurado.`,
      { field, maximum: canonicalDecimal(maximum) },
    );
  }

  return value;
}

export function canonicalDecimal(value: Decimal.Value): string {
  const decimal = new FinancialDecimal(value);
  assertDomain(decimal.isFinite(), "INVALID_DECIMAL", "El resultado debe ser finito.");
  if (decimal.isZero()) {
    return "0";
  }
  return decimal.toFixed();
}

export function quantizeDecimal(
  value: Decimal.Value,
  scale: number,
  rounding: Decimal.Rounding = Decimal.ROUND_HALF_UP,
): string {
  assertDomain(
    Number.isInteger(scale) && scale >= 0 && scale <= 20,
    "INVALID_CONFIGURATION",
    "La escala de redondeo debe ser un entero entre 0 y 20.",
  );
  return new FinancialDecimal(value).toDecimalPlaces(scale, rounding).toFixed(scale);
}

export function decimalSum(values: readonly Decimal.Value[]): Decimal {
  return values.reduce<Decimal>(
    (total, value) => total.plus(value),
    new FinancialDecimal(0),
  );
}

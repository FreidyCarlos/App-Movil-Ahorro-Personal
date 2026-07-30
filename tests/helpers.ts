import { Decimal } from "decimal.js";

import type {
  FinancialProductConfiguration,
  InterestRateDefinition,
  SavingsMovement,
  YieldRatePeriod,
} from "../src/index.js";
import {
  normalizeInterestRate,
  type InterestRateInput,
} from "../src/index.js";

export const NOW = "2026-07-30T12:00:00.000Z";

export function id(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

export function expectDecimalClose(
  actual: string,
  expected: string,
  tolerance = "1e-12",
): void {
  expect(new Decimal(actual).minus(expected).abs().lessThanOrEqualTo(tolerance)).toBe(true);
}

export function rateInput(
  overrides: Partial<InterestRateInput> = {},
): InterestRateInput {
  return {
    id: id(100),
    originalValue: "10",
    originalType: "EA",
    originalPeriodicity: "ANNUAL",
    timing: "DUE",
    variability: "FIXED",
    effectiveFrom: "2026-01-01",
    createdAt: NOW,
    ...overrides,
  };
}

export function normalizedRate(
  overrides: Partial<InterestRateInput> = {},
): InterestRateDefinition {
  return normalizeInterestRate(rateInput(overrides));
}

export function flexibleProduct(
  overrides: Partial<FinancialProductConfiguration> = {},
): FinancialProductConfiguration {
  return {
    id: id(200),
    configurationId: id(2),
    productModel: "FLEXIBLE_REMUNERATED",
    liquidity: "IMMEDIATE",
    additionalContributionsAllowed: true,
    withdrawalsAllowed: true,
    capitalizationFrequency: "DAILY",
    creditingFrequency: "MONTHLY",
    yieldPaymentDestination: "CAPITALIZED",
    dayCountConvention: "ACT_365",
    renewalRule: "NONE",
    earlyWithdrawalRule: "ALLOWED",
    unsupportedConditions: [],
    createdAt: NOW,
    ...overrides,
  };
}

export function noYieldProduct(
  overrides: Partial<FinancialProductConfiguration> = {},
): FinancialProductConfiguration {
  return flexibleProduct({
    productModel: "NO_YIELD",
    capitalizationFrequency: "AT_MATURITY",
    creditingFrequency: "AT_MATURITY",
    ...overrides,
  });
}

export function ratePeriod(
  overrides: Partial<YieldRatePeriod> = {},
): YieldRatePeriod {
  return {
    id: id(300),
    goalId: id(1),
    configurationId: id(2),
    rateDefinitionId: id(100),
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    purpose: "ORIGINAL_PROJECTION",
    createdAt: NOW,
    ...overrides,
  };
}

export function movement(
  value: number,
  overrides: Partial<SavingsMovement> = {},
): SavingsMovement {
  const movementId = id(1000 + value);
  return {
    id: movementId,
    goalId: id(1),
    type: "CONTRIBUTION",
    amount: "100",
    effectiveDate: "2026-01-01",
    recordedAt: NOW,
    currentRevisionId: id(2000 + value),
    status: "ACTIVE",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

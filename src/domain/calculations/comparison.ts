import { nonCryptographicDigest } from "../canonical.js";
import {
  FinancialDecimal,
  canonicalDecimal,
  parseDecimal,
} from "../decimal.js";
import { assertDomain } from "../errors.js";
import type {
  ActualLedgerResult,
  ActualPeriodClose,
  ComparisonResult,
  ProjectionResult,
  UtcInstant,
  Uuid,
} from "../models.js";
import { FINANCIAL_RULES_VERSION } from "./rates.js";

export interface ComparisonInput {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly projection: ProjectionResult;
  readonly actual: ActualLedgerResult;
  readonly actualClose?: ActualPeriodClose;
  readonly cutoffDate: string;
  readonly targetAmount?: string;
  readonly onTrackTolerance: string;
  readonly calculatedAt: UtcInstant;
  readonly rulesVersion?: string;
}

export function compareProjectionWithActual(input: ComparisonInput): ComparisonResult {
  assertDomain(
    input.projection.goalId === input.goalId,
    "INVALID_CONFIGURATION",
    "La proyección pertenece a otra meta.",
  );
  assertDomain(
    input.projection.projectedEndDate === input.cutoffDate,
    "INVALID_CONFIGURATION",
    "La proyección y el real deben usar la misma fecha de corte.",
  );
  if (input.actualClose !== undefined) {
    assertDomain(
      input.actualClose.goalId === input.goalId &&
        input.actualClose.periodEnd === input.cutoffDate &&
        input.actualClose.status === "VALID",
      "INVALID_CONFIGURATION",
      "El cierre real no es válido para la fecha de comparación.",
    );
  }

  const projectedContributions = new FinancialDecimal(
    input.projection.projectedContributions,
  ).plus(input.projection.projectedExtraContributions);
  const actualContributions = new FinancialDecimal(input.actual.contributions).plus(
    input.actual.extraContributions,
  );
  const projectedWithdrawals = parseDecimal(input.projection.projectedWithdrawals);
  const actualWithdrawals = parseDecimal(input.actual.withdrawals);
  const projectedYield = parseDecimal(input.projection.projectedYield);
  const actualYield = parseDecimal(input.actual.actualYield);
  const projectedBalance = parseDecimal(input.projection.finalBalance);
  const actualBalance = parseDecimal(input.actual.closingBalance);
  const balanceDifference = actualBalance.minus(projectedBalance);
  const tolerance = parseDecimal(input.onTrackTolerance, {
    field: "onTrackTolerance",
  });

  let scheduleStatus: ComparisonResult["scheduleStatus"] = "ON_TRACK";
  if (balanceDifference.greaterThan(tolerance)) {
    scheduleStatus = "AHEAD";
  } else if (balanceDifference.lessThan(tolerance.negated())) {
    scheduleStatus = "BEHIND";
  }

  const targetProgress =
    input.targetAmount === undefined
      ? undefined
      : canonicalDecimal(
          actualBalance.dividedBy(
            parseDecimal(input.targetAmount, {
              allowZero: false,
              field: "targetAmount",
            }),
          ),
        );

  const digestInput = {
    projectionDigest: input.projection.inputDigest,
    actual: input.actual,
    cutoffDate: input.cutoffDate,
  };
  return {
    id: input.id,
    goalId: input.goalId,
    projectionResultId: input.projection.id,
    ...(input.actualClose === undefined ? {} : { actualCloseId: input.actualClose.id }),
    cutoffDate: input.cutoffDate,
    projectedContributions: canonicalDecimal(projectedContributions),
    actualContributions: canonicalDecimal(actualContributions),
    contributionDifference: canonicalDecimal(
      actualContributions.minus(projectedContributions),
    ),
    projectedWithdrawals: canonicalDecimal(projectedWithdrawals),
    actualWithdrawals: canonicalDecimal(actualWithdrawals),
    withdrawalDifference: canonicalDecimal(
      actualWithdrawals.minus(projectedWithdrawals),
    ),
    projectedYield: canonicalDecimal(projectedYield),
    actualYield: canonicalDecimal(actualYield),
    yieldDifference: canonicalDecimal(actualYield.minus(projectedYield)),
    projectedBalance: canonicalDecimal(projectedBalance),
    actualBalance: canonicalDecimal(actualBalance),
    balanceDifference: canonicalDecimal(balanceDifference),
    ...(targetProgress === undefined ? {} : { targetProgress }),
    scheduleStatus,
    inputDigest: nonCryptographicDigest(digestInput),
    rulesVersion: input.rulesVersion ?? FINANCIAL_RULES_VERSION,
    calculatedAt: input.calculatedAt,
  };
}

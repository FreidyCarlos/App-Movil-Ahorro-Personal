import { nonCryptographicDigest } from "../canonical.js";
import { compareCivilDates, parseCivilDate, type CivilDate } from "../date.js";
import {
  COP_ROUNDING_POLICY_VERSION,
  FinancialDecimal,
  canonicalDecimal,
  parseDecimal,
  quantizeCop,
  resolveNumericLimits,
  type NumericLimits,
} from "../decimal.js";
import { assertDomain } from "../errors.js";
import type {
  ActualLedgerResult,
  ActualPeriodClose,
  FinancialProductConfiguration,
  MovementRevision,
  SavingsMovement,
  UtcInstant,
  Uuid,
} from "../models.js";
import { FINANCIAL_RULES_VERSION } from "./rates.js";

export interface LedgerOptions {
  readonly startDate?: CivilDate;
  readonly endDateExclusive?: CivilDate;
  readonly product?: FinancialProductConfiguration;
  readonly limits?: NumericLimits;
}

function validateMovementState(movement: SavingsMovement): void {
  parseCivilDate(movement.effectiveDate);
  assertDomain(
    movement.recordedAt.endsWith("Z") &&
      Number.isFinite(Date.parse(movement.recordedAt)),
    "INVALID_CONFIGURATION",
    "El instante de registro no es válido.",
    { movementId: movement.id },
  );
  assertDomain(
    movement.status === "ACTIVE" ||
      (movement.voidedAt !== undefined &&
        movement.voidReason !== undefined &&
        movement.voidReason.trim().length > 0),
    "INVALID_CONFIGURATION",
    "Un movimiento anulado requiere fecha y motivo.",
    { movementId: movement.id },
  );
  if (movement.type === "ADJUSTMENT") {
    assertDomain(
      movement.note !== undefined && movement.note.trim().length > 0,
      "INVALID_CONFIGURATION",
      "Un ajuste requiere observación.",
      { movementId: movement.id },
    );
    parseDecimal(movement.amount, {
      allowNegative: true,
      allowZero: false,
      field: `movements.${movement.id}.amount`,
    });
  } else {
    parseDecimal(movement.amount, {
      allowZero: false,
      field: `movements.${movement.id}.amount`,
    });
  }
}

function validateMovementUniqueness(movements: readonly SavingsMovement[]): void {
  const ids = new Set<string>();
  const deduplicationKeys = new Set<string>();
  for (const movement of movements) {
    assertDomain(
      !ids.has(movement.id),
      "DUPLICATE_MOVEMENT",
      "Existe un identificador de movimiento duplicado.",
      { movementId: movement.id },
    );
    ids.add(movement.id);
    if (movement.deduplicationKey !== undefined) {
      assertDomain(
        !deduplicationKeys.has(movement.deduplicationKey),
        "DUPLICATE_MOVEMENT",
        "Existe una clave de deduplicación repetida.",
        { deduplicationKey: movement.deduplicationKey },
      );
      deduplicationKeys.add(movement.deduplicationKey);
    }
  }
}

export function calculateActualLedger(
  openingBalanceInput: string,
  movements: readonly SavingsMovement[],
  options: LedgerOptions = {},
): ActualLedgerResult {
  const limits = resolveNumericLimits(options.limits);
  let balance = parseDecimal(openingBalanceInput, {
    field: "openingBalance",
    maximum: limits.maximumAmount,
  });
  validateMovementUniqueness(movements);

  const active = movements
    .filter((movement) => {
      validateMovementState(movement);
      return (
        movement.status === "ACTIVE" &&
        (options.startDate === undefined ||
          compareCivilDates(movement.effectiveDate, options.startDate) >= 0) &&
        (options.endDateExclusive === undefined ||
          compareCivilDates(movement.effectiveDate, options.endDateExclusive) < 0)
      );
    })
    .sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) ||
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.id.localeCompare(b.id),
    );

  let contributions = new FinancialDecimal(0);
  let extraContributions = new FinancialDecimal(0);
  let withdrawals = new FinancialDecimal(0);
  let actualYield = new FinancialDecimal(0);
  let adjustments = new FinancialDecimal(0);

  for (const movement of active) {
    const amount = parseDecimal(movement.amount, {
      allowNegative: movement.type === "ADJUSTMENT",
      allowZero: false,
      field: `movements.${movement.id}.amount`,
      maximum:
        movement.type === "ADJUSTMENT" && movement.amount.startsWith("-")
          ? undefined
          : limits.maximumAmount,
    });
    assertDomain(
      amount.abs().lessThanOrEqualTo(limits.maximumAmount),
      "INVALID_DECIMAL",
      "El movimiento excede el máximo técnico permitido.",
      { movementId: movement.id, maximum: limits.maximumAmount },
    );
    switch (movement.type) {
      case "CONTRIBUTION":
        assertDomain(
          options.product?.additionalContributionsAllowed !== false,
          "PRODUCT_CONSTRAINT",
          "El producto no admite aportes.",
        );
        contributions = contributions.plus(amount);
        balance = balance.plus(amount);
        break;
      case "EXTRA_CONTRIBUTION":
        assertDomain(
          options.product?.additionalContributionsAllowed !== false,
          "PRODUCT_CONSTRAINT",
          "El producto no admite aportes extraordinarios.",
        );
        extraContributions = extraContributions.plus(amount);
        balance = balance.plus(amount);
        break;
      case "YIELD":
        actualYield = actualYield.plus(amount);
        balance = balance.plus(amount);
        break;
      case "WITHDRAWAL":
        assertDomain(
          options.product?.withdrawalsAllowed !== false,
          "PRODUCT_CONSTRAINT",
          "El producto no admite retiros.",
        );
        assertDomain(
          amount.lessThanOrEqualTo(balance),
          "INSUFFICIENT_BALANCE",
          "El retiro excede el saldo real.",
          { movementId: movement.id },
        );
        withdrawals = withdrawals.plus(amount);
        balance = balance.minus(amount);
        break;
      case "ADJUSTMENT":
        assertDomain(
          balance.plus(amount).greaterThanOrEqualTo(0),
          "INSUFFICIENT_BALANCE",
          "El ajuste dejaría un saldo negativo.",
          { movementId: movement.id },
        );
        adjustments = adjustments.plus(amount);
        balance = balance.plus(amount);
        break;
    }
    assertDomain(
      balance.lessThanOrEqualTo(limits.maximumAmount),
      "INVALID_DECIMAL",
      "El saldo real excede el máximo técnico permitido.",
      { movementId: movement.id, maximum: limits.maximumAmount },
    );
  }

  return {
    openingBalance: canonicalDecimal(openingBalanceInput),
    contributions: canonicalDecimal(contributions),
    extraContributions: canonicalDecimal(extraContributions),
    withdrawals: canonicalDecimal(withdrawals),
    actualYield: canonicalDecimal(actualYield),
    adjustments: canonicalDecimal(adjustments),
    closingBalance: canonicalDecimal(balance),
    movementIds: active.map(({ id }) => id),
  };
}

export function createMovementRevision(
  previous: SavingsMovement,
  replacement: SavingsMovement,
  metadata: {
    readonly id: Uuid;
    readonly revisionNumber: number;
    readonly reason: string;
    readonly createdAt: UtcInstant;
    readonly supersedesId?: Uuid;
  },
): MovementRevision {
  assertDomain(previous.id === replacement.id, "INVALID_CONFIGURATION", "La revisión cambia de movimiento.");
  assertDomain(
    metadata.revisionNumber >= 2 && Number.isInteger(metadata.revisionNumber),
    "INVALID_CONFIGURATION",
    "El número de revisión debe ser un entero mayor o igual a 2.",
  );
  assertDomain(
    metadata.reason.trim().length > 0,
    "INVALID_CONFIGURATION",
    "La revisión requiere un motivo.",
  );
  validateMovementState(replacement);
  return {
    id: metadata.id,
    movementId: previous.id,
    revisionNumber: metadata.revisionNumber,
    snapshot: { ...replacement },
    reason: metadata.reason,
    createdAt: metadata.createdAt,
    ...(metadata.supersedesId === undefined
      ? {}
      : { supersedesId: metadata.supersedesId }),
    integrityDigest: nonCryptographicDigest(replacement),
  };
}

export interface CloseMetadata {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly periodStart: CivilDate;
  readonly periodEnd: CivilDate;
  readonly configurationRevisionId: Uuid;
  readonly closedAt: UtcInstant;
  readonly rulesVersion?: string;
}

export function createActualPeriodClose(
  openingBalance: string,
  movements: readonly SavingsMovement[],
  metadata: CloseMetadata,
  options: Omit<LedgerOptions, "startDate" | "endDateExclusive"> = {},
): ActualPeriodClose {
  assertDomain(
    compareCivilDates(metadata.periodStart, metadata.periodEnd) < 0,
    "INVALID_DATE",
    "El cierre requiere un periodo positivo.",
  );
  const ledger = calculateActualLedger(openingBalance, movements, {
    ...options,
    startDate: metadata.periodStart,
    endDateExclusive: metadata.periodEnd,
  });
  const digestPayload = movements
    .filter(
      (movement) =>
        movement.status === "ACTIVE" &&
        movement.effectiveDate >= metadata.periodStart &&
        movement.effectiveDate < metadata.periodEnd,
    )
    .sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) ||
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.id.localeCompare(b.id),
    )
    .map((movement) => ({
      id: movement.id,
      currentRevisionId: movement.currentRevisionId,
      type: movement.type,
      amount: movement.amount,
      effectiveDate: movement.effectiveDate,
      status: movement.status,
    }));
  return {
    id: metadata.id,
    goalId: metadata.goalId,
    periodStart: metadata.periodStart,
    periodEnd: metadata.periodEnd,
    openingBalance: ledger.openingBalance,
    contributions: ledger.contributions,
    extraContributions: ledger.extraContributions,
    withdrawals: ledger.withdrawals,
    actualYield: ledger.actualYield,
    adjustments: ledger.adjustments,
    closingBalance: ledger.closingBalance,
    quantizedClosingBalance: quantizeCop(ledger.closingBalance),
    movementSetDigest: nonCryptographicDigest(digestPayload),
    configurationRevisionId: metadata.configurationRevisionId,
    rulesVersion: metadata.rulesVersion ?? FINANCIAL_RULES_VERSION,
    roundingPolicyVersion: COP_ROUNDING_POLICY_VERSION,
    status: "VALID",
    closedAt: metadata.closedAt,
  };
}

export function isCloseStale(
  close: ActualPeriodClose,
  movements: readonly SavingsMovement[],
): boolean {
  const activeMovements = movements
    .filter(
      (movement) =>
        movement.status === "ACTIVE" &&
        movement.effectiveDate >= close.periodStart &&
        movement.effectiveDate < close.periodEnd,
    )
    .sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) ||
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.id.localeCompare(b.id),
    )
    .map((movement) => ({
      id: movement.id,
      currentRevisionId: movement.currentRevisionId,
      type: movement.type,
      amount: movement.amount,
      effectiveDate: movement.effectiveDate,
      status: movement.status,
    }));
  return nonCryptographicDigest(activeMovements) !== close.movementSetDigest;
}

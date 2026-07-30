import {
  calculateActualLedger,
  compareProjectionWithActual,
  createActualPeriodClose,
  createMovementRevision,
  createSimpleProjectionResult,
  calculateSimpleProjection,
  isCloseStale,
} from "../src/index.js";
import { NOW, flexibleProduct, id, movement } from "./helpers.js";

describe("libro real y trazabilidad", () => {
  it("reconstruye saldo solo con movimientos reales activos", () => {
    const result = calculateActualLedger("100000", [
      movement(1, { amount: "50000" }),
      movement(2, { type: "YIELD", amount: "2000", effectiveDate: "2026-01-02" }),
      movement(3, { type: "WITHDRAWAL", amount: "10000", effectiveDate: "2026-01-03" }),
      movement(4, {
        type: "ADJUSTMENT",
        amount: "-500",
        note: "Corrección de conciliación",
        effectiveDate: "2026-01-04",
      }),
      movement(5, {
        type: "CONTRIBUTION",
        amount: "999999",
        status: "VOIDED",
        voidedAt: NOW,
        voidReason: "Duplicado",
      }),
    ]);
    expect(result.closingBalance).toBe("141500");
    expect(result.contributions).toBe("50000");
    expect(result.actualYield).toBe("2000");
    expect(result.adjustments).toBe("-500");
    expect(result.movementIds).toHaveLength(4);
  });

  it("rechaza ajuste sin nota, duplicados y retiro excesivo", () => {
    expect(() =>
      calculateActualLedger("0", [movement(1, { type: "ADJUSTMENT", amount: "1" })]),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));

    const duplicate = movement(1);
    expect(() => calculateActualLedger("0", [duplicate, duplicate])).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_MOVEMENT" }),
    );

    expect(() =>
      calculateActualLedger("10", [movement(2, { type: "WITHDRAWAL", amount: "11" })]),
    ).toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));
  });

  it("respeta restricciones del producto y claves de deduplicación", () => {
    expect(() =>
      calculateActualLedger(
        "0",
        [
          movement(1, { deduplicationKey: "same" }),
          movement(2, { deduplicationKey: "same" }),
        ],
      ),
    ).toThrowError(expect.objectContaining({ code: "DUPLICATE_MOVEMENT" }));

    expect(() =>
      calculateActualLedger("10", [movement(3, { type: "WITHDRAWAL", amount: "1" })], {
        product: flexibleProduct({ withdrawalsAllowed: false }),
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));

    expect(() =>
      calculateActualLedger("0", [movement(4)], {
        product: flexibleProduct({ additionalContributionsAllowed: false }),
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));

    expect(() =>
      calculateActualLedger(
        "0",
        [movement(5, { type: "EXTRA_CONTRIBUTION" })],
        {
          product: flexibleProduct({ additionalContributionsAllowed: false }),
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));
  });

  it("rechaza movimiento anulado incompleto e instante no UTC", () => {
    expect(() =>
      calculateActualLedger("0", [
        movement(1, { status: "VOIDED" }),
      ]),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(() =>
      calculateActualLedger("0", [
        movement(2, { recordedAt: "2026-07-30T07:00:00-05:00" }),
      ]),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  });

  it("crea revisión inmutable con motivo y huella", () => {
    const previous = movement(1);
    const replacement = { ...previous, amount: "200", updatedAt: "2026-07-30T13:00:00.000Z" };
    const revision = createMovementRevision(previous, replacement, {
      id: id(3000),
      revisionNumber: 2,
      reason: "Valor corregido contra comprobante",
      createdAt: "2026-07-30T13:00:00.000Z",
      supersedesId: previous.currentRevisionId,
    });
    expect(revision.snapshot.amount).toBe("200");
    expect(revision.integrityDigest).toMatch(/^fnv1a64:/);
  });

  it("mantiene orden determinista cuando fecha e instante coinciden", () => {
    const result = calculateActualLedger("0", [movement(2), movement(1)]);
    expect(result.movementIds).toEqual([id(1001), id(1002)]);
  });

  it("crea cierre preciso y detecta movimiento retroactivo", () => {
    const movements = [movement(1, { amount: "50", effectiveDate: "2026-01-15" })];
    const close = createActualPeriodClose("100", movements, {
      id: id(4000),
      goalId: id(1),
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
      configurationRevisionId: id(2),
      closedAt: NOW,
    });
    expect(close.closingBalance).toBe("150");
    expect(close.quantizedClosingBalance).toBe("150");
    expect(close.roundingPolicyVersion).toBe("cop-half-up-0-v1");
    expect(isCloseStale(close, movements)).toBe(false);
    expect(
      isCloseStale(close, [
        ...movements,
        movement(2, { amount: "1", effectiveDate: "2026-01-20" }),
      ]),
    ).toBe(true);
    expect(
      isCloseStale(close, [
        ...movements,
        movement(3, { effectiveDate: "2026-02-15" }),
      ]),
    ).toBe(false);
    expect(
      isCloseStale(close, [
        {
          ...movements[0]!,
          amount: "51",
          currentRevisionId: id(9999),
        },
      ]),
    ).toBe(true);
  });
});

describe("comparación proyectado frente a real", () => {
  function projection() {
    return createSimpleProjectionResult(
      calculateSimpleProjection({
        periodicAmount: "250000",
        periodicity: "MONTHLY",
        numberOfPeriods: 2,
        startDate: "2026-01-01",
      }),
      {
        id: id(5000),
        goalId: id(1),
        configurationRevisionId: id(2),
        cutoffDate: "2026-01-01",
        calculatedAt: NOW,
      },
    );
  }

  it("calcula diferencias con signo real menos proyectado y avance", () => {
    const result = compareProjectionWithActual({
      id: id(5001),
      goalId: id(1),
      projection: projection(),
      actual: {
        openingBalance: "0",
        contributions: "470000",
        extraContributions: "0",
        withdrawals: "0",
        actualYield: "0",
        adjustments: "0",
        closingBalance: "470000",
        movementIds: [],
      },
      cutoffDate: "2026-03-01",
      targetAmount: "1000000",
      onTrackTolerance: "0",
      calculatedAt: NOW,
    });
    expect(result.balanceDifference).toBe("-30000");
    expect(result.contributionDifference).toBe("-30000");
    expect(result.targetProgress).toBe("0.47");
    expect(result.scheduleStatus).toBe("BEHIND");
  });

  it("aplica tolerancia explícita y rechaza fechas diferentes", () => {
    const actual = {
      openingBalance: "0",
      contributions: "500001",
      extraContributions: "0",
      withdrawals: "0",
      actualYield: "0",
      adjustments: "0",
      closingBalance: "500001",
      movementIds: [],
    };
    expect(
      compareProjectionWithActual({
        id: id(5002),
        goalId: id(1),
        projection: projection(),
        actual,
        cutoffDate: "2026-03-01",
        onTrackTolerance: "1",
        calculatedAt: NOW,
      }).scheduleStatus,
    ).toBe("ON_TRACK");
    expect(
      compareProjectionWithActual({
        id: id(5004),
        goalId: id(1),
        projection: projection(),
        actual: { ...actual, contributions: "500002", closingBalance: "500002" },
        cutoffDate: "2026-03-01",
        onTrackTolerance: "1",
        calculatedAt: NOW,
      }).scheduleStatus,
    ).toBe("AHEAD");
    expect(() =>
      compareProjectionWithActual({
        id: id(5003),
        goalId: id(1),
        projection: projection(),
        actual,
        cutoffDate: "2026-02-28",
        onTrackTolerance: "0",
        calculatedAt: NOW,
      }),
    ).toThrow();
  });

  it("exige que el cierre asociado sea válido, de la misma meta y corte", () => {
    const actual = {
      openingBalance: "0",
      contributions: "500000",
      extraContributions: "0",
      withdrawals: "0",
      actualYield: "0",
      adjustments: "0",
      closingBalance: "500000",
      movementIds: [],
    };
    const close = createActualPeriodClose("0", [], {
      id: id(5100),
      goalId: id(1),
      periodStart: "2026-01-01",
      periodEnd: "2026-03-01",
      configurationRevisionId: id(2),
      closedAt: NOW,
    });
    const result = compareProjectionWithActual({
      id: id(5101),
      goalId: id(1),
      projection: projection(),
      actual,
      actualClose: close,
      cutoffDate: "2026-03-01",
      onTrackTolerance: "0",
      calculatedAt: NOW,
    });
    expect(result.actualCloseId).toBe(close.id);
    expect(() =>
      compareProjectionWithActual({
        id: id(5102),
        goalId: id(1),
        projection: projection(),
        actual,
        actualClose: { ...close, status: "STALE" },
        cutoffDate: "2026-03-01",
        onTrackTolerance: "0",
        calculatedAt: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  });
});

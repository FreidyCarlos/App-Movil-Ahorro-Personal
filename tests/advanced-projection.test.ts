import {
  calculateAdvancedProjection,
  calculateUpdatedProjectionFromClose,
  createActualPeriodClose,
} from "../src/index.js";
import {
  NOW,
  expectDecimalClose,
  flexibleProduct,
  id,
  movement,
  noYieldProduct,
  normalizedRate,
  ratePeriod,
} from "./helpers.js";

function baseInput() {
  const rate = normalizedRate();
  return {
    id: id(500),
    goalId: id(1),
    configurationRevisionId: id(2),
    projectionKind: "ORIGINAL" as const,
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    initialBalance: "1000",
    contributionTiming: "START_OF_DAY" as const,
    product: flexibleProduct(),
    ratePeriods: [ratePeriod({ endDate: "2026-02-01" })],
    rateDefinitions: new Map([[rate.id, rate]]),
    events: [],
    calculatedAt: NOW,
  };
}

describe("proyección avanzada", () => {
  it("proyecta tasa cero sin crear periodos para producto sin rendimiento", () => {
    const result = calculateAdvancedProjection({
      ...baseInput(),
      product: noYieldProduct(),
      ratePeriods: [],
      rateDefinitions: new Map(),
      events: [
        { id: id(501), date: "2026-01-01", type: "CONTRIBUTION", amount: "50", sequence: 1 },
        { id: id(502), date: "2026-01-15", type: "WITHDRAWAL", amount: "20", sequence: 1 },
      ],
    });
    expect(result.finalBalance).toBe("1030");
    expect(result.projectedContributions).toBe("50");
    expect(result.projectedWithdrawals).toBe("20");
    expect(result.projectedYield).toBe("0");
    expect(result.ratePeriodIds).toEqual([]);
  });

  it("aplica aporte al inicio o al final del día de forma explícita", () => {
    const start = calculateAdvancedProjection({
      ...baseInput(),
      initialBalance: "0",
      events: [
        { id: id(501), date: "2026-01-01", type: "CONTRIBUTION", amount: "1000", sequence: 1 },
      ],
    });
    const end = calculateAdvancedProjection({
      ...baseInput(),
      initialBalance: "0",
      contributionTiming: "END_OF_DAY",
      events: [
        { id: id(501), date: "2026-01-01", type: "CONTRIBUTION", amount: "1000", sequence: 1 },
      ],
    });
    expect(Number(start.projectedYield)).toBeGreaterThan(Number(end.projectedYield));
    expect(start.trajectory[0]?.date).toBe("2026-01-01");
    expect(start.trajectory.at(-1)?.date).toBe("2026-02-01");
    expect(start.trajectory.at(-1)?.balance).toBe(start.finalBalance);
  });

  it("aplica cambios de tasa solo a periodos posteriores", () => {
    const rate10 = normalizedRate();
    const rate8 = normalizedRate({
      id: id(101),
      originalValue: "8",
      effectiveFrom: "2026-01-16",
      variability: "VARIABLE",
    });
    const result = calculateAdvancedProjection({
      ...baseInput(),
      initialBalance: "1000000",
      endDate: "2026-01-31",
      ratePeriods: [
        ratePeriod({ endDate: "2026-01-16" }),
        ratePeriod({
          id: id(301),
          rateDefinitionId: rate8.id,
          startDate: "2026-01-16",
          endDate: "2026-01-31",
        }),
      ],
      rateDefinitions: new Map([
        [rate10.id, rate10],
        [rate8.id, rate8],
      ]),
    });
    const expected =
      1_000_000 *
      Math.pow(1.1, 15 / 365) *
      Math.pow(1.08, 15 / 365);
    expectDecimalClose(result.finalBalance, String(expected), "1e-8");
  });

  it("capitaliza meses completos y bloquea calendarios mensuales ambiguos", () => {
    const monthlyRate = normalizedRate({
      originalValue: "12.6825030131969720661201",
    });
    const monthlyProduct = flexibleProduct({
      capitalizationFrequency: "MONTHLY",
      creditingFrequency: "MONTHLY",
    });
    const result = calculateAdvancedProjection({
      ...baseInput(),
      initialBalance: "1000000",
      endDate: "2026-04-01",
      product: monthlyProduct,
      ratePeriods: [
        ratePeriod({
          rateDefinitionId: monthlyRate.id,
          endDate: "2026-04-01",
        }),
      ],
      rateDefinitions: new Map([[monthlyRate.id, monthlyRate]]),
    });
    expectDecimalClose(result.finalBalance, "1030301", "1e-12");

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: monthlyProduct,
        events: [
          { id: id(501), date: "2026-01-15", type: "CONTRIBUTION", amount: "1", sequence: 1 },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));
  });

  it("separa aportes ordinarios, extraordinarios, retiros y rendimiento", () => {
    const result = calculateAdvancedProjection({
      ...baseInput(),
      product: noYieldProduct(),
      ratePeriods: [],
      rateDefinitions: new Map(),
      events: [
        { id: id(501), date: "2026-01-02", type: "CONTRIBUTION", amount: "100", sequence: 1 },
        {
          id: id(502),
          date: "2026-01-03",
          type: "EXTRA_CONTRIBUTION",
          amount: "30",
          sequence: 1,
        },
        { id: id(503), date: "2026-01-04", type: "WITHDRAWAL", amount: "20", sequence: 1 },
      ],
    });
    expect(result.projectedContributions).toBe("100");
    expect(result.projectedExtraContributions).toBe("30");
    expect(result.projectedWithdrawals).toBe("20");
    expect(result.finalBalance).toBe("1110");
  });

  it("registra cuándo se alcanza el objetivo por aporte o rendimiento", () => {
    const byContribution = calculateAdvancedProjection({
      ...baseInput(),
      product: noYieldProduct(),
      initialBalance: "0",
      targetAmount: "100",
      ratePeriods: [],
      rateDefinitions: new Map(),
      events: [
        { id: id(501), date: "2026-01-10", type: "CONTRIBUTION", amount: "100", sequence: 1 },
      ],
    });
    expect(byContribution.targetReachedDate).toBe("2026-01-10");

    const byYield = calculateAdvancedProjection({
      ...baseInput(),
      initialBalance: "1000",
      targetAmount: "1005",
    });
    expect(byYield.targetReachedDate).toBe("2026-02-01");
  });

  it("rechaza retiro superior al saldo y restricciones del producto", () => {
    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: noYieldProduct(),
        initialBalance: "10",
        ratePeriods: [],
        rateDefinitions: new Map(),
        events: [
          { id: id(501), date: "2026-01-02", type: "WITHDRAWAL", amount: "11", sequence: 1 },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: noYieldProduct({ additionalContributionsAllowed: false }),
        ratePeriods: [],
        rateDefinitions: new Map(),
        events: [
          { id: id(501), date: "2026-01-02", type: "CONTRIBUTION", amount: "1", sequence: 1 },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));
  });

  it("bloquea huecos, tasa desconocida y convención de días sin resolver", () => {
    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        ratePeriods: [ratePeriod({ endDate: "2026-01-15" })],
      }),
    ).toThrowError(expect.objectContaining({ code: "RATE_PERIOD_GAP" }));

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        ratePeriods: [ratePeriod({ rateDefinitionId: id(999), endDate: "2026-02-01" })],
        rateDefinitions: new Map(),
      }),
    ).toThrowError(expect.objectContaining({ code: "RATE_DATA_INCOMPLETE" }));

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: flexibleProduct({ dayCountConvention: "PRODUCT_DEFINED" }),
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: flexibleProduct({
          unsupportedConditions: ["Saldo mínimo escalonado no modelado"],
        }),
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));
  });

  it("soporta plazo fijo simple solo con capital único, tasa fija y vencimiento", () => {
    const fixedProduct = flexibleProduct({
      productModel: "FIXED_TERM_SIMPLE",
      liquidity: "FIXED_TERM",
      additionalContributionsAllowed: false,
      withdrawalsAllowed: false,
      capitalizationFrequency: "AT_MATURITY",
      creditingFrequency: "AT_MATURITY",
      yieldPaymentDestination: "MATURITY",
      maturityDate: "2026-02-01",
      earlyWithdrawalRule: "NOT_ALLOWED",
    });
    const result = calculateAdvancedProjection({ ...baseInput(), product: fixedProduct });
    expect(Number(result.projectedYield)).toBeGreaterThan(0);

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: fixedProduct,
        events: [
          { id: id(501), date: "2026-01-02", type: "CONTRIBUTION", amount: "1", sequence: 1 },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));

    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        endDate: "2026-01-31",
        product: fixedProduct,
        ratePeriods: [ratePeriod({ endDate: "2026-01-31" })],
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));
  });

  it("rechaza propósito de tasa incorrecto y pagos de rendimiento no capitalizados", () => {
    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        ratePeriods: [
          ratePeriod({
            endDate: "2026-02-01",
            purpose: "UPDATED_PROJECTION",
          }),
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(() =>
      calculateAdvancedProjection({
        ...baseInput(),
        product: flexibleProduct({ yieldPaymentDestination: "PAID_OUT" }),
      }),
    ).toThrowError(expect.objectContaining({ code: "PRODUCT_CONSTRAINT" }));
  });

  it("crea proyección actualizada desde el último cierre válido", () => {
    const close = createActualPeriodClose(
      "100",
      [movement(1, { amount: "50", effectiveDate: "2026-01-15" })],
      {
        id: id(600),
        goalId: id(1),
        periodStart: "2026-01-01",
        periodEnd: "2026-02-01",
        configurationRevisionId: id(2),
        closedAt: NOW,
      },
    );
    const futureInput = {
      ...baseInput(),
      id: id(601),
      endDate: "2026-03-01",
      ratePeriods: [
        ratePeriod({
          startDate: "2026-02-01",
          endDate: "2026-03-01",
          purpose: "UPDATED_PROJECTION",
        }),
      ],
      events: [],
    };
    const result = calculateUpdatedProjectionFromClose(close, futureInput);
    expect(result.projectionKind).toBe("UPDATED");
    expect(result.cutoffDate).toBe("2026-02-01");
    expect(result.initialBalance).toBe("150");

    expect(() =>
      calculateUpdatedProjectionFromClose(
        { ...close, status: "STALE" },
        futureInput,
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(() =>
      calculateUpdatedProjectionFromClose(close, {
        ...futureInput,
        goalId: id(999),
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(() =>
      calculateUpdatedProjectionFromClose(close, {
        ...futureInput,
        endDate: "2026-02-01",
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DATE" }));
  });
});

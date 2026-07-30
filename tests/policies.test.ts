import {
  COP_ROUNDING_POLICY_VERSION,
  DEFAULT_CONTRIBUTION_TIMING,
  DEFAULT_NUMERIC_LIMITS,
  NUMERIC_POLICY_VERSION,
  calculateActualLedger,
  calculateAdvancedProjection,
  calculateSimpleProjection,
  quantizeCop,
  resolveNumericLimits,
} from "../src/index.js";
import {
  NOW,
  flexibleProduct,
  id,
  movement,
  normalizedRate,
  ratePeriod,
} from "./helpers.js";

describe("políticas técnicas versionadas", () => {
  it("publica topes seguros y rechaza ampliarlos silenciosamente", () => {
    expect(NUMERIC_POLICY_VERSION).toBe("numeric-policy-cop-v1");
    expect(DEFAULT_NUMERIC_LIMITS).toEqual({
      maximumAmount: "10000000000",
      maximumRatePercent: "100",
      maximumCanonicalEffectiveAnnualRate: "1",
    });
    expect(() =>
      resolveNumericLimits({ maximumAmount: "10000000001" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(resolveNumericLimits({ maximumAmount: "1000000" }).maximumAmount).toBe(
      "1000000",
    );
  });

  it("bloquea tanto una entrada excesiva como un total que cruza el tope", () => {
    expect(() =>
      calculateSimpleProjection({
        periodicAmount: "10000000001",
        periodicity: "MONTHLY",
        numberOfPeriods: 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DECIMAL" }));
    expect(() =>
      calculateSimpleProjection({
        periodicAmount: "6000000000",
        periodicity: "MONTHLY",
        numberOfPeriods: 2,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DECIMAL" }));
  });

  it("bloquea un saldo real que supera el máximo por acumulación", () => {
    expect(() =>
      calculateActualLedger("9999999999", [
        movement(1, { amount: "2" }),
      ]),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DECIMAL" }));
  });

  it("aplica HALF_UP al peso solo en la consolidación COP", () => {
    expect(COP_ROUNDING_POLICY_VERSION).toBe("cop-half-up-0-v1");
    expect(quantizeCop("24113.499999")).toBe("24113");
    expect(quantizeCop("24113.5")).toBe("24114");
  });

  it("usa final del día como opción conservadora si el llamador no especifica momento", () => {
    expect(DEFAULT_CONTRIBUTION_TIMING).toBe("END_OF_DAY");
    const rate = normalizedRate();
    const common = {
      id: id(8000),
      goalId: id(1),
      configurationRevisionId: id(2),
      projectionKind: "ORIGINAL" as const,
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      initialBalance: "0",
      product: flexibleProduct(),
      ratePeriods: [ratePeriod({ endDate: "2026-02-01" })],
      rateDefinitions: new Map([[rate.id, rate]]),
      events: [
        {
          id: id(8001),
          date: "2026-01-01",
          type: "CONTRIBUTION" as const,
          amount: "1000",
          sequence: 1,
        },
      ],
      calculatedAt: NOW,
    };
    const implicit = calculateAdvancedProjection(common);
    const explicit = calculateAdvancedProjection({
      ...common,
      contributionTiming: "END_OF_DAY",
    });
    expect(implicit.finalBalance).toBe(explicit.finalBalance);
    expect(implicit.inputDigest).toBe(explicit.inputDigest);
  });
});

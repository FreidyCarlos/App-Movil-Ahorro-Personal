import {
  calculateSimpleProjection,
  createSimpleProjectionResult,
  toSimpleProjectionConfiguration,
} from "../src/index.js";
import { NOW, id } from "./helpers.js";

describe("proyección simple uniforme", () => {
  it("calcula 200.000 mensuales durante 18 meses sin tasa", () => {
    const result = calculateSimpleProjection({
      periodicAmount: "200000",
      periodicity: "MONTHLY",
      numberOfPeriods: 18,
      startDate: "2026-01-31",
    });
    expect(result.projectedTotal).toBe("3600000");
    expect(result.projectedYield).toBe("0");
    expect(result.projectedEndDate).toBe("2027-07-31");
  });

  it("calcula 3.000.000 anuales durante 5 años", () => {
    const result = calculateSimpleProjection({
      periodicAmount: "3000000",
      periodicity: "YEARLY",
      numberOfPeriods: 5,
    });
    expect(result.projectedTotal).toBe("15000000");
    expect(result.projectedEndDate).toBeUndefined();
  });

  it.each([
    ["MONTHLY" as const, 0],
    ["MONTHLY" as const, 1201],
    ["YEARLY" as const, 0],
    ["YEARLY" as const, 101],
  ])("rechaza horizonte inválido %s %s", (periodicity, numberOfPeriods) => {
    expect(() =>
      calculateSimpleProjection({
        periodicAmount: "1",
        periodicity,
        numberOfPeriods,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  });

  it("rechaza aporte cero, negativo, NaN, infinito y máximo inyectado", () => {
    for (const periodicAmount of ["0", "-1", "NaN", "Infinity"]) {
      expect(() =>
        calculateSimpleProjection({
          periodicAmount,
          periodicity: "MONTHLY",
          numberOfPeriods: 1,
        }),
      ).toThrow();
    }
    expect(() =>
      calculateSimpleProjection(
        { periodicAmount: "101", periodicity: "MONTHLY", numberOfPeriods: 1 },
        { maximumAmount: "100" },
      ),
    ).toThrow();
  });

  it("materializa configuración y resultado sin tasa ni producto ficticios", () => {
    const calculation = calculateSimpleProjection({
      periodicAmount: "10.50",
      periodicity: "MONTHLY",
      numberOfPeriods: 2,
    });
    const configuration = toSimpleProjectionConfiguration(calculation, {
      id: id(10),
      configurationId: id(2),
    });
    const projection = createSimpleProjectionResult(calculation, {
      id: id(20),
      goalId: id(1),
      configurationRevisionId: id(2),
      cutoffDate: "2026-01-01",
      calculatedAt: NOW,
    });
    expect(configuration.projectedTotal).toBe("21");
    expect(projection.projectionMode).toBe("SIMPLE");
    expect(projection.ratePeriodIds).toEqual([]);
    expect(projection.projectedYield).toBe("0");
    expect(projection.initialBalance).toBe("0");
  });
});

import {
  calculateMaturityValue,
  calculateMonthlyCapitalizationFromEa,
  compoundEffectivePeriods,
} from "../src/index.js";
import { expectDecimalClose } from "./helpers.js";

describe("capitalización explícita", () => {
  it("capitaliza tres meses completos sin redondeo intermedio", () => {
    const result = compoundEffectivePeriods("1000000", "0.01", 3);
    expect(result.finalBalance).toBe("1030301");
    expect(result.grossYield).toBe("30301");
  });

  it("convierte E.A. a E.M. antes de capitalizar mensualmente", () => {
    const result = calculateMonthlyCapitalizationFromEa(
      "1000000",
      "0.126825030131969720661201",
      12,
    );
    expectDecimalClose(result.finalBalance, "1126825.030131969720661201", "1e-18");
  });

  it("calcula rendimiento al vencimiento con plazo y convención explícitos", () => {
    const result = calculateMaturityValue(
      "1000000",
      "0.10",
      "2026-01-01",
      "2026-04-01",
      "DAYS_360_360",
    );
    expectDecimalClose(result.intervalRate, "0.024113689084", "1e-12");
    expectDecimalClose(result.grossYield, "24113.689084", "1e-6");
  });

  it("acepta cero periodos y rechaza cantidades fraccionarias o negativas", () => {
    expect(compoundEffectivePeriods("100", "0.01", 0).finalBalance).toBe("100");
    expect(() => compoundEffectivePeriods("100", "0.01", -1)).toThrow();
    expect(() => compoundEffectivePeriods("100", "0.01", 1.5)).toThrow();
  });
});

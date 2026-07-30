import {
  assessInterestRateInput,
  DomainError,
  effectiveRateEquivalent,
  effectiveRateForInterval,
  normalizeInterestRate,
  resolveRateSchedule,
} from "../src/index.js";
import {
  NOW,
  expectDecimalClose,
  id,
  normalizedRate,
  rateInput,
  ratePeriod,
} from "./helpers.js";

describe("normalización de tasas", () => {
  it("conserva una E.A. y su dato original", () => {
    const result = normalizedRate({ originalValue: "8.75" });
    expect(result.originalValue).toBe("8.75");
    expect(result.originalType).toBe("EA");
    expect(result.canonicalEffectiveAnnualRate).toBe("0.0875");
    expect(result.conversionMethod).toBe("EA_IDENTITY_V1");
  });

  it("convierte E.M. a E.A.", () => {
    const result = normalizedRate({
      originalValue: "0.7",
      originalType: "EM",
      originalPeriodicity: "MONTHLY",
    });
    expectDecimalClose(result.canonicalEffectiveAnnualRate ?? "", "0.087310661916", "1e-12");
  });

  it("convierte efectiva trimestral y semestral a E.A.", () => {
    expect(
      normalizedRate({
        originalValue: "2",
        originalType: "ET",
        originalPeriodicity: "QUARTERLY",
      }).canonicalEffectiveAnnualRate,
    ).toBe("0.08243216");
    expect(
      normalizedRate({
        originalValue: "4",
        originalType: "ES",
        originalPeriodicity: "SEMIANNUAL",
      }).canonicalEffectiveAnnualRate,
    ).toBe("0.0816");
  });

  it("convierte N.M.V. a E.M. y E.A.", () => {
    const result = normalizedRate({
      originalValue: "12",
      originalType: "NMV",
      originalPeriodicity: "MONTHLY",
      capitalizationPeriodsPerYear: 12,
    });
    expect(result.equivalentPeriodicRate).toBe("0.01");
    expectDecimalClose(result.canonicalEffectiveAnnualRate ?? "", "0.126825030132", "1e-12");
  });

  it("convierte N.T.V. a E.T. y E.A.", () => {
    const result = normalizedRate({
      originalValue: "12",
      originalType: "NTV",
      originalPeriodicity: "QUARTERLY",
      capitalizationPeriodsPerYear: 4,
    });
    expect(result.equivalentPeriodicRate).toBe("0.03");
    expect(result.canonicalEffectiveAnnualRate).toBe("0.12550881");
  });

  it("convierte nominal anual vencida con frecuencia explícita", () => {
    const result = normalizedRate({
      originalValue: "14",
      originalType: "NOMINAL_ANNUAL_DUE",
      originalPeriodicity: "QUARTERLY",
      capitalizationPeriodsPerYear: 4,
    });
    expect(result.equivalentPeriodicRate).toBe("0.035");
    expect(result.canonicalEffectiveAnnualRate).toBe("0.147523000625");
  });

  it("convierte nominal anual anticipada sin modelar flujos anticipados", () => {
    const result = normalizedRate({
      originalValue: "10",
      originalType: "NOMINAL_ANNUAL_ADVANCE",
      originalPeriodicity: "QUARTERLY",
      capitalizationPeriodsPerYear: 4,
      timing: "ADVANCE",
    });
    expectDecimalClose(result.equivalentPeriodicRate ?? "", "0.025641025641", "1e-12");
    expectDecimalClose(result.canonicalEffectiveAnnualRate ?? "", "0.106576740016", "1e-12");
  });

  it("convierte una efectiva periódica personalizada con n explícito", () => {
    const result = normalizedRate({
      originalValue: "1",
      originalType: "CUSTOM_EFFECTIVE_PERIODIC",
      originalPeriodicity: "CUSTOM",
      capitalizationPeriodsPerYear: 6,
    });
    expectDecimalClose(result.canonicalEffectiveAnnualRate ?? "", "0.061520150601", "1e-12");
  });

  it("representa tasa cero sin rendimiento", () => {
    const result = normalizedRate({
      originalValue: "0",
      originalType: "ZERO",
      originalPeriodicity: "NOT_APPLICABLE",
      timing: "NOT_APPLICABLE",
    });
    expect(result.canonicalEffectiveAnnualRate).toBe("0");
  });

  it("No estoy seguro queda bloqueada y no obtiene equivalencia", () => {
    const result = assessInterestRateInput(
      rateInput({
        originalType: "UNKNOWN",
        originalPeriodicity: "UNKNOWN",
        timing: "UNKNOWN",
      }),
    );
    expect(result.status).toBe("BLOCKED");
    expect("definition" in result).toBe(false);
    expect(result.blockingReasons).toContain("RATE_TYPE_UNKNOWN");
    expect(() =>
      normalizeInterestRate(
        rateInput({
          originalType: "UNKNOWN",
          originalPeriodicity: "UNKNOWN",
          timing: "UNKNOWN",
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_DATA_INCOMPLETE" }));
  });

  it.each([
    {
      originalType: "NOMINAL_ANNUAL_DUE" as const,
      originalPeriodicity: "CUSTOM" as const,
      timing: "DUE" as const,
    },
    {
      originalType: "NOMINAL_ANNUAL_ADVANCE" as const,
      originalPeriodicity: "CUSTOM" as const,
      timing: "ADVANCE" as const,
    },
  ])("rechaza nominal sin periodicidad $originalType", (overrides) => {
    expect(() => normalizedRate(overrides)).toThrowError(
      expect.objectContaining({ code: "RATE_DATA_INCOMPLETE" }),
    );
  });

  it("rechaza modalidad incorrecta, tasa negativa y anticipada periódica >= 100 %", () => {
    expect(() => normalizedRate({ originalType: "EA", timing: "UNKNOWN" })).toThrow(
      DomainError,
    );
    expect(() => normalizedRate({ originalValue: "-1" })).toThrow(DomainError);
    expect(() =>
      normalizedRate({
        originalValue: "400",
        originalType: "NOMINAL_ANNUAL_ADVANCE",
        originalPeriodicity: "QUARTERLY",
        capitalizationPeriodsPerYear: 4,
        timing: "ADVANCE",
      }),
    ).toThrow(DomainError);
  });

  it("rechaza periodicidad contradictoria y fecha civil inválida", () => {
    expect(() =>
      normalizedRate({
        originalType: "EM",
        originalPeriodicity: "ANNUAL",
      }),
    ).toThrowError(expect.objectContaining({ code: "RATE_DATA_INCOMPLETE" }));
    expect(() =>
      normalizedRate({ effectiveFrom: "2026-02-29" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DATE" }));
    expect(() =>
      normalizedRate({ consultedAt: "2026-02-29" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DATE" }));
  });

  it("evalúa datos nominales incompletos sin crear definición", () => {
    const assessment = assessInterestRateInput(
      rateInput({
        originalType: "NOMINAL_ANNUAL_DUE",
        originalPeriodicity: "CUSTOM",
      }),
    );
    expect(assessment.status).toBe("BLOCKED");
    expect("definition" in assessment).toBe(false);
    expect(assessment.blockingReasons).toContain("RATE_DATA_INCOMPLETE");
  });

  it("bloquea por defecto tasas extremadamente altas y permite políticas más estrictas", () => {
    expect(() =>
      normalizeInterestRate(rateInput({ originalValue: "100.01" })),
    ).toThrow(DomainError);
    expect(() =>
      normalizeInterestRate(rateInput({ originalValue: "51" }), {
        maximumRatePercent: "50",
      }),
    ).toThrow(DomainError);
    expect(() =>
      normalizeInterestRate(
        rateInput({
          originalValue: "10",
          originalType: "EM",
          originalPeriodicity: "MONTHLY",
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DECIMAL" }));
  });

  it("convierte entre periodicidades efectivas sin dividir tasas anuales", () => {
    const monthlyFromEa = effectiveRateEquivalent("0.0875", 1, 12);
    expectDecimalClose(monthlyFromEa, "0.007014611604", "1e-12");
    expectDecimalClose(effectiveRateEquivalent(monthlyFromEa, 12, 1), "0.0875", "1e-45");
    const monthly = effectiveRateEquivalent("0.02", 4, 12);
    expectDecimalClose(monthly, "0.00662270956", "1e-11");
    expectDecimalClose(effectiveRateEquivalent(monthly, 12, 4), "0.02", "1e-45");
  });

  it("calcula intervalo diario y año bisiesto con fórmulas documentadas", () => {
    expectDecimalClose(
      effectiveRateForInterval("0.10", "2026-01-01", "2026-01-31", "ACT_365"),
      "0.007864477221",
      "1e-12",
    );
    const leap = effectiveRateForInterval(
      "0.10",
      "2024-01-01",
      "2025-01-01",
      "ACT_ACT",
    );
    expectDecimalClose(leap, "0.10", "1e-45");
  });
});

describe("periodos de tasa", () => {
  const rate1 = normalizedRate();
  const rate2 = normalizedRate({
    id: id(101),
    originalValue: "8",
    effectiveFrom: "2026-07-01",
    variability: "VARIABLE",
  });
  const definitions = new Map([
    [rate1.id, rate1],
    [rate2.id, rate2],
  ]);

  it("acepta periodos consecutivos y conserva referencias", () => {
    const result = resolveRateSchedule(
      [
        ratePeriod({ endDate: "2026-07-01" }),
        ratePeriod({
          id: id(301),
          rateDefinitionId: rate2.id,
          startDate: "2026-07-01",
          endDate: "2027-01-01",
        }),
      ],
      definitions,
      "2026-01-01",
      "2027-01-01",
    );
    expect(result.map(({ rate }) => rate.id)).toEqual([rate1.id, rate2.id]);
  });

  it("ignora periodos completamente fuera del horizonte sin alterar la cobertura", () => {
    const result = resolveRateSchedule(
      [
        ratePeriod({
          id: id(299),
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        }),
        ratePeriod({ startDate: "2026-01-01", endDate: "2027-01-01" }),
        ratePeriod({
          id: id(302),
          startDate: "2027-02-01",
          endDate: "2028-01-01",
        }),
      ],
      definitions,
      "2026-01-01",
      "2027-01-01",
    );
    expect(result.map(({ period }) => period.id)).toEqual([id(300)]);
  });

  it("rechaza superposición, incluso con periodo abierto", () => {
    expect(() =>
      resolveRateSchedule(
        [
          ratePeriod({ endDate: "2026-08-01" }),
          ratePeriod({ id: id(301), startDate: "2026-07-01" }),
        ],
        definitions,
        "2026-01-01",
        "2027-01-01",
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_PERIOD_OVERLAP" }));

    const { endDate: _discardedEndDate, ...openPeriod } = ratePeriod();
    expect(() =>
      resolveRateSchedule(
        [
          openPeriod,
          ratePeriod({ id: id(301), startDate: "2026-07-01" }),
        ],
        definitions,
        "2026-01-01",
        "2027-01-01",
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_PERIOD_OVERLAP" }));
  });

  it("rechaza espacios y definiciones bloqueadas", () => {
    expect(() =>
      resolveRateSchedule(
        [
          ratePeriod({ endDate: "2026-06-01" }),
          ratePeriod({
            id: id(301),
            rateDefinitionId: rate2.id,
            startDate: "2026-07-01",
          }),
        ],
        definitions,
        "2026-01-01",
        "2027-01-01",
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_PERIOD_GAP" }));

    expect(() =>
      resolveRateSchedule(
        [ratePeriod({ rateDefinitionId: id(102) })],
        new Map(),
        "2026-01-01",
        "2027-01-01",
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_DATA_INCOMPLETE" }));
  });
});

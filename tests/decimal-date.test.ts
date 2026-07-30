import {
  DomainError,
  actualDaysBetween,
  addCalendarMonths,
  addCalendarYears,
  canonicalDecimal,
  dayCountFractions,
  parseCivilDate,
  parseDecimal,
  quantizeDecimal,
  utf8ByteLength,
  utf8Bytes,
} from "../src/index.js";

describe("aritmética decimal y fechas civiles", () => {
  it("canonicaliza sin notación exponencial ni cero negativo", () => {
    expect(canonicalDecimal("100.5000")).toBe("100.5");
    expect(canonicalDecimal("-0")).toBe("0");
  });

  it.each(["NaN", "Infinity", "1e3", "01", "1,5", "", " 1"])(
    "rechaza decimal ambiguo %s",
    (value) => {
      expect(() => parseDecimal(value)).toThrow(DomainError);
    },
  );

  it("aplica límite inyectado sin truncar", () => {
    expect(() => parseDecimal("101", { maximum: "100" })).toThrowError(
      expect.objectContaining({ code: "INVALID_DECIMAL" }),
    );
  });

  it("cuantiza HALF_UP solo cuando se solicita", () => {
    expect(quantizeDecimal("24113.5", 0)).toBe("24114");
    expect(quantizeDecimal("24113.49", 0)).toBe("24113");
  });

  it("mide bytes UTF-8 reales para que el límite de archivo no se omita con Unicode", () => {
    expect(utf8Bytes("Aé€😀")).toHaveLength(10);
    expect(utf8ByteLength("Aé€😀")).toBe(10);
  });

  it("valida fechas inexistentes y límites", () => {
    expect(() => parseCivilDate("2026-02-29")).toThrow(DomainError);
    expect(() => parseCivilDate("1899-12-31")).toThrow(DomainError);
    expect(parseCivilDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("opera meses y años sin desplazamiento de zona horaria", () => {
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addCalendarYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(actualDaysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("distingue ACT/365, 365/365, 360/360 y ACT/ACT", () => {
    expect(dayCountFractions("2024-02-28", "2024-03-01", "ACT_365")[0]).toMatchObject({
      numeratorDays: 2,
      denominatorDays: 365,
    });
    expect(
      dayCountFractions("2024-02-28", "2024-03-01", "DAYS_365_365")[0],
    ).toMatchObject({ numeratorDays: 1, denominatorDays: 365 });
    expect(
      dayCountFractions("2026-01-31", "2026-02-28", "DAYS_360_360")[0],
    ).toMatchObject({ numeratorDays: 28, denominatorDays: 360 });
    expect(dayCountFractions("2023-12-31", "2024-01-02", "ACT_ACT")).toEqual([
      { numeratorDays: 1, denominatorDays: 365, fraction: expect.any(String) },
      { numeratorDays: 1, denominatorDays: 366, fraction: expect.any(String) },
    ]);
  });

  it("bloquea PRODUCT_DEFINED", () => {
    expect(() =>
      dayCountFractions("2026-01-01", "2026-02-01", "PRODUCT_DEFINED"),
    ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
  });
});

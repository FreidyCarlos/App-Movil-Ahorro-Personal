import { FinancialDecimal, canonicalDecimal } from "./decimal.js";
import { assertDomain } from "./errors.js";

export type CivilDate = string;

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINIMUM_DATE = "1900-01-01";
const MAXIMUM_DATE = "2200-12-31";
const MILLISECONDS_PER_DAY = 86_400_000;

export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function parseCivilDate(
  value: string,
  limits: { readonly minimum?: CivilDate; readonly maximum?: CivilDate } = {},
): DateParts {
  const match = CIVIL_DATE_PATTERN.exec(value);
  assertDomain(match !== null, "INVALID_DATE", "La fecha debe usar YYYY-MM-DD.", {
    value,
  });

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  assertDomain(
    date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day,
    "INVALID_DATE",
    "La fecha civil no existe.",
    { value },
  );

  const minimum = limits.minimum ?? MINIMUM_DATE;
  const maximum = limits.maximum ?? MAXIMUM_DATE;
  assertDomain(
    value >= minimum && value <= maximum,
    "INVALID_DATE",
    "La fecha está fuera del intervalo admitido.",
    { value, minimum, maximum },
  );

  return { year, month, day };
}

export function compareCivilDates(left: CivilDate, right: CivilDate): number {
  parseCivilDate(left);
  parseCivilDate(right);
  return left.localeCompare(right);
}

export function civilDateToEpochDay(value: CivilDate): number {
  const { year, month, day } = parseCivilDate(value);
  return Math.trunc(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

export function epochDayToCivilDate(epochDay: number): CivilDate {
  assertDomain(
    Number.isInteger(epochDay),
    "INVALID_DATE",
    "El día de época debe ser entero.",
  );
  const date = new Date(epochDay * MILLISECONDS_PER_DAY);
  const value = [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
  parseCivilDate(value);
  return value;
}

export function addCivilDays(value: CivilDate, days: number): CivilDate {
  assertDomain(Number.isInteger(days), "INVALID_DATE", "La cantidad de días debe ser entera.");
  return epochDayToCivilDate(civilDateToEpochDay(value) + days);
}

export function actualDaysBetween(start: CivilDate, end: CivilDate): number {
  const days = civilDateToEpochDay(end) - civilDateToEpochDay(start);
  assertDomain(days >= 0, "INVALID_DATE", "La fecha final no puede ser anterior.");
  return days;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export type DayCountConvention =
  | "DAYS_360_360"
  | "DAYS_365_365"
  | "ACT_ACT"
  | "ACT_365"
  | "PRODUCT_DEFINED";

function days360Between(start: CivilDate, end: CivilDate): number {
  const a = parseCivilDate(start);
  const b = parseCivilDate(end);
  const value =
    360 * (b.year - a.year) +
    30 * (b.month - a.month) +
    (Math.min(b.day, 30) - Math.min(a.day, 30));
  assertDomain(value >= 0, "INVALID_DATE", "La fecha final no puede ser anterior.");
  return value;
}

function fixed365Serial(date: CivilDate): number {
  const { year, month, day } = parseCivilDate(date);
  const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = Math.min(day, monthLengths[month - 1] ?? 31) - 1;
  for (let index = 0; index < month - 1; index += 1) {
    dayOfYear += monthLengths[index] ?? 0;
  }
  return year * 365 + dayOfYear;
}

export interface DayCountFraction {
  readonly numeratorDays: number;
  readonly denominatorDays: number;
  readonly fraction: string;
}

export function dayCountFractions(
  start: CivilDate,
  end: CivilDate,
  convention: DayCountConvention,
): readonly DayCountFraction[] {
  assertDomain(
    convention !== "PRODUCT_DEFINED",
    "INVALID_CONFIGURATION",
    "PRODUCT_DEFINED no permite calcular sin una convención concreta.",
  );
  assertDomain(compareCivilDates(start, end) <= 0, "INVALID_DATE", "Intervalo inválido.");

  if (start === end) {
    return [];
  }

  if (convention === "DAYS_360_360") {
    const days = days360Between(start, end);
    return [
      {
        numeratorDays: days,
        denominatorDays: 360,
        fraction: canonicalDecimal(new FinancialDecimal(days).dividedBy(360)),
      },
    ];
  }

  if (convention === "DAYS_365_365") {
    const days = fixed365Serial(end) - fixed365Serial(start);
    return [
      {
        numeratorDays: days,
        denominatorDays: 365,
        fraction: canonicalDecimal(new FinancialDecimal(days).dividedBy(365)),
      },
    ];
  }

  if (convention === "ACT_365") {
    const days = actualDaysBetween(start, end);
    return [
      {
        numeratorDays: days,
        denominatorDays: 365,
        fraction: canonicalDecimal(new FinancialDecimal(days).dividedBy(365)),
      },
    ];
  }

  const result: DayCountFraction[] = [];
  let cursor = start;
  while (cursor < end) {
    const { year } = parseCivilDate(cursor);
    const nextYear = `${String(year + 1).padStart(4, "0")}-01-01`;
    const segmentEnd = nextYear < end ? nextYear : end;
    const days = actualDaysBetween(cursor, segmentEnd);
    const denominator = isLeapYear(year) ? 366 : 365;
    result.push({
      numeratorDays: days,
      denominatorDays: denominator,
      fraction: canonicalDecimal(new FinancialDecimal(days).dividedBy(denominator)),
    });
    cursor = segmentEnd;
  }
  return result;
}

export function addCalendarMonths(value: CivilDate, months: number): CivilDate {
  assertDomain(Number.isInteger(months), "INVALID_DATE", "Los meses deben ser enteros.");
  const { year, month, day } = parseCivilDate(value);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = first.getUTCFullYear();
  const targetMonth = first.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return [
    String(targetYear).padStart(4, "0"),
    String(targetMonth + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

export function addCalendarYears(value: CivilDate, years: number): CivilDate {
  assertDomain(Number.isInteger(years), "INVALID_DATE", "Los años deben ser enteros.");
  return addCalendarMonths(value, years * 12);
}

export function exactCalendarMonthsBetween(
  start: CivilDate,
  end: CivilDate,
): number | undefined {
  const a = parseCivilDate(start);
  const b = parseCivilDate(end);
  const months = (b.year - a.year) * 12 + (b.month - a.month);
  if (months < 0) {
    return undefined;
  }
  return addCalendarMonths(start, months) === end ? months : undefined;
}

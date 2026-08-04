import { calculateSimpleProjection } from "../domain/calculations/simple-projection.js";
import { assessInterestRateInput } from "../domain/calculations/rates.js";
import { parseCivilDate } from "../domain/date.js";
import type { RateType, SimplePeriodicity } from "../domain/models.js";
import { validateSimpleGoalForm } from "./simple-goal-form.js";

export type AdvancedYieldChoice = "ZERO" | "EA" | "OTHER" | "UNKNOWN";

export type OtherSupportedRateType = Extract<
  RateType,
  "EM" | "ET" | "ES" | "NMV" | "NTV" | "NOMINAL_ANNUAL_DUE"
>;

export interface AdvancedGoalFormInput {
  readonly name: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: string;
  readonly startDate: string;
  readonly targetAmount: string;
  readonly initialBalance: string;
  readonly yieldChoice: AdvancedYieldChoice;
  readonly rateValue: string;
  readonly otherRateType: OtherSupportedRateType;
  readonly capitalizationPeriodsPerYear: string;
}

export interface ValidAdvancedGoalInput {
  readonly name: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: string;
  readonly targetAmount?: string;
  readonly initialBalance: string;
  readonly yieldChoice: Exclude<AdvancedYieldChoice, "UNKNOWN">;
  readonly rateValue?: string;
  readonly otherRateType?: OtherSupportedRateType;
  readonly capitalizationPeriodsPerYear?: number;
}

export type AdvancedGoalFormErrors = Partial<
  Record<keyof AdvancedGoalFormInput, string>
>;

export type AdvancedGoalFormValidation =
  | {
      readonly success: true;
      readonly data: ValidAdvancedGoalInput;
      readonly projectedContributions: string;
      readonly projectedEndDate?: string;
    }
  | {
      readonly success: false;
      readonly errors: AdvancedGoalFormErrors;
    };

function canonicalWholeAmount(
  value: string,
  field: "targetAmount" | "initialBalance",
  errors: AdvancedGoalFormErrors,
  options: { readonly optional: boolean; readonly allowZero: boolean },
): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 && options.optional) {
    return undefined;
  }
  const pattern = options.allowZero ? /^\d+$/ : /^[1-9]\d*$/;
  if (!pattern.test(trimmed)) {
    errors[field] = options.allowZero
      ? "Escribe un monto entero igual o mayor que cero."
      : "Escribe un monto entero mayor que cero.";
    return undefined;
  }
  try {
    const normalized = BigInt(trimmed).toString();
    if (BigInt(normalized) > 10_000_000_000n) {
      errors[field] = "El monto no puede superar 10.000.000.000 COP.";
      return undefined;
    }
    return normalized;
  } catch {
    errors[field] = "El monto no es válido.";
    return undefined;
  }
}

function rateShape(type: OtherSupportedRateType): {
  readonly periodicity: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "CUSTOM";
  readonly capitalizationPeriodsPerYear?: number;
} {
  switch (type) {
    case "EM":
      return { periodicity: "MONTHLY" };
    case "ET":
      return { periodicity: "QUARTERLY" };
    case "ES":
      return { periodicity: "SEMIANNUAL" };
    case "NMV":
      return { periodicity: "MONTHLY", capitalizationPeriodsPerYear: 12 };
    case "NTV":
      return { periodicity: "QUARTERLY", capitalizationPeriodsPerYear: 4 };
    case "NOMINAL_ANNUAL_DUE":
      return { periodicity: "CUSTOM" };
  }
}

export function validateAdvancedGoalForm(
  input: AdvancedGoalFormInput,
): AdvancedGoalFormValidation {
  const simple = validateSimpleGoalForm(input);
  const errors: AdvancedGoalFormErrors = simple.success
    ? {}
    : { ...simple.errors };
  const initialBalance = canonicalWholeAmount(
    input.initialBalance,
    "initialBalance",
    errors,
    { optional: false, allowZero: true },
  );
  const targetAmount = canonicalWholeAmount(
    input.targetAmount,
    "targetAmount",
    errors,
    { optional: true, allowZero: false },
  );

  if (input.yieldChoice === "UNKNOWN") {
    errors.yieldChoice =
      "Completa el tipo de tasa antes de calcular rendimiento. No se usará una tasa inventada.";
  }

  const effectiveFrom = input.startDate.trim() || "2000-01-01";
  try {
    parseCivilDate(effectiveFrom);
  } catch {
    errors.startDate = "Escribe una fecha válida con formato AAAA-MM-DD.";
  }

  let rateValue: string | undefined;
  let capitalizationPeriodsPerYear: number | undefined;
  if (input.yieldChoice === "EA" || input.yieldChoice === "OTHER") {
    rateValue = input.rateValue.trim();
    if (!/^\d+(?:\.\d+)?$/.test(rateValue)) {
      errors.rateValue = "Escribe la tasa como porcentaje, por ejemplo 9.5.";
    } else {
      const type = input.yieldChoice === "EA" ? "EA" : input.otherRateType;
      const shape =
        type === "EA" ? { periodicity: "ANNUAL" as const } : rateShape(type);
      if (type === "NOMINAL_ANNUAL_DUE") {
        capitalizationPeriodsPerYear = Number(
          input.capitalizationPeriodsPerYear.trim(),
        );
        if (
          !Number.isInteger(capitalizationPeriodsPerYear) ||
          capitalizationPeriodsPerYear < 1 ||
          capitalizationPeriodsPerYear > 366
        ) {
          errors.capitalizationPeriodsPerYear =
            "Indica entre 1 y 366 capitalizaciones por año.";
        }
      } else {
        capitalizationPeriodsPerYear =
          "capitalizationPeriodsPerYear" in shape
            ? shape.capitalizationPeriodsPerYear
            : undefined;
      }
      if (errors.capitalizationPeriodsPerYear === undefined) {
        const assessment = assessInterestRateInput({
          id: "00000000-0000-4000-8000-000000000001",
          originalValue: rateValue,
          originalType: type,
          originalPeriodicity: shape.periodicity,
          ...(capitalizationPeriodsPerYear === undefined
            ? {}
            : { capitalizationPeriodsPerYear }),
          timing: "DUE",
          variability: "FIXED",
          effectiveFrom,
          createdAt: "2000-01-01T00:00:00.000Z",
        });
        if (assessment.status === "BLOCKED") {
          errors.rateValue =
            "La tasa está incompleta o supera los límites admitidos.";
        }
      }
    }
  }

  if (
    !simple.success ||
    initialBalance === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { success: false, errors };
  }

  const calculation = calculateSimpleProjection(simple.data);
  return {
    success: true,
    data: {
      ...simple.data,
      ...(targetAmount === undefined ? {} : { targetAmount }),
      initialBalance,
      yieldChoice: input.yieldChoice as Exclude<AdvancedYieldChoice, "UNKNOWN">,
      ...(rateValue === undefined ? {} : { rateValue }),
      ...(input.yieldChoice !== "OTHER"
        ? {}
        : { otherRateType: input.otherRateType }),
      ...(capitalizationPeriodsPerYear === undefined
        ? {}
        : { capitalizationPeriodsPerYear }),
    },
    projectedContributions: calculation.projectedTotal,
    ...(calculation.projectedEndDate === undefined
      ? {}
      : { projectedEndDate: calculation.projectedEndDate }),
  };
}

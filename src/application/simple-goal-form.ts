import { calculateSimpleProjection } from "../domain/calculations/simple-projection.js";
import { parseCivilDate } from "../domain/date.js";
import type { SimplePeriodicity } from "../domain/models.js";

export interface SimpleGoalFormInput {
  readonly name: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: string;
  readonly startDate: string;
}

export interface ValidSimpleGoalInput {
  readonly name: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: string;
}

export type SimpleGoalFormErrors = Partial<
  Record<keyof SimpleGoalFormInput, string>
>;

export type SimpleGoalFormValidation =
  | {
      readonly success: true;
      readonly data: ValidSimpleGoalInput;
      readonly projectedTotal: string;
    }
  | {
      readonly success: false;
      readonly errors: SimpleGoalFormErrors;
    };

export function validateSimpleGoalForm(
  input: SimpleGoalFormInput,
): SimpleGoalFormValidation {
  const errors: SimpleGoalFormErrors = {};
  const name = input.name.trim();
  const periodicAmount = input.periodicAmount.trim();
  const periodsText = input.numberOfPeriods.trim();
  const startDate = input.startDate.trim();

  if (name.length === 0) {
    errors.name = "Escribe un nombre para la meta.";
  } else if (name.length > 80) {
    errors.name = "El nombre puede tener máximo 80 caracteres.";
  }

  if (!/^[1-9]\d*$/.test(periodicAmount)) {
    errors.periodicAmount = "Escribe un monto entero mayor que cero.";
  }

  const numberOfPeriods = Number(periodsText);
  const maximum = input.periodicity === "MONTHLY" ? 1200 : 100;
  if (
    !/^[1-9]\d*$/.test(periodsText) ||
    !Number.isSafeInteger(numberOfPeriods) ||
    numberOfPeriods > maximum
  ) {
    errors.numberOfPeriods =
      `La cantidad debe estar entre 1 y ${maximum}.`;
  }

  if (startDate.length > 0) {
    try {
      parseCivilDate(startDate);
    } catch {
      errors.startDate = "Escribe una fecha válida con formato AAAA-MM-DD.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  try {
    const calculation = calculateSimpleProjection({
      periodicAmount,
      periodicity: input.periodicity,
      numberOfPeriods,
      ...(startDate.length === 0 ? {} : { startDate }),
    });
    return {
      success: true,
      data: {
        name,
        periodicAmount: calculation.periodicAmount,
        periodicity: calculation.periodicity,
        numberOfPeriods: calculation.numberOfPeriods,
        ...(calculation.startDate === undefined
          ? {}
          : { startDate: calculation.startDate }),
      },
      projectedTotal: calculation.projectedTotal,
    };
  } catch {
    return {
      success: false,
      errors: {
        periodicAmount:
          "Revisa el monto, la cantidad de periodos y la fecha.",
      },
    };
  }
}

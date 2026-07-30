import { assertDomain } from "../errors.js";
import type { ActualPeriodClose, ProjectionResult } from "../models.js";
import {
  calculateAdvancedProjection,
  type AdvancedProjectionInput,
} from "./advanced-projection.js";

export type UpdatedProjectionInput = Omit<
  AdvancedProjectionInput,
  "projectionKind" | "startDate" | "initialBalance"
>;

export function calculateUpdatedProjectionFromClose(
  close: ActualPeriodClose,
  input: UpdatedProjectionInput,
): ProjectionResult {
  assertDomain(close.status === "VALID", "INVALID_CONFIGURATION", "El cierre no está vigente.");
  assertDomain(close.goalId === input.goalId, "INVALID_CONFIGURATION", "El cierre pertenece a otra meta.");
  assertDomain(
    close.periodEnd < input.endDate,
    "INVALID_DATE",
    "La proyección actualizada debe terminar después del cierre.",
  );
  return calculateAdvancedProjection({
    ...input,
    projectionKind: "UPDATED",
    startDate: close.periodEnd,
    initialBalance: close.closingBalance,
  });
}

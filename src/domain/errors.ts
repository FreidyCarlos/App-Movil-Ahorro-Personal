export type DomainErrorCode =
  | "INVALID_DECIMAL"
  | "INVALID_DATE"
  | "INVALID_IDENTIFIER"
  | "INVALID_CONFIGURATION"
  | "UNSUPPORTED_CURRENCY"
  | "UNSUPPORTED_RATE"
  | "RATE_DATA_INCOMPLETE"
  | "RATE_PERIOD_OVERLAP"
  | "RATE_PERIOD_GAP"
  | "PRODUCT_CONSTRAINT"
  | "INSUFFICIENT_BALANCE"
  | "DUPLICATE_MOVEMENT"
  | "SERIALIZATION_ERROR"
  | "INCOMPATIBLE_VERSION";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    code: DomainErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function assertDomain(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): asserts condition {
  if (!condition) {
    throw new DomainError(code, message, details);
  }
}

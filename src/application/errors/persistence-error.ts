export type PersistenceErrorCode =
  | "DATABASE_CORRUPT"
  | "DATABASE_INCOMPATIBLE"
  | "DATABASE_NOT_INITIALIZED"
  | "DATABASE_CONSTRAINT"
  | "DATABASE_OPERATION_FAILED"
  | "MIGRATION_FAILED"
  | "BACKUP_FILE_INVALID"
  | "BACKUP_FILE_TOO_LARGE"
  | "BACKUP_CHECKSUM_MISMATCH"
  | "IMPORT_CONFIRMATION_REQUIRED"
  | "IMPORT_PREVIEW_EXPIRED"
  | "FILE_OPERATION_FAILED";

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    code: PersistenceErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    this.details = details;
  }
}

export function asPersistenceError(
  error: unknown,
  fallbackCode: PersistenceErrorCode,
  fallbackMessage: string,
): PersistenceError {
  if (error instanceof PersistenceError) {
    return error;
  }
  return new PersistenceError(fallbackCode, fallbackMessage);
}

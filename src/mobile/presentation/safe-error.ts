import { DomainError } from "../../domain/errors.js";
import { PersistenceError } from "../../application/errors/persistence-error.js";

export function safeUserMessage(error: unknown): string {
  if (error instanceof PersistenceError || error instanceof DomainError) {
    return error.message;
  }
  return "Ocurrió un error inesperado. Tus datos existentes no fueron reemplazados.";
}

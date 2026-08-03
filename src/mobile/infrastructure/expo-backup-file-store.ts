import { Directory, File, Paths } from "expo-file-system";

import { PersistenceError } from "../../application/errors/persistence-error.js";
import { utf8ByteLength } from "../../domain/canonical.js";
import type {
  BackupFileStore,
  SelectedBackupFile,
  StoredBackupFile,
} from "../../application/ports/backup-file-store.js";

const JSON_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}\.json$/;

function validateDisplayName(displayName: string): void {
  if (!JSON_NAME.test(displayName)) {
    throw new PersistenceError(
      "FILE_OPERATION_FAILED",
      "El nombre del archivo de copia no es válido.",
    );
  }
}

export class ExpoBackupFileStore implements BackupFileStore {
  readonly #directory = new Directory(Paths.document, "backups");
  readonly #maximumBytes: number;
  readonly #nextTemporaryId: () => string;

  public constructor(maximumBytes: number, nextTemporaryId: () => string) {
    if (!Number.isInteger(maximumBytes) || maximumBytes <= 0) {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "El límite de archivos debe ser un entero positivo.",
      );
    }
    this.#maximumBytes = maximumBytes;
    this.#nextTemporaryId = nextTemporaryId;
  }

  public async writeAtomic(
    displayName: string,
    contents: string,
  ): Promise<StoredBackupFile> {
    validateDisplayName(displayName);
    const expectedSize = utf8ByteLength(contents);
    if (expectedSize > this.#maximumBytes) {
      throw new PersistenceError(
        "BACKUP_FILE_TOO_LARGE",
        "La copia excede el tamaño permitido.",
      );
    }
    try {
      this.#directory.create({ idempotent: true, intermediates: true });
      const destination = new File(this.#directory, displayName);
      if (destination.exists) {
        throw new PersistenceError(
          "FILE_OPERATION_FAILED",
          "Ya existe una copia con el mismo nombre.",
        );
      }
      const temporary = new File(
        this.#directory,
        `.temporal-${this.#nextTemporaryId()}.tmp`,
      );
      temporary.create({ overwrite: false });
      try {
        temporary.write(contents);
        await temporary.move(destination, { overwrite: false });
      } catch (error) {
        if (temporary.exists) {
          temporary.delete();
        }
        throw error;
      }
      if (!destination.exists || destination.size !== expectedSize) {
        if (destination.exists) {
          destination.delete();
        }
        throw new PersistenceError(
          "FILE_OPERATION_FAILED",
          "La copia local quedó incompleta y fue descartada.",
        );
      }
      return {
        reference: destination.uri,
        displayName: destination.name,
        sizeBytes: destination.size,
      };
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }
      throw new PersistenceError(
        "FILE_OPERATION_FAILED",
        "No fue posible escribir la copia local.",
      );
    }
  }

  public async readSelected(reference: string): Promise<SelectedBackupFile> {
    try {
      const file = new File(reference);
      if (!file.exists || !file.name.toLowerCase().endsWith(".json")) {
        throw new PersistenceError(
          "BACKUP_FILE_INVALID",
          "Selecciona un archivo JSON de copia válido.",
        );
      }
      if (file.size > this.#maximumBytes) {
        throw new PersistenceError(
          "BACKUP_FILE_TOO_LARGE",
          "La copia excede el tamaño permitido.",
        );
      }
      const expectedSize = file.size;
      const contents = await file.text();
      const actualSize = utf8ByteLength(contents);
      if (actualSize > this.#maximumBytes) {
        throw new PersistenceError(
          "BACKUP_FILE_TOO_LARGE",
          "La copia excede el tamaño permitido.",
        );
      }
      if (actualSize !== expectedSize) {
        throw new PersistenceError(
          "BACKUP_FILE_INVALID",
          "El archivo cambió o no es texto UTF-8 válido.",
        );
      }
      return {
        reference: file.uri,
        displayName: file.name.slice(0, 180),
        sizeBytes: actualSize,
        contents,
      };
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }
      throw new PersistenceError(
        "FILE_OPERATION_FAILED",
        "No fue posible leer el archivo seleccionado.",
      );
    }
  }

  public async deleteStored(reference: string): Promise<void> {
    try {
      const file = new File(reference);
      if (file.exists) {
        file.delete();
      }
    } catch {
      throw new PersistenceError(
        "FILE_OPERATION_FAILED",
        "No fue posible retirar una copia local inválida.",
      );
    }
  }
}

import {
  mkdir,
  link,
  open,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { utf8ByteLength } from "../../domain/canonical.js";
import type {
  BackupFileStore,
  SelectedBackupFile,
  StoredBackupFile,
} from "../../application/ports/backup-file-store.js";
import { PersistenceError } from "../../application/errors/persistence-error.js";

function isInside(root: string, candidate: string): boolean {
  const difference = relative(root, candidate);
  return (
    difference === "" ||
    (!difference.startsWith("..") && !isAbsolute(difference))
  );
}

function safeDisplayName(value: string): string {
  if (
    value.length < 1 ||
    value.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/i.test(value)
  ) {
    throw new PersistenceError(
      "BACKUP_FILE_INVALID",
      "El nombre propuesto para la copia no es válido.",
    );
  }
  return value;
}

export interface SafeNodeBackupFileStoreOptions {
  readonly exportDirectory: string;
  readonly allowedImportDirectories: readonly string[];
  readonly maximumBytes: number;
}

/**
 * Adaptador de integración para Node. En móvil se reemplazará por selector de
 * documentos y sistema de archivos de Expo sin cambiar el caso de uso.
 */
export class SafeNodeBackupFileStore implements BackupFileStore {
  readonly #exportDirectory: string;
  readonly #allowedImportDirectories: readonly string[];
  readonly #maximumBytes: number;

  public constructor(options: SafeNodeBackupFileStoreOptions) {
    if (!Number.isInteger(options.maximumBytes) || options.maximumBytes <= 0) {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "El límite de archivos debe ser un entero positivo.",
      );
    }
    this.#exportDirectory = resolve(options.exportDirectory);
    this.#allowedImportDirectories = options.allowedImportDirectories.map(
      (directory) => resolve(directory),
    );
    this.#maximumBytes = options.maximumBytes;
  }

  public async writeAtomic(
    displayNameInput: string,
    contents: string,
  ): Promise<StoredBackupFile> {
    const displayName = safeDisplayName(displayNameInput);
    const sizeBytes = utf8ByteLength(contents);
    if (sizeBytes > this.#maximumBytes) {
      throw new PersistenceError(
        "BACKUP_FILE_TOO_LARGE",
        "La copia excede el tamaño permitido.",
      );
    }
    const destination = resolve(this.#exportDirectory, displayName);
    if (!isInside(this.#exportDirectory, destination)) {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "El destino de la copia no está permitido.",
      );
    }
    const temporary = resolve(
      this.#exportDirectory,
      `.${displayName}.${randomUUID()}.tmp`,
    );
    await mkdir(this.#exportDirectory, { recursive: true });
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(contents, { encoding: "utf8" });
      await handle.sync();
      await handle.close();
      handle = undefined;
      await link(temporary, destination);
      await rm(temporary);
      return {
        reference: destination,
        displayName,
        sizeBytes,
      };
    } catch {
      if (handle !== undefined) {
        await handle.close().catch(() => undefined);
      }
      await rm(temporary, { force: true }).catch(() => undefined);
      throw new PersistenceError(
        "FILE_OPERATION_FAILED",
        "No fue posible escribir la copia de forma segura.",
      );
    }
  }

  public async readSelected(reference: string): Promise<SelectedBackupFile> {
    const resolved = resolve(reference);
    if (
      this.#allowedImportDirectories.length === 0 ||
      !this.#allowedImportDirectories.some((root) => isInside(root, resolved))
    ) {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "El archivo seleccionado no pertenece a una ubicación autorizada.",
      );
    }
    if (extname(resolved).toLowerCase() !== ".json") {
      throw new PersistenceError(
        "BACKUP_FILE_INVALID",
        "La copia seleccionada debe ser un archivo JSON.",
      );
    }
    try {
      const information = await stat(resolved);
      if (!information.isFile()) {
        throw new PersistenceError(
          "BACKUP_FILE_INVALID",
          "La selección no corresponde a un archivo regular.",
        );
      }
      if (information.size > this.#maximumBytes) {
        throw new PersistenceError(
          "BACKUP_FILE_TOO_LARGE",
          "La copia excede el tamaño permitido.",
        );
      }
      const contents = await readFile(resolved, { encoding: "utf8" });
      const sizeBytes = utf8ByteLength(contents);
      if (sizeBytes > this.#maximumBytes) {
        throw new PersistenceError(
          "BACKUP_FILE_TOO_LARGE",
          "La copia excede el tamaño permitido.",
        );
      }
      return {
        reference: resolved,
        displayName: safeDisplayName(basename(resolved)),
        sizeBytes,
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
}

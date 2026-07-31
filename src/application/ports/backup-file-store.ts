export interface StoredBackupFile {
  /**
   * Referencia opaca para que la presentación pueda compartirla. Nunca se
   * persiste dentro del snapshot ni se muestra en mensajes de error.
   */
  readonly reference: string;
  readonly displayName: string;
  readonly sizeBytes: number;
}

export interface SelectedBackupFile extends StoredBackupFile {
  readonly contents: string;
}

export interface BackupFileStore {
  writeAtomic(
    displayName: string,
    contents: string,
  ): Promise<StoredBackupFile>;
  readSelected(reference: string): Promise<SelectedBackupFile>;
}

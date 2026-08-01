import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import {
  BackupService,
  DEFAULT_PORTABLE_BACKUP_LIMITS,
  type ImportPreview,
  type ImportReplacementResult,
} from "../../application/backup/backup-service.js";
import { createEmptyDomainSnapshot } from "../../application/create-empty-snapshot.js";
import {
  MobileSavingsService,
  type CreateSimpleGoalInput,
  type SimpleGoalView,
} from "../../application/mobile-savings-service.js";
import type { StoredBackupFile } from "../../application/ports/backup-file-store.js";
import { FINANCIAL_RULES_VERSION } from "../../domain/calculations/rates.js";
import { ExpoSqliteDatabaseAdapter } from "../../infrastructure/database/expo-sqlite-adapter.js";
import type { ExpoSqliteDatabaseLike } from "../../infrastructure/database/expo-sqlite-adapter.js";
import { initializeDatabase } from "../../infrastructure/database/initialize-database.js";
import { SQLiteDomainRepository } from "../../infrastructure/repositories/sqlite-domain-repository.js";
import { ExpoBackupFileStore } from "./expo-backup-file-store.js";
import { ExpoChecksumProvider } from "./expo-checksum-provider.js";

const APP_VERSION = Constants.expoConfig?.version ?? "0.1.0";
const DATABASE_NAME = "ahorro-personal.db";

function asExpoDatabaseLike(database: SQLiteDatabase): ExpoSqliteDatabaseLike {
  return {
    execAsync: (sql) => database.execAsync(sql),
    runAsync: (sql, parameters) => database.runAsync(sql, [...parameters]),
    getFirstAsync: (sql, parameters) =>
      database.getFirstAsync(sql, [...parameters]),
    getAllAsync: (sql, parameters) =>
      database.getAllAsync(sql, [...parameters]),
    withExclusiveTransactionAsync: async <T>(
      operation: (transaction: ExpoSqliteDatabaseLike) => Promise<T>,
    ) => {
      let completed = false;
      let result: T | undefined;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        result = await operation(asExpoDatabaseLike(transaction));
        completed = true;
      });
      if (!completed) {
        throw new Error("La transacción no finalizó.");
      }
      return result as T;
    },
  };
}

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  const current = new Date();
  return [
    String(current.getFullYear()).padStart(4, "0"),
    String(current.getMonth() + 1).padStart(2, "0"),
    String(current.getDate()).padStart(2, "0"),
  ].join("-");
}

export interface MobileRuntime {
  readonly databaseStatus: "HEALTHY";
  listGoals(): Promise<readonly SimpleGoalView[]>;
  createSimpleGoal(input: CreateSimpleGoalInput): Promise<SimpleGoalView>;
  exportBackup(): Promise<StoredBackupFile>;
  shareBackup(file: StoredBackupFile): Promise<boolean>;
  selectAndPreviewImport(): Promise<ImportPreview | undefined>;
  confirmImport(token: string): Promise<ImportReplacementResult>;
}

export async function createMobileRuntime(): Promise<MobileRuntime> {
  const nativeDatabase = await openDatabaseAsync(DATABASE_NAME);
  const database = new ExpoSqliteDatabaseAdapter(
    asExpoDatabaseLike(nativeDatabase),
  );
  const initialization = await initializeDatabase(database, now());
  const repository = new SQLiteDomainRepository(
    database,
    DEFAULT_PORTABLE_BACKUP_LIMITS,
  );
  if (!(await repository.hasDomainState())) {
    const instant = now();
    await repository.replaceSnapshot(
      createEmptyDomainSnapshot({
        appVersion: APP_VERSION,
        rulesVersion: FINANCIAL_RULES_VERSION,
        now: instant,
        settingsId: Crypto.randomUUID(),
      }),
    );
  }

  const ids = { nextId: () => Crypto.randomUUID() };
  const clock = { now, today };
  const savings = new MobileSavingsService(repository, clock, ids, {
    appVersion: APP_VERSION,
    rulesVersion: FINANCIAL_RULES_VERSION,
  });
  const files = new ExpoBackupFileStore(
    DEFAULT_PORTABLE_BACKUP_LIMITS.maximumBytes,
    () => Crypto.randomUUID(),
  );
  const backups = new BackupService(
    repository,
    files,
    new ExpoChecksumProvider(),
    clock,
    ids,
    {
      appVersion: APP_VERSION,
      rulesVersion: FINANCIAL_RULES_VERSION,
      limits: DEFAULT_PORTABLE_BACKUP_LIMITS,
    },
  );

  return {
    databaseStatus: initialization.integrityStatus,
    listGoals: () => savings.listSimpleGoals(),
    createSimpleGoal: (input) => savings.createSimpleGoal(input),
    exportBackup: () => backups.exportPortableBackup(),
    shareBackup: async (file) => {
      if (!(await Sharing.isAvailableAsync())) {
        return false;
      }
      await Sharing.shareAsync(file.reference, {
        mimeType: "application/json",
        dialogTitle: "Guardar copia de Ahorro Personal",
      });
      return true;
    },
    selectAndPreviewImport: async () => {
      const selection = await DocumentPicker.getDocumentAsync({
        // Some Android document providers classify .json files as text or
        // generic binary data. The file store still enforces the .json
        // extension, size limit, schema and checksum after selection.
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) {
        return undefined;
      }
      const asset = selection.assets[0];
      if (asset === undefined) {
        return undefined;
      }
      return backups.previewImport(asset.uri);
    },
    confirmImport: (token) => backups.replaceFromPreview(token, true),
  };
}

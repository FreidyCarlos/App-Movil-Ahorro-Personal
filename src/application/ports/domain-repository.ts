import type {
  BackupMetadata,
  SavingsGoal,
  SavingsMovement,
} from "../../domain/models.js";
import type { DomainSnapshotV1 } from "../../domain/serialization/snapshot.js";

export interface SnapshotHeader {
  readonly appVersion: string;
  readonly rulesVersion: string;
  readonly exportedAt: string;
}

export interface SnapshotReplaceOptions {
  readonly additionalBackupMetadata?: readonly BackupMetadata[];
}

export type DomainStateUpdater = (
  current: DomainSnapshotV1,
) => unknown;

export interface DomainRepository {
  hasDomainState(): Promise<boolean>;
  loadSnapshot(header: SnapshotHeader): Promise<DomainSnapshotV1>;
  replaceSnapshot(
    candidate: unknown,
    options?: SnapshotReplaceOptions,
  ): Promise<DomainSnapshotV1>;
  updateSnapshot(
    header: SnapshotHeader,
    updater: DomainStateUpdater,
  ): Promise<DomainSnapshotV1>;
  appendBackupMetadata(candidate: unknown): Promise<BackupMetadata>;
  getGoal(id: string): Promise<SavingsGoal | undefined>;
  listGoals(includeDeleted?: boolean): Promise<readonly SavingsGoal[]>;
  listMovements(goalId: string): Promise<readonly SavingsMovement[]>;
}

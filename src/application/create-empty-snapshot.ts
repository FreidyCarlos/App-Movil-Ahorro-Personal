import {
  COP_ROUNDING_POLICY_VERSION,
  DEFAULT_NUMERIC_LIMITS,
  NUMERIC_POLICY_VERSION,
} from "../domain/decimal.js";
import {
  DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
  DOMAIN_SNAPSHOT_SCHEMA_VERSION,
  RATE_EQUIVALENCE_POLICY_VERSION,
  type DomainSnapshotV1,
} from "../domain/serialization/snapshot.js";

export interface EmptySnapshotOptions {
  readonly appVersion: string;
  readonly rulesVersion: string;
  readonly now: string;
  readonly settingsId: string;
}

export function createEmptyDomainSnapshot(
  options: EmptySnapshotOptions,
): DomainSnapshotV1 {
  return {
    schemaVersion: DOMAIN_SNAPSHOT_SCHEMA_VERSION,
    appVersion: options.appVersion,
    rulesVersion: options.rulesVersion,
    exportedAt: options.now,
    policyMetadata: {
      numericPolicyVersion: NUMERIC_POLICY_VERSION,
      maximumAmountCop: DEFAULT_NUMERIC_LIMITS.maximumAmount,
      maximumRatePercent: DEFAULT_NUMERIC_LIMITS.maximumRatePercent,
      maximumCanonicalEffectiveAnnualRate:
        DEFAULT_NUMERIC_LIMITS.maximumCanonicalEffectiveAnnualRate,
      roundingPolicyVersion: COP_ROUNDING_POLICY_VERSION,
      rateEquivalencePolicyVersion: RATE_EQUIVALENCE_POLICY_VERSION,
      rateEquivalenceTolerance: DEFAULT_RATE_EQUIVALENCE_TOLERANCE,
    },
    goals: [],
    configurations: [],
    simpleConfigurations: [],
    rateDefinitions: [],
    ratePeriods: [],
    productConfigurations: [],
    movements: [],
    movementRevisions: [],
    closes: [],
    backupMetadata: [],
    settings: {
      id: options.settingsId,
      schemaVersion: DOMAIN_SNAPSHOT_SCHEMA_VERSION,
      theme: "SYSTEM",
      locale: "es-CO",
      currencyDisplay: "COP_SYMBOL",
      reduceMotion: false,
      createdAt: options.now,
      updatedAt: options.now,
    },
  };
}

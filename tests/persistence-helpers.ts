import type { DomainSnapshotV1 } from "../src/index.js";
import { DOMAIN_SNAPSHOT_SCHEMA_VERSION } from "../src/index.js";
import { NOW, id } from "./helpers.js";

export const PERSISTENCE_LIMITS = {
  maximumBytes: 10 * 1024 * 1024,
  maximumDepth: 20,
  maximumGoals: 100,
  maximumMovements: 10_000,
  maximumRatePeriods: 1_000,
} as const;

export function persistenceSnapshot(
  name = "Fondo de emergencia",
): DomainSnapshotV1 {
  const movement = {
    id: id(5),
    goalId: id(1),
    type: "CONTRIBUTION" as const,
    amount: "100000",
    effectiveDate: "2026-02-01",
    recordedAt: NOW,
    deduplicationKey: "manual-1",
    currentRevisionId: id(6),
    status: "ACTIVE" as const,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return {
    schemaVersion: DOMAIN_SNAPSHOT_SCHEMA_VERSION,
    appVersion: "0.1.0",
    rulesVersion: "financial-rules-1",
    exportedAt: NOW,
    policyMetadata: {
      numericPolicyVersion: "numeric-policy-cop-v1",
      maximumAmountCop: "10000000000",
      maximumRatePercent: "100",
      maximumCanonicalEffectiveAnnualRate: "1",
      roundingPolicyVersion: "cop-half-up-0-v1",
      rateEquivalencePolicyVersion: "rate-equivalence-tolerance-v1",
      rateEquivalenceTolerance: "0.000000000000000001",
    },
    goals: [
      {
        id: id(1),
        name,
        currency: "COP",
        status: "ACTIVE",
        sortOrder: 0,
        activeConfigurationId: id(2),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    configurations: [
      {
        id: id(2),
        goalId: id(1),
        revisionNumber: 1,
        projectionMode: "SIMPLE",
        effectiveFrom: "2026-01-01",
        simpleProjectionConfigurationId: id(3),
        createdAt: NOW,
        rulesVersion: "financial-rules-1",
        isActive: true,
      },
    ],
    simpleConfigurations: [
      {
        id: id(3),
        configurationId: id(2),
        periodicAmount: "200000",
        periodicity: "MONTHLY",
        numberOfPeriods: 18,
        calculationMethod: "SIMPLE_UNIFORM_SUM_V1",
      },
    ],
    rateDefinitions: [],
    ratePeriods: [],
    productConfigurations: [],
    movements: [movement],
    movementRevisions: [
      {
        id: id(6),
        movementId: movement.id,
        revisionNumber: 1,
        snapshot: { ...movement },
        reason: "Registro inicial",
        createdAt: NOW,
      },
    ],
    closes: [],
    backupMetadata: [],
    settings: {
      id: id(4),
      schemaVersion: 1,
      theme: "SYSTEM",
      locale: "es-CO",
      currencyDisplay: "COP_SYMBOL",
      reduceMotion: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  };
}

import {
  DomainError,
  validateDomainSnapshot,
  type DomainSnapshotV1,
} from "../src/index.js";
import {
  NOW,
  flexibleProduct,
  id,
  normalizedRate,
  ratePeriod,
} from "./helpers.js";
import {
  PERSISTENCE_LIMITS,
  persistenceSnapshot,
} from "./persistence-helpers.js";

function expectInvalid(snapshot: DomainSnapshotV1): void {
  expect(() =>
    validateDomainSnapshot(snapshot, PERSISTENCE_LIMITS),
  ).toThrowError(expect.objectContaining<Partial<DomainError>>({
    code: "SERIALIZATION_ERROR",
  }));
}

function advancedSnapshot(): DomainSnapshotV1 {
  const source = persistenceSnapshot();
  const rate = normalizedRate();
  const product = flexibleProduct();
  return {
    ...source,
    configurations: [
      {
        ...source.configurations[0]!,
        projectionMode: "ADVANCED",
        initialBalance: "0",
        contributionTiming: "END_OF_DAY",
        productConfigurationId: id(200),
      },
    ],
    rateDefinitions: [
      JSON.parse(JSON.stringify(rate)) as DomainSnapshotV1["rateDefinitions"][number],
    ],
    ratePeriods: [ratePeriod()],
    productConfigurations: [
      JSON.parse(
        JSON.stringify(product),
      ) as DomainSnapshotV1["productConfigurations"][number],
    ],
  };
}

describe("relaciones completas del snapshot", () => {
  it("rechaza revisión vigente inexistente y deduplicación repetida", () => {
    const source = persistenceSnapshot();
    expectInvalid({
      ...source,
      movements: [
        {
          ...source.movements[0]!,
          currentRevisionId: id(999),
        },
      ],
    });

    const secondMovement = {
      ...source.movements[0]!,
      id: id(7),
      currentRevisionId: id(8),
    };
    expectInvalid({
      ...source,
      movements: [...source.movements, secondMovement],
      movementRevisions: [
        ...source.movementRevisions,
        {
          id: id(8),
          movementId: id(7),
          revisionNumber: 1,
          snapshot: { ...secondMovement },
          reason: "Registro inicial",
          createdAt: NOW,
        },
      ],
    });
  });

  it("rechaza cadenas de revisión y versión de preferencias incoherentes", () => {
    const source = persistenceSnapshot();
    expectInvalid({
      ...source,
      configurations: [
        {
          ...source.configurations[0]!,
          revisionNumber: 2,
          supersedesId: id(999),
        },
      ],
    });
    expectInvalid({
      ...source,
      settings: {
        ...source.settings,
        schemaVersion: 2,
      },
    });
  });

  it("exige que producto, tasa, configuración y meta correspondan", () => {
    const valid = advancedSnapshot();
    expect(() =>
      validateDomainSnapshot(valid, PERSISTENCE_LIMITS),
    ).not.toThrow();
    expectInvalid({
      ...valid,
      ratePeriods: [
        {
          ...valid.ratePeriods[0]!,
          goalId: id(999),
        },
      ],
    });
    expectInvalid({
      ...valid,
      productConfigurations: [
        {
          ...valid.productConfigurations[0]!,
          configurationId: id(999),
        },
      ],
    });
  });

  it("rechaza un metadato que apunta a un respaldo inexistente", () => {
    const source = persistenceSnapshot();
    expectInvalid({
      ...source,
      backupMetadata: [
        {
          id: id(10),
          operation: "IMPORT_REPLACE",
          schemaVersion: 1,
          appVersion: "0.1.0",
          rulesVersion: "financial-rules-1",
          createdAt: NOW,
          importedAt: NOW,
          fileSizeBytes: 100,
          checksumAlgorithm: "SHA-256",
          checksum: "a".repeat(64),
          goalCount: 1,
          movementCount: 1,
          sourceFileName: "backup.json",
          result: "SUCCESS",
          rollbackBackupId: id(11),
        },
      ],
    });
  });
});

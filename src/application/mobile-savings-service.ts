import type { DomainRepository, SnapshotHeader } from "./ports/domain-repository.js";
import {
  calculateSimpleProjection,
  toSimpleProjectionConfiguration,
} from "../domain/calculations/simple-projection.js";
import type {
  SavingsGoal,
  SavingsPlanConfiguration,
  SimplePeriodicity,
} from "../domain/models.js";
import type { DomainSnapshotV1 } from "../domain/serialization/snapshot.js";

export interface MobileClock {
  now(): string;
  today(): string;
}

export interface MobileIdGenerator {
  nextId(): string;
}

export interface MobileSavingsServiceOptions {
  readonly appVersion: string;
  readonly rulesVersion: string;
}

export interface CreateSimpleGoalInput {
  readonly name: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: string;
}

export interface SimpleGoalView {
  readonly id: string;
  readonly name: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: string;
  readonly projectedEndDate?: string;
  readonly projectedTotal: string;
  readonly projectedYield: "0";
}

export class MobileSavingsService {
  readonly #repository: DomainRepository;
  readonly #clock: MobileClock;
  readonly #ids: MobileIdGenerator;
  readonly #options: MobileSavingsServiceOptions;

  public constructor(
    repository: DomainRepository,
    clock: MobileClock,
    ids: MobileIdGenerator,
    options: MobileSavingsServiceOptions,
  ) {
    this.#repository = repository;
    this.#clock = clock;
    this.#ids = ids;
    this.#options = options;
  }

  #header(): SnapshotHeader {
    return {
      appVersion: this.#options.appVersion,
      rulesVersion: this.#options.rulesVersion,
      exportedAt: this.#clock.now(),
    };
  }

  public async listSimpleGoals(): Promise<readonly SimpleGoalView[]> {
    const snapshot = await this.#repository.loadSnapshot(this.#header());
    return this.#viewsFrom(snapshot);
  }

  #viewsFrom(snapshot: DomainSnapshotV1): readonly SimpleGoalView[] {
    const configurations = new Map(
      snapshot.configurations.map((configuration) => [
        configuration.id,
        configuration,
      ]),
    );
    const simpleConfigurations = new Map(
      snapshot.simpleConfigurations.map((configuration) => [
        configuration.id,
        configuration,
      ]),
    );

    return snapshot.goals
      .filter((goal) => goal.deletedAt === undefined)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .flatMap((goal) => {
        const configuration = configurations.get(goal.activeConfigurationId);
        if (
          configuration?.projectionMode !== "SIMPLE" ||
          configuration.simpleProjectionConfigurationId === undefined
        ) {
          return [];
        }
        const simple = simpleConfigurations.get(
          configuration.simpleProjectionConfigurationId,
        );
        if (simple === undefined) {
          return [];
        }
        const result = calculateSimpleProjection({
          periodicAmount: simple.periodicAmount,
          periodicity: simple.periodicity,
          numberOfPeriods: simple.numberOfPeriods,
          ...(simple.startDate === undefined
            ? {}
            : { startDate: simple.startDate }),
        });
        return [
          {
            id: goal.id,
            name: goal.name,
            periodicAmount: result.periodicAmount,
            periodicity: result.periodicity,
            numberOfPeriods: result.numberOfPeriods,
            ...(result.startDate === undefined
              ? {}
              : { startDate: result.startDate }),
            ...(result.projectedEndDate === undefined
              ? {}
              : { projectedEndDate: result.projectedEndDate }),
            projectedTotal: result.projectedTotal,
            projectedYield: result.projectedYield,
          },
        ];
      });
  }

  public async createSimpleGoal(
    input: CreateSimpleGoalInput,
  ): Promise<SimpleGoalView> {
    const name = input.name.trim();
    const calculation = calculateSimpleProjection(input);
    const now = this.#clock.now();
    const goalId = this.#ids.nextId();
    const configurationId = this.#ids.nextId();
    const simpleConfigurationId = this.#ids.nextId();

    const updated = await this.#repository.updateSnapshot(
      this.#header(),
      (current) => {
        const goal: SavingsGoal = {
          id: goalId,
          name,
          currency: "COP",
          status: "ACTIVE",
          sortOrder:
            current.goals.reduce(
              (maximum, candidate) => Math.max(maximum, candidate.sortOrder),
              -1,
            ) + 1,
          activeConfigurationId: configurationId,
          createdAt: now,
          updatedAt: now,
          ...(calculation.startDate === undefined
            ? {}
            : { startDate: calculation.startDate }),
        };
        const configuration: SavingsPlanConfiguration = {
          id: configurationId,
          goalId,
          revisionNumber: 1,
          projectionMode: "SIMPLE",
          effectiveFrom: calculation.startDate ?? this.#clock.today(),
          simpleProjectionConfigurationId: simpleConfigurationId,
          createdAt: now,
          rulesVersion: this.#options.rulesVersion,
          isActive: true,
        };
        return {
          ...current,
          appVersion: this.#options.appVersion,
          rulesVersion: this.#options.rulesVersion,
          exportedAt: now,
          goals: [...current.goals, goal],
          configurations: [...current.configurations, configuration],
          simpleConfigurations: [
            ...current.simpleConfigurations,
            toSimpleProjectionConfiguration(calculation, {
              id: simpleConfigurationId,
              configurationId,
            }),
          ],
        };
      },
    );

    const created = this.#viewsFrom(updated).find((goal) => goal.id === goalId);
    if (created === undefined) {
      throw new Error("La meta guardada no pudo reconstruirse.");
    }
    return created;
  }
}

import type { DomainRepository, SnapshotHeader } from "./ports/domain-repository.js";
import {
  calculateAdvancedProjection,
  type ProjectedEvent,
} from "../domain/calculations/advanced-projection.js";
import { calculateActualLedger, createActualPeriodClose } from "../domain/calculations/actual-ledger.js";
import { compareProjectionWithActual } from "../domain/calculations/comparison.js";
import {
  FINANCIAL_RULES_VERSION,
  normalizeInterestRate,
} from "../domain/calculations/rates.js";
import {
  calculateSimpleProjection,
  toSimpleProjectionConfiguration,
} from "../domain/calculations/simple-projection.js";
import { calculateUpdatedProjectionFromClose } from "../domain/calculations/updated-projection.js";
import { addCalendarMonths, addCalendarYears, addCivilDays } from "../domain/date.js";
import { nonCryptographicDigest } from "../domain/canonical.js";
import { canonicalDecimal } from "../domain/decimal.js";
import type {
  ActualPeriodClose,
  ComparisonResult,
  ContributionFrequency,
  FinancialProductConfiguration,
  GoalStatus,
  InterestRateDefinition,
  MovementRevision,
  MovementType,
  ProjectionResult,
  SavingsMovement,
  SavingsGoal,
  SavingsPlanConfiguration,
  SimplePeriodicity,
  YieldRatePeriod,
} from "../domain/models.js";
import type { DomainSnapshotV1 } from "../domain/serialization/snapshot.js";
import type { ValidAdvancedGoalInput } from "./advanced-goal-form.js";

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

export interface GoalSummaryView {
  readonly id: string;
  readonly name: string;
  readonly projectionMode: "SIMPLE" | "ADVANCED";
  readonly status: GoalStatus;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods?: number;
  readonly startDate?: string;
  readonly projectedEndDate?: string;
  readonly projectedTotal: string;
  readonly projectedContributions: string;
  readonly projectedYield: string;
  readonly actualBalance: string;
  readonly targetAmount?: string;
  readonly projectionBlocked: boolean;
}

export interface MovementView {
  readonly id: string;
  readonly type: MovementType;
  readonly amount: string;
  readonly effectiveDate: string;
  readonly note?: string;
  readonly status: "ACTIVE" | "VOIDED";
}

export interface GoalDetailView extends GoalSummaryView {
  readonly configurationRevisionNumber: number;
  readonly configurationEffectiveFrom: string;
  readonly initialBalance: string;
  readonly actualContributions: string;
  readonly actualExtraContributions: string;
  readonly actualWithdrawals: string;
  readonly actualYield: string;
  readonly adjustments: string;
  readonly movements: readonly MovementView[];
  readonly originalProjection?: ProjectionResult;
  readonly updatedProjection?: ProjectionResult;
  readonly comparison?: ComparisonResult;
  readonly latestClose?: ActualPeriodClose;
}

export interface RegisterMovementInput {
  readonly goalId: string;
  readonly type: MovementType;
  readonly amount: string;
  readonly effectiveDate: string;
  readonly note?: string;
}

export interface ReviseAdvancedGoalInput extends ValidAdvancedGoalInput {
  readonly goalId: string;
  readonly effectiveFrom: string;
  readonly reason: string;
}

export interface ReviseAdvancedContributionInput {
  readonly goalId: string;
  readonly periodicAmount: string;
  readonly effectiveFrom: string;
  readonly reason: string;
}

export interface ConvertAdvancedGoalToSimpleInput {
  readonly goalId: string;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate: string;
}

function advanceContributionBoundary(
  value: string,
  frequency: ContributionFrequency,
): string {
  switch (frequency) {
    case "WEEKLY":
      return addCivilDays(value, 7);
    case "BIWEEKLY":
      return addCivilDays(value, 14);
    case "MONTHLY":
      return addCalendarMonths(value, 1);
    case "YEARLY":
      return addCalendarYears(value, 1);
  }
}

function plannedEvents(
  configuration: SavingsPlanConfiguration,
  startDate: string,
  endDate: string,
): readonly ProjectedEvent[] {
  if (
    configuration.contributionFrequency === undefined ||
    configuration.periodicContributionAmount === undefined
  ) {
    return [];
  }
  const events: ProjectedEvent[] = [];
  let boundary = advanceContributionBoundary(
    startDate,
    configuration.contributionFrequency,
  );
  let sequence = 0;
  while (boundary <= endDate && sequence < 5200) {
    events.push({
      id: `planned-${configuration.id}-${sequence}`,
      date:
        configuration.contributionTiming === "END_OF_DAY"
          ? addCivilDays(boundary, -1)
          : boundary,
      type: "CONTRIBUTION",
      amount: configuration.periodicContributionAmount,
      sequence,
    });
    boundary = advanceContributionBoundary(
      boundary,
      configuration.contributionFrequency,
    );
    sequence += 1;
  }
  return events;
}

function rateShape(input: ValidAdvancedGoalInput): {
  readonly originalType: InterestRateDefinition["originalType"];
  readonly originalPeriodicity: InterestRateDefinition["originalPeriodicity"];
  readonly capitalizationPeriodsPerYear?: number;
} {
  if (input.yieldChoice === "ZERO") {
    return {
      originalType: "ZERO",
      originalPeriodicity: "NOT_APPLICABLE",
    };
  }
  if (input.yieldChoice === "EA") {
    return { originalType: "EA", originalPeriodicity: "ANNUAL" };
  }
  switch (input.otherRateType) {
    case "EM":
      return { originalType: "EM", originalPeriodicity: "MONTHLY" };
    case "ET":
      return { originalType: "ET", originalPeriodicity: "QUARTERLY" };
    case "ES":
      return { originalType: "ES", originalPeriodicity: "SEMIANNUAL" };
    case "NMV":
      return {
        originalType: "NMV",
        originalPeriodicity: "MONTHLY",
        capitalizationPeriodsPerYear: 12,
      };
    case "NTV":
      return {
        originalType: "NTV",
        originalPeriodicity: "QUARTERLY",
        capitalizationPeriodsPerYear: 4,
      };
    case "NOMINAL_ANNUAL_DUE":
      return {
        originalType: "NOMINAL_ANNUAL_DUE",
        originalPeriodicity: "CUSTOM",
        ...(input.capitalizationPeriodsPerYear === undefined
          ? {}
          : {
              capitalizationPeriodsPerYear:
                input.capitalizationPeriodsPerYear,
            }),
      };
    case undefined:
      throw new Error("La tasa avanzada está incompleta.");
  }
  throw new Error("La tasa avanzada no está soportada.");
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

  #productFor(
    snapshot: DomainSnapshotV1,
    configuration: SavingsPlanConfiguration,
  ): FinancialProductConfiguration {
    const product = snapshot.productConfigurations.find(
      (candidate) => candidate.id === configuration.productConfigurationId,
    );
    if (product === undefined) {
      throw new Error("La configuración avanzada no tiene un producto válido.");
    }
    return product as FinancialProductConfiguration;
  }

  #originalAdvancedConfiguration(
    snapshot: DomainSnapshotV1,
    goalId: string,
  ): SavingsPlanConfiguration | undefined {
    return snapshot.configurations
      .filter(
        (candidate) =>
          candidate.goalId === goalId && candidate.projectionMode === "ADVANCED",
      )
      .sort((left, right) => left.revisionNumber - right.revisionNumber)[0] as
      | SavingsPlanConfiguration
      | undefined;
  }

  #advancedProjection(
    snapshot: DomainSnapshotV1,
    goal: SavingsGoal,
    configuration: SavingsPlanConfiguration,
    options: {
      readonly kind: "ORIGINAL" | "UPDATED";
      readonly startDate?: string;
      readonly initialBalance?: string;
      readonly endDate?: string;
    },
  ): ProjectionResult {
    const startDate = options.startDate ?? goal.startDate;
    const endDate = options.endDate ?? configuration.targetDate ?? goal.targetDate;
    if (startDate === undefined || endDate === undefined) {
      throw new Error("La proyección avanzada requiere fechas de inicio y final.");
    }
    const purpose =
      options.kind === "ORIGINAL"
        ? "ORIGINAL_PROJECTION"
        : "UPDATED_PROJECTION";
    const periods = snapshot.ratePeriods.filter(
      (period) =>
        period.configurationId === configuration.id &&
        period.purpose === purpose,
    ) as YieldRatePeriod[];
    const definitions = new Map(
      snapshot.rateDefinitions.map((definition) => [
        definition.id,
        definition as InterestRateDefinition,
      ]),
    ) as ReadonlyMap<string, InterestRateDefinition>;
    const product = this.#productFor(snapshot, configuration);
    const input = {
      id: this.#ids.nextId(),
      goalId: goal.id,
      configurationRevisionId: configuration.id,
      endDate,
      ...((configuration.targetAmount ?? goal.targetAmount) === undefined
        ? {}
        : { targetAmount: configuration.targetAmount ?? goal.targetAmount }),
      ...(configuration.contributionTiming === undefined
        ? {}
        : { contributionTiming: configuration.contributionTiming }),
      product,
      ratePeriods: periods,
      rateDefinitions: definitions,
      events: plannedEvents(configuration, startDate, endDate),
      calculatedAt: this.#clock.now(),
      rulesVersion: this.#options.rulesVersion,
    } as const;
    if (options.kind === "UPDATED") {
      const close = snapshot.closes
        .filter(
          (candidate) =>
            candidate.goalId === goal.id &&
            candidate.status === "VALID" &&
            candidate.periodEnd === startDate,
        )
        .sort((left, right) => right.closedAt.localeCompare(left.closedAt))[0] as
        | ActualPeriodClose
        | undefined;
      if (close === undefined) {
        throw new Error("No existe un cierre válido para actualizar la proyección.");
      }
      return calculateUpdatedProjectionFromClose(close, input);
    }
    return calculateAdvancedProjection({
      ...input,
      projectionKind: "ORIGINAL",
      startDate,
      initialBalance: options.initialBalance ?? configuration.initialBalance ?? "0",
    });
  }

  #advancedNumberOfPeriods(
    configuration: SavingsPlanConfiguration,
    startDate: string,
    endDate: string,
  ): number | undefined {
    if (
      configuration.contributionFrequency !== "MONTHLY" &&
      configuration.contributionFrequency !== "YEARLY"
    ) {
      return undefined;
    }
    let boundary = startDate;
    let count = 0;
    while (boundary < endDate && count <= 1200) {
      boundary = advanceContributionBoundary(
        boundary,
        configuration.contributionFrequency,
      );
      count += 1;
    }
    return boundary === endDate ? count : undefined;
  }

  #summaryFrom(
    snapshot: DomainSnapshotV1,
    goal: SavingsGoal,
  ): GoalSummaryView {
    const configuration = snapshot.configurations.find(
      (candidate) => candidate.id === goal.activeConfigurationId,
    ) as SavingsPlanConfiguration | undefined;
    if (configuration === undefined) {
      throw new Error("La meta no tiene una configuración activa.");
    }
    if (configuration.projectionMode === "SIMPLE") {
      const simple = this.#viewsFrom(snapshot).find(
        (candidate) => candidate.id === goal.id,
      );
      if (simple === undefined) {
        throw new Error("La meta simple no pudo reconstruirse.");
      }
      return {
        ...simple,
        projectionMode: "SIMPLE",
        status: goal.status,
        actualBalance: "0",
        projectedContributions: simple.projectedTotal,
        projectionBlocked: false,
        ...(goal.targetAmount === undefined
          ? {}
          : { targetAmount: goal.targetAmount }),
      };
    }

    const movements = snapshot.movements.filter(
      (movement) => movement.goalId === goal.id,
    ) as SavingsMovement[];
    const originalConfiguration =
      this.#originalAdvancedConfiguration(snapshot, goal.id) ?? configuration;
    const product = this.#productFor(snapshot, originalConfiguration);
    const ledger = calculateActualLedger(
      originalConfiguration.initialBalance ?? goal.initialBalance ?? "0",
      movements,
      { product },
    );
    const startDate = goal.startDate ?? configuration.effectiveFrom;
    const endDate = configuration.targetDate ?? goal.targetDate;
    if (endDate === undefined) {
      throw new Error("La meta avanzada no tiene fecha final.");
    }
    try {
      const latestClose = snapshot.closes
        .filter(
          (close) => close.goalId === goal.id && close.status === "VALID",
        )
        .sort((left, right) => right.periodEnd.localeCompare(left.periodEnd))[0] as
        | ActualPeriodClose
        | undefined;
      const projection =
        configuration.revisionNumber > originalConfiguration.revisionNumber &&
        latestClose !== undefined
          ? this.#advancedProjection(snapshot, goal, configuration, {
              kind: "UPDATED",
              startDate: latestClose.periodEnd,
              initialBalance: latestClose.closingBalance,
            })
          : this.#advancedProjection(snapshot, goal, originalConfiguration, {
              kind: "ORIGINAL",
            });
      const numberOfPeriods = this.#advancedNumberOfPeriods(
        configuration,
        startDate,
        endDate,
      );
      return {
        id: goal.id,
        name: goal.name,
        projectionMode: "ADVANCED",
        status: goal.status,
        periodicAmount: configuration.periodicContributionAmount ?? "0",
        periodicity:
          configuration.contributionFrequency === "YEARLY"
            ? "YEARLY"
            : "MONTHLY",
        ...(numberOfPeriods === undefined ? {} : { numberOfPeriods }),
        startDate,
        projectedEndDate: endDate,
        projectedTotal: projection.finalBalance,
        projectedContributions: projection.projectedContributions,
        projectedYield: projection.projectedYield,
        actualBalance: ledger.closingBalance,
        ...(goal.targetAmount === undefined
          ? {}
          : { targetAmount: goal.targetAmount }),
        projectionBlocked: false,
      };
    } catch {
      return {
        id: goal.id,
        name: goal.name,
        projectionMode: "ADVANCED",
        status: goal.status,
        periodicAmount: configuration.periodicContributionAmount ?? "0",
        periodicity:
          configuration.contributionFrequency === "YEARLY"
            ? "YEARLY"
            : "MONTHLY",
        startDate,
        projectedEndDate: endDate,
        projectedTotal: "0",
        projectedContributions: "0",
        projectedYield: "0",
        actualBalance: ledger.closingBalance,
        ...(goal.targetAmount === undefined
          ? {}
          : { targetAmount: goal.targetAmount }),
        projectionBlocked: true,
      };
    }
  }

  public async listGoals(): Promise<readonly GoalSummaryView[]> {
    const snapshot = await this.#repository.loadSnapshot(this.#header());
    return snapshot.goals
      .filter((goal) => goal.deletedAt === undefined)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((goal) => this.#summaryFrom(snapshot, goal as SavingsGoal));
  }

  public async getGoal(goalId: string): Promise<GoalDetailView> {
    const snapshot = await this.#repository.loadSnapshot(this.#header());
    const goal = snapshot.goals.find((candidate) => candidate.id === goalId) as
      | SavingsGoal
      | undefined;
    if (goal === undefined || goal.deletedAt !== undefined) {
      throw new Error("La meta solicitada no existe.");
    }
    const configuration = snapshot.configurations.find(
      (candidate) => candidate.id === goal.activeConfigurationId,
    ) as SavingsPlanConfiguration | undefined;
    if (configuration === undefined) {
      throw new Error("La meta no tiene configuración activa.");
    }
    const movements = snapshot.movements
      .filter((movement) => movement.goalId === goal.id)
      .sort(
        (left, right) =>
          right.effectiveDate.localeCompare(left.effectiveDate) ||
          right.recordedAt.localeCompare(left.recordedAt),
      ) as SavingsMovement[];
    const product =
      configuration.projectionMode === "ADVANCED"
        ? this.#productFor(snapshot, configuration)
        : undefined;
    const originalConfiguration =
      configuration.projectionMode === "ADVANCED"
        ? this.#originalAdvancedConfiguration(snapshot, goal.id) ?? configuration
        : configuration;
    const ledgerProduct =
      originalConfiguration.projectionMode === "ADVANCED"
        ? this.#productFor(snapshot, originalConfiguration)
        : product;
    const ledger = calculateActualLedger(
      originalConfiguration.initialBalance ?? goal.initialBalance ?? "0",
      movements,
      ledgerProduct === undefined ? {} : { product: ledgerProduct },
    );
    const summary = this.#summaryFrom(snapshot, goal);
    let originalProjection: ProjectionResult | undefined;
    let updatedProjection: ProjectionResult | undefined;
    let comparison: ComparisonResult | undefined;
    const latestClose = snapshot.closes
      .filter(
        (close) => close.goalId === goal.id && close.status === "VALID",
      )
      .sort((left, right) => right.periodEnd.localeCompare(left.periodEnd))[0] as
      | ActualPeriodClose
      | undefined;

    if (configuration.projectionMode === "ADVANCED") {
      try {
        originalProjection = this.#advancedProjection(
          snapshot,
          goal,
          originalConfiguration,
          { kind: "ORIGINAL" },
        );
        if (
          latestClose !== undefined &&
          latestClose.periodEnd < originalProjection.projectedEndDate
        ) {
          updatedProjection = this.#advancedProjection(
            snapshot,
            goal,
            configuration,
            {
              kind: "UPDATED",
              startDate: latestClose.periodEnd,
              initialBalance: latestClose.closingBalance,
            },
          );
        }
        if (latestClose !== undefined) {
          const comparisonProjection = this.#advancedProjection(
            snapshot,
            goal,
            originalConfiguration,
            { kind: "ORIGINAL", endDate: latestClose.periodEnd },
          );
          const actualAtClose = calculateActualLedger(
            originalConfiguration.initialBalance ?? goal.initialBalance ?? "0",
            movements,
            {
              ...(ledgerProduct === undefined ? {} : { product: ledgerProduct }),
              endDateExclusive: latestClose.periodEnd,
            },
          );
          comparison = compareProjectionWithActual({
            id: this.#ids.nextId(),
            goalId: goal.id,
            projection: comparisonProjection,
            actual: actualAtClose,
            actualClose: latestClose,
            cutoffDate: latestClose.periodEnd,
            ...(goal.targetAmount === undefined
              ? {}
              : { targetAmount: goal.targetAmount }),
            onTrackTolerance: "0",
            calculatedAt: this.#clock.now(),
            rulesVersion: this.#options.rulesVersion,
          });
        }
      } catch {
        // El resumen conserva el estado bloqueado y evita presentar cifras parciales.
      }
    }

    return {
      ...summary,
      configurationRevisionNumber: configuration.revisionNumber,
      configurationEffectiveFrom: configuration.effectiveFrom,
      initialBalance:
        originalConfiguration.initialBalance ?? goal.initialBalance ?? "0",
      actualContributions: ledger.contributions,
      actualExtraContributions: ledger.extraContributions,
      actualWithdrawals: ledger.withdrawals,
      actualYield: ledger.actualYield,
      adjustments: ledger.adjustments,
      movements: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: movement.amount,
        effectiveDate: movement.effectiveDate,
        ...(movement.note === undefined ? {} : { note: movement.note }),
        status: movement.status,
      })),
      ...(originalProjection === undefined ? {} : { originalProjection }),
      ...(updatedProjection === undefined ? {} : { updatedProjection }),
      ...(comparison === undefined ? {} : { comparison }),
      ...(latestClose === undefined ? {} : { latestClose }),
    };
  }

  #advancedBundle(
    input: ValidAdvancedGoalInput,
    identity: {
      readonly goalId: string;
      readonly configurationId: string;
      readonly productId: string;
      readonly rateId: string;
      readonly originalRatePeriodId: string;
      readonly updatedRatePeriodId: string;
      readonly revisionNumber: number;
      readonly now: string;
      readonly supersedesConfigurationId?: string;
      readonly supersedesProductId?: string;
      readonly changeReason?: string;
      readonly effectiveFrom?: string;
    },
  ): {
    readonly startDate: string;
    readonly targetDate: string;
    readonly configuration: SavingsPlanConfiguration;
    readonly product: FinancialProductConfiguration;
    readonly rate: InterestRateDefinition;
    readonly periods: readonly YieldRatePeriod[];
  } {
    const startDate = input.startDate ?? this.#clock.today();
    const calculation = calculateSimpleProjection({
      periodicAmount: input.periodicAmount,
      periodicity: input.periodicity,
      numberOfPeriods: input.numberOfPeriods,
      startDate,
    });
    if (calculation.projectedEndDate === undefined) {
      throw new Error("No se pudo determinar la fecha final de la meta.");
    }
    const targetDate = calculation.projectedEndDate;
    const shape = rateShape(input);
    const originalValue =
      input.yieldChoice === "ZERO" ? "0" : input.rateValue;
    if (originalValue === undefined) {
      throw new Error("La tasa avanzada requiere un valor original.");
    }
    const rate = normalizeInterestRate({
      id: identity.rateId,
      originalValue,
      originalType: shape.originalType,
      originalPeriodicity: shape.originalPeriodicity,
      ...(shape.capitalizationPeriodsPerYear === undefined
        ? {}
        : {
            capitalizationPeriodsPerYear:
              shape.capitalizationPeriodsPerYear,
          }),
      timing: input.yieldChoice === "ZERO" ? "NOT_APPLICABLE" : "DUE",
      variability: "FIXED",
      effectiveFrom: identity.effectiveFrom ?? startDate,
      createdAt: identity.now,
      rulesVersion: this.#options.rulesVersion,
    });
    const product: FinancialProductConfiguration = {
      id: identity.productId,
      configurationId: identity.configurationId,
      productModel:
        input.yieldChoice === "ZERO" ? "NO_YIELD" : "FLEXIBLE_REMUNERATED",
      liquidity: "IMMEDIATE",
      additionalContributionsAllowed: true,
      withdrawalsAllowed: true,
      capitalizationFrequency: "DAILY",
      creditingFrequency: "DAILY",
      yieldPaymentDestination: "CAPITALIZED",
      dayCountConvention: "ACT_365",
      renewalRule: "NONE",
      earlyWithdrawalRule: "ALLOWED",
      unsupportedConditions: [],
      createdAt: identity.now,
      ...(identity.supersedesProductId === undefined
        ? {}
        : { supersedesId: identity.supersedesProductId }),
    };
    const configuration: SavingsPlanConfiguration = {
      id: identity.configurationId,
      goalId: identity.goalId,
      revisionNumber: identity.revisionNumber,
      projectionMode: "ADVANCED",
      effectiveFrom: identity.effectiveFrom ?? startDate,
      ...(input.targetAmount === undefined
        ? {}
        : { targetAmount: input.targetAmount }),
      targetDate,
      initialBalance: input.initialBalance,
      contributionFrequency:
        input.periodicity === "MONTHLY" ? "MONTHLY" : "YEARLY",
      periodicContributionAmount: input.periodicAmount,
      contributionTiming: "END_OF_DAY",
      productConfigurationId: identity.productId,
      ...(identity.changeReason === undefined
        ? {}
        : { changeReason: identity.changeReason }),
      createdAt: identity.now,
      ...(identity.supersedesConfigurationId === undefined
        ? {}
        : { supersedesId: identity.supersedesConfigurationId }),
      rulesVersion: this.#options.rulesVersion,
      isActive: true,
    };
    const commonPeriod = {
      goalId: identity.goalId,
      configurationId: identity.configurationId,
      rateDefinitionId: identity.rateId,
      startDate: identity.effectiveFrom ?? startDate,
      createdAt: identity.now,
    } as const;
    const periods: readonly YieldRatePeriod[] = [
      {
        id: identity.originalRatePeriodId,
        ...commonPeriod,
        purpose: "ORIGINAL_PROJECTION",
      },
      {
        id: identity.updatedRatePeriodId,
        ...commonPeriod,
        purpose: "UPDATED_PROJECTION",
      },
    ];

    calculateAdvancedProjection({
      id: this.#ids.nextId(),
      goalId: identity.goalId,
      configurationRevisionId: identity.configurationId,
      projectionKind: "ORIGINAL",
      startDate,
      endDate: targetDate,
      initialBalance: input.initialBalance,
      ...(input.targetAmount === undefined
        ? {}
        : { targetAmount: input.targetAmount }),
      contributionTiming: "END_OF_DAY",
      product,
      ratePeriods: periods.filter(
        (period) => period.purpose === "ORIGINAL_PROJECTION",
      ),
      rateDefinitions: new Map([[rate.id, rate]]),
      events: plannedEvents(configuration, startDate, targetDate),
      calculatedAt: identity.now,
      rulesVersion: this.#options.rulesVersion,
    });

    return { startDate, targetDate, configuration, product, rate, periods };
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

  public async createAdvancedGoal(
    input: ValidAdvancedGoalInput,
  ): Promise<GoalDetailView> {
    const now = this.#clock.now();
    const goalId = this.#ids.nextId();
    const configurationId = this.#ids.nextId();
    const productId = this.#ids.nextId();
    const rateId = this.#ids.nextId();
    const originalRatePeriodId = this.#ids.nextId();
    const updatedRatePeriodId = this.#ids.nextId();
    const bundle = this.#advancedBundle(input, {
      goalId,
      configurationId,
      productId,
      rateId,
      originalRatePeriodId,
      updatedRatePeriodId,
      revisionNumber: 1,
      now,
    });

    await this.#repository.updateSnapshot(this.#header(), (current) => {
      const goal: SavingsGoal = {
        id: goalId,
        name: input.name.trim(),
        currency: "COP",
        ...(input.targetAmount === undefined
          ? {}
          : { targetAmount: input.targetAmount }),
        startDate: bundle.startDate,
        targetDate: bundle.targetDate,
        initialBalance: input.initialBalance,
        status: "ACTIVE",
        sortOrder:
          current.goals.reduce(
            (maximum, candidate) => Math.max(maximum, candidate.sortOrder),
            -1,
          ) + 1,
        activeConfigurationId: configurationId,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...current,
        appVersion: this.#options.appVersion,
        rulesVersion: this.#options.rulesVersion,
        exportedAt: now,
        goals: [...current.goals, goal],
        configurations: [...current.configurations, bundle.configuration],
        rateDefinitions: [...current.rateDefinitions, bundle.rate],
        ratePeriods: [...current.ratePeriods, ...bundle.periods],
        productConfigurations: [
          ...current.productConfigurations,
          bundle.product,
        ],
      };
    });
    return this.getGoal(goalId);
  }

  public async reviseAdvancedContribution(
    input: ReviseAdvancedContributionInput,
  ): Promise<GoalDetailView> {
    const reason = input.reason.trim();
    if (reason.length === 0) {
      throw new Error("La revisión requiere un motivo.");
    }
    const periodicAmount = calculateSimpleProjection({
      periodicAmount: input.periodicAmount,
      periodicity: "MONTHLY",
      numberOfPeriods: 1,
    }).periodicAmount;
    const now = this.#clock.now();
    const configurationId = this.#ids.nextId();
    const productId = this.#ids.nextId();
    const rateId = this.#ids.nextId();
    const originalRatePeriodId = this.#ids.nextId();
    const updatedRatePeriodId = this.#ids.nextId();

    await this.#repository.updateSnapshot(this.#header(), (current) => {
      const goal = current.goals.find(
        (candidate) => candidate.id === input.goalId,
      ) as SavingsGoal | undefined;
      const previous = current.configurations.find(
        (candidate) => candidate.id === goal?.activeConfigurationId,
      ) as SavingsPlanConfiguration | undefined;
      if (goal === undefined || previous?.projectionMode !== "ADVANCED") {
        throw new Error("Solo una meta avanzada admite revisión de supuestos.");
      }
      const close = current.closes
        .filter(
          (candidate) =>
            candidate.goalId === goal.id &&
            candidate.status === "VALID" &&
            candidate.periodEnd === input.effectiveFrom,
        )
        .sort((left, right) => right.closedAt.localeCompare(left.closedAt))[0] as
        | ActualPeriodClose
        | undefined;
      if (close === undefined) {
        throw new Error(
          "La vigencia debe coincidir con un cierre real vigente.",
        );
      }
      const previousProduct = this.#productFor(current, previous);
      const previousRatePeriod = current.ratePeriods.find(
        (period) =>
          period.configurationId === previous.id &&
          period.purpose === "UPDATED_PROJECTION",
      );
      const previousRate = current.rateDefinitions.find(
        (rate) => rate.id === previousRatePeriod?.rateDefinitionId,
      ) as InterestRateDefinition | undefined;
      if (previousRate === undefined) {
        throw new Error("La tasa vigente no pudo reconstruirse.");
      }
      const product: FinancialProductConfiguration = {
        ...previousProduct,
        id: productId,
        configurationId,
        unsupportedConditions: [...previousProduct.unsupportedConditions],
        createdAt: now,
        supersedesId: previousProduct.id,
      };
      const rate: InterestRateDefinition = {
        ...previousRate,
        id: rateId,
        blockingReasons: [...previousRate.blockingReasons],
        effectiveFrom: input.effectiveFrom,
        createdAt: now,
      };
      const configuration: SavingsPlanConfiguration = {
        ...previous,
        id: configurationId,
        revisionNumber: previous.revisionNumber + 1,
        effectiveFrom: input.effectiveFrom,
        periodicContributionAmount: periodicAmount,
        productConfigurationId: productId,
        changeReason: reason,
        createdAt: now,
        supersedesId: previous.id,
        isActive: true,
      };
      const commonPeriod = {
        goalId: goal.id,
        configurationId,
        rateDefinitionId: rateId,
        startDate: input.effectiveFrom,
        createdAt: now,
      } as const;
      const periods: readonly YieldRatePeriod[] = [
        {
          id: originalRatePeriodId,
          ...commonPeriod,
          purpose: "ORIGINAL_PROJECTION",
        },
        {
          id: updatedRatePeriodId,
          ...commonPeriod,
          purpose: "UPDATED_PROJECTION",
        },
      ];
      const endDate = configuration.targetDate ?? goal.targetDate;
      if (endDate === undefined || input.effectiveFrom >= endDate) {
        throw new Error("La revisión debe entrar en vigor antes del final.");
      }
      calculateUpdatedProjectionFromClose(close, {
        id: this.#ids.nextId(),
        goalId: goal.id,
        configurationRevisionId: configuration.id,
        endDate,
        ...(configuration.targetAmount === undefined
          ? {}
          : { targetAmount: configuration.targetAmount }),
        contributionTiming: configuration.contributionTiming ?? "END_OF_DAY",
        product,
        ratePeriods: periods.filter(
          (period) => period.purpose === "UPDATED_PROJECTION",
        ),
        rateDefinitions: new Map([[rate.id, rate]]),
        events: plannedEvents(configuration, input.effectiveFrom, endDate),
        calculatedAt: now,
        rulesVersion: this.#options.rulesVersion,
      });
      return {
        ...current,
        appVersion: this.#options.appVersion,
        rulesVersion: this.#options.rulesVersion,
        exportedAt: now,
        goals: current.goals.map((candidate) =>
          candidate.id === goal.id
            ? {
                ...candidate,
                activeConfigurationId: configurationId,
                updatedAt: now,
              }
            : candidate,
        ),
        configurations: [
          ...current.configurations.map((candidate) =>
            candidate.id === previous.id
              ? { ...candidate, isActive: false }
              : candidate,
          ),
          configuration,
        ],
        productConfigurations: [...current.productConfigurations, product],
        rateDefinitions: [...current.rateDefinitions, rate],
        ratePeriods: [...current.ratePeriods, ...periods],
      };
    });
    return this.getGoal(input.goalId);
  }

  public async convertAdvancedGoalToSimple(
    input: ConvertAdvancedGoalToSimpleInput,
  ): Promise<GoalDetailView> {
    const calculation = calculateSimpleProjection(input);
    const now = this.#clock.now();
    const configurationId = this.#ids.nextId();
    const simpleConfigurationId = this.#ids.nextId();
    await this.#repository.updateSnapshot(this.#header(), (current) => {
      const goal = current.goals.find(
        (candidate) => candidate.id === input.goalId,
      ) as SavingsGoal | undefined;
      const previous = current.configurations.find(
        (candidate) => candidate.id === goal?.activeConfigurationId,
      ) as SavingsPlanConfiguration | undefined;
      if (goal === undefined || previous?.projectionMode !== "ADVANCED") {
        throw new Error("La meta ya no usa proyección avanzada.");
      }
      const configuration: SavingsPlanConfiguration = {
        id: configurationId,
        goalId: goal.id,
        revisionNumber: previous.revisionNumber + 1,
        projectionMode: "SIMPLE",
        effectiveFrom: input.startDate,
        simpleProjectionConfigurationId: simpleConfigurationId,
        changeReason: "Proyección avanzada desactivada con confirmación",
        createdAt: now,
        supersedesId: previous.id,
        rulesVersion: this.#options.rulesVersion,
        isActive: true,
      };
      return {
        ...current,
        appVersion: this.#options.appVersion,
        rulesVersion: this.#options.rulesVersion,
        exportedAt: now,
        goals: current.goals.map((candidate) =>
          candidate.id === goal.id
            ? {
                ...candidate,
                activeConfigurationId: configurationId,
                updatedAt: now,
              }
            : candidate,
        ),
        configurations: [
          ...current.configurations.map((candidate) =>
            candidate.id === previous.id
              ? { ...candidate, isActive: false }
              : candidate,
          ),
          configuration,
        ],
        simpleConfigurations: [
          ...current.simpleConfigurations,
          toSimpleProjectionConfiguration(calculation, {
            id: simpleConfigurationId,
            configurationId,
          }),
        ],
      };
    });
    return this.getGoal(input.goalId);
  }

  public async registerMovement(
    input: RegisterMovementInput,
  ): Promise<GoalDetailView> {
    const now = this.#clock.now();
    const movementId = this.#ids.nextId();
    const revisionId = this.#ids.nextId();
    await this.#repository.updateSnapshot(this.#header(), (current) => {
      const goal = current.goals.find(
        (candidate) => candidate.id === input.goalId,
      ) as SavingsGoal | undefined;
      if (goal === undefined) {
        throw new Error("La meta seleccionada no existe.");
      }
      const configuration = current.configurations.find(
        (candidate) => candidate.id === goal.activeConfigurationId,
      ) as SavingsPlanConfiguration | undefined;
      if (configuration?.projectionMode !== "ADVANCED") {
        throw new Error(
          "Activa la proyección avanzada antes de registrar ahorro real.",
        );
      }
      const product = this.#productFor(current, configuration);
      const amount = canonicalDecimal(input.amount.trim());
      const movement: SavingsMovement = {
        id: movementId,
        goalId: goal.id,
        type: input.type,
        amount,
        effectiveDate: input.effectiveDate,
        recordedAt: now,
        ...(input.note === undefined || input.note.trim().length === 0
          ? {}
          : { note: input.note.trim() }),
        currentRevisionId: revisionId,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      };
      const goalMovements = current.movements.filter(
        (candidate) => candidate.goalId === goal.id,
      ) as SavingsMovement[];
      calculateActualLedger(
        configuration.initialBalance ?? goal.initialBalance ?? "0",
        [...goalMovements, movement],
        { product },
      );
      const revision: MovementRevision = {
        id: revisionId,
        movementId,
        revisionNumber: 1,
        snapshot: { ...movement },
        reason: "Registro inicial",
        createdAt: now,
        integrityDigest: nonCryptographicDigest(movement),
      };
      return {
        ...current,
        appVersion: this.#options.appVersion,
        exportedAt: now,
        movements: [...current.movements, movement],
        movementRevisions: [...current.movementRevisions, revision],
        closes: current.closes.map((close) =>
          close.goalId === goal.id &&
          close.status === "VALID" &&
          input.effectiveDate < close.periodEnd
            ? {
                ...close,
                status: "STALE" as const,
                invalidatedAt: now,
                reason: "Un movimiento posterior cambió el periodo cerrado.",
              }
            : close,
        ),
      };
    });
    return this.getGoal(input.goalId);
  }

  public async voidMovement(
    goalId: string,
    movementId: string,
    reason: string,
  ): Promise<GoalDetailView> {
    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      throw new Error("La anulación requiere un motivo.");
    }
    const now = this.#clock.now();
    const revisionId = this.#ids.nextId();
    await this.#repository.updateSnapshot(this.#header(), (current) => {
      const previous = current.movements.find(
        (candidate) =>
          candidate.id === movementId && candidate.goalId === goalId,
      ) as SavingsMovement | undefined;
      if (previous === undefined || previous.status === "VOIDED") {
        throw new Error("El movimiento no existe o ya está anulado.");
      }
      const replacement: SavingsMovement = {
        ...previous,
        currentRevisionId: revisionId,
        status: "VOIDED",
        voidedAt: now,
        voidReason: trimmedReason,
        updatedAt: now,
      };
      const previousRevision = current.movementRevisions.find(
        (candidate) => candidate.id === previous.currentRevisionId,
      ) as MovementRevision | undefined;
      const revision: MovementRevision = {
        id: revisionId,
        movementId,
        revisionNumber: (previousRevision?.revisionNumber ?? 1) + 1,
        snapshot: { ...replacement },
        reason: trimmedReason,
        createdAt: now,
        ...(previousRevision === undefined
          ? {}
          : { supersedesId: previousRevision.id }),
        integrityDigest: nonCryptographicDigest(replacement),
      };
      return {
        ...current,
        appVersion: this.#options.appVersion,
        exportedAt: now,
        movements: current.movements.map((candidate) =>
          candidate.id === movementId ? replacement : candidate,
        ),
        movementRevisions: [...current.movementRevisions, revision],
        closes: current.closes.map((close) =>
          close.goalId === goalId &&
          close.status === "VALID" &&
          previous.effectiveDate < close.periodEnd
            ? {
                ...close,
                status: "STALE" as const,
                invalidatedAt: now,
                reason: "La anulación cambió el periodo cerrado.",
              }
            : close,
        ),
      };
    });
    return this.getGoal(goalId);
  }

  public async changeGoalStatus(
    goalId: string,
    status: GoalStatus,
  ): Promise<GoalDetailView> {
    const now = this.#clock.now();
    await this.#repository.updateSnapshot(this.#header(), (current) => ({
      ...current,
      appVersion: this.#options.appVersion,
      exportedAt: now,
      goals: current.goals.map((goal) => {
        if (goal.id !== goalId) {
          return goal;
        }
        const { archivedAt: _archivedAt, ...withoutArchive } = goal;
        return {
          ...withoutArchive,
          status,
          updatedAt: now,
          ...(status === "ARCHIVED" ? { archivedAt: now } : {}),
        };
      }),
    }));
    return this.getGoal(goalId);
  }

  public async closeActualPeriod(
    goalId: string,
    periodEnd: string,
  ): Promise<GoalDetailView> {
    const now = this.#clock.now();
    const closeId = this.#ids.nextId();
    await this.#repository.updateSnapshot(this.#header(), (current) => {
      const goal = current.goals.find((candidate) => candidate.id === goalId) as
        | SavingsGoal
        | undefined;
      if (goal === undefined) {
        throw new Error("La meta seleccionada no existe.");
      }
      const configuration = current.configurations.find(
        (candidate) => candidate.id === goal.activeConfigurationId,
      ) as SavingsPlanConfiguration | undefined;
      if (configuration?.projectionMode !== "ADVANCED") {
        throw new Error("Solo una meta avanzada admite cierres reales.");
      }
      const product = this.#productFor(current, configuration);
      const periodStart = goal.startDate ?? configuration.effectiveFrom;
      const close = createActualPeriodClose(
        configuration.initialBalance ?? goal.initialBalance ?? "0",
        current.movements.filter(
          (movement) => movement.goalId === goal.id,
        ) as SavingsMovement[],
        {
          id: closeId,
          goalId,
          periodStart,
          periodEnd,
          configurationRevisionId: configuration.id,
          closedAt: now,
          rulesVersion: this.#options.rulesVersion,
        },
        { product },
      );
      return {
        ...current,
        appVersion: this.#options.appVersion,
        exportedAt: now,
        closes: [
          ...current.closes.map((candidate) =>
            candidate.goalId === goalId && candidate.status === "VALID"
              ? {
                  ...candidate,
                  status: "STALE" as const,
                  invalidatedAt: now,
                  reason: "Sustituido por un cierre más reciente.",
                }
              : candidate,
          ),
          close,
        ],
      };
    });
    return this.getGoal(goalId);
  }
}

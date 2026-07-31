import type { CivilDate, DayCountConvention } from "./date.js";

export type Uuid = string;
export type UtcInstant = string;
export type CurrencyCode = "COP";
export type ProjectionMode = "SIMPLE" | "ADVANCED";
export type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export interface SavingsGoal {
  readonly id: Uuid;
  readonly name: string;
  readonly description?: string;
  readonly currency: CurrencyCode;
  readonly targetAmount?: string;
  readonly startDate?: CivilDate;
  readonly targetDate?: CivilDate;
  readonly initialBalance?: string;
  readonly status: GoalStatus;
  readonly visualToken?: string;
  readonly sortOrder: number;
  readonly activeConfigurationId: Uuid;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly archivedAt?: UtcInstant;
  readonly deletedAt?: UtcInstant;
}

export type SimplePeriodicity = "MONTHLY" | "YEARLY";
export interface SimpleProjectionConfiguration {
  readonly id: Uuid;
  readonly configurationId: Uuid;
  readonly periodicAmount: string;
  readonly periodicity: SimplePeriodicity;
  readonly numberOfPeriods: number;
  readonly startDate?: CivilDate;
  readonly calculationMethod: "SIMPLE_UNIFORM_SUM_V1";
}

export type ContributionFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
export type ContributionTiming = "START_OF_DAY" | "END_OF_DAY";

export interface SavingsPlanConfiguration {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly revisionNumber: number;
  readonly projectionMode: ProjectionMode;
  readonly effectiveFrom: CivilDate;
  readonly targetAmount?: string;
  readonly targetDate?: CivilDate;
  readonly initialBalance?: string;
  readonly simpleProjectionConfigurationId?: Uuid;
  readonly contributionFrequency?: ContributionFrequency;
  readonly periodicContributionAmount?: string;
  readonly contributionTiming?: ContributionTiming;
  readonly productConfigurationId?: Uuid;
  readonly changeReason?: string;
  readonly createdAt: UtcInstant;
  readonly supersedesId?: Uuid;
  readonly rulesVersion: string;
  readonly isActive: boolean;
}

export type RateType =
  | "ZERO"
  | "EA"
  | "EM"
  | "ET"
  | "ES"
  | "NOMINAL_ANNUAL_DUE"
  | "NMV"
  | "NTV"
  | "NOMINAL_ANNUAL_ADVANCE"
  | "CUSTOM_EFFECTIVE_PERIODIC"
  | "UNKNOWN";
export type ConvertibleRateType = Exclude<RateType, "UNKNOWN">;
export type RatePeriodicity =
  | "ANNUAL"
  | "SEMIANNUAL"
  | "QUARTERLY"
  | "BIMONTHLY"
  | "MONTHLY"
  | "CUSTOM"
  | "NOT_APPLICABLE"
  | "UNKNOWN";
export type RateTiming = "ADVANCE" | "DUE" | "NOT_APPLICABLE" | "UNKNOWN";
export type RateVariability = "FIXED" | "VARIABLE";
export type ConversionStatus = "VALID" | "BLOCKED" | "NEEDS_REVIEW";

export interface InterestRateDefinition {
  readonly id: Uuid;
  readonly originalValue: string;
  readonly originalType: ConvertibleRateType;
  readonly originalPeriodicity: RatePeriodicity;
  readonly capitalizationPeriodsPerYear?: number;
  readonly timing: RateTiming;
  readonly variability: RateVariability;
  readonly effectiveFrom: CivilDate;
  readonly canonicalEffectiveAnnualRate?: string;
  readonly equivalentPeriodicRate?: string;
  readonly conversionMethod?: string;
  readonly conversionFormula?: string;
  readonly calculationPrecision: number;
  readonly conversionStatus: ConversionStatus;
  readonly blockingReasons: readonly string[];
  readonly sourceName?: string;
  readonly sourceUrl?: string;
  readonly sourceNote?: string;
  readonly consultedAt?: CivilDate;
  readonly createdAt: UtcInstant;
  readonly rulesVersion: string;
}

export type RatePeriodPurpose =
  | "ORIGINAL_PROJECTION"
  | "UPDATED_PROJECTION"
  | "HISTORICAL_EXPLANATION";

export interface YieldRatePeriod {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly configurationId: Uuid;
  readonly rateDefinitionId: Uuid;
  readonly startDate: CivilDate;
  readonly endDate?: CivilDate;
  readonly purpose: RatePeriodPurpose;
  readonly sourceNote?: string;
  readonly consultedAt?: CivilDate;
  readonly createdAt: UtcInstant;
  readonly supersedesId?: Uuid;
}

export type ProductModel =
  | "NO_YIELD"
  | "FLEXIBLE_REMUNERATED"
  | "SAVINGS_DEPOSIT"
  | "FIXED_TERM_SIMPLE"
  | "CUSTOM";
export type Liquidity = "IMMEDIATE" | "FIXED_TERM" | "UNKNOWN";
export type CapitalizationFrequency = "DAILY" | "MONTHLY" | "AT_MATURITY" | "OTHER";
export type YieldPaymentDestination = "CAPITALIZED" | "PAID_OUT" | "MATURITY";

export interface FinancialProductConfiguration {
  readonly id: Uuid;
  readonly configurationId: Uuid;
  readonly productModel: ProductModel;
  readonly institutionName?: string;
  readonly productName?: string;
  readonly liquidity: Liquidity;
  readonly additionalContributionsAllowed: boolean;
  readonly withdrawalsAllowed: boolean;
  readonly capitalizationFrequency: CapitalizationFrequency;
  readonly creditingFrequency: CapitalizationFrequency;
  readonly yieldPaymentDestination: YieldPaymentDestination;
  readonly dayCountConvention: DayCountConvention;
  readonly maturityDate?: CivilDate;
  readonly renewalRule: "NONE";
  readonly minimumBalance?: string;
  readonly earlyWithdrawalRule: "NOT_ALLOWED" | "ALLOWED" | "UNKNOWN";
  readonly unsupportedConditions: readonly string[];
  readonly createdAt: UtcInstant;
  readonly supersedesId?: Uuid;
}

export type MovementType =
  | "CONTRIBUTION"
  | "EXTRA_CONTRIBUTION"
  | "YIELD"
  | "WITHDRAWAL"
  | "ADJUSTMENT";
export type MovementStatus = "ACTIVE" | "VOIDED";

export interface SavingsMovement {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly type: MovementType;
  readonly amount: string;
  readonly effectiveDate: CivilDate;
  readonly recordedAt: UtcInstant;
  readonly note?: string;
  readonly externalReference?: string;
  readonly deduplicationKey?: string;
  readonly currentRevisionId: Uuid;
  readonly status: MovementStatus;
  readonly voidedAt?: UtcInstant;
  readonly voidReason?: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
}

export interface MovementRevision {
  readonly id: Uuid;
  readonly movementId: Uuid;
  readonly revisionNumber: number;
  readonly snapshot: SavingsMovement;
  readonly reason: string;
  readonly createdAt: UtcInstant;
  readonly supersedesId?: Uuid;
  readonly integrityDigest?: string;
}

export type CloseStatus = "VALID" | "STALE" | "VOIDED";
export interface ActualPeriodClose {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly periodStart: CivilDate;
  readonly periodEnd: CivilDate;
  readonly openingBalance: string;
  readonly contributions: string;
  readonly extraContributions: string;
  readonly withdrawals: string;
  readonly actualYield: string;
  readonly adjustments: string;
  readonly closingBalance: string;
  readonly quantizedClosingBalance: string;
  readonly movementSetDigest: string;
  readonly configurationRevisionId: Uuid;
  readonly rulesVersion: string;
  readonly roundingPolicyVersion: string;
  readonly status: CloseStatus;
  readonly closedAt: UtcInstant;
  readonly invalidatedAt?: UtcInstant;
  readonly reason?: string;
}

export interface ProjectionPoint {
  readonly date: CivilDate;
  readonly balance: string;
  readonly contributions: string;
  readonly extraContributions: string;
  readonly withdrawals: string;
  readonly projectedYield: string;
  readonly eventIds: readonly Uuid[];
}

export type ProjectionStatus = "CALCULATED" | "BLOCKED";
export interface ProjectionResult {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly configurationRevisionId: Uuid;
  readonly projectionKind: "ORIGINAL" | "UPDATED";
  readonly projectionMode: ProjectionMode;
  readonly cutoffDate: CivilDate;
  readonly projectedEndDate: CivilDate;
  readonly targetReachedDate?: CivilDate;
  readonly initialBalance: string;
  readonly projectedContributions: string;
  readonly projectedExtraContributions: string;
  readonly projectedWithdrawals: string;
  readonly projectedYield: string;
  readonly finalBalance: string;
  readonly trajectory: readonly ProjectionPoint[];
  readonly ratePeriodIds: readonly Uuid[];
  readonly inputDigest: string;
  readonly rulesVersion: string;
  readonly precision: number;
  readonly roundingPolicyVersion: string;
  readonly status: ProjectionStatus;
  readonly blockingReasons: readonly string[];
  readonly calculatedAt: UtcInstant;
}

export interface ComparisonResult {
  readonly id: Uuid;
  readonly goalId: Uuid;
  readonly projectionResultId: Uuid;
  readonly actualCloseId?: Uuid;
  readonly cutoffDate: CivilDate;
  readonly projectedContributions: string;
  readonly actualContributions: string;
  readonly contributionDifference: string;
  readonly projectedWithdrawals: string;
  readonly actualWithdrawals: string;
  readonly withdrawalDifference: string;
  readonly projectedYield: string;
  readonly actualYield: string;
  readonly yieldDifference: string;
  readonly projectedBalance: string;
  readonly actualBalance: string;
  readonly balanceDifference: string;
  readonly targetProgress?: string;
  readonly scheduleStatus: "AHEAD" | "ON_TRACK" | "BEHIND";
  readonly inputDigest: string;
  readonly rulesVersion: string;
  readonly calculatedAt: UtcInstant;
}

export interface BackupMetadata {
  readonly id: Uuid;
  readonly operation: "EXPORT" | "IMPORT_PREVIEW" | "IMPORT_REPLACE" | "AUTO_BACKUP";
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly rulesVersion: string;
  readonly createdAt: UtcInstant;
  readonly exportedAt?: UtcInstant;
  readonly importedAt?: UtcInstant;
  readonly fileSizeBytes: number;
  readonly checksumAlgorithm: "SHA-256";
  readonly checksum: string;
  readonly goalCount: number;
  readonly movementCount: number;
  readonly dateRangeStart?: CivilDate;
  readonly dateRangeEnd?: CivilDate;
  readonly sourceDeviceId?: Uuid;
  readonly sourceFileName?: string;
  readonly result: "SUCCESS" | "FAILED";
  readonly resultCode?: string;
  readonly rollbackBackupId?: Uuid;
}

export interface AppSettings {
  readonly id: Uuid;
  readonly schemaVersion: number;
  readonly theme: "SYSTEM" | "LIGHT" | "DARK";
  readonly locale: "es-CO";
  readonly currencyDisplay: "COP_SYMBOL" | "COP_CODE";
  readonly reduceMotion: boolean;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
}

export interface ActualLedgerResult {
  readonly openingBalance: string;
  readonly contributions: string;
  readonly extraContributions: string;
  readonly withdrawals: string;
  readonly actualYield: string;
  readonly adjustments: string;
  readonly closingBalance: string;
  readonly movementIds: readonly Uuid[];
}

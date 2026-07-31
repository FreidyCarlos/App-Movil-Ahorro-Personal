import { z } from "zod";
import { Decimal } from "decimal.js";

const canonicalUnsignedDecimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const canonicalSignedDecimal = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const civilDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const uuidSchema = z.string().uuid();
export const utcInstantSchema = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => value.endsWith("Z") && Number.isFinite(Date.parse(value)),
    "El instante debe estar expresado en UTC con sufijo Z.",
  );
export const civilDateSchema = z
  .string()
  .regex(civilDatePattern)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) {
      return false;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      year >= 1900 &&
      year <= 2200 &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Fecha civil inválida.");
export const decimalSchema = z.string().regex(canonicalUnsignedDecimal);
export const signedDecimalSchema = z.string().regex(canonicalSignedDecimal);

export const savingsGoalSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500).optional(),
    currency: z.literal("COP"),
    targetAmount: decimalSchema.optional(),
    startDate: civilDateSchema.optional(),
    targetDate: civilDateSchema.optional(),
    initialBalance: decimalSchema.optional(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
    visualToken: z.string().max(80).optional(),
    sortOrder: z.number().int(),
    activeConfigurationId: uuidSchema,
    createdAt: utcInstantSchema,
    updatedAt: utcInstantSchema,
    archivedAt: utcInstantSchema.optional(),
    deletedAt: utcInstantSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "ARCHIVED" && value.archivedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["archivedAt"],
        message: "Una meta archivada requiere archivedAt.",
      });
    }
  });

export const simpleProjectionConfigurationSchema = z
  .object({
    id: uuidSchema,
    configurationId: uuidSchema,
    periodicAmount: decimalSchema,
    periodicity: z.enum(["MONTHLY", "YEARLY"]),
    numberOfPeriods: z.number().int().positive(),
    startDate: civilDateSchema.optional(),
    calculationMethod: z.literal("SIMPLE_UNIFORM_SUM_V1"),
  })
  .strict()
  .superRefine((value, context) => {
    const maximum = value.periodicity === "MONTHLY" ? 1200 : 100;
    if (value.numberOfPeriods > maximum) {
      context.addIssue({
        code: "custom",
        path: ["numberOfPeriods"],
        message: `El máximo es ${maximum}.`,
      });
    }
    if (value.periodicAmount === "0") {
      context.addIssue({
        code: "custom",
        path: ["periodicAmount"],
        message: "El aporte periódico debe ser mayor que cero.",
      });
    }
  });

export const savingsPlanConfigurationSchema = z
  .object({
    id: uuidSchema,
    goalId: uuidSchema,
    revisionNumber: z.number().int().positive(),
    projectionMode: z.enum(["SIMPLE", "ADVANCED"]),
    effectiveFrom: civilDateSchema,
    targetAmount: decimalSchema.optional(),
    targetDate: civilDateSchema.optional(),
    initialBalance: decimalSchema.optional(),
    simpleProjectionConfigurationId: uuidSchema.optional(),
    contributionFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]).optional(),
    periodicContributionAmount: decimalSchema.optional(),
    contributionTiming: z.enum(["START_OF_DAY", "END_OF_DAY"]).optional(),
    productConfigurationId: uuidSchema.optional(),
    changeReason: z.string().trim().min(1).max(500).optional(),
    createdAt: utcInstantSchema,
    supersedesId: uuidSchema.optional(),
    rulesVersion: z.string().min(1).max(80),
    isActive: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.projectionMode === "SIMPLE" && value.simpleProjectionConfigurationId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["simpleProjectionConfigurationId"],
        message: "SIMPLE requiere configuración simple.",
      });
    }
    if (
      value.projectionMode === "ADVANCED" &&
      (value.contributionTiming === undefined || value.initialBalance === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["projectionMode"],
        message: "ADVANCED requiere saldo inicial y momento de aporte explícitos.",
      });
    }
  });

export const interestRateDefinitionSchema = z
  .object({
    id: uuidSchema,
    originalValue: decimalSchema,
    originalType: z.enum([
      "ZERO",
      "EA",
      "EM",
      "ET",
      "ES",
      "NOMINAL_ANNUAL_DUE",
      "NMV",
      "NTV",
      "NOMINAL_ANNUAL_ADVANCE",
      "CUSTOM_EFFECTIVE_PERIODIC",
    ]),
    originalPeriodicity: z.enum([
      "ANNUAL",
      "SEMIANNUAL",
      "QUARTERLY",
      "BIMONTHLY",
      "MONTHLY",
      "CUSTOM",
      "NOT_APPLICABLE",
      "UNKNOWN",
    ]),
    capitalizationPeriodsPerYear: z.number().int().positive().max(366).optional(),
    timing: z.enum(["ADVANCE", "DUE", "NOT_APPLICABLE", "UNKNOWN"]),
    variability: z.enum(["FIXED", "VARIABLE"]),
    effectiveFrom: civilDateSchema,
    canonicalEffectiveAnnualRate: decimalSchema.optional(),
    equivalentPeriodicRate: decimalSchema.optional(),
    conversionMethod: z.string().min(1).max(100).optional(),
    conversionFormula: z.string().min(1).max(300).optional(),
    calculationPrecision: z.number().int().positive().max(1000),
    conversionStatus: z.enum(["VALID", "BLOCKED", "NEEDS_REVIEW"]),
    blockingReasons: z.array(z.string().min(1).max(100)).max(20),
    sourceName: z.string().max(200).optional(),
    sourceUrl: z.string().url().max(2000).optional(),
    sourceNote: z.string().max(2000).optional(),
    consultedAt: civilDateSchema.optional(),
    createdAt: utcInstantSchema,
    rulesVersion: z.string().min(1).max(80),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.conversionStatus === "VALID" &&
      (value.canonicalEffectiveAnnualRate === undefined ||
        value.conversionMethod === undefined ||
        value.conversionFormula === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["conversionStatus"],
        message: "Una tasa válida requiere equivalencia y método.",
      });
    }
  });

export const yieldRatePeriodSchema = z
  .object({
    id: uuidSchema,
    goalId: uuidSchema,
    configurationId: uuidSchema,
    rateDefinitionId: uuidSchema,
    startDate: civilDateSchema,
    endDate: civilDateSchema.optional(),
    purpose: z.enum([
      "ORIGINAL_PROJECTION",
      "UPDATED_PROJECTION",
      "HISTORICAL_EXPLANATION",
    ]),
    sourceNote: z.string().max(2000).optional(),
    consultedAt: civilDateSchema.optional(),
    createdAt: utcInstantSchema,
    supersedesId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endDate !== undefined && value.endDate <= value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "El final debe ser posterior al inicio.",
      });
    }
  });

export const financialProductConfigurationSchema = z
  .object({
    id: uuidSchema,
    configurationId: uuidSchema,
    productModel: z.enum([
      "NO_YIELD",
      "FLEXIBLE_REMUNERATED",
      "SAVINGS_DEPOSIT",
      "FIXED_TERM_SIMPLE",
      "CUSTOM",
    ]),
    institutionName: z.string().max(200).optional(),
    productName: z.string().max(200).optional(),
    liquidity: z.enum(["IMMEDIATE", "FIXED_TERM", "UNKNOWN"]),
    additionalContributionsAllowed: z.boolean(),
    withdrawalsAllowed: z.boolean(),
    capitalizationFrequency: z.enum(["DAILY", "MONTHLY", "AT_MATURITY", "OTHER"]),
    creditingFrequency: z.enum(["DAILY", "MONTHLY", "AT_MATURITY", "OTHER"]),
    yieldPaymentDestination: z.enum(["CAPITALIZED", "PAID_OUT", "MATURITY"]),
    dayCountConvention: z.enum([
      "DAYS_360_360",
      "DAYS_365_365",
      "ACT_ACT",
      "ACT_365",
      "PRODUCT_DEFINED",
    ]),
    maturityDate: civilDateSchema.optional(),
    renewalRule: z.literal("NONE"),
    minimumBalance: decimalSchema.optional(),
    earlyWithdrawalRule: z.enum(["NOT_ALLOWED", "ALLOWED", "UNKNOWN"]),
    unsupportedConditions: z.array(z.string().min(1).max(500)).max(30),
    createdAt: utcInstantSchema,
    supersedesId: uuidSchema.optional(),
  })
  .strict();

export const savingsMovementSchema = z
  .object({
    id: uuidSchema,
    goalId: uuidSchema,
    type: z.enum([
      "CONTRIBUTION",
      "EXTRA_CONTRIBUTION",
      "YIELD",
      "WITHDRAWAL",
      "ADJUSTMENT",
    ]),
    amount: signedDecimalSchema,
    effectiveDate: civilDateSchema,
    recordedAt: utcInstantSchema,
    note: z.string().max(500).optional(),
    externalReference: z.string().max(200).optional(),
    deduplicationKey: z.string().max(200).optional(),
    currentRevisionId: uuidSchema,
    status: z.enum(["ACTIVE", "VOIDED"]),
    voidedAt: utcInstantSchema.optional(),
    voidReason: z.string().trim().min(1).max(500).optional(),
    createdAt: utcInstantSchema,
    updatedAt: utcInstantSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Decimal(value.amount).isZero()) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "El movimiento debe ser distinto de cero.",
      });
    }
    if (value.type !== "ADJUSTMENT" && value.amount.startsWith("-")) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Solo ADJUSTMENT puede usar signo.",
      });
    }
    if (value.type === "ADJUSTMENT" && !value.note?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "El ajuste requiere observación.",
      });
    }
    if (value.status === "VOIDED" && (!value.voidedAt || !value.voidReason)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "La anulación requiere fecha y motivo.",
      });
    }
  });

export const movementRevisionSchema = z
  .object({
    id: uuidSchema,
    movementId: uuidSchema,
    revisionNumber: z.number().int().positive(),
    snapshot: savingsMovementSchema,
    reason: z.string().trim().min(1).max(500),
    createdAt: utcInstantSchema,
    supersedesId: uuidSchema.optional(),
    integrityDigest: z.string().max(200).optional(),
  })
  .strict();

export const actualPeriodCloseSchema = z
  .object({
    id: uuidSchema,
    goalId: uuidSchema,
    periodStart: civilDateSchema,
    periodEnd: civilDateSchema,
    openingBalance: decimalSchema,
    contributions: decimalSchema,
    extraContributions: decimalSchema,
    withdrawals: decimalSchema,
    actualYield: decimalSchema,
    adjustments: signedDecimalSchema,
    closingBalance: decimalSchema,
    quantizedClosingBalance: decimalSchema,
    movementSetDigest: z.string().min(1).max(200),
    configurationRevisionId: uuidSchema,
    rulesVersion: z.string().min(1).max(80),
    roundingPolicyVersion: z.string().min(1).max(80),
    status: z.enum(["VALID", "STALE", "VOIDED"]),
    closedAt: utcInstantSchema,
    invalidatedAt: utcInstantSchema.optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const projectionPointSchema = z
  .object({
    date: civilDateSchema,
    balance: decimalSchema,
    contributions: decimalSchema,
    extraContributions: decimalSchema,
    withdrawals: decimalSchema,
    projectedYield: decimalSchema,
    eventIds: z.array(uuidSchema),
  })
  .strict();

export const projectionResultSchema = z
  .object({
    id: uuidSchema,
    goalId: uuidSchema,
    configurationRevisionId: uuidSchema,
    projectionKind: z.enum(["ORIGINAL", "UPDATED"]),
    projectionMode: z.enum(["SIMPLE", "ADVANCED"]),
    cutoffDate: civilDateSchema,
    projectedEndDate: civilDateSchema,
    targetReachedDate: civilDateSchema.optional(),
    initialBalance: decimalSchema,
    projectedContributions: decimalSchema,
    projectedExtraContributions: decimalSchema,
    projectedWithdrawals: decimalSchema,
    projectedYield: decimalSchema,
    finalBalance: decimalSchema,
    trajectory: z.array(projectionPointSchema).max(100_000),
    ratePeriodIds: z.array(uuidSchema).max(1000),
    inputDigest: z.string().min(1).max(200),
    rulesVersion: z.string().min(1).max(80),
    precision: z.number().int().positive().max(1000),
    roundingPolicyVersion: z.string().min(1).max(80),
    status: z.enum(["CALCULATED", "BLOCKED"]),
    blockingReasons: z.array(z.string().min(1).max(100)).max(50),
    calculatedAt: utcInstantSchema,
  })
  .strict();

export const comparisonResultSchema = z
  .object({
    id: uuidSchema,
    goalId: uuidSchema,
    projectionResultId: uuidSchema,
    actualCloseId: uuidSchema.optional(),
    cutoffDate: civilDateSchema,
    projectedContributions: decimalSchema,
    actualContributions: decimalSchema,
    contributionDifference: signedDecimalSchema,
    projectedWithdrawals: decimalSchema,
    actualWithdrawals: decimalSchema,
    withdrawalDifference: signedDecimalSchema,
    projectedYield: decimalSchema,
    actualYield: decimalSchema,
    yieldDifference: signedDecimalSchema,
    projectedBalance: decimalSchema,
    actualBalance: decimalSchema,
    balanceDifference: signedDecimalSchema,
    targetProgress: decimalSchema.optional(),
    scheduleStatus: z.enum(["AHEAD", "ON_TRACK", "BEHIND"]),
    inputDigest: z.string().min(1).max(200),
    rulesVersion: z.string().min(1).max(80),
    calculatedAt: utcInstantSchema,
  })
  .strict();

export const backupMetadataSchema = z
  .object({
    id: uuidSchema,
    operation: z.enum(["EXPORT", "IMPORT_PREVIEW", "IMPORT_REPLACE", "AUTO_BACKUP"]),
    schemaVersion: z.number().int().positive(),
    appVersion: z.string().min(1).max(80),
    rulesVersion: z.string().min(1).max(80),
    createdAt: utcInstantSchema,
    exportedAt: utcInstantSchema.optional(),
    importedAt: utcInstantSchema.optional(),
    fileSizeBytes: z.number().int().nonnegative(),
    checksumAlgorithm: z.literal("SHA-256"),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    goalCount: z.number().int().nonnegative(),
    movementCount: z.number().int().nonnegative(),
    dateRangeStart: civilDateSchema.optional(),
    dateRangeEnd: civilDateSchema.optional(),
    sourceDeviceId: uuidSchema.optional(),
    sourceFileName: z.string().max(255).optional(),
    result: z.enum(["SUCCESS", "FAILED"]),
    resultCode: z.string().min(1).max(80).optional(),
    rollbackBackupId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.dateRangeStart !== undefined &&
      value.dateRangeEnd !== undefined &&
      value.dateRangeEnd < value.dateRangeStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["dateRangeEnd"],
        message: "El final del rango no puede preceder su inicio.",
      });
    }
    if (value.result === "FAILED" && value.resultCode === undefined) {
      context.addIssue({
        code: "custom",
        path: ["resultCode"],
        message: "Una operación fallida requiere un código seguro.",
      });
    }
  });

export const appSettingsSchema = z
  .object({
    id: uuidSchema,
    schemaVersion: z.number().int().positive(),
    theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
    locale: z.literal("es-CO"),
    currencyDisplay: z.enum(["COP_SYMBOL", "COP_CODE"]),
    reduceMotion: z.boolean(),
    createdAt: utcInstantSchema,
    updatedAt: utcInstantSchema,
  })
  .strict();

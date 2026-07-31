# Modelo de datos

Estado: contratos TypeScript y esquema SQLite v1 implementados. Fecha: 30 de
julio de 2026.

## Principios

- Identificadores UUID generados localmente.
- Fechas civiles como `YYYY-MM-DD`; instantes de auditoría como UTC ISO 8601.
- Importes y tasas como strings decimales canónicos.
- Moneda ISO 4217; el MVP acepta `COP`.
- Revisiones inmutables y eliminación lógica para conservar trazabilidad.
- SQLite es la fuente única de verdad de la persistencia; las vistas calculadas
  no reemplazan movimientos ni configuraciones.
- Proyecciones y comparaciones se calculan en memoria con el motor vigente y no
  se persisten.

## Relaciones

```text
SavingsGoal 1 ── * SavingsPlanConfiguration
SavingsPlanConfiguration 1 ── 0..1 SimpleProjectionConfiguration
SavingsGoal 1 ── * YieldRatePeriod * ── 1 InterestRateDefinition
SavingsGoal 1 ── 1 FinancialProductConfiguration (por revisión)
SavingsGoal 1 ── * SavingsMovement 1 ── * MovementRevision
SavingsGoal 1 ── * ActualPeriodClose
SavingsPlanConfiguration + datos base ──> ProjectionResult (en memoria)
ProjectionResult + movimientos/cierre ──> ComparisonResult (en memoria)
BackupMetadata registra exportaciones/importaciones del conjunto
AppSettings configura la aplicación, no los saldos
```

## Entidades

### SavingsGoal

| Atributo | Tipo conceptual | Regla |
|---|---|---|
| `id` | UUID | único, inmutable |
| `name` | texto 1..80 | obligatorio |
| `description` | texto 0..500 | opcional |
| `currency` | código ISO | solo `COP` en MVP |
| `targetAmount` | decimal o nulo | opcional en simple; mayor que cero si existe |
| `startDate` | fecha civil o nula | opcional en simple; requerida cuando el calendario avanzado la necesita |
| `targetDate` | fecha civil o nula | derivable en simple si hay inicio; requerida según el flujo avanzado |
| `initialBalance` | decimal o nulo | ausente en simple; no negativo en avanzado |
| `status` | enum | `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED` |
| `visualToken` | texto | color/icono, sin significado financiero |
| `sortOrder` | entero | orden configurable |
| `activeConfigurationId` | UUID | revisión activa |
| `createdAt`, `updatedAt` | instante UTC | auditoría |
| `archivedAt` | instante UTC | obligatorio si archivada |
| `deletedAt` | instante UTC | borrado lógico futuro |

El saldo inicial se materializa también como origen auditable de la primera
configuración avanzada; no se duplica como aporte ordinario. El modo vigente
no se duplica aquí: se obtiene de `activeConfigurationId`.

### SavingsPlanConfiguration

Revisión inmutable de los supuestos.

| Atributo | Regla |
|---|---|
| `id`, `goalId` | UUID y relación |
| `revisionNumber` | entero creciente por meta |
| `projectionMode` | `SIMPLE` o `ADVANCED`; `SIMPLE` al crear |
| `effectiveFrom` | fecha civil |
| `targetAmount`, `targetDate`, `initialBalance` | snapshot condicional según modo |
| `simpleProjectionConfigurationId` | obligatorio en `SIMPLE`; se conserva al pasar a `ADVANCED` |
| `contributionFrequency` | regla avanzada: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `YEARLY`, `CUSTOM` |
| `periodicContributionAmount` | decimal no negativo en avanzado |
| `contributionRule` | regla avanzada de día/intervalo y ajuste de fecha |
| `contributionTiming` | regla avanzada: `START_OF_DAY` o `END_OF_DAY` |
| `productConfigurationId` | relación opcional, solo avanzado |
| `changeReason` | texto 1..500 salvo revisión inicial |
| `createdAt`, `supersedesId` | auditoría/cadena |
| `rulesVersion` | versión de reglas |
| `isActive` | solo una activa por meta |

La edición crea una revisión; no cambia proyecciones ya emitidas.

Al pasar de `SIMPLE` a `ADVANCED`, los datos básicos se copian a una revisión
nueva y se traducen a la regla de aportes compatible. Al volver a `SIMPLE`, los
campos avanzados no participan en el cálculo, pero permanecen en la revisión
anterior o en un borrador versionado. Nunca se ponen en `null` como efecto
secundario del interruptor.

### SimpleProjectionConfiguration

Objeto de configuración propiedad de una revisión:

| Atributo | Regla |
|---|---|
| `id`, `configurationId` | UUID/relación uno a uno |
| `periodicAmount` | decimal mayor que cero |
| `periodicity` | `MONTHLY` o `YEARLY` |
| `numberOfPeriods` | entero positivo escrito libremente dentro del límite |
| `startDate` | fecha civil opcional |
| `calculationMethod` | `SIMPLE_UNIFORM_SUM_V1` |

`projectedTotal` se calcula desde las entradas y se entrega en el resultado en
memoria; no forma parte de esta configuración persistente.

`PlannedContributionOverride` no forma parte del esquema MVP. Queda reservado
como posible extensión futura con `periodIndex` y `amount`, siempre como dato
planificado y nunca como `SavingsMovement`.

### InterestRateDefinition

Solo se relaciona con revisiones avanzadas. Una revisión simple no crea una
tasa cero implícita: declara que el método suma aportes y que el rendimiento no
aplica.

| Atributo | Regla |
|---|---|
| `id` | UUID |
| `originalValue` | string decimal porcentual exacto |
| `originalType` | catálogo de tasas convertibles; `UNKNOWN` permanece como estado de captura y no crea esta entidad |
| `originalPeriodicity` | periodo comunicado |
| `capitalizationFrequency` | periodo o cantidad/año |
| `timing` | `ADVANCE`, `DUE`, `NOT_APPLICABLE`, `UNKNOWN` |
| `variability` | `FIXED`, `VARIABLE` |
| `effectiveFrom` | fecha civil |
| `canonicalEffectiveAnnualRate` | decimal o nulo si no convertible |
| `conversionMethod` | código de fórmula o nulo |
| `conversionFormula` | expresión versionada |
| `calculationPrecision` | entero/configuración |
| `conversionStatus` | `VALID`, `BLOCKED`, `NEEDS_REVIEW` |
| `blockingReasons` | lista cerrada de códigos |
| `sourceName`, `sourceUrl`, `sourceNote` | opcionales |
| `consultedAt` | fecha civil opcional |
| `createdAt`, `rulesVersion` | auditoría |

Nunca se sobrescribe `originalValue` con la equivalencia.

### YieldRatePeriod

| Atributo | Regla |
|---|---|
| `id`, `goalId`, `configurationId`, `rateDefinitionId` | relaciones |
| `startDate` | inclusiva |
| `endDate` | exclusiva, opcional |
| `purpose` | `ORIGINAL_PROJECTION`, `UPDATED_PROJECTION`, `HISTORICAL_EXPLANATION` |
| `sourceNote`, `consultedAt` | trazabilidad |
| `createdAt`, `supersedesId` | revisión |

Restricciones: ordenado, sin superposición por propósito/configuración; un hueco
requiere un periodo `ZERO` explícito o bloquea el cálculo.

### FinancialProductConfiguration

Es opcional y exclusivo de `ADVANCED`; no se exige ni se muestra en `SIMPLE`.

| Atributo | Valores principales |
|---|---|
| `id`, `configurationId` | UUID/relación |
| `productModel` | `NO_YIELD`, `FLEXIBLE_REMUNERATED`, `SAVINGS_DEPOSIT`, `FIXED_TERM_SIMPLE`, `CUSTOM` |
| `institutionName`, `productName` | opcionales, solo referencia |
| `liquidity` | `IMMEDIATE`, `FIXED_TERM`, `UNKNOWN` |
| `additionalContributionsAllowed` | booleano |
| `withdrawalsAllowed` | booleano |
| `capitalizationFrequency` | diaria, mensual, vencimiento, otra |
| `creditingFrequency` | cuándo acredita/paga |
| `yieldPaymentDestination` | `CAPITALIZED`, `PAID_OUT`, `MATURITY` |
| `dayCountConvention` | `DAYS_360_360`, `DAYS_365_365`, `ACT_ACT`, `ACT_365`, `PRODUCT_DEFINED` |
| `maturityDate` | obligatoria para plazo fijo |
| `renewalRule` | `NONE`; otras fuera del MVP |
| `minimumBalance` | opcional, informativo en MVP |
| `earlyWithdrawalRule` | `NOT_ALLOWED` en plazo fijo simple |
| `unsupportedConditions` | lista explicativa |
| `createdAt`, `supersedesId` | auditoría |

El modelo de producto no determina el tipo de tasa.

### SavingsMovement

Pertenece al seguimiento real avanzado. Una proyección simple puede convertirse
en avanzada conservando su plan, pero sus periodos proyectados no se transforman
automáticamente en movimientos confirmados.

| Atributo | Regla |
|---|---|
| `id`, `goalId` | UUID/relación |
| `type` | `CONTRIBUTION`, `EXTRA_CONTRIBUTION`, `YIELD`, `WITHDRAWAL`, `ADJUSTMENT` |
| `amount` | decimal positivo; el tipo da el signo |
| `effectiveDate` | fecha civil |
| `recordedAt` | instante UTC |
| `note` | obligatoria para `ADJUSTMENT`, opcional en otros |
| `externalReference` | opcional; nunca credencial |
| `deduplicationKey` | opcional/único por origen |
| `currentRevisionId` | relación |
| `status` | `ACTIVE`, `VOIDED` |
| `voidedAt`, `voidReason` | obligatorios al anular |
| `createdAt`, `updatedAt` | auditoría |

Un movimiento no se edita en sitio. `MovementRevision` conserva valor anterior,
nuevo valor, motivo, instante y relación con la revisión previa. La anulación es
lógica. Un retiro superior al saldo se rechaza en el MVP.

### MovementRevision

`id`, `movementId`, `revisionNumber`, snapshot completo, `reason`,
`createdAt`, `supersedesId` y `integrityDigest` no criptográfico opcional.

### ActualPeriodClose

| Atributo | Regla |
|---|---|
| `id`, `goalId` | relaciones |
| `periodStart`, `periodEnd` | fechas, sin solaparse para cierres activos |
| `openingBalance`, `contributions`, `extraContributions`, `withdrawals`, `actualYield`, `adjustments`, `closingBalance` | decimales precisos |
| `quantizedClosingBalance` | valor de presentación/consolidación |
| `movementSetDigest` | detecta cambios accidentales |
| `configurationRevisionId` | contexto |
| `rulesVersion`, `roundingPolicyVersion` | reproducibilidad |
| `status` | `VALID`, `STALE`, `VOIDED` |
| `closedAt`, `invalidatedAt`, `reason` | auditoría |

Un movimiento retroactivo vuelve obsoletos los cierres afectados; no se
reescriben silenciosamente.

### ProjectionResult

Resultado derivado, reproducible, transitorio y reemplazable. No forma parte del
snapshot persistente ni de la copia portable; se recalcula con el motor vigente.

Campos: `id`, `goalId`, `configurationRevisionId`, `projectionKind`
(`ORIGINAL`, `UPDATED`), `cutoffDate`, `projectedEndDate`, `targetReachedDate`,
totales de saldo inicial/aportes/retiros/rendimiento/saldo final, puntos de
trayectoria, IDs de periodos de tasa, `inputDigest`, `rulesVersion`,
`precision`, `roundingPolicyVersion`, `status`, `blockingReasons`,
`calculatedAt`.

También conserva `projectionMode`. En `SIMPLE`, `projectedContributions` y
`finalBalance` equivalen a la suma simple, `projectedYield` es cero/no
aplicable, y no se crean referencias ficticias a tasa o producto.

Nunca se marca como real ni se usa como fuente de verdad.

### ComparisonResult

Campos: `id`, `goalId`, `projectionResultId`, `actualCloseId` o corte real,
`cutoffDate`, proyectado/real para aportes, retiros, rendimiento y saldo,
diferencias por concepto, avance, estado de plazo, desglose por periodo,
`inputDigest`, `rulesVersion`, `calculatedAt`.

También es transitorio: se reconstruye desde la proyección vigente y el libro
real. Una caché futura deberá incluir versión del motor y huella de entradas, y
podrá descartarse sin pérdida.

### BackupMetadata

| Atributo | Regla |
|---|---|
| `id` | UUID |
| `operation` | `EXPORT`, `IMPORT_PREVIEW`, `IMPORT_REPLACE`, `AUTO_BACKUP` |
| `schemaVersion`, `appVersion`, `rulesVersion` | versiones |
| `createdAt`, `exportedAt`, `importedAt` | instantes |
| `fileSizeBytes` | límite validado |
| `checksumAlgorithm`, `checksum` | daño accidental, no autenticidad |
| `goalCount`, `movementCount`, `dateRange` | resumen |
| `sourceDeviceId` | identificador aleatorio opcional, no hardware |
| `sourceFileName` | nombre saneado, sin ruta |
| `result` | éxito/fallo y código seguro |
| `rollbackBackupId` | respaldo previo a reemplazo |

No contiene contraseña, token, credencial bancaria ni ruta absoluta.

### AppSettings

Campos: `id` singleton, `schemaVersion`, tema, idioma, preferencia de formato
COP, reducción de movimiento, accesibilidad, orden de inicio, versión de
advertencia aceptada y fechas de creación/actualización.

Las preferencias no alteran resultados financieros. Un futuro PIN o biometría
se modelará aparte y solo después de diseñar almacenamiento seguro.

## Datos almacenados

- metas, revisiones y reglas de aportes;
- modo de proyección y configuración simple uniforme;
- movimientos y sus revisiones;
- periodos y definiciones originales/equivalentes de tasa;
- condiciones básicas del producto;
- cierres auditables, versiones y huellas necesarias para recalcular;
- preferencias no críticas y metadatos de respaldo/importación.

No se almacenan `ProjectionResult` ni `ComparisonResult`. Los movimientos y sus
revisiones son la fuente del ahorro real; un cierre solo consolida ese libro y
puede quedar `STALE`.

## Datos que nunca deben almacenarse

- usuarios o contraseñas bancarias;
- números completos de tarjetas o claves;
- tokens, cookies de sesión o secretos;
- credenciales de correo o nube;
- documentos de identidad innecesarios;
- datos obtenidos de bancos sin una integración futura autorizada;
- estado financiero completo en logs o analítica.

## Correspondencia SQLite v1

| Entidad | Tabla |
|---|---|
| `SavingsGoal` | `goals` |
| `SavingsPlanConfiguration` | `plan_configurations` |
| `SimpleProjectionConfiguration` | `simple_configurations` |
| `InterestRateDefinition` | `rate_definitions` |
| `YieldRatePeriod` | `rate_periods` |
| `FinancialProductConfiguration` | `product_configurations` |
| `SavingsMovement` | `movements` |
| `MovementRevision` | `movement_revisions` |
| `ActualPeriodClose` | `actual_period_closes` |
| `BackupMetadata` | `backup_metadata` |
| `AppSettings` | `app_settings` |

Cada fila contiene columnas relacionales e indexables junto con `payload_json`.
Los decimales permanecen como strings; no se almacenan en columnas
binarias `REAL`. Al leer, se valida tanto la carga individual como el snapshot
completo y sus relaciones.

La duplicación controlada entre columnas e `payload_json` sirve para consultar
y aplicar restricciones sin perder el objeto original. Todo reemplazo vuelve a
leer y comparar el snapshot antes de confirmar la transacción.

## Integridad y migraciones

- `application_id`, `user_version`, `schema_migrations` y `app_metadata` desde
  la primera migración;
- claves foráneas activas y comprobadas por conexión;
- escritura crítica en transacción exclusiva;
- consultas parametrizadas;
- `quick_check` y `foreign_key_check` antes y después de migrar;
- nunca borrar o reinicializar automáticamente una base incompatible;
- conservar archivo dañado, bloquear operaciones peligrosas y ofrecer
  exportación/recuperación;
- migraciones ascendentes verificables y respaldo previo;
- una versión futura desconocida se rechaza sin modificar datos.

## Importación

El JSON es cerrado y versionado. Antes de parsear se validan tipo y tamaño;
después, profundidad, longitudes, claves, tipos, IDs, relaciones y números
decimales finitos. El reemplazo completo usa respaldo, confirmación,
transacción, verificación y rollback.

No se implementa una migración histórica de archivos sin `projectionMode`
mientras no existan copias móviles productivas anteriores. Para una futura
versión heredada conocida, la migración asignará `ADVANCED` solo si hay datos
financieros avanzados completos y válidos, `SIMPLE` solo si hay campos simples
válidos, y rechazará archivos ambiguos sin modificar datos.

Los techos operativos de desarrollo son 10 MiB, profundidad 20, 100 metas,
10.000 movimientos y 1.000 periodos de tasa. Su calibración final en Android
permanece en [`DECISIONES_PENDIENTES.md`](DECISIONES_PENDIENTES.md).

## Correspondencia con la implementación

Las entidades conceptuales tienen contratos TypeScript en
`src/domain/models.ts`. Los objetos importables se validan con esquemas Zod
cerrados en `src/domain/validation/schemas.ts`.

Identificadores, relaciones, revisión activa, referencias de tasas y resultados
se validan en el snapshot v1. SQLite añade atomicidad, claves foráneas,
unicidad, índices y recuperación por rollback.

`projectionMode`, valor/tipo original de tasa, equivalencia, versión de reglas,
movimientos, revisiones, cierres y huellas forman parte del contrato
serializable. Un archivo heredado sin `projectionMode` no se migra en esta
versión: se rechaza por esquema.

Detalles físicos y recuperación:
[MIGRACIONES.md](MIGRACIONES.md) y
[RESPALDOS_E_IMPORTACION.md](RESPALDOS_E_IMPORTACION.md).

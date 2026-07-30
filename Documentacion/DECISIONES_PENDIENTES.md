# Decisiones pendientes

Fecha: 30 de julio de 2026. Ninguna de estas decisiones se resolverá
silenciosamente al implementar.

## Decisiones cerradas

- Existe un solo flujo de meta con `projectionMode: SIMPLE | ADVANCED`.
- `projectionMode` pertenece a `SavingsPlanConfiguration`, porque cambiarlo
  crea una revisión; la meta obtiene el modo vigente desde su configuración
  activa.
- `SIMPLE` es el valor predeterminado.
- El control visible se rotula **Usar proyección avanzada** y no es un chulito
  sin explicación.
- El simple uniforme usa importe, mes/año y cantidad de periodos; fecha inicial
  y objetivo son opcionales.
- En simple no se crea una tasa cero ficticia: el rendimiento no aplica y el
  total es solo aportes.
- Activar conserva datos básicos; desactivar con datos avanzados advierte, crea
  revisión y no borra el histórico.
- Los campos avanzados permanecen ocultos hasta activar el interruptor.
- La proyección simple usa un importe uniforme por periodo.
- Los importes diferentes por periodo quedan fuera del MVP.
  `PlannedContributionOverride` se aplaza para una versión futura.
- Los límites de la proyección simple son `1..1200` meses y `1..100` años.
- No existe todavía una copia productiva móvil que requiera migración histórica
  por ausencia de `projectionMode`.
- Regla para una futura importación heredada: usar `ADVANCED` cuando existan
  datos financieros avanzados completos y válidos; usar `SIMPLE` cuando solo
  existan campos simples válidos; rechazar cualquier caso ambiguo.
- La reducción de periodos con overrides no se define para el MVP porque los
  overrides no se implementarán.

## Decisiones técnicas cerradas al finalizar la Fase 2

Estas políticas quedan propuestas como valores seguros del MVP y ya tienen
implementación y pruebas. Permanecen sujetas a la revisión del responsable del
producto antes del commit.

### DC-01 — Límite de montos COP

- Máximo por objetivo, saldo, aporte, retiro, ajuste absoluto y resultado
  calculado: `10 000 000 000 COP`.
- La aplicación puede configurar un límite menor, pero no uno mayor sin crear
  y aprobar una nueva versión de política.
- Se aplica al capturar, calcular y validar un snapshot importado.

**Motivo sencillo:** diez mil millones cubren metas personales de valor alto,
pero reducen el riesgo de agregar ceros por error o procesar cifras diseñadas
para agotar recursos. La propuesta anterior de casi diez billones se descarta
por excesiva.

**Impacto técnico:** `numeric-policy-cop-v1` viaja en los metadatos del
snapshot. SQLite deberá guardar el decimal como texto canónico y aplicar la
misma validación en los casos de uso; el límite no justifica usar números
binarios.

### DC-02 — Límite de tasas

- Tasas negativas: rechazadas.
- Valor original: máximo `100 %` por el periodo declarado.
- Equivalente canónica: máximo `100 % E.A.` (`1` decimal).
- Una tasa mensual o nominal aparentemente menor también se bloquea si al
  convertirla supera `100 % E.A.`.

**Motivo sencillo:** una tasa de ahorro por encima de ese límite es más
probablemente un error de tipo, periodo o digitación que un supuesto apropiado
para este producto. El límite no afirma que sea jurídicamente imposible.

**Impacto técnico:** la normalización valida el valor original y nuevamente la
E.A. obtenida. La importación recalcula la tasa; no confía en la equivalencia
guardada. La propuesta anterior de `1000 %` se descarta.

### DC-03 — Redondeo COP

- Cálculo interno: `Decimal` con 50 dígitos significativos, sin redondeo
  monetario entre eventos.
- Visualización y consolidación de cierres: peso completo, `HALF_UP`.
- Política: `cop-half-up-0-v1`.
- El valor preciso se conserva junto al consolidado; el consolidado no
  reemplaza la fuente precisa.

**Motivo sencillo:** si el valor tiene medio peso o más, se muestra el peso
siguiente. Redondear solo al final evita que muchos redondeos pequeños alteren
una proyección larga.

**Impacto técnico:** los cierres generan siempre ambos valores y guardan la
versión. Una regla de liquidación específica de una entidad requerirá otra
política; no se imita silenciosamente.

### DC-04 — Equivalencias importadas

- Tolerancia híbrida versionada `1e-18`: se acepta cuando la diferencia
  absoluta **o** la relativa es menor o igual a `1e-18`.
- Método, fórmula y precisión deben coincidir exactamente con la versión
  conocida.
- Si excede la tolerancia, la importación se rechaza antes de modificar datos.

**Motivo sencillo:** tolera diferencias minúsculas de precisión, pero no una
tasa materialmente distinta ni una fórmula desconocida.

**Impacto técnico:** `rate-equivalence-tolerance-v1` y su valor se incluyen en
el snapshot. Una versión heredada solo podrá usar otra tolerancia mediante una
migración conocida; los casos ambiguos continúan rechazados.

### DC-05 — Momento predeterminado del aporte

- El programador futuro ubicará el aporte periódico al cierre del periodo.
- En la fecha programada, el motor usa `END_OF_DAY` por defecto.
- En modo avanzado el usuario podrá seleccionar `START_OF_DAY`.

**Motivo sencillo:** aplicar el aporte al final es conservador: no atribuye
rendimiento a dinero que quizá todavía no había sido depositado.

**Impacto técnico:** el valor predeterminado se materializa y persiste en la
revisión; no se presenta como una regla del banco. Un aporte al final del día
empieza a influir en el rendimiento desde el día siguiente.

### DC-06 — Capitalización mensual con movimientos intermedios

Continúa bloqueada en el MVP. Solo se calcula con una tasa única, meses
calendario completos y sin aportes ni retiros intermedios.

**Motivo sencillo:** sin conocer el calendario de corte y acreditación del
producto no puede decidirse qué saldo genera rendimiento en un mes parcial.

**Impacto técnico:** no se aproxima con capitalización diaria ni se inventa una
fecha de corte. La Fase 3 puede persistir la configuración, pero debe conservar
el estado bloqueado hasta que una versión futura modele ese calendario.

## Requieren aprobación del responsable del producto

Las decisiones siguientes no se resolvieron como efecto secundario del cierre.
Requieren trabajo de su fase o validación adicional.

### DP-02 — Retiro superior al saldo

Propuesta MVP: rechazarlo. Alternativa futura: permitir saldo negativo solo en
una simulación personalizada expresamente marcada.

Riesgo: permitirlo confunde ahorro con deuda y rompe supuestos de rendimiento.

### DP-03 — Frecuencia personalizada de aportes

Propuesta: MVP soporta semanal, quincenal, mensual y anual. `CUSTOM` se limita a
“cada N días” o se aplaza; no admite reglas de calendario arbitrarias.

Riesgo: una regla genérica exige manejo de festivos, fin de mes y zona horaria.

### DP-06 — Convenciones de días

Propuesta: ofrecer 360/360, 365/365 y real/real según las definiciones
documentadas por la SFC. ACT/365 solo aparece si el producto dice
explícitamente días reales/365. `PRODUCT_DEFINED` bloquea hasta tener una regla.

Riesgo: real/real y 30/360 tienen variantes internacionales; se usarán códigos
sin ambigüedad y no se inferirán por la frase genérica “base 360”.

### DP-08 — Tamaño y profundidad de copia

Propuesta inicial: máximo 10 MiB, profundidad 20, 100 metas, 10 000 movimientos
por meta, 1000 periodos de tasa y strings de máximo 2000 caracteres salvo
campos documentados.

Riesgo: debe medirse en dispositivos de gama baja antes de aprobar. El límite
se comprueba antes del parseo y nuevamente durante validación.

### DP-09 — Conservación de resultados derivados

Propuesta: guardar cierres y metadatos de resultados; recalcular proyecciones
cuando cambie el motor, conservando `inputDigest` y versión previa.

Riesgo: guardar cada punto consume espacio; no guardarlo dificulta auditoría.

### DP-10 — Soporte exacto de plazo fijo

Propuesta: solo capital único, tasa fija, base explícita y pago al vencimiento.
No renovación automática, pagos periódicos, negociación ni cancelación.

Riesgo: el nombre “CDT” cubre más variantes; la interfaz debe mostrar
“configuración no soportada” ante cualquier condición adicional.

### DP-11 — Rendimiento fijo sin tasa

Propuesta: dejarlo fuera del MVP.

Riesgo: un monto informado al vencimiento podría modelarse, pero presentarlo
como rendimiento “fijo” sin verificar garantía, plazo y pago puede inducir a
error.

### DP-12 — Tasa nominal anticipada

Propuesta: aprobar su normalización matemática con frecuencia completa, pero no
los flujos de un producto que pague por anticipado.

Riesgo: mostrarla sin esta separación podría hacer creer que el producto
completo está soportado.

### DP-13 — Cifrado y bloqueo

Propuesta MVP documental: base y copias sin cifrar, con divulgación clara.
Evaluar después biometría/PIN y SQLCipher como controles distintos.

Riesgo: datos expuestos en un dispositivo perdido. Implementar protección
superficial daría una falsa garantía y complica recuperación.

### DP-14 — Respaldo del sistema operativo

Definir si se permite respaldo automático de la base por Android/iOS o se
excluye. Requiere evaluar recuperación, exposición y comportamiento de Expo.

### DP-15 — Versiones mínimas y alcance iOS

Debe decidirse después de validar el stack y dispositivos disponibles. Android
seguirá siendo la primera plataforma comprobada.

## Investigación adicional antes de ampliar el soporte productivo

- validar variantes y códigos exactos de 360/360, 365/365, real/real y ACT/365;
- contrastar la política de acreditación de meses parciales para los modelos
  elegidos;
- diseñar migraciones JSON únicamente cuando exista una versión productiva
  anterior real;
- definir modelo de amenaza formal en la Fase 5 sin perder los riesgos ya
  listados;
- medir límites de importación y rendimiento en Android de gama baja;
- revisar accesibilidad con tecnología asistiva real;
- verificar licencias y salud de dependencias antes de fijarlas.

## Rechazos ya decididos para el MVP

- inferir datos faltantes de una tasa;
- dividir E.A. entre doce;
- tratar nominal como efectiva;
- proyección automática de índices futuros;
- tasas negativas;
- copiar tasas vigentes como valores permanentes;
- conexión bancaria, dinero real o recomendaciones;
- cálculo tributario, inflación, comisiones o GMF;
- combinación automática de historiales;
- criptografía casera.

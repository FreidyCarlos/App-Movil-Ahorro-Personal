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

## Requieren aprobación del responsable del producto

### DP-01 — Límites monetarios y de tasa

Propuesta: monto máximo `9 999 999 999 999 COP`, tasa máxima `1000 %` por
periodo original.

Costo/riesgo: límites muy altos aumentan consumo y riesgo de entradas erróneas;
límites bajos excluyen casos legítimos. Se propone aceptar los valores para
validación técnica y ajustarlos con pruebas.

### DP-02 — Retiro superior al saldo

Propuesta MVP: rechazarlo. Alternativa futura: permitir saldo negativo solo en
una simulación personalizada expresamente marcada.

Riesgo: permitirlo confunde ahorro con deuda y rompe supuestos de rendimiento.

### DP-03 — Frecuencia personalizada de aportes

Propuesta: MVP soporta semanal, quincenal, mensual y anual. `CUSTOM` se limita a
“cada N días” o se aplaza; no admite reglas de calendario arbitrarias.

Riesgo: una regla genérica exige manejo de festivos, fin de mes y zona horaria.

### DP-04 — Convención predeterminada de aporte

Propuesta: aporte proyectado al final del día; modo avanzado puede escoger
inicio del día. La pantalla explicará la diferencia.

Riesgo: la fecha desde la que una entidad remunera puede diferir. No se debe
presentar el valor predeterminado como condición bancaria.

### DP-05 — Política monetaria COP

Propuesta: cálculo interno con 28 dígitos significativos; visual COP al peso
`HALF_UP`; cierre conserva valor preciso y consolidado.

Riesgo: una entidad puede acreditar con otra precisión. Se necesita prueba de
acumulación antes de congelar `rounding-policy-1`.

### DP-06 — Convenciones de días

Propuesta: ofrecer 360/360, 365/365 y real/real según las definiciones
documentadas por la SFC. ACT/365 solo aparece si el producto dice
explícitamente días reales/365. `PRODUCT_DEFINED` bloquea hasta tener una regla.

Riesgo: real/real y 30/360 tienen variantes internacionales; se usarán códigos
sin ambigüedad y no se inferirán por la frase genérica “base 360”.

### DP-07 — Tolerancia de equivalencia importada

Propuesta: comparación decimal relativa `1e-18`, conservando el dato importado
y marcando revisión si excede la tolerancia.

Riesgo: demasiado estricta puede rechazar versiones antiguas; demasiado amplia
puede ocultar una conversión defectuosa.

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

## Investigación adicional antes de implementación

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

# Historias de usuario

Fecha: 30 de julio de 2026. Prioridad `P0` significa indispensable para el MVP;
`P1`, importante pero posterior al núcleo mínimo.

## Metas

### HU-01 — Crear varias metas (`P0`)

Como persona ahorradora, quiero crear varias metas con nombre, objetivo, fecha
o plazo y saldo inicial para seguir propósitos independientes.

Criterios: en modo avanzado, objetivo positivo, fecha válida y saldo inicial;
en modo simple, objetivo y fecha inicial pueden omitirse; COP; una meta no
altera otra; el saldo persiste tras reiniciar.

### HU-02 — Organizar y cambiar estado (`P0`)

Quiero ordenar, pausar, completar y archivar metas sin perder su historial.

Criterios: archivado lógico; estados válidos; completar no borra movimientos;
orden meramente visual.

### HU-03 — Revisar supuestos (`P0`)

Quiero cambiar aportes, objetivo o tasa desde una fecha y explicar el motivo
para conservar lo que se proyectó antes.

Criterios: revisión nueva; vigencia explícita; proyección original intacta;
impacto futuro previsualizado.

### HU-31 — Crear proyección simple mensual (`P0`)

Como persona sin conocimientos financieros, quiero indicar cuánto ahorraré por
mes y durante cuántos meses para conocer la suma total sin configurar una tasa.

Criterios: modo `SIMPLE` predeterminado; cantidad entera libre dentro de los
límites; total `monto × meses`; fecha inicial y objetivo opcionales; ningún
campo financiero avanzado visible o requerido.

### HU-32 — Crear proyección simple anual (`P0`)

Quiero indicar un monto por año y cualquier cantidad válida de años para
calcular el acumulado de aportes.

Criterios: periodicidad `YEARLY`; total exacto sin rendimiento; agregar o quitar
periodos actualiza la cantidad y el total.

### HU-33 — Activar o desactivar proyección avanzada (`P0`)

Quiero usar un interruptor claramente rotulado para incorporar detalles
financieros solo cuando los necesite.

Criterios: **Usar proyección avanzada** está desactivado al crear; activarlo
conserva datos básicos; desactivarlo con datos avanzados advierte qué dejará de
influir, exige confirmación y no borra la revisión previa.

### HU-34 — Planificar importes diferentes por periodo (versión futura)

Quiero variar el importe de periodos concretos sin confundir lo planeado con lo
realmente ahorrado.

Criterios futuros: lista de aportes planificados identificados por índice de
periodo; total igual a su suma; ningún elemento crea un `SavingsMovement`. Esta
historia está expresamente fuera del MVP.

## Rendimiento

### HU-04 — Proyectar sin rendimiento (`P0`)

Quiero elegir “Sin rendimiento” para que la trayectoria use tasa cero y no
invente intereses.

Criterios: rendimiento estimado exacto cero; aportes siguen calculándose.

### HU-05 — Ingresar E.A. (`P0`)

Quiero registrar una tasa E.A. con vigencia y condiciones básicas para simular
el crecimiento.

Criterios: conserva valor original; calcula equivalencia canónica; no divide
entre doce; muestra fórmula y advertencia.

### HU-06 — Ingresar otra tasa (`P0`)

Como persona que conoce la expresión exacta, quiero configurar E.M., efectiva
trimestral/semestral o nominal vencida con capitalización.

Criterios: solo tipos aprobados; datos requeridos por tipo; equivalencia
reproducible; original intacto.

### HU-07 — Declarar incertidumbre (`P0`)

Como persona que desconoce el tipo, quiero seleccionar “No estoy seguro” y
saber qué buscar sin recibir un cálculo engañoso.

Criterios: conversión bloqueada; lista de campos; borrador opcional; resultado
marca rendimiento pendiente; no sustituye silenciosamente por cero.

### HU-08 — Configurar tasa avanzada (`P0`)

Quiero indicar periodicidad, capitalización, anticipada/vencida,
fija/variable, vigencia, base de días y fuente.

Criterios: campos dependientes; nominal incompleta rechazada; anticipada
incompleta rechazada; fuente opcional; fecha de consulta separada.

### HU-09 — Cambiar tasa hacia adelante (`P0`)

Quiero agregar periodos cuando la tasa cambie para no modificar rendimientos
reales ni supuestos históricos.

Criterios: inicio inclusivo/fin exclusivo; sin superposición; hueco bloqueado
salvo cero explícito; periodos anteriores inmutables.

### HU-10 — Configurar producto (`P0`)

Quiero distinguir cuenta flexible de plazo fijo para no simular aportes o
retiros imposibles.

Criterios: el producto no infiere tasa; plazo fijo simple rechaza flujos
intermedios; condición no soportada se explica.

## Registro real

### HU-11 — Registrar aporte (`P0`)

Quiero registrar cuánto ahorré realmente y en qué fecha.

Criterios: el ingreso no se suma; fecha civil; importe positivo; saldo
recalculado; duplicado detectable.

### HU-12 — Registrar aporte extraordinario (`P0`)

Quiero separar un aporte no programado del aporte periódico.

Criterios: tipo distinto; aparece en desglose; aumenta saldo real.

### HU-13 — Registrar rendimiento real (`P0`)

Quiero anotar el rendimiento que efectivamente recibí.

Criterios: no lo reemplaza una tasa estimada; separado de aportes; conserva
fecha y nota opcional.

### HU-14 — Registrar retiro (`P0`)

Quiero registrar dinero retirado para conocer el saldo real.

Criterios: resta saldo; rechazo si excede saldo; rechazo si producto no permite;
aparece separado.

### HU-15 — Registrar ajuste (`P0`)

Quiero corregir una diferencia excepcional dejando explicación.

Criterios: importe distinto de cero; nota obligatoria; historial visible.

### HU-16 — Corregir o anular (`P0`)

Quiero corregir un movimiento sin borrar lo que ocurrió.

Criterios: revisión o anulación lógica; motivo; cierres afectados pasan a
obsoletos; no doble conteo.

## Proyección y comparación

### HU-17 — Ver proyección original (`P0`)

Quiero ver aportes, retiros planificados, rendimiento bruto y saldo para
entender la trayectoria definida.

Criterios: resultado reproducible; desglose no solo gráfico; tasa/configuración
identificables; advertencia visible.

### HU-18 — Cerrar un periodo real (`P0`)

Quiero confirmar un corte del historial para continuar la meta desde datos
reales.

Criterios: totales conciliados; digest de movimientos; cierre invalidable, no
reescrito; versión del motor.

### HU-19 — Ver proyección actualizada (`P0`)

Quiero continuar desde el último cierre válido para ajustar expectativas sin
cambiar la proyección original.

Criterios: saldo real como base; solo supuestos futuros; indica corte.

### HU-20 — Comparar plan y realidad (`P0`)

Quiero comparar aportes, retiros, rendimientos y saldo a una misma fecha.

Criterios: diferencias por concepto; avance; adelantado/al día/retrasado;
gráfica acompañada de texto.

### HU-21 — Ver meta alcanzada o vencida (`P0`)

Quiero saber si alcancé el objetivo o si venció sin alcanzarlo.

Criterios: estados distintos; no promete cumplimiento; permite seguir,
completar o revisar.

## Datos y continuidad

### HU-22 — Usar sin conexión (`P0`)

Quiero crear, registrar y consultar sin internet.

Criterios: flujos principales no hacen solicitudes remotas; no exige cuenta.

### HU-23 — Exportar copia completa (`P0`)

Quiero crear un JSON portable para cambiar de celular.

Criterios: versión, metas, revisiones, movimientos, tasas originales y
equivalentes, modo de proyección y configuración simple; checksum de daño
accidental; advertencia en proyecciones; sin secretos.

### HU-24 — Previsualizar importación (`P0`)

Quiero revisar metas, movimientos, fechas y versión antes de reemplazar.

Criterios: límites previos; esquema cerrado; no ejecuta contenido; archivo
inválido no modifica datos.

### HU-25 — Reemplazar con recuperación (`P0`)

Quiero importar después de un respaldo automático para recuperar el estado
anterior si algo falla.

Criterios: confirmación; transacción; verificación; rollback; no combinación
automática.

### HU-26 — Atender corrupción (`P0`)

Quiero conservar mis archivos y recibir opciones si la base falla.

Criterios: no reinicialización silenciosa; escritura peligrosa bloqueada;
exportación/recuperación cuando sea posible; error sin traza interna.

## Accesibilidad, privacidad e información

### HU-27 — Comprender advertencias (`P0`)

Quiero saber qué no incluye la estimación.

Criterios: texto obligatorio en tasa, resultados, exportaciones con proyección
e Información.

### HU-28 — Usar ayudas de accesibilidad (`P0`)

Quiero usar texto ampliado, lector de pantalla, modo oscuro y reducción de
movimiento.

Criterios: controles etiquetados; objetivos táctiles; contraste; información
no depende de color o gráfica.

### HU-29 — Conocer la protección real (`P0`)

Quiero saber que el almacenamiento y las copias iniciales no están cifrados.

Criterios: lenguaje claro; no se afirma seguridad absoluta; no se guardan
credenciales bancarias.

### HU-30 — Bloqueo biométrico futuro (`P1`)

Quiero poder proteger la apertura de la aplicación cuando exista una solución
probada.

Criterios: no forma parte del MVP; no cifra por sí mismo; requiere evaluación
de plataforma y recuperación.

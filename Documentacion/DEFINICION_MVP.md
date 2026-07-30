# Definición del MVP

Fecha: 30 de julio de 2026. Estado: propuesta de Fase 1 para revisión.

## Problema

Una persona puede definir cuánto desea ahorrar, pero suele perder la relación
entre el plan, lo que realmente apartó y el rendimiento que recibió. Las
calculadoras simples confunden ingreso con ahorro, tratan una tasa anual como si
fuera mensual o sustituyen el historial cuando cambian los supuestos.

## Público objetivo

Personas en Colombia, especialmente sin formación financiera, que desean
planear y registrar una o varias metas con datos locales y sin conectar una
cuenta bancaria. La moneda inicial es COP.

## Propuesta de valor

Una aplicación móvil local que explique lo necesario, conserve los datos
originales y muestre por separado:

1. proyección original;
2. ahorro real confirmado;
3. proyección actualizada desde el último corte real válido;
4. comparación proyectado frente a real.

La aplicación registra y simula; no mueve dinero, no consulta bancos, no
garantiza resultados ni recomienda productos.

Cada meta se crea en un único flujo con dos niveles de complejidad:
**Proyección simple**, predeterminada, y **Proyección avanzada**, habilitada
mediante un interruptor visible. No son productos ni pantallas duplicadas.

## Alcance incluido

- varias metas con nombre, descripción, objetivo, fecha/plazo, saldo inicial,
  estado, icono/color y orden;
- proyección simple mensual o anual con importe periódico, número libre de
  periodos válidos, total acumulado y posibilidad de agregar o quitar periodos,
  sin exigir tasa, producto, saldo inicial, retiros ni seguimiento real;
- aportes semanales, quincenales, mensuales y anuales; regla personalizada solo
  si queda cerrada antes de implementación;
- aportes extraordinarios, rendimientos reales, retiros y ajustes explicados;
- libro real con revisiones y anulación lógica;
- tasa cero y configuraciones validadas de
  [`TIPOS_Y_CONVERSIONES_DE_TASAS.md`](TIPOS_Y_CONVERSIONES_DE_TASAS.md);
- periodos de tasa conocidos, vigentes hacia adelante y sin superposición;
- cuenta/depósito flexible y depósito a término simple dentro de los límites
  documentados;
- trayectoria, aportes netos, rendimiento bruto estimado, saldo y fecha
  estimada;
- cierres reales, proyección actualizada y comparación por periodo;
- interfaz sencilla/avanzada y opción **No estoy seguro** sin conversión;
- almacenamiento local SQLite, migraciones, exportación JSON e importación por
  reemplazo seguro en fases posteriores;
- funcionamiento sin conexión y sin cuenta;
- Android como plataforma de validación primaria e iOS cuando el stack y las
  dependencias lo permitan.

## Alcance excluido

- conceptos o calendarios específicos de educación formal;
- presupuesto integral, nómina o suma de ingresos como ahorro real;
- cálculo de impuestos, retenciones, inflación, comisiones o GMF;
- rendimiento neto o garantía de cumplimiento;
- conexión bancaria, consulta de saldo, transferencia o movimiento de dinero;
- recomendación de banco, inversión o tratamiento tributario;
- tasas actuales precargadas, actualización automática o scraping;
- productos indexados, escalonados, con penalizaciones complejas o negociación
  secundaria;
- criptografía propia, cifrado superficial o promesa de seguridad absoluta;
- sincronización en nube, cuentas de usuario y combinación automática de
  historiales;
- múltiples monedas y conversión de divisas en el MVP.

## Modelos de producto

| Modelo | Aportes | Retiros | Rendimiento | Estado MVP |
|---|---|---|---|---|
| Sin rendimiento | Sí | Sí, hasta saldo | Cero | Completo |
| Flexible remunerado | Sí | Sí, según regla | Tasa/periodos completos | Completo |
| Depósito de ahorro | Según contrato | Según contrato | Solo con datos completos | Como configuración flexible |
| Plazo fijo simple | Solo capital inicial | No antes de vencer | Fija, al vencimiento | Acotado |
| Personalizado | Según configuración | Según configuración | Solo reglas aprobadas | Acotado |
| Indexado/condicional | Variable | Variable | Índice o escala futura | Fuera |

Una etiqueta comercial nunca selecciona el modelo ni la tasa por sí sola.

## Niveles de proyección

### Proyección simple — predeterminada

Responde “¿cuánto acumulo si ahorro este monto durante esta cantidad de
periodos?” sin pedir conocimientos financieros.

Datos mínimos:

- `periodicAmount`;
- `periodicity`: mensual o anual;
- `numberOfPeriods`: entero escrito libremente, no limitado a opciones
  predefinidas;
- `startDate`: opcional;
- nombre de la meta; objetivo monetario opcional.

El total es `periodicAmount × numberOfPeriods`. Sin tasa no existe rendimiento:
el crecimiento corresponde únicamente a la suma de aportes. Saldo inicial,
producto financiero, retiros y configuración de tasa no aparecen ni son
obligatorios.

Agregar o quitar un periodo cambia `numberOfPeriods` y recalcula el total. El
MVP usa el mismo importe en todos los periodos. Los importes diferentes quedan
fuera del MVP; una futura versión podrá diseñarlos como aportes planificados
separados, nunca como movimientos reales.

Los límites aprobados son de 1 a 1.200 meses y de 1 a 100 años.

### Proyección avanzada — activación explícita

El mismo formulario muestra el interruptor **Usar proyección avanzada**,
desactivado por defecto. Al activarlo conserva nombre, importe, periodicidad,
número de periodos y fecha ya ingresados, y habilita progresivamente saldo
inicial, rendimiento, movimientos, seguimiento real, comparación y producto.

Las secciones avanzadas incluyen:

- saldo inicial;
- tasa, tipo, periodicidad y capitalización;
- tasa fija/variable y cambios fechados;
- aportes extraordinarios y retiros;
- rendimiento estimado y real;
- cierres, proyección actualizada y comparación;
- configuración del producto financiero.

Desactivarlo con datos avanzados requiere advertencia. Si el usuario confirma,
se crea una revisión simple que ignora esos campos en el cálculo, pero los
datos avanzados permanecen en la revisión anterior o borrador recuperable; no
se eliminan silenciosamente.

## Configuración de rendimiento dentro de la proyección avanzada

### Captura sencilla de tasa

1. **Sin rendimiento:** tasa cero explícita.
2. **Tengo una tasa E.A.:** valor, vigencia y preguntas básicas del producto.
3. **Tengo otro tipo de tasa:** deriva al modo avanzado.
4. **No estoy seguro:** guarda borrador opcional, lista datos a buscar y no
   calcula rendimiento.

El texto de ayuda indicará dónde revisar: contrato, certificado, tarifario,
detalle del producto o aplicación de la entidad. Pedirá abreviatura exacta,
capitalización, anticipada/vencida, vigencia, base de días y pago.

### Captura avanzada de tasa

Valor, tipo, periodicidad, capitalización, anticipada/vencida, fija/variable,
fecha de vigencia, base de días, fecha de consulta, fuente y condiciones de
disponibilidad, aportes, retiros, vencimiento y pago.

## Reglas funcionales esenciales

- Una meta nueva inicia en `SIMPLE`; las opciones avanzadas no bloquean su
  guardado.
- La meta simple no muestra rendimiento distinto de cero ni conceptos de
  producto.
- Activar `ADVANCED` conserva y reutiliza los campos básicos compatibles.
- Desactivar `ADVANCED` nunca borra datos y exige confirmación si dejan de
  influir supuestos o movimientos avanzados.
- El ingreso mensual puede sugerir un aporte, pero nunca aumenta el saldo real.
- Solo movimientos confirmados construyen el ahorro real.
- El rendimiento real registrado prevalece sobre la estimación.
- Una edición de supuestos crea una revisión y una proyección nueva.
- Una tasa nueva solo afecta desde su vigencia.
- Huecos y superposiciones de tasas son errores, salvo cero explícito.
- Un retiro no puede superar el saldo en el MVP.
- Un ajuste requiere observación.
- Un producto a término simple rechaza aportes y retiros intermedios.
- La meta completada conserva historial; archivarla no elimina datos.
- Fechas civiles no cambian al viajar o cambiar zona horaria.
- Los valores se calculan con decimal y se redondean solo según política
  documentada.

## Flujos principales

### Crear una meta

Inicio → Nueva meta → nombre → importe periódico → mes/año → cantidad de
periodos → total → guardar.

En el mismo flujo, **Usar proyección avanzada** abre de forma progresiva
objetivo, fechas detalladas, saldo inicial, aportes, rendimiento y condiciones
del producto. No se navega a otra aplicación ni se pierde lo ya escrito.

### Registrar realidad

Inicio/Detalle → Registrar → tipo → monto/fecha/nota → validación de producto y
saldo → confirmar → recalcular saldo real y marcar cierres afectados.

### Cambiar supuestos

Detalle → Configuración → crear revisión → definir vigencia → previsualizar
impacto futuro → explicar motivo → confirmar. El histórico no cambia.

### Comparar

Detalle → Proyectado vs. real → elegir corte → resumen textual y por periodos →
abrir diferencias.

### Respaldo

Configuración y datos → Exportar → validar/construir → compartir archivo.
Importar → seleccionar → validar → resumen → respaldo automático → confirmar
reemplazo → transacción → verificar o restaurar.

## Navegación

La navegación detallada está en
[`MAPA_DE_NAVEGACION.md`](MAPA_DE_NAVEGACION.md). La barra principal prioriza
Inicio, Metas, Registrar y Datos; Proyección y Comparación viven dentro de cada
meta para no convertir cada campo en una pantalla.

## Datos y arquitectura futura

El modelo conceptual está en [`MODELO_DE_DATOS.md`](MODELO_DE_DATOS.md). La
arquitectura prevista mantiene:

```text
Presentación móvil → Casos de uso → Dominio financiero → Repositorios
                                                        ↓
                                                SQLite / archivos
```

Fase 1 no crea estas capas ni instala dependencias.

## Seguridad y privacidad del producto

Datos locales: metas, importes, movimientos, supuestos, tasas, resultados,
revisiones y preferencias. Nunca se almacenan credenciales bancarias, tokens,
contraseñas, tarjetas ni secretos.

Riesgos principales:

- pérdida o acceso al celular;
- SQLite sin cifrado inicial;
- copia JSON expuesta;
- importación manipulada o enorme;
- corrupción, falta de espacio o cierre durante escritura;
- dependencias vulnerables y logs excesivos.

Controles previstos: esquemas cerrados, límites antes y después de parsear,
decimales finitos, consultas parametrizadas, transacciones, respaldo previo,
migraciones, rollback, nombres de archivo saneados, ausencia de código dinámico
y logs sin estado financiero. El checksum detectará daño accidental; no será
firma ni prueba de autenticidad.

Biometría, PIN local y cifrado son evaluaciones posteriores; no se simulará
protección con criptografía casera.

## Accesibilidad y experiencia

- objetivo táctil mínimo de 44×44 puntos equivalentes;
- etiquetas para lector de pantalla y orden de foco;
- texto ampliado sin cortar importes ni acciones;
- claro/oscuro con contraste suficiente;
- teclado numérico con alternativa accesible;
- gráficas acompañadas de resumen textual;
- estados vacíos útiles y errores accionables;
- confirmación para archivar, anular e importar;
- reducción de movimiento;
- pantallas pequeñas y uso con una mano cuando sea posible.

## Casos límite prioritarios

- proyección simple mensual/anual, un periodo y máximo permitido;
- activar avanzada con datos básicos; desactivarla con datos avanzados;
- meta simple sin fecha inicial u objetivo monetario;
- cero/sin tasa; tasa decimal, nominal incompleta, anticipada incompleta;
- periodos superpuestos, huecos, cambios y año bisiesto;
- aporte cero, omitido, extraordinario o tardío;
- retiro excesivo o prohibido;
- objetivo alcanzado o vencido;
- fecha final inválida y plazo de un periodo;
- varias metas y moneda no soportada;
- negativos, no finitos, excesos y duplicados;
- archivo corrupto, profundo, grande, antiguo migrable o futuro incompatible;
- base dañada, falta de espacio, interrupción y cambio de reloj/zona.

## Advertencia

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

## Riesgos y dependencias de decisión

- La precisión frente a contratos depende de que el usuario transcriba todos
  los datos correctos.
- La modalidad personalizada puede crecer sin control; debe permanecer cerrada
  a reglas enumeradas.
- Los códigos exactos de 360/360, 365/365, real/real y ACT/365, los límites de
  archivo y la tolerancia de equivalencias deben aprobarse antes de codificar.
- El soporte iOS debe validarse con las librerías seleccionadas.
- SQLite y los respaldos no estarán cifrados en el primer alcance salvo una
  decisión técnica posterior.

Las opciones abiertas están en
[`DECISIONES_PENDIENTES.md`](DECISIONES_PENDIENTES.md).

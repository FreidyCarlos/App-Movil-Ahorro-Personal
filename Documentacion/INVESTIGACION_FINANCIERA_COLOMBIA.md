# Investigación financiera para Colombia

Fecha de consulta: **30 de julio de 2026**.

## Propósito y método

Esta investigación define vocabulario, datos mínimos y límites de simulación
para una aplicación de metas de ahorro. No compara entidades, no recomienda
productos y no incorpora tasas vigentes como valores predeterminados.

Se priorizaron la Superintendencia Financiera de Colombia (SFC), el Banco de la
República y el Gestor Normativo de Función Pública. Las páginas de entidades
vigiladas se usaron únicamente para comprobar cómo se describen condiciones
comerciales que varían entre productos.

Cuando una fuente no indica una fecha de vigencia, se registra **no indicada**;
la fecha de consulta no se presenta como fecha de vigencia.

## Hallazgos aplicables al producto

### Tasas nominales, efectivas, anticipadas y vencidas

| Fuente oficial | Vigencia indicada | Definición en lenguaje sencillo | Implicación para la aplicación |
|---|---|---|---|
| [Glosario de tasas de la SFC](https://www.superfinanciera.gov.co/publicaciones/13243/glosario-t-13243/) | No indicada | Una tasa nominal expresa pagos periódicos sin incorporar su reinversión; una efectiva incorpora capitalización. Una tasa anticipada se paga o cobra al inicio y una vencida al final del periodo. | No se pueden tratar como equivalentes. Deben guardarse valor, tipo, periodo, capitalización y modalidad originales. |
| [Finanzas para no financieros, Banco de la República](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/10292/Finanzasparanofinancieros.pdf?isAllowed=y&sequence=1) | Publicación académica de 2013; sin vigencia normativa | Explica tasas periódicas, nominales, efectivas, anticipadas, vencidas y sus conversiones matemáticas. Una nominal requiere número de periodos por año y modalidad. | Es la fuente principal de las fórmulas de normalización. El motor bloqueará una nominal incompleta. |
| [Simulador de conversión de tasas de la SFC](https://www.superfinanciera.gov.co/publicaciones/61554/consumidor-financieroinformacion-generalsimulador-de-conversion-de-tasas-de-interes-61554/) | Página modificada el 8 de julio de 2025 | La SFC distingue conversiones E.A., nominal mensual y nominal diaria. | Confirma que una tasa anual no se divide entre doce cuando se busca una tasa efectiva mensual. |
| [Documento de conversión E.A. a mensual de la SFC](https://www.superfinanciera.gov.co/publicaciones/18136/documento-sin-t-iacute-tulo-18136/) | Documento histórico; página modificada en 2012 | Presenta la relación efectiva mensual `((1 + i_EA)^(1/12)) - 1`. | La fórmula se puede aprobar, con prueba independiente y sin usar aproximaciones lineales. |

La E.A. es útil como tasa canónica de comparación, pero no reemplaza el dato
publicado por la entidad. Dos expresiones equivalentes pueden producir la misma
E.A. y seguir necesitando sus metadatos originales para auditoría.

### Cuentas, depósitos y disponibilidad

| Fuente oficial | Vigencia indicada | Hallazgo | Implicación |
|---|---|---|---|
| [Preguntas frecuentes de cuentas y depósitos electrónicos, SFC](https://www.superfinanciera.gov.co/preguntas-frecuentes/9/9-cuentas-y-depositos-electronicos/) | Remite a Ley 1793 de 2016 | Las cuentas de ahorro reconocen una tasa remuneratoria mínima y el cliente puede disponer del total sin saldo mínimo. | “Cuenta sin rendimiento” será un modelo de simulación manual o dinero fuera de una cuenta remunerada; no se afirmará que describe toda cuenta de ahorro colombiana. |
| [Guías informativas del sistema financiero, SFC](https://www.superfinanciera.gov.co/publicaciones/11238/guas-informativas-11238/) | No indicada | Diferencia depósitos a la vista, como cuentas de ahorro, y depósitos a término. | La disponibilidad debe pertenecer a la configuración del producto y no a la tasa. |
| [Decreto 2555 de 2010 consolidado, Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?2555=&i=40032) | Texto consolidado consultado el 30 de julio de 2026; límites modificados por Decreto 2642 de 2022 | El depósito de bajo monto es un depósito a la vista para persona natural, asociado a mecanismos de transferir fondos o retirar. Su contrato determina canales y si reconoce intereses. | “Bajo monto” es una categoría regulatoria, no una fórmula de rendimiento. La aplicación no aplicará topes regulatorios ni inferirá tasa por la etiqueta. |
| [Concepto de depósitos de bajo monto y ordinarios, SFC](https://www.superfinanciera.gov.co/publicaciones/10110759/) | Concepto de 2022 | Los presenta como depósitos a la vista y transaccionales, diferentes de cuentas de ahorro y corrientes. | Se pueden describir como producto flexible, pero la simulación depende de las condiciones efectivamente informadas. |

El límite regulatorio de los depósitos de bajo monto está expresado actualmente
en UVT y puede cambiar. No es necesario para proyectar una meta y no se
codificará como constante del MVP.

### CDT y depósitos a término

| Fuente | Vigencia indicada | Hallazgo | Implicación |
|---|---|---|---|
| [Concepto sobre CDT, SFC](https://www.superfinanciera.gov.co/publicaciones/38808/jurdico-de-38808/) | Boletín 05 de junio de 2003; fuente histórica | Un depósito a término exige esperar el plazo o preaviso para pedir devolución. El CDT mantiene los recursos hasta la fecha pactada y puede renovarse. | Un producto a término no puede simularse como una cuenta con retiros o aportes libres. |
| [Características de CDT, SFC](https://www.superfinanciera.gov.co/publicaciones/18580/) | Concepto histórico de 2001 | Señala la irredimibilidad antes del vencimiento y la posible prórroga si no se redime. | El MVP rechazará retiros antes de vencimiento para su modalidad simple de depósito a término. No simulará venta o negociación del título. |
| [Resolución 514 de 2002, SFC](https://www.superfinanciera.gov.co/publicaciones/1075/) | 2002 | La divulgación de tasas debe acompañarse de condiciones de pago de capital e intereses, E.A. equivalente y convención usada. | La tasa sola no basta: se guardarán pago, capitalización, base de días y fuente. |
| [Ejemplo oficial de CDT físico, Bancolombia](https://www.bancolombia.com/personas/productos-servicios/inversiones/cdts/fisicos/seguro-fogafin) | Condiciones visibles el 30 de julio de 2026 | Muestra variantes capitalizables y no capitalizables, pago al vencimiento y base de liquidación de 360 días. | Prueba que “CDT” no determina una única mecánica. El MVP solo soportará el caso simple expresamente configurado. No se copian tasas publicadas. |
| [Ejemplo oficial de CDT desmaterializado, Valores Bancolombia](https://valores.bancolombia.com/productos-servicios/renta-fija/cdt-desmaterializado) | Condiciones visibles el 30 de julio de 2026 | Describe tasa fija o variable y pagos periódicos o al vencimiento, incluso tasas indexadas. | Las tasas indexadas y pagos periódicos complejos quedan fuera del MVP hasta definir fuentes y reglas verificables. |

La modalidad de CDT aprobada para el MVP es deliberadamente estrecha: capital
inicial único, tasa fija conocida, plazo y base de días explícitos, sin aportes
ni retiros, capitalización y pago al vencimiento. Cualquier condición distinta
se mostrará como no soportada.

### Nombres comerciales: bolsillos, cajitas y similares

| Fuente de entidad | Vigencia indicada | Observación | Implicación |
|---|---|---|---|
| [Bolsillos Bancolombia](https://www.bancolombia.com/personas/bolsillos) | Contenido consultado el 30 de julio de 2026 | El dinero de un bolsillo forma parte del saldo total de la cuenta de ahorro y puede cargarse o descargarse. | “Bolsillo” es una función comercial de organización, no un tipo de tasa ni una categoría financiera general. |
| [Cuenta Nu y Cajitas](https://nu.com.co/cf/cuenta) | Contenido consultado el 30 de julio de 2026 | La entidad usa “Cajitas” como nombre comercial y comunica rendimiento mediante E.A. y acreditación descrita por el producto. | El nombre no debe seleccionar automáticamente tasa, capitalización o disponibilidad. No se incorpora el valor publicado. |
| [Características de bolsillos, Lulo Bank](https://ayuda.lulobank.com/hc/es/articles/28625884138772--Cu%C3%A1les-son-las-caracter%C3%ADsticas-de-los-bolsillos-y-su-rendimiento) | Contenido consultado el 30 de julio de 2026 | La página indica que la tasa puede variar con condiciones de mercado. | Una tasa anunciada hoy no se puede convertir en predeterminado permanente; se modela con periodos de vigencia. |

Estos nombres pueden aparecer únicamente como ejemplos de dónde buscar la
información del producto. La taxonomía interna será neutral.

### Tasa fija, variable e indexada

El material del Banco de la República distingue tasas fijas, variables e
indexadas. Además, el [IBR publicado por el Banco de la
República](https://www.banrep.gov.co/es/glosario/indicador-bancario-referencia-ibr)
se informa con tasa nominal, efectiva y días calendario reales para varios
plazos; su ficha metodológica versión 4 fue actualizada el 13 de mayo de 2026.

Implicaciones:

- una tasa fija conserva su valor durante el periodo pactado;
- una tasa variable conocida se representa mediante periodos fechados;
- una tasa indexada futura exige el valor del índice, margen, calendario,
  fuente y reglas de reajuste;
- el MVP no proyectará automáticamente índices futuros ni consultará servicios
  remotos;
- una tasa variable sin valores futuros solo permite proyectar con un supuesto
  explícito, identificado como escenario, nunca como tasa confirmada.

### Convención de días, capitalización y pago

No existe una base universal que la aplicación pueda inferir:

- el Banco de la República publica IBR con días calendario reales;
- el ejemplo de CDT físico consultado declara base 360;
- la [Resolución 514 de 2002 de la
  SFC](https://www.superfinanciera.gov.co/publicaciones/1075/normativahistorico-normas-de-las-anteriores-superintendencias-bancaria-y-de-valores-historico-boletin-minhacienda-capitulo-superintendencia-de-valoresanos-anterioresresolucion-de-1075/),
  expedida el 26 de julio de 2002 y vigente desde el 1 de octubre de 2002,
  enumera para los valores a los que aplica las convenciones 360/360, 365/365 y
  real/real, y exige revelar la convención;
- una tasa puede capitalizar diariamente, mensualmente o al vencimiento;
- pagar rendimiento y capitalizarlo no significan lo mismo: un pago retirado no
  aumenta el principal; un rendimiento capitalizado sí.

Por tanto, el modelo exige `dayCountConvention`, `creditingFrequency`,
`capitalizationFrequency` y `yieldPaymentDestination` cuando afecten el
cálculo. Las bases aprobadas inicialmente son:

- `DAYS_360_360`: año de 360 y meses de 30 días;
- `DAYS_365_365`: año de 365; meses calendario excepto febrero de 28 días,
  conforme a la definición de la Resolución 514;
- `ACT_ACT`: días calendario reales sobre 365 o 366 según el segmento anual;
- `ACT_365`: solo si el producto publica expresamente días reales/365; no es un
  predeterminado;
- `PRODUCT_DEFINED`: bloquea el cálculo hasta registrar una regla soportada.

No se deduce una base a partir de que la tasa diga “diaria” o “base 360”.

### Presentación oficial de tasas actuales

La [consulta de tasas pasivas de la
SFC](https://www.superfinanciera.gov.co/Superfinanciera-Tasas/faces/generic/passiveInterestRates.xhtml),
consultada el 30 de julio de 2026 y con corte visible al 28 de julio de 2026,
publica E.A. para cuentas de ahorro y CDT. Su utilidad para el diseño es
confirmar que la E.A. funciona como unidad de comparación y que los valores
tienen fecha de corte. No se copió ninguna tasa ni se usará como
predeterminada.

### Redondeo

Las fuentes consultadas demuestran que las convenciones de liquidación pueden
variar por producto, pero no fijan una política universal de redondeo para esta
aplicación. Decisión de diseño:

- conservar tasas y resultados intermedios como decimales, nunca como punto
  flotante binario;
- usar al menos 28 dígitos significativos en el motor;
- no redondear cada día ni cada movimiento salvo que el contrato lo exija;
- mostrar COP al peso con `HALF_UP`, sin alterar el valor interno;
- registrar en cada cierre el valor preciso, el valor consolidado y la versión
  de la política;
- el rendimiento real digitado prevalece sobre cualquier redondeo estimado.

Esta política es de la aplicación, no una afirmación sobre la liquidación de
una entidad.

## Información mínima para interpretar una tasa

Una conversión queda bloqueada si falta cualquiera de los datos aplicables:

1. valor numérico y unidad porcentual;
2. tipo: efectiva, nominal o periódica;
3. periodo al que se refiere;
4. frecuencia de capitalización o número de periodos por año para nominales;
5. anticipada o vencida;
6. fecha inicial de vigencia;
7. fija o variable;
8. convención de días cuando el cálculo use días;
9. regla de pago/capitalización del producto;
10. fuente y fecha de consulta, recomendadas para trazabilidad;
11. fecha final, vencimiento o siguiente revisión cuando exista.

El nombre del producto o de la entidad nunca completa silenciosamente estos
datos.

## Tipos y productos aprobados para el MVP

### Aprobados

- sin rendimiento, tasa canónica cero;
- cuenta o depósito flexible con tasa efectiva conocida y reglas explícitas;
- tasas E.A., E.M., efectiva trimestral y efectiva semestral;
- nominal anual mes vencido y trimestre vencido;
- nominal anual vencida genérica con capitalizaciones por año explícitas;
- normalización matemática de nominal anual anticipada cuando la frecuencia
  está completa; no implica simular un pago anticipado del producto;
- periodos de tasa fija o variable ya conocidos y no superpuestos;
- capitalización diaria, mensual o al vencimiento solo con convención
  compatible y reglas completas;
- depósito a término simple con capital único, tasa fija y pago al vencimiento.

### Fuera del MVP o bloqueados

- tasas negativas;
- nominales sin periodicidad;
- anticipadas sin frecuencia o sin modalidad;
- tasas indexadas a IBR, DTF, IPC, UVR u otro índice futuro;
- tasas escalonadas por saldo;
- penalizaciones, cancelación anticipada o venta secundaria de CDT;
- renovación automática proyectada sin condiciones de la nueva vigencia;
- pagos periódicos retirados y reinversión externa;
- rendimiento fijo estimado sin tasa, hasta definir su semántica;
- combinación de bases o fórmulas no documentadas por el producto.

## Diseño para una persona no experta

### Modo sencillo

- **Sin rendimiento:** calcula solo aportes y retiros.
- **Tengo una tasa E.A.:** solicita valor, fecha de vigencia y reglas básicas
  del producto.
- **Tengo otro tipo de tasa:** abre la configuración avanzada.
- **No estoy seguro:** no calcula rendimiento. Explica que debe buscar la
  abreviatura de la tasa, si es nominal o efectiva, periodicidad, anticipada o
  vencida, capitalización, fecha de vigencia y condiciones de retiro/aporte.

La última opción puede guardar un borrador y mostrar una proyección de aportes
con rendimiento “pendiente”, pero nunca asume cero como si fuera la tasa real ni
inventa una conversión.

### Modo avanzado

Expone valor, tipo, periodo, capitalización, modalidad anticipada/vencida,
fija/variable, vigencia, base de días y condiciones del producto. Cada error
debe explicar el dato faltante y dónde suele aparecer en un contrato,
certificado, tarifario o detalle de producto.

## Limitaciones de la investigación

- Las condiciones contractuales pueden variar entre entidades y cambiar
  después de la consulta.
- Las páginas comerciales se usaron como ejemplos de presentación, no como
  definición normativa.
- No se validó una fórmula universal para productos indexados, escalonados o
  con cancelación anticipada; quedan fuera.
- No se investigaron impuestos, retenciones, inflación, comisiones ni GMF para
  cálculo porque están excluidos del MVP.
- No habrá actualización automática de tasas ni extracción de páginas.

## Advertencia obligatoria

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

# Tipos y conversiones de tasas

Estado: definición aprobada para el MVP, 30 de julio de 2026.

## Principio de conservación

Una normalización nunca reemplaza la entrada. `InterestRateDefinition` conserva
el valor y tipo originales, periodo, capitalización, modalidad, vigencia,
fuente y fecha de consulta, junto con la equivalencia calculada, fórmula,
precisión y versión del motor.

La tasa canónica será una **tasa efectiva anual decimal** (`effectiveAnnualRate`)
acompañada de la convención de días y de las reglas de capitalización del
producto. La E.A. permite comparar y convertir, pero por sí sola no describe
cuándo se acredita el rendimiento ni si puede retirarse o reinvertirse.

## Catálogo de entrada

| Código | Nombre | Datos indispensables | Estado MVP |
|---|---|---|---|
| `ZERO` | Sin rendimiento | vigencia | Aprobado |
| `EA` | Efectiva anual | valor, vencida, vigencia | Aprobado |
| `EM` | Efectiva mensual | valor, vencida, vigencia | Aprobado |
| `ET` | Efectiva trimestral | valor, vencida, vigencia | Aprobado |
| `ES` | Efectiva semestral | valor, vencida, vigencia | Aprobado |
| `NOMINAL_ANNUAL_DUE` | Nominal anual vencida genérica | valor y periodos de capitalización por año | Aprobado |
| `NMV` | Nominal anual mes vencido | valor, 12 capitalizaciones/año | Aprobado |
| `NTV` | Nominal anual trimestre vencido | valor, 4 capitalizaciones/año | Aprobado |
| `NOMINAL_ANNUAL_ADVANCE` | Nominal anual anticipada | valor y periodos/año | Conversión aprobada; simulación de pago anticipado no aprobada |
| `CUSTOM_EFFECTIVE_PERIODIC` | Efectiva periódica personalizada | valor, duración exacta del periodo, modalidad | Aprobado solo para periodos compatibles |
| `UNKNOWN` | No estoy seguro | texto opcional y fuente | Sin conversión ni rendimiento proyectado |
| `INDEXED` | Indexada | índice, margen, reset y fuente de valores | Fuera del MVP |
| `FIXED_AMOUNT` | Rendimiento fijo sin tasa | importe y reglas de pago | Pendiente |

Las tasas negativas se rechazan. El límite superior inicial propuesto es
`1000 %` por periodo original; superarlo requiere decisión explícita. Todo
valor debe ser decimal finito.

## Periodos compatibles

| Periodo | Periodos por año |
|---|---:|
| Anual | 1 |
| Semestral | 2 |
| Trimestral | 4 |
| Bimestral | 6 |
| Mensual | 12 |

La conversión diaria no utiliza esta tabla a ciegas: requiere `DAYS_360_360`,
`DAYS_365_365`, `ACT_ACT` o un `ACT_365` expresamente publicado. Semanal y
quincenal quedan pendientes porque su relación con meses y años no es exacta
sin calendario o convención.

## Reglas de validación

- Efectiva: requiere periodo; en el MVP es vencida.
- Nominal: requiere unidad base anual, capitalizaciones por año y modalidad.
- Anticipada: exige frecuencia y que la tasa de descuento periódica sea menor
  que 1.
- Variable: exige periodos fechados; no se inventan valores futuros.
- Periodos de tasa de una meta no pueden superponerse.
- Un espacio sin tasa bloquea rendimiento, salvo un periodo explícito `ZERO`.
- `UNKNOWN` conserva el borrador, muestra instrucciones y bloquea el cálculo de
  rendimiento.
- El producto no determina el tipo de tasa.
- La equivalencia se recalcula desde el original al cambiar la versión del
  motor, dejando revisión auditable.

## Fórmulas aprobadas

Las fórmulas completas, ejemplos y pruebas previstas están en
[`REGLAS_FINANCIERAS.md`](REGLAS_FINANCIERAS.md).

- efectivas equivalentes:
  `i_destino = (1 + i_origen)^(p_origen / p_destino) - 1`;
- nominal anual vencida:
  `i_periodica = j / n` y `EA = (1 + j/n)^n - 1`;
- nominal anual anticipada:
  `d_periodica = j / n`,
  `i_vencida = d_periodica / (1 - d_periodica)` y
  `EA = (1 - j/n)^(-n) - 1`;
- fracción anual efectiva:
  `i_intervalo = (1 + EA)^(fraccion_anual) - 1`.

No están permitidas estas aproximaciones:

- `EA / 12` como tasa efectiva mensual;
- `EM * 12` como E.A.;
- nominal igual a efectiva;
- capitalización mensual por defecto;
- anticipada tratada como vencida;
- convención 360/360, 365/365 o real/real inferida del nombre comercial.

## Tasa variable

Cada `YieldRatePeriod` lleva inicio inclusivo y fin exclusivo. El motor:

1. ordena por inicio;
2. rechaza superposiciones;
3. segmenta cada intervalo de cálculo en cambios de tasa y de año;
4. aplica solo la tasa vigente en cada segmento;
5. bloquea huecos no declarados;
6. no recalcula rendimientos reales confirmados.

Una tasa actualmente anunciada puede originar un nuevo periodo futuro, pero no
modifica periodos históricos. Una tasa sin fecha final puede cerrarse al crear
la siguiente, dejando revisión.

## Separación entre tasa y producto

`InterestRateDefinition` explica la expresión matemática.
`FinancialProductConfiguration` explica el comportamiento: disponibilidad,
aportes, retiros, plazo, vencimiento, capitalización, pago, renovación y base
de días.

Un CDT, una cuenta remunerada o un nombre comercial nunca rellenan campos de
tasa automáticamente.

## Fuentes

- [Glosario de tasas de la SFC](https://www.superfinanciera.gov.co/publicaciones/13243/glosario-t-13243/),
  consultado el 30 de julio de 2026; vigencia no indicada.
- [Simulador de conversión de la SFC](https://www.superfinanciera.gov.co/publicaciones/61554/consumidor-financieroinformacion-generalsimulador-de-conversion-de-tasas-de-interes-61554/),
  consultado el 30 de julio de 2026; página modificada el 8 de julio de 2025.
- [Finanzas para no financieros, Banco de la República](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/10292/Finanzasparanofinancieros.pdf?isAllowed=y&sequence=1),
  consultado el 30 de julio de 2026; publicación de 2013.
- [IBR, Banco de la República](https://www.banrep.gov.co/es/glosario/indicador-bancario-referencia-ibr),
  consultado el 30 de julio de 2026; metodología versión 4 actualizada el 13 de
  mayo de 2026.

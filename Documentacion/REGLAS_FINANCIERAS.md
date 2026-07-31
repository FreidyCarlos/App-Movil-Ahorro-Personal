# Reglas financieras

Versión de reglas: `finance-rules-1-draft`. Fecha: 30 de julio de 2026.

Estas reglas definen el comportamiento que deberá probarse antes de escribir el
motor. Los porcentajes se convierten a decimal antes de operar: `8,75 %` se
representa como `0.0875`.

Fuentes generales:

- [Finanzas para no financieros, Banco de la República](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/10292/Finanzasparanofinancieros.pdf?isAllowed=y&sequence=1),
  consultado el 30 de julio de 2026, publicación de 2013.
- [Glosario de tasas, SFC](https://www.superfinanciera.gov.co/publicaciones/13243/glosario-t-13243/),
  consultado el 30 de julio de 2026, vigencia no indicada.
- [Simulador de conversión, SFC](https://www.superfinanciera.gov.co/publicaciones/61554/consumidor-financieroinformacion-generalsimulador-de-conversion-de-tasas-de-interes-61554/),
  consultado el 30 de julio de 2026, página modificada el 8 de julio de 2025.

## Convenciones comunes

- `i`: tasa efectiva periódica decimal, vencida.
- `EA`: tasa efectiva anual decimal.
- `j`: tasa nominal anual decimal.
- `d`: tasa periódica anticipada o de descuento.
- `n`: número entero de capitalizaciones por año.
- `P`: principal o saldo.
- `B`: base anual de días.
- `D`: días aplicables al intervalo.
- Fechas: fecha civil ISO `YYYY-MM-DD`, sin convertirla por zona horaria.
- Intervalos de tasa: inicio inclusivo y fin exclusivo.
- Precisión: aritmética decimal con al menos 28 dígitos significativos.
- Redondeo visual COP: al peso, `HALF_UP`; no modifica el resultado interno.

## RF-00 — Total de proyección simple

- **Propósito:** calcular cuánto se acumula únicamente por aportes uniformes.
- **Variables:** importe periódico `A`, número entero de periodos `N`, total
  proyectado `T`.
- **Fórmula:** `T = A × N`.
- **Entrada:** `A` en COP; `N` en meses si la periodicidad es `MONTHLY` o en
  años si es `YEARLY`.
- **Salida:** total acumulado en COP y desglose de `N` aportes.
- **Supuestos:** no hay saldo inicial, tasa, rendimiento, retiros ni producto.
  La fecha inicial es opcional y solo ubica periodos en calendario.
- **Ejemplo mensual:** `$200.000 × 18 = $3.600.000`.
- **Ejemplo anual:** `$3.000.000 × 5 = $15.000.000`.
- **Fuente:** suma aritmética definida por el dominio; no utiliza una fórmula
  financiera ni afirma rendimiento.
- **Restricciones:** `A > 0`; `N` entero positivo dentro de límites; la
  periodicidad solo puede ser mensual o anual.
- **Errores posibles:** presentar la diferencia entre aportes como interés;
  multiplicar años por doce cuando el importe ya es anual; crear movimientos
  reales desde periodos planificados.
- **Pruebas:** los dos ejemplos; un periodo; cantidad mínima/máxima; decimal
  monetario; cero, negativo, fraccionario, `NaN`, infinito y exceso rechazados;
  agregar/quitar periodo; fecha ausente; persistencia de modo.

`projectedYield` se presenta como cero o “No aplica”, pero no se crea una
`InterestRateDefinition` de tasa cero. La explicación obligatoria es:

> Sin una tasa, el total corresponde únicamente a la suma de tus aportes.

Los importes distintos por periodo y la variante `T = Σ A_k` quedan fuera del
MVP. Una versión futura deberá modelarlos como aportes planificados y no
reutilizar movimientos reales.

## Reglas de cambio de modo

- Una configuración nueva usa `projectionMode = SIMPLE`.
- El interruptor visible se denomina **Usar proyección avanzada**.
- Activar `ADVANCED` crea una revisión y conserva importe, periodicidad,
  cantidad, fecha, nombre y objetivo compatibles.
- Desactivar con datos avanzados exige confirmación y enumera lo que dejará de
  influir.
- Confirmar la desactivación crea una revisión `SIMPLE`; los datos avanzados
  históricos no se borran y no participan en RF-00.
- Cancelar conserva la revisión avanzada sin cambios.
- Ningún validador de tasa, producto, saldo inicial, retiro o cierre puede
  bloquear el guardado de una revisión simple válida.

## RF-01 — E.A. a efectiva mensual

- **Propósito:** obtener la tasa efectiva de un mes equivalente a una E.A.
- **Variables:** `EA`, `i_m`.
- **Fórmula:** `i_m = (1 + EA)^(1/12) - 1`.
- **Entrada:** E.A. decimal no negativa.
- **Salida:** efectiva mensual decimal vencida.
- **Supuestos:** doce meses equivalentes por año; reinversión implícita.
- **Ejemplo:** `EA = 0.0875`; `i_m = 0.007014611604`, aproximadamente
  `0.7014611604 % E.M.`.
- **Fuente:** Banco de la República, sección de tasas equivalentes; SFC,
  documento de conversión E.A. a mensual.
- **Restricciones:** no describe la fecha real de acreditación del producto.
- **Errores posibles:** dividir `0.0875 / 12`; redondear antes de elevar.
- **Pruebas:** valor conocido; cero; alta precisión; ida y vuelta con RF-02;
  rechazo de negativo, `NaN` e infinito.

## RF-02 — Efectiva mensual a E.A.

- **Propósito:** anualizar una E.M. conservando equivalencia compuesta.
- **Variables:** `i_m`, `EA`.
- **Fórmula:** `EA = (1 + i_m)^12 - 1`.
- **Entrada:** E.M. decimal no negativa.
- **Salida:** E.A. decimal.
- **Supuestos:** doce periodos mensuales equivalentes y reinversión.
- **Ejemplo:** `i_m = 0.007`; `EA = 0.087310661916`, aproximadamente
  `8.7310661916 % E.A.`.
- **Fuente:** Banco de la República, tasas equivalentes.
- **Restricciones:** no multiplicar por doce.
- **Errores posibles:** confundir `0.7 %` con `0.7`; redondeo prematuro.
- **Pruebas:** ejemplo; cero; ida y vuelta; precisión; entradas inválidas.

## RF-03 — Efectiva trimestral a E.A.

- **Propósito:** anualizar una tasa efectiva trimestral.
- **Variables:** `i_t`, `EA`.
- **Fórmula:** `EA = (1 + i_t)^4 - 1`.
- **Entrada:** efectiva trimestral decimal vencida.
- **Salida:** E.A. decimal.
- **Supuestos:** cuatro trimestres equivalentes por año.
- **Ejemplo:** `i_t = 0.02`; `EA = 0.08243216`, `8.243216 % E.A.`.
- **Fuente:** Banco de la República, tasas equivalentes.
- **Restricciones:** no aplica a una nominal trimestre vencido sin dividir
  primero la nominal entre cuatro.
- **Errores posibles:** usar `i_t * 4`.
- **Pruebas:** ejemplo; cero; diferencia frente a `8 %`; equivalencia inversa.

## RF-04 — Efectiva semestral a E.A.

- **Propósito:** anualizar una tasa efectiva semestral.
- **Variables:** `i_s`, `EA`.
- **Fórmula:** `EA = (1 + i_s)^2 - 1`.
- **Entrada:** efectiva semestral decimal vencida.
- **Salida:** E.A. decimal.
- **Supuestos:** dos periodos semestrales equivalentes por año.
- **Ejemplo:** `i_s = 0.04`; `EA = 0.0816`, `8.16 % E.A.`.
- **Fuente:** Banco de la República, tasas equivalentes.
- **Restricciones:** la periodicidad debe ser efectiva, no nominal.
- **Errores posibles:** reportar `8 %`.
- **Pruebas:** ejemplo; cero; inversa; límite alto permitido.

## RF-05 — Nominal anual mes vencido a periódica y E.A.

- **Propósito:** normalizar una N.M.V.
- **Variables:** `j`, `n = 12`, `i_m`, `EA`.
- **Fórmulas:** `i_m = j / 12`; `EA = (1 + j/12)^12 - 1`.
- **Entrada:** nominal anual decimal, modalidad vencida, capitalización mensual.
- **Salida:** E.M. y E.A. decimales.
- **Supuestos:** la división entre doce es válida para obtener la tasa periódica
  de una **nominal anual mes vencido**, no para una E.A.
- **Ejemplo:** `j = 0.12`; `i_m = 0.01`; `EA = 0.126825030132`,
  aproximadamente `12.6825030132 % E.A.`.
- **Fuente:** Banco de la República, fórmula de nominal vencida a efectiva.
- **Restricciones:** requiere que el documento diga nominal, mes y vencida.
- **Errores posibles:** tratar `12 % N.M.V.` como `12 % E.A.`.
- **Pruebas:** ejemplo; cero; conservación original; ausencia de modalidad;
  ausencia de capitalización; equivalencia con una E.M. de `1 %`.

## RF-06 — Nominal anual trimestre vencido a periódica y E.A.

- **Propósito:** normalizar una N.T.V.
- **Variables:** `j`, `n = 4`, `i_t`, `EA`.
- **Fórmulas:** `i_t = j / 4`; `EA = (1 + j/4)^4 - 1`.
- **Entrada:** nominal anual decimal, vencida, capitalización trimestral.
- **Salida:** efectiva trimestral y E.A.
- **Supuestos:** cuatro capitalizaciones anuales.
- **Ejemplo:** `j = 0.12`; `i_t = 0.03`; `EA = 0.12550881`,
  `12.550881 % E.A.`.
- **Fuente:** Banco de la República; su ejemplo de N.A.T.V. usa el mismo método.
- **Restricciones:** no aplica si “trimestral” describe pago pero no
  capitalización.
- **Errores posibles:** usar doce periodos; sumar cuatro veces.
- **Pruebas:** ejemplo; cero; equivalencia con `3 % E.T.`; datos incompletos.

## RF-07 — Efectivas entre periodicidades compatibles

- **Propósito:** convertir una tasa efectiva vencida a otra periodicidad.
- **Variables:** `i_o`, `p_o`, `p_d`, `i_d`, donde `p` es periodos/año.
- **Fórmula:** `i_d = (1 + i_o)^(p_o/p_d) - 1`.
- **Entrada:** tasa efectiva y periodicidades de la tabla aprobada.
- **Salida:** tasa efectiva de destino.
- **Supuestos:** periodos uniformes y equivalencia compuesta.
- **Ejemplo:** `2 % E.T.` a E.M.: `(1.02)^(4/12)-1`, aproximadamente
  `0.662270 % E.M.`; al anualizar ambas se obtiene `8.243216 %`.
- **Fuente:** Banco de la República, tasas equivalentes.
- **Restricciones:** semanal, quincenal y diaria necesitan convención propia.
- **Errores posibles:** invertir el exponente; usar razón de días sin base.
- **Pruebas:** todas las parejas anual/semestral/trimestral/bimestral/mensual;
  ida y vuelta dentro de tolerancia decimal; periodos desconocidos.

## RF-08 — Nominal anual vencida genérica

- **Propósito:** normalizar una nominal vencida con frecuencia explícita.
- **Variables:** `j`, `n`, `i_p`, `EA`.
- **Fórmulas:** `i_p = j/n`; `EA = (1 + j/n)^n - 1`.
- **Entrada:** nominal anual decimal y entero `n > 0`.
- **Salida:** efectiva periódica y E.A.
- **Supuestos:** capitalizaciones uniformes, al final de cada periodo.
- **Ejemplo verificable:** `j = 0.14`, `n = 4`; `i_p = 0.035`;
  `EA = 0.147523000625`, aproximadamente `14.7523000625 %`.
- **Fuente:** Banco de la República, sección 1.6.1.
- **Restricciones:** sin `n` no hay conversión válida.
- **Errores posibles:** inferir `n` por el producto; aceptar fracciones.
- **Pruebas:** `n` 1, 2, 4, 6, 12; `n` ausente, cero, negativo y excesivo.

## RF-09 — Nominal anual anticipada a E.A.

- **Propósito:** hallar la E.A. equivalente de una nominal anticipada.
- **Variables:** `j`, `n`, `d = j/n`, `i_v`, `EA`.
- **Fórmulas:** `i_v = d/(1-d)`; `EA = (1-d)^(-n)-1`.
- **Entrada:** nominal anual anticipada decimal y capitalizaciones por año.
- **Salida:** periódica vencida equivalente y E.A.
- **Supuestos:** descuento anticipado uniforme; `0 <= d < 1`.
- **Ejemplo:** `j = 0.10`, `n = 4`; `d = 0.025`;
  `i_v = 0.025641025641`; `EA = 0.106576740016`,
  aproximadamente `10.6576740016 % E.A.`.
- **Fuente:** Banco de la República, sección 1.6.2.
- **Restricciones:** se aprueba la conversión, no una simulación de flujos
  pagados por anticipado. Faltando modalidad o `n`, se bloquea.
- **Errores posibles:** aplicar la fórmula vencida; permitir `d >= 1`.
- **Pruebas:** ejemplo oficial equivalente; cero; frecuencia ausente;
  modalidad desconocida; límite `d -> 1`; conservación del dato original.

## RF-10 — Capitalización diaria

- **Propósito:** obtener crecimiento por intervalos diarios con convención
  explícita.
- **Variables:** `EA`, fechas `a` y `b`, días convencionales `D_c`, base `B`,
  `i_D`.
- **Fórmula 360/360:** `i_D = (1 + EA)^(D_c/360) - 1`, donde cada mes tiene 30
  días.
- **Fórmula 365/365:** `i_D = (1 + EA)^(D_c/365) - 1`, con meses calendario y
  febrero de 28 días conforme a la convención citada.
- **Fórmula real/real:** segmentar por año y multiplicar factores
  `Π(1 + EA)^(D_a/B_a) - 1`, con días calendario reales y `B_a` igual a 365 o
  366.
- **Entrada:** E.A., fechas civiles y código de convención explícito.
- **Salida:** tasa efectiva del intervalo.
- **Supuestos:** el saldo permanece constante dentro de cada segmento. ACT/365
  usa la fórmula `D_real/365` solo cuando el producto la publica expresamente.
- **Ejemplo real/real en año no bisiesto:** `EA = 10 %`, `D = 30`; factor de
  rendimiento `0.007864477221`, aproximadamente `0.7864477221 %`.
- **Fuente:** equivalencia compuesta del Banco de la República; Resolución 514
  de 2002 de la SFC para 360/360, 365/365 y real/real; el IBR del Banco de la
  República corrobora la necesidad de días calendario reales en su contexto.
- **Restricciones:** acreditar diariamente no equivale a pagar diariamente.
  Real/real separa un intervalo que cruce el 31 de diciembre.
- **Errores posibles:** usar milisegundos locales; ignorar año bisiesto; tratar
  “base 360” como días reales/360; inferir una convención.
- **Pruebas:** uno y treinta días; año bisiesto; cruce anual; zona horaria;
  fecha final igual/anterior; 360/360, 365/365, real/real y ACT/365 explícita.

## RF-11 — Capitalización mensual

- **Propósito:** acumular rendimiento en cierres mensuales.
- **Variables:** `P`, `i_m`, número de meses completos `k`.
- **Fórmula:** `VF = P(1+i_m)^k`.
- **Entrada:** saldo, E.M. equivalente, meses completos.
- **Salida:** saldo antes de movimientos externos.
- **Supuestos:** el rendimiento se capitaliza al cierre; los meses parciales se
  calculan con la convención diaria explícita o se bloquean si el producto no
  la define.
- **Ejemplo:** `P = 1 000 000`, `i_m = 1 %`, `k = 3`;
  `VF = 1 030 301`.
- **Fuente:** interés compuesto, Banco de la República.
- **Restricciones:** no asumir meses de 30 días; no aplicarla a un pago no
  capitalizable.
- **Errores posibles:** sumar `3 %` al principal; redondear cada mes sin regla.
- **Pruebas:** cero meses; tres meses; mes parcial; aporte entre cierres; pago
  no reinvertido.

## RF-12 — Rendimiento al vencimiento

- **Propósito:** simular un depósito a término simple, sin flujos intermedios.
- **Variables:** `P`, `EA`, `D_c`, `B`, `I`, `VF`.
- **Fórmulas:** `I = P((1+EA)^(D_c/B)-1)`; `VF = P + I`.
- **Entrada:** capital único, E.A. equivalente, plazo y base explícita.
- **Salida:** rendimiento bruto estimado y saldo al vencimiento.
- **Supuestos:** tasa fija; ningún aporte/retiro; pago y capitalización al
  vencimiento; no renovación.
- **Ejemplo 360/360:** `P = 1 000 000`, `EA = 10 %`, `D_c = 90`;
  factor `0.024113689084`; `I = 24 113.689084`; visual COP `$24.114`.
- **Fuente:** interés compuesto y tasas equivalentes, Banco de la República;
  Resolución 514 de 2002 de la SFC para las convenciones; la frase “base 360”
  aparece en el ejemplo oficial de CDT físico de Bancolombia consultado.
- **Restricciones:** solo usar 360/360 si esa es la convención confirmada; “base
  360” sin detalle exige revisión. No simula CDT negociado, cancelación, pagos
  periódicos ni renovación.
- **Errores posibles:** `P * EA * D/360` como aproximación; permitir retiro.
- **Pruebas:** 90/360; 365/365; vencimiento bisiesto; aporte/retiro rechazado;
  tasa variable rechazada.

## RF-13 — Cambio de tasa en el tiempo

- **Propósito:** aplicar cada tasa solo durante su vigencia.
- **Variables:** saldo `S`, intervalos no superpuestos `r_k`, fracciones
  `f_k`.
- **Fórmula:** para un saldo sin movimientos,
  `S_final = S_inicial × Π_k (1 + EA_k)^(f_k)`.
- **Entrada:** periodos normalizados, fechas y convención.
- **Salida:** saldo e interés desglosados por periodo.
- **Supuestos:** se segmenta también por movimiento, cierre y límite anual.
- **Ejemplo:** `$1.000.000`, `10 % E.A.` durante 30 días real/real de un año no
  bisiesto y luego
  `8 % E.A.` durante 30 días:
  `1 000 000 × 1.10^(30/365) × 1.08^(30/365)`.
- **Fuente:** composición de interés compuesto, Banco de la República.
- **Restricciones:** un hueco bloquea el cálculo salvo periodo `ZERO`.
- **Errores posibles:** aplicar la tasa nueva retroactivamente; usar promedio.
- **Pruebas:** dos y varios periodos; límite exacto; superposición; hueco;
  periodos consecutivos; cambio con movimiento el mismo día.

## RF-14 — Saldo real

- **Propósito:** reconstruir dinero realmente registrado, sin usar ingreso
  personal ni proyección.
- **Variables:** saldo inicial confirmado `S0`, aportes `C`, rendimientos reales
  `Y`, retiros `W`, ajustes `A`.
- **Fórmula:** `S_real = S0 + ΣC + ΣY - ΣW + ΣA`.
- **Entrada:** movimientos activos y confirmados hasta una fecha.
- **Salida:** saldo real preciso.
- **Supuestos:** un ajuste lleva signo y observación; revisiones no duplican el
  movimiento vigente.
- **Ejemplo:** `100 000 + 50 000 + 2 000 - 10 000 - 500 = 141 500`.
- **Fuente:** identidad contable del producto; decisión de dominio.
- **Restricciones:** el ingreso mensual nunca se suma. Por defecto se rechaza
  un retiro superior al saldo.
- **Errores posibles:** contar versiones anuladas; estimar rendimiento como
  real.
- **Pruebas:** cada tipo; retiro excesivo; ajuste sin nota; duplicado; borrado
  lógico; orden estable.

## RF-15 — Proyección avanzada con movimientos

- **Propósito:** reproducir una trayectoria futura con aportes y retiros.
- **Variables:** saldo, eventos fechados, periodos de tasa y objetivo.
- **Algoritmo:**
  1. ordenar eventos por fecha civil y secuencia estable;
  2. acumular rendimiento del saldo hasta la fecha del siguiente evento;
  3. aplicar el evento;
  4. continuar con la tasa vigente;
  5. separar principal aportado, retiros y rendimiento.
- **Entrada:** configuración versionada.
- **Salida:** puntos de trayectoria y totales.
- **Supuestos:** aportes proyectados se consideran al final del día configurado;
  una opción avanzada puede establecer inicio de día. Esta convención se
  conserva en la revisión.
- **Ejemplo:** saldo `100`, tasa cero, aporte `50` y retiro `20` produce saldo
  `130`, aportes netos `130` y rendimiento `0`.
- **Fuente:** decisión de dominio sustentada en equivalencia compuesta.
- **Restricciones:** un producto a término simple no admite eventos
  intermedios.
- **Errores posibles:** acreditar rendimiento antes/después del aporte sin
  convención; mezclar estimado y real.
- **Pruebas:** tasa cero; eventos en fechas distintas/iguales; extraordinario;
  retiro; cambio de tasa; mes sin aporte; aporte tardío.

## RF-16 — Proyección original, real y actualizada

- **Proyección original:** resultado reproducible asociado a una revisión
  inmutable de configuración. Una edición crea una revisión nueva. El resultado
  se recalcula con el motor vigente y no se persiste como fuente de verdad.
- **Ahorro real:** RF-14, basado solo en movimientos confirmados.
- **Último cierre real válido:** cierre no anulado, cuyo hash de movimientos y
  revisión coinciden con el libro vigente.
- **Proyección actualizada:** parte del saldo del último cierre válido —o del
  saldo real a la fecha de corte si no hay cierre— y aplica únicamente
  supuestos futuros de la revisión seleccionada.
- **Prevalencia:** un `YIELD` real sustituye la explicación estimada de ese
  periodo, pero no altera la tasa histórica guardada.

La proyección simple conserva su configuración original, pero no exige libro
real, cierres, proyección actualizada ni comparación. Esas capacidades aparecen
al activar `ADVANCED`; los periodos simples previos siguen siendo planificados,
no movimientos confirmados.

Pruebas: edición de configuración; cierre válido/inválido; movimiento
retroactivo; tasa futura; rendimiento real distinto; ausencia de cierre.

## RF-17 — Comparación proyectado frente a real

- **Propósito:** cuantificar diferencias a una misma fecha de corte.
- **Variables:** totales reales `A_*`, proyectados `P_*`, objetivo `G` y
  diferencias `Δ_*`.
- **Fórmulas:** `Δ_aportes = A_aportes - P_aportes`;
  `Δ_rendimiento = A_rendimiento - P_rendimiento`;
  `Δ_retiros = A_retiros - P_retiros`;
  `Δ_saldo = A_saldo - P_saldo`;
  `avance = A_saldo/G` cuando `G > 0`.
- **Entrada:** importes COP precisos para idéntica meta y fecha.
- **Salida:** importes COP de diferencia, avance decimal y estado de plazo.
- **Supuestos:** el estado adelantado/al día/retrasado usa una tolerancia
  monetaria versionada; retiros no se suman a aportes.
- **Ejemplo:** proyectado `$500.000`, real `$470.000`; `Δ_saldo = -$30.000`.
  Con objetivo `$1.000.000`, `avance = 0.47`, mostrado `47 %`.
- **Fuente:** identidad de comparación definida por el dominio de la
  aplicación; no es una tasa ni una recomendación financiera.
- **Restricciones:** no calcular avance con objetivo cero; un saldo negativo
  queda fuera del MVP; los dos lados deben usar el mismo corte.
- **Errores posibles:** invertir el signo; comparar fechas diferentes; incluir
  retiro como aporte; redondear antes de restar.
- **Pruebas:** exactitud; real mayor/menor; objetivo alcanzado; vencido; retiro;
  objetivo inválido; fecha distinta rechazada; redondeo solo visual.

## RF-18 — Redondeo y consolidación monetaria

- Almacenar importes y tasas como strings decimales canónicos.
- Conservar cálculo interno sin redondeo monetario intermedio.
- Al mostrar COP, cuantizar a escala 0 con `HALF_UP`.
- Al crear un cierre, almacenar monto preciso, monto cuantizado, moneda,
  política y versión del motor.
- Una importación debe conservar los strings originales y verificar que las
  equivalencias recalculadas estén dentro de una tolerancia versionada.

Ejemplo: `24 113.689084` se muestra `$24.114`, pero el siguiente cálculo usa
`24 113.689084`.

La política es una decisión de esta aplicación; el contrato de una entidad
puede liquidar de otra manera. Si se conoce esa regla, requiere una futura
configuración específica.

Pruebas: medio peso; valores negativos solo para ajustes; acumulación de varios
años; diferencia entre redondeo diario y final; importación.

## RF-19 — Límites y errores

Política `numeric-policy-cop-v1`:

- objetivo, saldo, movimiento absoluto y resultado calculado:
  `0` a `10 000 000 000 COP`;
- tasa original: `0 %` a `100 %` por el periodo declarado;
- tasa canónica después de convertir: `0` a `1` decimal, equivalente a
  `0 %` a `100 % E.A.`;
- horizonte: entre 1 día y 100 años;
- proyección simple: entre 1 y 1200 meses o entre 1 y 100 años;
- máximo 10 000 movimientos por meta y 1000 periodos de tasa;
- fechas válidas entre `1900-01-01` y `2200-12-31`;
- no aceptar `NaN`, infinito, notación ambigua ni separadores incompatibles;
- retiro que excede el saldo: rechazado en el MVP;
- ajustes: importe distinto de cero y observación obligatoria.

Un límite excedido genera error accionable; no trunca, satura ni convierte en
cero. Una configuración puede usar un máximo menor, pero superar el techo
técnico exige una nueva política versionada. La validación se aplica también a
snapshots importados.

## Casos donde el motor debe abstenerse

- tipo `UNKNOWN`;
- nominal sin frecuencia;
- modalidad anticipada/vencida ausente;
- tasa anticipada periódica `>= 100 %`;
- periodos superpuestos o con huecos no declarados;
- base diaria desconocida;
- producto a término con aporte o retiro no permitido;
- tasa indexada futura;
- regla de pago/capitalización no soportada;
- revisión o importación cuya fórmula sea desconocida.

La respuesta debe ser “no se puede calcular todavía” con los campos faltantes,
no una cifra aproximada.

## Advertencia obligatoria

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

Debe aparecer al configurar una tasa, en resultados con rendimiento, en
exportaciones/reportes que contengan proyecciones y en Información.

## Estado de implementación de Fase 2

Las reglas RF-00 a RF-19 tienen una implementación de dominio y pruebas
unitarias.

- La precisión del motor es de 50 dígitos significativos y no redondea dinero
  entre eventos.
- `cop-half-up-0-v1` cuantiza al peso con `HALF_UP` solo al mostrar o consolidar
  y conserva el decimal preciso para cálculos posteriores.
- `rate-equivalence-tolerance-v1` usa tolerancia absoluta o relativa `1e-18`;
  método, fórmula y precisión deben coincidir.
- Si no se suministra el momento del aporte, el motor aplica `END_OF_DAY` y
  registra ese valor resuelto en la huella. La revisión persistida deberá
  materializarlo.
- La capitalización mensual se admite únicamente para meses calendario
  completos, una tasa única y sin movimientos intermedios. Cualquier calendario
  de acreditación más complejo se bloquea.
- El plazo fijo simple exige que el final de la proyección coincida con el
  vencimiento, una sola tasa fija y ningún evento.
- El cierre calcula su huella sobre revisión, tipo, importe, fecha y estado de
  cada movimiento; una corrección retroactiva lo vuelve obsoleto.

Las fórmulas y restricciones continúan siendo la especificación normativa. El
código no amplía soporte cuando la documentación ordena abstenerse.

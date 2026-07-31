# Criterios de aceptación

Fecha: 30 de julio de 2026. Estos criterios definen el resultado futuro; en la
Fase 1 solo se valida que estén documentados.

## Producto y metas

- **CA-001:** se crean y consultan al menos dos metas independientes en COP.
- **CA-002:** una meta simple acepta importe, periodicidad y periodos; una
  avanzada conserva objetivo, fecha/plazo, saldo inicial, aportes y estados ya
  definidos.
- **CA-003:** pausar/completar/archivar no elimina datos.
- **CA-004:** editar supuestos crea revisión con motivo y vigencia.
- **CA-005:** no existe concepto funcional específico de educación formal.
- **CA-006:** ingreso personal, si se usa para sugerir, no incrementa ahorro
  real.

## Proyección simple y avanzada

- **CA-100:** una meta nueva usa `projectionMode = SIMPLE`.
- **CA-101:** se crea una meta simple con aporte mensual y cualquier cantidad
  entera válida de meses.
- **CA-102:** se crea una meta simple con aporte anual y cualquier cantidad
  entera válida de años.
- **CA-103:** `$200.000` mensuales por 18 meses produce `$3.600.000`.
- **CA-104:** `$3.000.000` anuales por 5 años produce `$15.000.000`.
- **CA-105:** agregar o quitar un periodo actualiza cantidad, desglose y total.
- **CA-106:** una meta simple válida no exige tasa, producto, saldo inicial,
  fecha inicial, retiros, movimientos reales ni objetivo monetario.
- **CA-107:** sin tasa, no se crea una definición de tasa ni se muestra
  rendimiento inexistente; se explica que el total es la suma de aportes.
- **CA-108:** los campos avanzados permanecen ocultos mientras el interruptor
  **Usar proyección avanzada** esté desactivado.
- **CA-109:** activar el interruptor conserva todos los datos básicos e integra
  las reglas avanzadas existentes en el mismo flujo.
- **CA-110:** desactivar con datos avanzados muestra qué dejará de influir y
  exige confirmación.
- **CA-111:** confirmar la desactivación conserva la revisión avanzada y calcula
  con una nueva revisión simple; no borra datos.
- **CA-112:** los validadores avanzados no bloquean guardar una meta simple.
- **CA-113:** exportación e importación conservan `projectionMode`, configuración
  simple y revisiones avanzadas relacionadas.
- **CA-114:** no se implementa una migración histórica de `projectionMode`
  mientras no existan copias móviles productivas anteriores.
- **CA-115:** una futura importación heredada usa `ADVANCED` solo con datos
  avanzados válidos, usa `SIMPLE` solo con campos simples válidos y rechaza
  casos ambiguos.
- **CA-116:** el MVP rechaza importes diferentes por periodo; no implementa
  `PlannedContributionOverride`.

## Tasas y productos

- **CA-010:** “Sin rendimiento” produce rendimiento estimado cero.
- **CA-011:** E.A., E.M., E.T., E.S., N.M.V. y N.T.V. se normalizan con las
  fórmulas documentadas.
- **CA-012:** nominal anual vencida genérica exige capitalizaciones/año.
- **CA-013:** nominal sin periodicidad se rechaza sin inferencias.
- **CA-014:** anticipada sin frecuencia/modalidad se rechaza.
- **CA-015:** la conversión anticipada aprobada no habilita flujos anticipados
  de producto.
- **CA-016:** tasas negativas, no finitas y superiores al límite se rechazan.
- **CA-017:** el original, su equivalente, fórmula, precisión y versión se
  conservan.
- **CA-018:** equivalencias de entradas diferentes coinciden dentro de la
  tolerancia decimal aprobada.
- **CA-019:** “No estoy seguro” no crea tasa, equivalencia ni rendimiento.
- **CA-020:** una tasa variable usa periodos; cambios no son retroactivos.
- **CA-021:** superposiciones se rechazan y huecos se bloquean salvo cero
  explícito.
- **CA-022:** capitalización diaria, mensual y al vencimiento usa convención
  explícita.
- **CA-023:** el año bisiesto se segmenta conforme a la convención.
- **CA-024:** cuenta flexible y plazo fijo conservan reglas distintas.
- **CA-025:** plazo fijo simple rechaza aportes adicionales y retiros previos.
- **CA-026:** productos indexados o condiciones no soportadas no producen una
  cifra aparentemente exacta.
- **CA-027:** ninguna tasa bancaria actual está codificada como predeterminada.

## Cálculo y trazabilidad

- **CA-030:** proyección original, ahorro real, proyección actualizada y
  comparación son resultados distintos.
- **CA-031:** aportes, retiros y rendimiento se muestran separados.
- **CA-032:** el rendimiento real confirmado prevalece sobre el estimado.
- **CA-033:** los eventos fechados y cambios de tasa generan un cálculo
  reproducible.
- **CA-034:** solo la presentación/consolidación redondea; el valor preciso se
  conserva.
- **CA-035:** un movimiento corregido conserva revisiones; anular es lógico.
- **CA-036:** un ajuste exige observación.
- **CA-037:** un retiro superior al saldo se rechaza en el MVP.
- **CA-038:** el cierre registra conjunto de movimientos, versiones y política.
- **CA-039:** un movimiento retroactivo invalida cierres afectados.
- **CA-040:** la comparación usa la misma fecha de corte para ambos lados.

## Persistencia y respaldo

- **CA-050:** SQLite es la única fuente de verdad financiera; una preferencia
  visual puede usar almacenamiento no crítico.
- **CA-051:** los datos sobreviven cierre/reinicio sin conexión.
- **CA-052:** existe versión de esquema y migración desde la primera entrega.
- **CA-053:** una base incompatible o dañada nunca se reemplaza por vacío.
- **CA-054:** exportación incluye esquema, app, reglas, metas, modo,
  configuración simple, revisiones, movimientos, tasas
  originales/equivalentes y trazabilidad.
- **CA-055:** exportación no contiene credenciales, tokens ni datos bancarios.
- **CA-056:** importación valida tipo, tamaño, profundidad, esquema y relaciones
  antes de escribir.
- **CA-057:** muestra metas, movimientos, rango y versión antes de confirmar.
- **CA-058:** crea respaldo, reemplaza en transacción, verifica y restaura al
  fallar.
- **CA-059:** versión futura se rechaza; antigua soportada se migra.
- **CA-060:** el checksum se describe como detector de daño, no autenticidad.
- **CA-061:** el MVP no combina historiales automáticamente.
- **CA-062:** proyecciones y comparaciones no son fuente de verdad ni forman
  parte de SQLite o de la copia portable; se recalculan con el motor vigente.
- **CA-063:** una caché futura incluye versión del motor, valida su huella y
  puede descartarse sin pérdida.

Evidencia de Fase 3:

- CA-050 y CA-052 a CA-061 están implementados en la capa independiente y
  probados con SQLite/archivos temporales reales.
- CA-051 está comprobado mediante cierre y reapertura en Node. Permanece
  pendiente repetirlo con `expo-sqlite` en Android, por lo que no se declara
  finalizado para el MVP móvil.
- La falta de espacio se simula en el puerto de archivos. Su comportamiento
  real, el cierre abrupto y el selector móvil corresponden a la Fase 4.
- El adaptador `expo-sqlite` sigue sin validación en dispositivo.

## Seguridad y privacidad

- **CA-070:** no usa `eval`, ejecución dinámica, contenido ejecutable importado
  ni WebView sin justificación.
- **CA-071:** validación existe en presentación y dominio; números son finitos.
- **CA-072:** consultas son parametrizadas y escrituras críticas,
  transaccionales.
- **CA-073:** logs no contienen metas, saldos, movimientos o archivos completos.
- **CA-074:** errores visibles no exponen trazas, consultas ni rutas internas.
- **CA-075:** dependencias quedan fijadas, auditadas y sin vulnerabilidades
  críticas conocidas antes de terminar el MVP.
- **CA-076:** compilación de producción no incluye secretos ni depuración.
- **CA-077:** documentación declara SQLite/JSON sin cifrado inicial.
- **CA-078:** biometría/PIN/cifrado no se presentan como controles ya
  implementados.

En Fase 3 se verificaron consultas parametrizadas, transacciones, errores
seguros, archivos limitados y ausencia de secretos. La revisión de logs,
permisos y compilación móvil corresponde a Fases 4 y 5.

## Experiencia y accesibilidad futuras

- **CA-080:** la creación simple aparece primero; tras activar la proyección
  avanzada, la captura sencilla de tasa ofrece exactamente las cuatro rutas
  definidas y la captura avanzada aparece progresivamente.
- **CA-081:** mensajes de error indican el dato faltante y la acción.
- **CA-082:** controles táctiles, contraste, foco y lector de pantalla cumplen
  la revisión de accesibilidad acordada.
- **CA-083:** texto ampliado funciona en pantallas pequeñas.
- **CA-084:** reducción de movimiento y claro/oscuro son respetados.
- **CA-085:** gráficas no son la única representación.
- **CA-086:** acciones destructivas tienen resumen y confirmación.
- **CA-087:** estados vacío, carga, almacenamiento e integridad son útiles.

## Advertencias

- **CA-090:** aparece al configurar tasa, en todo resultado con rendimiento, en
  exportación/reporte de proyección y en Información:

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

- **CA-091:** la aplicación declara que no conecta bancos, no mueve dinero, no
  garantiza metas y no recomienda productos.

## Evidencia de finalización futura

El MVP no estará terminado sin resultados reales de:

- pruebas unitarias del dominio y conversiones;
- integración con SQLite temporal, migración, importación y rollback;
- componentes de los dos modos de tasa;
- E2E de los flujos mínimos definidos;
- auditoría de dependencias y análisis estático;
- compilación de producción;
- ejecución en al menos un dispositivo o emulador Android;
- revisión en pantalla pequeña, claro/oscuro, texto ampliado, lector de
  pantalla, teclado y reducción de movimiento;
- funcionamiento completamente independiente de la aplicación utilizada como
  referencia.

No se acepta una prueba no ejecutada ni una cifra corregida solo en la interfaz.

## Evidencia parcial de Fase 2

Se verificaron exclusivamente los criterios correspondientes al núcleo:

- tasas cero, efectivas y nominales soportadas;
- bloqueo de datos incompletos y `No estoy seguro`;
- conservación de tasa original y equivalencia;
- proyección simple mensual/anual;
- proyección avanzada, cambios de tasa, aportes, retiros y restricciones;
- ahorro real, cierres, proyección actualizada y comparación;
- serialización de dominio v1 estricta y determinista.

La ejecución registrada fue: 77 pruebas unitarias aprobadas, typecheck y build
aprobados, y auditoría npm con 0 vulnerabilidades conocidas. Esto no satisface
los criterios de persistencia, interfaz, E2E, compilación móvil ni dispositivo;
el MVP completo sigue pendiente.

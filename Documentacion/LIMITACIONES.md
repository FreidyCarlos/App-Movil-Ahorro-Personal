# Limitaciones

Fecha: 30 de julio de 2026.

## Financieras

- Toda proyección es una simulación bruta, no un saldo bancario ni una promesa.
- La proyección simple suma aportes; no estima rendimiento, saldo inicial,
  retiros ni condiciones de producto.
- El total simple no representa dinero realmente ahorrado hasta que existan
  movimientos confirmados en una proyección avanzada.
- El motor depende de que el usuario clasifique y transcriba correctamente la
  tasa y el producto.
- “No estoy seguro” bloquea el rendimiento; no produce una aproximación.
- No se calculan impuestos, retenciones, inflación, comisiones ni GMF.
- No se presenta rendimiento neto.
- No se modelan tasas negativas.
- No se proyectan índices futuros como IBR, DTF, IPC o UVR.
- No se soportan tasas escalonadas por saldo, bonos promocionales, topes,
  penalizaciones o condiciones comerciales complejas.
- El CDT del MVP se limita a capital único, tasa fija, plazo/base conocidos,
  sin aportes o retiros y pago al vencimiento.
- Una tasa anticipada se puede normalizar si está completa, pero el MVP no
  simula pagos comerciales anticipados.
- Una tasa variable solo se calcula para periodos cuyos valores ya se conocen.
- Una renovación a término futura no se proyecta sin condiciones nuevas.
- Las reglas de redondeo de una entidad pueden diferir de la política de la
  aplicación; el rendimiento real registrado prevalece.
- COP es la única moneda soportada inicialmente.

## Producto

- El modo simple admite periodicidad mensual o anual. La avanzada conserva esas
  frecuencias y añade semanal, quincenal y personalizada.
- Los importes distintos por periodo y `PlannedContributionOverride` quedan
  fuera del MVP y se aplazan para una versión futura.
- La proyección simple no incluye seguimiento real, cierres, comparación ni
  producto; activarlos requiere cambiar a modo avanzado sin perder el plan.
- No administra presupuesto completo ni verifica ingresos.
- No conecta bancos, consulta saldos, transfiere ni custodia dinero.
- No recomienda entidades, cuentas, CDT, inversiones o decisiones tributarias.
- No actualiza tasas automáticamente y no hace scraping.
- Los nombres “bolsillo”, “cajita” y similares son etiquetas comerciales, no
  modelos internos.
- La frecuencia personalizada de aportes puede aplazarse si no se define sin
  ambigüedad.
- La combinación automática de copias queda fuera; el MVP reemplaza el conjunto
  completo.
- No hay cuenta, nube, sincronización entre dispositivos ni colaboración.

## Seguridad y privacidad

- En el alcance inicial, SQLite y el JSON exportado **no están cifrados**.
- Almacenamiento local no evita acceso si el dispositivo está desbloqueado,
  comprometido o respaldado por el sistema operativo.
- Una copia compartida puede quedar en Descargas, correo, mensajería o nube;
  el usuario debe custodiarla.
- El checksum futuro detectará cambios accidentales; no autentica al autor ni
  impide manipulación.
- PIN, bloqueo biométrico, SQLCipher y exclusión de respaldos del sistema son
  fases posteriores, no controles presentes.
- La aplicación no almacenará credenciales bancarias, tarjetas, contraseñas,
  tokens ni secretos.
- Los logs deben excluir saldos, movimientos, metas y contenido de copias; aun
  así, metadatos mínimos de error pueden existir localmente.
- Una dependencia vulnerable, compilación de depuración o pérdida del celular
  sigue siendo un riesgo que requiere controles de entrega.

## Importación y recuperación

- Un JSON puede estar manipulado, ser enorme, profundo, duplicado o declarar
  una versión falsa.
- Validar el esquema no prueba autenticidad ni exactitud financiera.
- La falta de espacio o cierre del sistema puede interrumpir una operación; se
  requieren transacción, respaldo y verificación.
- Una base gravemente dañada puede no ser exportable por completo.
- Una versión futura incompatible se rechazará; nunca se vaciará la base para
  “resolverla”.
- El MVP no recupera copias eliminadas fuera de la aplicación.
- Los límites exactos de archivo y registros están pendientes de pruebas de
  dispositivo.

## Plataforma

- Android es la plataforma primaria de comprobación.
- Compatibilidad iOS depende de Expo, SQLite, selector de documentos y
  bibliotecas que se validarán posteriormente.
- No se ha decidido soporte para tablet, orientación horizontal o versiones
  mínimas del sistema.
- Funcionamiento sin conexión cubre los flujos del producto; abrir una fuente
  externa sí requiere conectividad y consentimiento.

## Estado actual

La Fase 1 contiene solo definiciones y documentación. No existen todavía:

- aplicación React Native/Expo;
- motor financiero ejecutable;
- base SQLite ni migraciones;
- importación/exportación;
- interfaz ni pruebas automatizadas;
- compilación o ejecución en emulador.

## Advertencia obligatoria

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

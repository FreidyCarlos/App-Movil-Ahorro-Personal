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
- Cada monto, saldo y resultado calculado se limita a
  `10 000 000 000 COP`. Ampliarlo requiere una nueva política y revisión del
  producto.
- Se rechaza una tasa si su valor original supera `100 %` o si su equivalencia
  supera `100 % E.A.`. Es un control contra errores, no una afirmación de que
  otra tasa sea imposible en todo contexto.

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
- Proyecciones y comparaciones no se conservan como historial: se recalculan con
  el motor vigente. Una futura caché deberá ser descartable y estar versionada.
- No hay cuenta, nube, sincronización entre dispositivos ni colaboración.

## Seguridad y privacidad

- En el alcance inicial, SQLite y el JSON exportado **no están cifrados**.
- Almacenamiento local no evita acceso si el dispositivo está desbloqueado,
  comprometido o respaldado por el sistema operativo.
- Una copia compartida puede quedar en Descargas, correo, mensajería o nube;
  el usuario debe custodiarla.
- El checksum SHA-256 detecta cambios accidentales; no autentica al autor ni
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
- Los techos operativos actuales son 10 MiB, profundidad 20, 100 metas,
  10.000 movimientos y 1.000 periodos de tasa. Siguen pendientes de medición
  en un Android de gama baja; se mantienen provisionalmente mientras tanto.

## Plataforma

- Android es la plataforma primaria de comprobación.
- Compatibilidad iOS depende de Expo, SQLite, selector de documentos y
  bibliotecas que se validarán posteriormente.
- No se ha decidido soporte para tablet, orientación horizontal o versiones
  mínimas del sistema.
- Funcionamiento sin conexión cubre los flujos del producto; abrir una fuente
  externa sí requiere conectividad y consentimiento.
- El dispositivo prevalidado ejecuta Android 9/API 28, tiene cerca de 2,68 GiB
  de RAM y un parche de seguridad de 2020. Es útil para compatibilidad y
  restricciones de recursos, pero no representa Android reciente.
- Los aproximadamente 6,81 GiB libres alcanzan para pruebas ordinarias; no
  demuestran comportamiento correcto cuando el almacenamiento se agota.

## Entorno móvil prevalidado

- ADB detectó un único teléfono autorizado en estado `device` y mantuvo 8 de 8
  sondas USB consecutivas.
- ADB no está disponible en `PATH`; solo se pudo reutilizar el ejecutable de un
  proceso activo. La disponibilidad no es estable si ese proceso desaparece.
- Node y npm están disponibles.
- Solo existe un Java Runtime 8; faltan JDK, `javac` y `JAVA_HOME`.
- No se verificó un Android SDK completo, variables de SDK, `sdkmanager`,
  plataforma ni Build Tools.
- Expo y EAS no están instalados.
- No se ejecutó una instalación real porque todavía no existe un APK propio.

## Estado actual

La Fase 3 contiene el núcleo financiero, un esquema SQLite v1, migraciones,
repositorio transaccional y copias portables ejecutables y probados. No existen
todavía:

- aplicación React Native/Expo;
- conexión ejecutada contra `expo-sqlite` en dispositivo;
- selector o sistema de archivos móvil;
- interfaz, pruebas de componentes ni E2E;
- compilación o ejecución en emulador;
- cifrado, biometría o PIN.

Las pruebas reales de falta de espacio, cierre abrupto y selector móvil quedan
asignadas a la Fase 4. El adaptador estructural `expo-sqlite` no se considera
validado hasta ejecutarlo en un dispositivo.

La capitalización mensual del núcleo solo admite una tasa única, meses
calendario completos y ausencia de movimientos intermedios. Si el producto
acredita en fechas específicas, calcula por saldos mínimos, paga fuera del
capital o aplica otra condición comercial, el motor bloquea la simulación.

El redondeo al peso `HALF_UP` es una política de presentación/consolidación de
la aplicación, no la liquidación contractual de una entidad. El cálculo
interno conserva decimales.

El snapshot JSON se encapsula en una copia portable con SHA-256, vista previa,
respaldo y reemplazo transaccional. SHA-256 detecta cambios, pero no autentica
al autor ni cifra la copia.

La integración SQLite real se prueba con el módulo incluido en Node 24.15. El
adaptador estructural de Expo está implementado, pero su conexión a
`expo-sqlite`, rendimiento, WAL y archivos deben verificarse en Android/iOS
durante la Fase 4.

Expo Go no será criterio de aceptación. La estrategia recomendada usa un
development build; EAS Build evita instalar herramientas nativas locales, pero
requiere autorización para cuenta y servicio remoto. La ruta local exige JDK 17
y Android SDK por línea de comandos.

## Advertencia obligatoria

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

# Limitaciones

Fecha: 3 de agosto de 2026.

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
- PIN, bloqueo biométrico y SQLCipher son fases posteriores. Fase 5 deshabilitó
  el respaldo automático Android en la configuración, pero el cambio solo
  estará presente en una compilación nativa futura.
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
- Expo SDK 57 está integrado y existe un development APK generado mediante
  EAS. La instalación por ADB fue correcta.
- En Android 9/API 28 el primer flujo completo terminó con un `SIGSEGV` nativo
  en el hilo JavaScript. Seis variantes reducidas y cuatro controles de
  onboarding de 120 segundos, incluidos arranques completos con datos limpios,
  no reprodujeron la causa.
- El APK registra un error no fatal porque `DevLauncherController` no encuentra
  `expo.modules.splashscreen.SplashScreenManager`. Es una búsqueda reflectiva
  de un módulo opcional, capturada por el launcher; no hay duplicados ni plugin
  splash y el flujo continúa, por lo que no se modifica el APK sin impacto o
  corrección demostrable.
- La prueba agrupada aprobó migración, lectura/escritura, persistencia,
  exportación, importación válida e inválida, modo sin red y recuperación en
  Android 9 y repitió el recorrido básico con éxito en Android 16/API 36.
- El primer `Failed to open app` de Android 16 fue causado por una configuración
  de red inválida heredada por Metro, que devolvía HTTP 500 al solicitar el
  manifiesto. Al reiniciar solo Metro con un entorno limpio, el mismo APK abrió
  el producto. No hubo causa nativa para otro build ni para cambios de
  dependencias.
- Sin internet, el development client no descubrió automáticamente Metro y fue
  necesario elegir su entrada USB guardada. Después de esa selección el
  producto funcionó con SQLite y los datos persistidos; esa ejecución aislada
  no validaba el arranque autónomo.
- Un APK EAS `preview`, versión `0.1.0` y `versionCode 8`, se validó después en
  Android 16 como compilación autónoma interna. Abrió directamente con Wi-Fi y
  datos móviles desactivados, Metro cerrado, 8081 libre y sin `adb reverse`;
  aprobó el recorrido básico y no mostró herramientas de desarrollo.
- La exportación del `preview` quedó confirmada hasta la generación de la copia
  y su entrega al resolver de Android. La importación válida se comprobó con
  una copia sintética compatible y checksum verificado, no como un roundtrip de
  un archivo externo guardado desde esa misma exportación.
- Estas validaciones son evidencia complementaria de Fase 4 y no completaban
  por sí mismas la Fase 5 canónica de Seguridad y robustez.

## Estado actual

La Fase 7 completó la validación funcional Android del MVP y generó un AAB de
tienda y un APK release instalable. El APK actualizó el paquete existente sin
borrar datos, quedó no depurable y abrió con bundle embebido y Metro ausente.
Fase 8 generó un nuevo AAB de tienda con `versionCode 10`; se verificaron su
estructura, manifiesto base y metadatos de firma, pero no se instaló ni
distribuyó. La ejecución física del binario continúa respaldada por la evidencia
release de Fase 7.
Continúan fuera de este cierre:

- límites máximos, rendimiento y presión de memoria;
- falta real de espacio;
- distribución, validación iOS o tablet, cifrado, biometría o PIN.

La Fase 8 no incorporó conciliación automática con saldos externos, borradores
mensuales, sincronización entre dispositivos, CSV, impuestos, retenciones, GMF,
productos específicos ni datos del proyecto guía. La corrección de movimientos
es manual, exige motivo y conserva revisiones; no consulta comprobantes,
cuentas, bancos ni fuentes externas.

La Fase 5 publicada revisó dependencias, permisos, logs,
archivos manipulados, límites, almacenamiento, modelo de amenazas y
recuperación. Permanece pendiente la medición física del caso máximo.

La Fase 6 implementa el nuevo sistema visual, tema automático, contraste AA,
texto envolvente, foco, objetivos táctiles y reducción de movimiento. En Moto
X4 se aprobaron pantalla pequeña, claro/oscuro, texto al 130 %, teclado, tacto y
movimiento reducido, incluida una corrección física del formulario sobre el
teclado. El árbol accesible contiene las etiquetas esperadas. Permanece
registrado que la activación automatizada de TalkBack no enlazó el servicio;
la activación manual sí lo enlazó y permitió aprobar el recorrido de foco,
etiquetas, estados y acciones en las tres pantallas. Todos los ajustes se
restauraron. iOS y tablet continúan sin validación física. La compilación de
producción y validación funcional Android quedaron aprobadas en Fase 7.

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
adaptador estructural de Expo y su conexión a `expo-sqlite`, WAL y archivos se
comprobaron en recorridos básicos de Android 9 y Android 16, incluido el APK
`preview` autónomo interno. Rendimiento físico del caso máximo, distribución e
iOS siguen pendientes.

La auditoría final conserva 11 vulnerabilidades moderadas transitivas de las
herramientas Expo y ninguna alta o crítica. Npm sólo propone resolverlas con un
cambio forzado incompatible; se espera una actualización compatible de Expo.

Expo Go no será criterio de aceptación. La estrategia recomendada usa un
development build; EAS Build evita instalar herramientas nativas locales, pero
requiere autorización para cuenta y servicio remoto. La ruta local exige JDK 17
y Android SDK por línea de comandos.

## Advertencia obligatoria

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

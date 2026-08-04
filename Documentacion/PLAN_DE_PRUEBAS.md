# Plan de pruebas

Fecha: 1 de agosto de 2026. Estado: pruebas unitarias e integración ejecutadas;
diagnóstico físico sin reproducción del fallo nativo y pruebas funcionales
agrupadas aprobadas en Android 9 y Android 16. La validación complementaria
posterior al cierre de Fase 4 reutilizó el development APK sin generar otro
build.

## Herramientas

- TypeScript en modo estricto para validación estática.
- Vitest para pruebas unitarias.
- Cobertura V8 para medir sentencias, ramas, funciones y líneas.
- SQLite real de Node 24.15 y archivos temporales para integración.
- `npm audit` contra el registro oficial para vulnerabilidades conocidas.

## Prevalidación móvil de Fase 4

Consulta: 30 de julio de 2026. Se usó un Moto X4 físico sin registrar ni
publicar su número de serie.

| Control | Resultado no destructivo |
|---|---|
| `adb devices` | un dispositivo autorizado en estado `device` |
| Sistema | Android 9, API 28, parche de seguridad 2020-01-01 |
| Arquitectura | ARM64; también declara ABI ARM de 32 bits |
| Recursos | aproximadamente 2,68 GiB de RAM y 6,81 GiB libres en `/data` |
| Pantalla | 1080 × 1920, densidad física 480 |
| USB | estado/configuración `adb`; 8 de 8 sondas consecutivas correctas |
| Autorización | ADB seguro activo y depuración habilitada |
| Instalación | cliente ADB admite `install`; Package Manager e instalador responden |

La instalación posterior del development APK fue autorizada y finalizó
correctamente sin desinstalar aplicaciones ni borrar datos.

Entorno del equipo:

- Node 24.15.0 y npm 11.12.1 disponibles. Expo SDK 57 exige como mínimo Node
  22.13.x, por lo que la versión supera el mínimo documentado.
- Existe Java Runtime 8, pero no `javac`, JDK ni `JAVA_HOME`; no permite una
  compilación Android local moderna.
- ADB 37.0.1 está activo y funcional, pero no está en `PATH`; se localizó a
  través del proceso ya iniciado. Esto no sustituye un SDK configurado.
- No se detectaron `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `sdkmanager`, plataforma
  Android ni Build Tools verificables.
- Expo SDK 57 y los módulos móviles quedaron fijados en el proyecto. El APK de
  desarrollo se generó mediante EAS Build.

Android 9 es compatible con Expo SDK 57, cuyo mínimo documentado es Android 7.
Expo SDK 57 quedó fijado al implementar Fase 4 y fue la versión usada para el
development build validado.

### Estrategia utilizada

El artefacto principal de pruebas fue un **development build de Expo**:

1. opción inicial menos pesada: EAS Build genera un APK de desarrollo, si el
   responsable autoriza cuenta, conectividad y carga del código al servicio;
2. instalar el APK por USB con ADB y trabajar con `expo-dev-client`;
3. usar Expo Go, como máximo, para smoke tests tempranos; no es evidencia de
   aceptación del binario propio;
4. si no se autoriza nube, instalar JDK 17 y Android SDK Command-Line Tools,
   plataforma y Build Tools. Android Studio no es necesario mientras se use el
   dispositivo físico y la línea de comandos.

La recomendación se basa en que Expo Go tiene un conjunto nativo fijo, mientras
que un development build admite configuración y módulos del proyecto. Aunque
`expo-sqlite` y `expo-document-picker` figuran incluidos en Expo Go, deben
probarse en el binario propio, con su sandbox, ciclo de vida y configuración.

Fuentes oficiales consultadas el 30 de julio de 2026:

- [Versiones y mínimos de Expo SDK](https://docs.expo.dev/versions/latest/)
- [Introducción a development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [APK para dispositivo Android](https://docs.expo.dev/build-reference/apk/)
- [Expo SQLite](https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/)
- [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/)
- [Entorno Android de React Native](https://reactnative.dev/docs/next/set-up-your-environment)
- [Android SDK Command-Line Tools](https://developer.android.com/tools/sdkmanager)

## Ejecución física inicial de Fase 4

| Prueba | Resultado |
|---|---|
| ADB previo | un dispositivo autorizado en estado `device` |
| Instalación APK | aprobada con `adb install -r`; paquete nuevo |
| Primer arranque del development client | aprobado |
| Conexión inicial a Metro | falló por listener IPv6; corregida con listener IPv4 y reenvío USB |
| Bundle Android | generado por Metro; React Native ejecutó `main` |
| Estabilidad | **fallida**: `Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)` en `mqt_v_js` |
| SQLite, meta simple y proyección | no ejecutadas por el bloqueo |
| Reinicio de app y persistencia | no ejecutadas |
| Exportación/importación | no ejecutadas |
| Archivo inválido y rollback | no ejecutadas |
| Modo sin internet | no ejecutada |
| Memoria y espacio de datos | no medidos con flujo estable |

Los logs se limitaron al PID histórico del paquete. No se registró estado
financiero completo. El proceso Metro y el reenvío USB se retiraron al detener
la prueba; el paquete quedó instalado y sus datos no se limpiaron.

### Diagnóstico por reducción del fallo nativo

Consulta: 31 de julio de 2026. Cada variante se generó como development APK
identificable, se instaló con `adb install -r` sin borrar datos y se ejecutó con
logs limitados al PID del paquete.

| Variante | Única categoría ejercitada | Resultado físico |
|---|---|---|
| V1 | texto estático; sin navegación, dominio, SQLite, Decimal ni archivos | estable durante 165 segundos; segundo plano/regreso, cierre normal y cierre forzado aprobados |
| V2 | formato COP manual sin `Intl` | estable durante 120 segundos; resultado visual correcto |
| V3 | `Intl.NumberFormat` aislado | estable durante 120 segundos; resultado visual correcto |
| V4 | Decimal.js aislado | estable durante 120 segundos; operación decimal correcta |
| V5 | Expo Router sobre un árbol diagnóstico separado | estable durante 120 segundos; pila y ruta visibles |
| V6 | `expo-sqlite.openDatabaseAsync` sin SQL de aplicación | estable durante 120 segundos; apertura llegó a estado `LISTA` |

Ninguna de estas seis variantes reprodujo el `SIGSEGV`. Esto descarta una
reproducción mínima en las condiciones probadas, pero no demuestra que una
categoría sea inocua en combinación con otras. No se asigna la causa a `Intl`,
Decimal.js, Expo Router, SQLite, Hermes ni a otra dependencia.

### Control del onboarding de Expo

Se identificó una diferencia entre el intento fallido y V1–V6: en el primero
quedó abierto el onboarding del menú de desarrollo, mientras que antes de las
variantes se pulsó `Continue`. Como `adb install -r` conservó los datos del
paquete, las seis variantes heredaron `isOnboardingFinished=true`.

Se repitieron cuatro condiciones con `pm clear` antes de cada una. La ausencia
de `Continue` se comprobó porque la preferencia `isOnboardingFinished` no
existía; al pulsarlo se comprobó su valor `true`. Cada intervalo comenzó después
de que V6 informara `READY` o de que el flujo completo ejecutara `main` y
mostrara la lista inicial de metas.

| Entrada JavaScript | Estado del onboarding | Resultado físico |
|---|---|---|
| V6, apertura aislada de SQLite | abierto, sin pulsar `Continue` | 120 segundos; mismo PID y cero fallos fatales |
| V6, apertura aislada de SQLite | `Continue` completado | 120 segundos; mismo PID y cero fallos fatales |
| Flujo completo | abierto, sin pulsar `Continue` | 120 segundos; mismo PID y cero fallos fatales |
| Flujo completo | `Continue` completado | 120 segundos; mismo PID y cero fallos fatales |

El botón no quedó demostrado como causa ni como corrección del `SIGSEGV`. El
arranque completo ejercitó apertura, migración, verificación de integridad,
creación del estado vacío y lectura inicial. La prueba agrupada posterior cubrió
también operaciones funcionales sin volver a reproducir el fallo.

Los logs mostraron además un error no fatal e independiente:
`DevLauncherController` no encontró
`expo.modules.splashscreen.SplashScreenManager` al intentar ocultar la pantalla
de inicio. La auditoría encontró una sola versión deduplicada de Expo,
dev-client, launcher, router y React Native; `expo-splash-screen` no está
declarado ni existe un plugin splash. El launcher busca la clase opcional por
reflexión, captura `Throwable`, registra el mensaje y continúa. Como el proceso
ejecutó `main` y completó el flujo, no hay una corrección demostrable ni causa
para cambiar dependencias o generar otro APK.

### Prueba funcional agrupada en Android 9

Se reutilizaron el development APK y Metro. La misma sesión, sin limpiar datos
ni reinstalar, produjo estos resultados:

| Etapa | Evidencia | Resultado |
| --- | --- | --- |
| Esquema y migración | `user_version=1`, integridad `HEALTHY` y 13 tablas de aplicación | aprobada |
| Escritura y lectura | meta `MetaPersistencia`, aporte mensual de 250.000 COP por 12 meses desde 2026-08-01 | aprobada; proyección de 3.000.000 COP y rendimiento 0 |
| Persistencia | cierre forzado, PID nuevo y lectura posterior de la misma meta y proyección | aprobada |
| Exportación | sobre `AHORRO_PERSONAL_BACKUP`, versión 1, esquema 1, una meta y SHA-256 de 64 caracteres | aprobada; selector de compartir abierto sin enviar datos |
| Importación válida | vista previa 1 meta/0 movimientos/esquema 1, confirmación y respaldo automático | aprobada; respaldos privados pasaron de 1 a 2 |
| Archivo inválido | JSON ajeno renombrado `.json` | rechazado antes del reemplazo con mensaje seguro; respaldos permanecieron en 2 |
| Sin internet | Wi-Fi y datos móviles desactivados, ping fallido y Metro por USB | aprobada; arranque, meta y proyección visibles; conectividad restaurada |
| Recuperación | cierre forzado y reapertura dentro de las etapas de persistencia y modo sin red | aprobada, sin pérdida observable |
| Estabilidad | logs filtrados del proceso | cero `SIGSEGV`, `Fatal signal` o `FATAL EXCEPTION` |

El selector de Android 9 deshabilitaba archivos `.json` cuando la aplicación
pedía exclusivamente MIME `application/json`; algunos proveedores los
clasifican como texto o binario genérico. Se amplió solo el filtro de selección
a `*/*`. La extensión `.json`, el tamaño, el esquema y el checksum siguen
validándose dentro de la aplicación. Ambos archivos quedaron seleccionables y
las pruebas válida e inválida demostraron el control posterior. Es un cambio
JavaScript y no requiere otro EAS Build.

### Cierre con el entrypoint productivo

Después de retirar los entrypoints diagnósticos se restauró
`expo-router/entry`. Metro confirmó que empaquetó
`node_modules/expo-router/entry.js` y tomó `src/app` como raíz. Se reutilizaron
el mismo APK, la base existente y Metro; no hubo cambio nativo ni EAS Build.

Se ejecutó una única prueba física corta, limitada al riesgo del cambio de
entrada:

| Etapa | Resultado |
| --- | --- |
| Apertura productiva | aprobada; flujo `Ahorro Personal` y meta previa visibles |
| Meta nueva | `CierreFase4`, 120.000 COP mensuales por 5 meses |
| Proyección | 600.000 COP y rendimiento proyectado 0 |
| Cierre forzado | PID cambió y la meta/proyección permanecieron tras reapertura |
| Exportación | aprobada; respaldos privados pasaron de 2 a 3 y abrió el selector de compartir |
| Importación válida | vista previa aprobada y reemplazo confirmado; respaldo automático elevó el total de 3 a 4 |
| Archivo inválido | rechazado antes de vista previa o reemplazo; respaldos permanecieron en 4 |
| Estabilidad | cero `SIGSEGV`, `Fatal signal` o `FATAL EXCEPTION` |

La copia válida usada contenía la meta previa, por lo que el reemplazo final
dejó nuevamente `MetaPersistencia` como estado importado. Esto es el
comportamiento previsto de importación por reemplazo, no pérdida inesperada.
El `SIGSEGV` permanece como fallo histórico no reproducido y la anomalía de
`SplashScreenManager` permanece no fatal y documentada. Android moderno quedó
pendiente en ese cierre del Moto X4 y se validó después como evidencia
complementaria de Fase 4.

## Validación complementaria de Fase 4 — Android moderno

Consulta: 1 de agosto de 2026. Se usó un Motorola moto g75 5G de uso diario con
Android 16, API 36 y ABI ARM64, sin registrar ni publicar su número de serie. La
raíz Git estaba limpia y `main`, `HEAD` y `origin/main` coincidían con el commit
de cierre de Fase 4 `c753375`.

No se generó otro APK. El APK V6 conserva el mismo stack nativo, los mismos
plugins y `versionCode 7`; el cierre productivo de Fase 4 ya lo había reutilizado
con cambios exclusivamente JavaScript servidos por Metro. Se verificó su
SHA-256 conocido y se instaló como paquete nuevo con `adb install -r`, sin
desinstalar, borrar datos, conceder permisos globales ni cambiar la seguridad
del dispositivo.

Se propuso una única prueba agrupada: apertura productiva, meta simple,
proyección, persistencia tras cierre forzado, exportación, importación válida,
rechazo de archivo inválido, funcionamiento sin internet y estabilidad. El
resultado fue:

| Etapa | Resultado confirmado |
|---|---|
| Instalación del development APK | aprobada; paquete nuevo |
| Metro y USB | Metro respondió por IPv4 local y `adb reverse` quedó configurado; no se documentaron direcciones ni identificadores del dispositivo |
| Primer intento de apertura | `Failed to open app`; la solicitud del manifiesto devolvía HTTP 500 porque Metro heredó una configuración de red inválida del proceso host |
| Corrección de entorno | se reinició únicamente Metro con el entorno saneado y en modo offline; el manifiesto respondió HTTP 200 y no se modificó el proyecto |
| Apertura productiva y SQLite | aprobadas; se ejecutó `main` y se creó/abrió `ahorro-personal.db` |
| Meta simple y proyección | aprobadas con datos sintéticos; el total y el rendimiento proyectado coincidieron con el resultado esperado |
| Persistencia | aprobada tras cierre forzado y proceso nuevo; meta, importes, plazo y proyección permanecieron |
| Exportación | aprobada; copia JSON completa con formato portable y checksum SHA-256 válido |
| Importación válida | aprobada; vista previa de 1 meta, 0 movimientos y esquema 1; reemplazo confirmado con copia automática previa y datos íntegros |
| Archivo inválido | rechazado antes de la vista previa por formato no portable; no reemplazó datos ni creó otra copia automática |
| Sin internet | aprobada sin salida de red; el development client exigió seleccionar su servidor USB guardado y luego el producto abrió con SQLite, meta y proyección intactas |
| Estabilidad | mismo proceso activo durante la observación final de 45 segundos y cero `SIGSEGV`, `Fatal signal`, `FATAL EXCEPTION` o `AndroidRuntime` en logs limitados al PID |

El bloqueo inicial no era una incompatibilidad con Android 16 ni una causa
nativa para regenerar el APK. Era una configuración de red del proceso host
que afectaba la generación del manifiesto de desarrollo. No se cambiaron Expo,
React Native, Hermes, dependencias ni arquitectura. El `SIGSEGV` histórico no
reapareció y no se reabrió su diagnóstico.

La prueba sin internet valida el producto y su almacenamiento local una vez
cargado el bundle por USB. No convierte el development client en un binario
autónomo: su pantalla inicial no descubrió Metro sin red y requirió elegir la
entrada USB ya guardada. La autonomía de arranque de un APK de producción
queda fuera de esta ejecución.

Al cerrar la prueba se detuvieron solo la aplicación y Metro, se retiró
`adb reverse` y se eliminaron los archivos temporales creados en la carpeta
autorizada del teléfono. Después, con autorización explícita, se eliminaron los
datos y cachés de prueba, se desinstaló el development APK y se retiró la
carpeta vacía. Se verificó la ausencia del paquete, proceso, rutas externas
específicas y puente USB. La evidencia local se conserva ignorada por Git. Una
captura que incluyó el teclado del sistema se eliminó inmediatamente tanto del
teléfono como del equipo y no se conserva.

### APK `preview` autónomo interno — evidencia complementaria

Consulta: 1 de agosto de 2026. Después del cierre documental anterior se generó
un único APK EAS con el perfil `preview`, `developmentClient: false` y
`buildType: "apk"`, destinado exclusivamente a validación interna. El artefacto resolvió la
versión `0.1.0`, `versionCode 8` y SHA-256
`30F442630A7EC33F8DA48B1292B468F18AEC049C6BA15D293E394A8F0366B2C6`.

Antes de instalar se confirmó que Metro estaba cerrado, el puerto 8081 libre,
no existían reenvíos ADB y el repositorio estaba limpio y sincronizado. El
paquete anterior no estaba instalado, por lo que `adb install` terminó sin
conflicto de firma, desinstalación ni borrado de datos. Wi-Fi y datos móviles se
desactivaron antes del primer arranque y la ausencia de salida a internet se
comprobó de forma independiente.

| Etapa | Resultado confirmado |
|---|---|
| Primer arranque | apertura directa del producto sin development client, Metro ni herramientas de desarrollo |
| Meta simple y proyección | aprobadas con datos sintéticos: `200.000 COP` mensuales durante 6 meses y total de `1.200.000 COP` |
| Persistencia | aprobada tras cierre forzado y proceso nuevo; meta, plazo y proyección permanecieron sin internet |
| Exportación | aprobada hasta la generación de la copia y entrega al resolver de Android; no se inspeccionaron destinos ajenos ni se afirmó una copia externa no confirmada |
| Importación válida | copia sintética compatible, checksum verificado, vista previa de 1 meta, 0 movimientos y esquema 1; la confirmación declaró la copia automática previa y el reemplazo terminó correctamente |
| Archivo inválido | rechazado antes de ofrecer reemplazo; los datos importados permanecieron intactos |
| Estabilidad sin internet | mismo proceso durante 45 segundos, interfaz productiva estable y cero señales fatales en logs limitados al proceso |
| Cierre | conectividad restaurada, app detenida pero instalada, sin reenvíos ADB, 8081 libre y archivos externos de prueba retirados |

Durante la creación de la meta, el importe predeterminado visible tuvo que
introducirse explícitamente para superar la validación del formulario. No se
reprodujo ni se aisló una causa, por lo que se registra como observación menor y
no como fallo confirmado.

No se reprodujo el `SIGSEGV` ni apareció `SplashScreenManager`. Frente al
development APK, el `preview` abrió el bundle integrado sin selector de servidor
y sin depender de Metro o del enlace USB para ejecutar el producto. Queda
aprobado como compilación autónoma interna. Esta prueba no cubre AAB,
distribución, actualización sobre una instalación con otra firma, iOS,
accesibilidad ni recursos y rendimiento.

Esta evidencia no completaba por sí sola la Fase 5 canónica del proyecto. La
revisión sistemática posterior de seguridad y robustez se ejecutó sin generar
otro build.

## Suite de Fase 2

La suite cubre:

- strings decimales, límites inyectados, no finitos y redondeo explícito;
- fechas civiles, fin de mes, año bisiesto y convenciones de días;
- E.A., E.M., E.T., E.S., N.M.V., N.T.V., nominal vencida, nominal anticipada,
  efectiva periódica personalizada, tasa cero y `UNKNOWN`;
- equivalencias entre periodicidades, ida/vuelta y conservación del dato
  original;
- periodos de tasa consecutivos, cambios futuros, huecos y superposiciones;
- capitalización diaria, mensual limitada y al vencimiento;
- proyección simple mensual/anual y límites 1..1200 / 1..100;
- proyección avanzada, orden de eventos, inicio/final del día, aportes,
  extraordinarios, retiros y restricciones de producto;
- libro real, rendimiento confirmado, ajustes, anulaciones, duplicados,
  revisiones y cierres obsoletos;
- proyección actualizada y comparación con tolerancia explícita;
- serialización determinista, esquema cerrado, versión incompatible, tamaño,
  profundidad, relaciones, duplicados y equivalencias manipuladas.

Los valores esperados de las conversiones principales provienen de ejemplos
numéricos documentados; las pruebas no copian la función productiva para
generar su propio resultado esperado.

## Resultados ejecutados

| Control | Resultado |
|---|---|
| `npm run typecheck` | aprobado |
| `npm test` | 12 archivos, 119 pruebas aprobadas |
| `npm run test:coverage` | 119 pruebas; 93,54 % sentencias, 81,05 % ramas, 95,52 % funciones, 93,86 % líneas |
| `npm run build` | aprobado |
| `npm audit --audit-level=high` | 0 vulnerabilidades conocidas |

La cifra de cobertura debe regenerarse después de cada cambio. Una cobertura
alta no sustituye la revisión de fórmulas ni demuestra exactitud de una
condición comercial no modelada.

## Auditoría de cobertura crítica del cierre

No se buscó 100 % nominal. Se revisaron primero ramas capaces de alterar dinero
o aceptar datos corruptos. Como resultado se añadieron casos para:

- máximo por entrada, acumulación y resultado calculado;
- máximo de tasa original y E.A. equivalente;
- política COP `HALF_UP` y aporte `END_OF_DAY` predeterminado;
- nominales incompletas y fechas de consulta inválidas;
- periodos de tasa fuera del horizonte, huecos y solapamientos;
- aportes extraordinarios no permitidos y orden determinista de movimientos;
- cierre obsoleto por cambio de revisión e indiferencia ante movimientos fuera
  del periodo;
- cierre inválido, meta incorrecta y horizonte inválido en proyección
  actualizada;
- cierre real inválido en la comparación;
- fórmula, equivalencia, precisión, monto y tasa manipulados en snapshots;
- configuración activa, producto, movimiento, revisión, periodo y cierre con
  relaciones inválidas, y rechazo de resultados derivados en el snapshot;
- ausencia de `projectionMode`, versión futura, JSON corrupto, Unicode, tamaño,
  profundidad, ciclos y máximos de registros.

Las ramas restantes se concentran en defensas imposibles de alcanzar con
JavaScript válido, campos opcionales sin efecto financiero y mensajes
alternativos de un mismo rechazo ya probado. No se añadieron pruebas
artificiales para elevar el porcentaje.

## Suite de integración de Fase 3

`tests/sqlite-persistence.test.ts` cubre:

- creación, migración, versión e identidad de base;
- reinicio y reconstrucción completa;
- claves foráneas y consultas parametrizadas;
- base ajena, futura, alterada o corrupta;
- migración y transacción interrumpidas;
- unidad de trabajo y rollback por unicidad.

`tests/backup-import.test.ts` cubre:

- exportación y SHA-256;
- vista previa y confirmación;
- importación inicial;
- respaldo automático y reemplazo;
- rollback ante restricción o fallo de archivo;
- versión, JSON, checksum, extensión, tamaño, ruta y sobrescritura.

`tests/expo-sqlite-adapter.test.ts` comprueba la traducción del puerto hacia la
API estructural de `expo-sqlite`, incluida la transacción exclusiva.

`tests/snapshot-relations.test.ts` comprueba propiedad cruzada entre metas,
configuraciones, productos, periodos, movimientos, revisiones y respaldos antes
de escribir.

La validación del snapshot rechaza campos de resultados derivados para impedir
que proyecciones o comparaciones se conviertan en fuente de verdad persistente.

No se buscó mantener artificialmente el porcentaje anterior: la capa nueva
incluye defensas de plataforma difíciles de forzar sin dobles de prueba
irreales. Las ramas financieras conservan su cobertura y las pruebas nuevas se
concentran en corrupción o pérdida de datos.

## Ejecución de Fase 5 — Seguridad y robustez

Consulta: 3 de agosto de 2026. La ejecución agrupada añadió y verificó:

- configuración Android sin respaldo automático y con bloqueo de permisos
  heredados de almacenamiento y vibración;
- auditoría completa y auditoría separada del árbol de producción;
- ausencia de logging, red propia, WebView y ejecución dinámica en `src/`;
- rechazo de claves JSON duplicadas y colecciones excesivas antes del esquema;
- una sola vista previa de importación vigente;
- tamaño UTF-8 medido sin asignación proporcional por byte;
- verificación posterior de exportaciones y respaldos automáticos;
- conservación de una base incompleta sin reinicialización silenciosa;
- fallos deterministas de archivo y SQLite sin provocar falta real de espacio.

Resultados:

| Control | Resultado |
|---|---|
| `npm run check` | aprobado |
| TypeScript portable y móvil | aprobado |
| Suite | 14 archivos, 131 pruebas aprobadas |
| Cobertura | 86,18 % sentencias; 77,62 % ramas; 84,98 % funciones; 86,44 % líneas |
| Build portable y Node | aprobado |
| `npm audit --omit=dev --audit-level=moderate` | 0 hallazgos |
| Auditoría completa | 11 moderados; 0 altos; 0 críticos |
| Expo config introspectada | `allowBackup=false` y tres permisos bloqueados |
| Moto X4 | versión, banderas y permisos consultados sin abrir la app ni modificar datos |

El APK instalado era el development build histórico, depurable y con
`versionCode 7`; no valida el manifiesto endurecido ni producción. No se generó
otro build. Los límites máximos siguen pendientes de medición física con archivo
real; no se ejecutó falta de espacio ni presión deliberada de memoria.

## Pendiente por fase

### Fase 5 — Seguridad y robustez

- ejecución técnica revisada y publicada en `f8b4d56`;
- mantener los límites como provisionales hasta una medición física autorizada;
- repetir auditoría y validar manifiesto no depurable en Fase 7.

### Fase 6 — Validación visual y accesibilidad

- sistema visual e interfaz reorganizada: implementados localmente;
- contraste AA, objetivos táctiles, tema automático, orientación vertical,
  foco, semántica, estados y reducción de movimiento: verificados por contrato
  y 6 pruebas nuevas;
- suite completa: 15 archivos y 137 pruebas aprobadas;
- pantalla pequeña, claro/oscuro, texto al 130 %, teclado, foco, navegación
  táctil y reducción de movimiento: aprobados en Moto X4;
- campo oculto por el teclado detectado, corregido con medición real y aprobado
  al repetir la prueba;
- árbol accesible: 50 nodos de la app, 9 descripciones y 6 de 6 etiquetas
  críticas encontradas;
- TalkBack habilitado manualmente y enlazado como servicio hablado, háptico y
  audible: recorrido de foco aprobado en inicio, formulario y datos;
- orden, etiquetas, frecuencia seleccionada, controles de cantidad y acciones
  de exportación/selección verificados sin guardar, exportar ni importar;
- preferencias restauradas, app detenida, Metro retirado, puerto local libre y
  reenvío USB ausente;
- Fase 6 cerrada y publicada; su evidencia se reutilizó en Fase 7.

### Fase 7 — Validación funcional completa

- componentes, integración, migraciones y flujos funcionales: aprobados;
- exportación, vista previa, respaldo, importación y recuperación avanzada:
  aprobados;
- 16 archivos y 145 pruebas Vitest, más 6 pruebas de componentes: aprobados;
- AAB de tienda y APK release instalable, `versionCode 9`: compilados;
- actualización in situ desde versión 7, identidad conservada y paquete no
  depurable: aprobados;
- bundle embebido, Metro ausente, sin dev launcher, estabilidad y arranque en
  frío: aprobados;
- dependencias Expo compatibles y 20/20 controles de `expo-doctor`: aprobados;
- auditoría: 11 moderadas transitivas conocidas, 0 altas y 0 críticas; no se
  aplicó la corrección forzada incompatible.

La evidencia detallada está en `Documentacion/RESULTADOS_FASE_7.md`. No hubo
distribución.

### Fase 8 — Migración final

- comparación documental mínima: completada sin abrir código fuente del
  proyecto guía;
- brecha `CA-035`: corrección trazable conectada en dominio, aplicación,
  persistencia e interfaz;
- revisión anterior, motivo, huella y cadena de versiones: conservados;
- cierres afectados por fecha anterior o corregida: invalidados;
- exportación, inspección, importación y recuperación de revisiones: aprobadas;
- 16 archivos y 147 pruebas Vitest, más 8 pruebas de componentes: aprobados;
- cobertura: 86,48 % sentencias, 77,40 % ramas, 86,68 % funciones y 86,56 %
  líneas;
- cambios de dependencias y esquema SQLite: ninguno;
- AAB de producción de tienda con `versionCode 10`: compilado y verificado como
  contenedor con manifiesto base, bundle embebido de Fase 8 y metadatos de firma;
- operaciones sobre teléfono y distribución: no ejecutadas.

La evidencia detallada está en `Documentacion/RESULTADOS_FASE_8.md`. Fase 9 no
se inició.

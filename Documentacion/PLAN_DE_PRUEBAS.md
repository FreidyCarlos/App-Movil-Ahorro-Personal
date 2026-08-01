# Plan de pruebas

Fecha: 31 de julio de 2026. Estado: pruebas unitarias e integración ejecutadas;
diagnóstico físico sin reproducción del fallo nativo y prueba funcional
agrupada de Fase 4 aprobada en Android 9.

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
`SplashScreenManager` permanece no fatal y documentada. Android moderno sigue
pendiente sin bloquear el cierre de la comprobación en Moto X4.

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

## Pendiente por fase

### Fase 4

- formularios, navegación, estados vacíos y errores de almacenamiento;
- datos provenientes de repositorios reales.
- repetir la prueba agrupada en un Android moderno antes de cerrar
  compatibilidad;
- medir límites grandes de importación y uso de recursos en Android de gama
  baja;
- ejecutar falta de espacio real solo con autorización específica;
- comprobar actualización y reinstalación en una sesión que permita modificar
  la instalación;
- capturar únicamente logs filtrados por aplicación/PID y verificar que no
  expongan datos financieros;
- solicitar autorización antes de desinstalar, limpiar datos o provocar
  deliberadamente falta de espacio.

### Fases 5 a 7

- archivos maliciosos y límites medidos en dispositivo;
- revisión de logs, permisos, compilación y dependencias;
- accesibilidad, pantallas pequeñas y reducción de movimiento;
- flujos E2E y ejecución Android de producción.

No se declarará aprobado ninguno de estos grupos hasta ejecutarlo en su fase.

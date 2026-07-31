# Plan de pruebas

Fecha: 30 de julio de 2026. Estado: pruebas unitarias e integración de Fase 3
ejecutadas; componentes móviles y E2E permanecen pendientes.

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

No se instaló un APK: la prueba de instalación real necesita primero un
artefacto propio y autorización dentro de la Fase 4.

Entorno del equipo:

- Node 24.15.0 y npm 11.12.1 disponibles. Expo SDK 57 exige como mínimo Node
  22.13.x, por lo que la versión supera el mínimo documentado.
- Existe Java Runtime 8, pero no `javac`, JDK ni `JAVA_HOME`; no permite una
  compilación Android local moderna.
- ADB 37.0.1 está activo y funcional, pero no está en `PATH`; se localizó a
  través del proceso ya iniciado. Esto no sustituye un SDK configurado.
- No se detectaron `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `sdkmanager`, plataforma
  Android ni Build Tools verificables.
- Expo CLI, EAS CLI y dependencias Expo locales aún no existen.

Android 9 es compatible con Expo SDK 57, cuyo mínimo documentado es Android 7.
El SDK exacto se fijará al crear el proyecto en Fase 4, no durante esta
prevalidación.

### Estrategia recomendada

El artefacto principal de pruebas debe ser un **development build de Expo**:

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
- repetir migraciones, reinicio, archivos y transacciones con `expo-sqlite` en
  Android;
- conectar selector, compartición y sistema de archivos móvil.
- ejecutar falta de espacio y cierre abrupto reales en dispositivo.
- crear e instalar un development APK, comprobar apertura, cierre forzado,
  persistencia, actualización y reinstalación;
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

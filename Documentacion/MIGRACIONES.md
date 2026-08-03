# Migraciones y operación segura de SQLite

Fecha: 3 de agosto de 2026. Estado: esquema inicial implementado y recuperación
endurecida en Fase 5; probado con SQLite real y `expo-sqlite` en Android.

## Objetivo

SQLite es la fuente única de verdad financiera. Una base desconocida,
incompatible o dañada nunca se sustituye automáticamente por una base vacía.
La aplicación debe bloquear escrituras peligrosas, conservar el archivo y
ofrecer recuperación o exportación cuando sea posible.

## Adaptadores

La aplicación usa el puerto asíncrono `SqlDatabase`. Repositorios y casos de
uso no dependen de una biblioteca concreta.

- `NodeSqliteDatabase`: adaptador de integración y pruebas con `node:sqlite`
  de Node 24.15 o posterior.
- `ExpoSqliteDatabaseAdapter`: adaptador estructural para el objeto entregado
  por `expo-sqlite`; su conexión real se realizará en la Fase 4.

Node no forma parte del binario móvil. El subpath `./node` separa adaptadores de
prueba y evita introducir `node:sqlite`, `node:fs` o `node:crypto` en la entrada
portable del paquete.

El build se divide en `build:portable` —sin tipos ni APIs Node— y `build:node`
para los adaptadores de integración. `npm run build` verifica ambos.

## Identidad y versión

- `PRAGMA application_id = 1095258706`.
- `PRAGMA user_version = 1`.
- tabla `schema_migrations` con versión, nombre, instante y huella del código de
  migración;
- tabla singleton `app_metadata` con versión e indicador de integridad.

La huella de una migración detecta cambios accidentales en una migración ya
publicada. No es una firma criptográfica ni demuestra autenticidad.

Una base con `application_id` diferente, tablas ajenas o `user_version` mayor
que el soportado se rechaza sin modificar sus datos.

## Configuración por conexión

La inicialización aplica y comprueba:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
```

No se confía en el valor predeterminado de `foreign_keys`. SQLite exige
activarlo por conexión. `WAL` permite una operación local robusta y
`synchronous = FULL` prioriza durabilidad sobre una pequeña ganancia de
rendimiento.

## Secuencia de inicialización

1. Abrir el archivo sin habilitar extensiones y con modo defensivo cuando el
   adaptador lo permita.
2. Activar los `PRAGMA` de conexión.
3. ejecutar `PRAGMA quick_check(1)`;
4. verificar que la base sea nueva o tenga el `application_id` esperado;
5. leer `user_version`;
6. rechazar versiones futuras;
7. validar el historial y sus huellas;
8. ejecutar cada migración pendiente en `BEGIN IMMEDIATE`;
9. actualizar `user_version` dentro de la misma transacción;
10. verificar nuevamente historial, integridad y claves foráneas.

Si cualquier sentencia falla, SQLite revierte la migración completa. No se
captura el error para reinicializar ni borrar el archivo.

## Esquema v1

Tablas:

- `goals`;
- `plan_configurations`;
- `simple_configurations`;
- `rate_definitions`;
- `rate_periods`;
- `product_configurations`;
- `movements`;
- `movement_revisions`;
- `actual_period_closes`;
- `backup_metadata`;
- `app_settings`;
- `schema_migrations`;
- `app_metadata`.

Cada entidad conserva su carga JSON estricta y, además, columnas relacionales
para identificadores, claves foráneas, revisión, estado, fechas de consulta e
índices. Esta estrategia evita convertir importes a `REAL`: montos, tasas y
equivalencias permanecen como strings decimales exactos.

Proyecciones y comparaciones no tienen tablas: se recalculan desde los datos
base con el motor vigente. Si se incorpora una caché en otro esquema, deberá
estar versionada y ser eliminable sin pérdida.

Las relaciones cíclicas legítimas —configuración activa de una meta y revisión
vigente de un movimiento— usan claves foráneas diferidas. El `COMMIT` solo
procede cuando todo el conjunto es consistente.

Restricciones principales:

- una revisión numérica única por meta;
- una única configuración activa por meta;
- una configuración simple y un producto como máximo por revisión;
- claves de deduplicación únicas por meta;
- revisiones de movimiento únicas y crecientes;
- claves foráneas para tasas, periodos, cierres, proyecciones y comparaciones;
- una sola fila de preferencias.

## Unidad de trabajo

`DomainRepository.updateSnapshot` lee, transforma, valida, reemplaza y verifica
el estado dentro de una transacción exclusiva. El actualizador es código local
del caso de uso, no contenido ejecutable proveniente de una copia.

`replaceSnapshot` se reserva para inicialización e importación completa. Antes
del `COMMIT`:

- valida Zod, relaciones, equivalencias y límites;
- escribe mediante parámetros;
- vuelve a leer desde SQLite;
- reconstruye el snapshot;
- compara el estado canónico escrito con el esperado.

Una violación de unicidad, clave foránea, validación o verificación revierte
todo el reemplazo.

## Recuperación y límites

- Un cierre de conexión con una escritura sin confirmar conserva el estado
  anterior.
- Una migración interrumpida no deja sus tablas ni su versión parcial.
- Una relación huérfana o carga JSON inválida se reporta como corrupción.
- Si falta `app_settings` pero existe cualquier otra fila de dominio, la base se
  bloquea como incompleta y nunca se inicializa como vacía.
- La base no se borra aunque `quick_check` falle.
- Falta de espacio o bloqueo se presenta con un error seguro, sin SQL, trazas o
  rutas en la interfaz.

La reparación automática de una base dañada queda fuera del MVP. Primero se
debe conservar el archivo y evaluar qué datos son recuperables.

## Pruebas asociadas

La prueba física agrupada del 31 de julio de 2026 comprobó una base nueva con
`user_version=1`, integridad `HEALTHY` y las 13 tablas de aplicación. La meta
simple guardada produjo filas coherentes en `goals`, `plan_configurations` y
`simple_configurations`; después de cierre forzado y reapertura, la meta y su
proyección permanecieron visibles. El archivo principal, WAL y SHM se leyeron
sin modificar la base para corroborar el estado físico.

`tests/sqlite-persistence.test.ts` usa archivos SQLite temporales reales y
cubre:

- creación y reinicio;
- `application_id`, versión y claves foráneas;
- migración interrumpida;
- historial alterado;
- versión futura;
- base ajena y archivo corrupto;
- transacción abierta al cerrar la aplicación;
- consultas parametrizadas con texto hostil;
- relaciones y JSON manipulados;
- rollback de reemplazo y unidad de trabajo.

## Fuentes técnicas

Consultadas el 30 de julio de 2026:

- SQLite, claves foráneas:
  <https://www.sqlite.org/foreignkeys.html>
- SQLite, transacciones:
  <https://www.sqlite.org/lang_transaction.html>
- SQLite, `PRAGMA`:
  <https://www.sqlite.org/pragma.html>
- Node.js, módulo `node:sqlite`:
  <https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html>
- Expo, `expo-sqlite`:
  <https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/>

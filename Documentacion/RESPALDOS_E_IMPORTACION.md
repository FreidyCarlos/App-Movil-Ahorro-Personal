# Respaldos, exportación e importación

Fecha: 31 de julio de 2026. Estado: flujo portable y reemplazo seguro de Fase 3
implementados; selector y sistema de archivos comprobados en Android 9.

## Formato portable

La copia usa JSON UTF-8 cerrado y versionado:

```text
format: AHORRO_PERSONAL_BACKUP
envelopeVersion: 1
disclaimer: advertencia obligatoria de valores brutos
checksum:
  algorithm: SHA-256
  scope: CANONICAL_SNAPSHOT_JSON
  value: hexadecimal
snapshot:
  schemaVersion
  appVersion
  rulesVersion
  exportedAt
  policyMetadata
  datos completos del dominio
```

El snapshot conserva metas, revisiones, modo simple/avanzado, tasas originales
y equivalentes, productos, movimientos y revisiones, cierres auditables,
preferencias y metadatos previos. No contiene proyecciones ni comparaciones:
estas se recalculan con el motor vigente después de importar.

SHA-256 se calcula sobre el JSON canónico del snapshot. Detecta daños o
modificaciones accidentales, pero **no es una firma**, no prueba quién creó el
archivo y no impide que una persona genere una copia manipulada con otro hash.

## Límites de seguridad

Valores operativos provisionales de Fase 3:

- archivo completo: 10 MiB;
- profundidad: 20 niveles;
- metas: 100;
- movimientos: 10.000 en total;
- periodos de tasa: 1.000;
- límites de strings según el esquema cerrado.

Estos valores son techos seguros para desarrollo. Deben medirse en Android de
gama baja antes de quedar aprobados como límites definitivos del producto; hasta
entonces permanecen vigentes de forma provisional.

El tamaño se comprueba con metadatos antes de leer y otra vez sobre los bytes
UTF-8. Luego se validan profundidad, esquema, IDs, relaciones, cantidades,
tasas y equivalencias.

## Exportación

1. reconstruir el estado desde SQLite;
2. validar el snapshot completo;
3. ordenar colecciones por identificador;
4. generar SHA-256;
5. construir el sobre v1;
6. comprobar el tamaño final;
7. escribir un archivo temporal;
8. sincronizarlo;
9. publicar el nombre final sin sobrescribir otro archivo;
10. registrar `BackupMetadata`.

El adaptador Node implementa este protocolo para pruebas. El adaptador móvil
usará las APIs de archivos y compartición de Expo sin aceptar una ruta escrita
por el usuario.

Si el archivo se crea pero falla el registro posterior de metadatos, el error
debe informar que la operación quedó incompleta; el archivo válido no se borra
silenciosamente.

## Vista previa de importación

La selección no modifica datos financieros. El flujo:

1. recibe una referencia opaca del selector;
2. exige extensión `.json`;
3. comprueba que sea un archivo regular y su tamaño;
4. analiza JSON sin ejecutar contenido;
5. rechaza versiones futuras;
6. valida el sobre y el snapshot;
7. recalcula tasas equivalentes;
8. verifica SHA-256;
9. muestra archivo, versión, fecha, metas, movimientos y rango de fechas;
10. entrega un token temporal de confirmación.

El token solo vive en memoria. Tras reiniciar la aplicación se debe seleccionar
y revisar el archivo nuevamente.

## Reemplazo completo seguro

El MVP no combina historiales. Después de la confirmación explícita:

1. volver a comprobar que existe una vista previa vigente;
2. exportar automáticamente el estado actual;
3. terminar de escribir el respaldo antes de tocar SQLite;
4. iniciar una transacción exclusiva;
5. eliminar el conjunto anterior dentro de esa transacción;
6. insertar el snapshot validado con consultas parametrizadas;
7. comprobar unicidad y claves foráneas;
8. reconstruir y comparar el estado importado;
9. registrar el respaldo automático y `IMPORT_REPLACE`;
10. confirmar la transacción.

Un fallo en cualquier escritura o verificación provoca rollback. El estado
anterior permanece en SQLite y el respaldo externo, si alcanzó a crearse, se
conserva.

Si la base estaba realmente vacía, se permite la primera importación sin crear
un archivo vacío ficticio.

## Metadatos

`BackupMetadata` conserva:

- operación;
- versiones de esquema, aplicación y reglas;
- fechas de creación, exportación o importación;
- tamaño;
- algoritmo y checksum;
- cantidad de metas y movimientos;
- rango de fechas;
- nombre saneado, nunca ruta absoluta;
- resultado y código seguro;
- relación con el respaldo previo cuando existe.

No contiene credenciales, contraseñas, tokens, datos bancarios ni identificador
de hardware.

## Seguridad y privacidad

- JSON y SQLite no están cifrados en el MVP.
- Una copia puede quedar expuesta al compartirla, enviarla o guardarla en nube.
- No se ejecutan propiedades, scripts ni enlaces contenidos en el JSON.
- Los errores visibles no incluyen contenido completo, rutas, SQL o trazas.
- No se acepta combinación automática ni resolución silenciosa de duplicados.
- La combinación automática de historiales queda fuera del MVP.
- Los resultados derivados no se exportan y no pueden sustituir datos base.
- Una copia válida estructuralmente puede contener datos falsos; la aplicación
  no certifica autenticidad.

## Pruebas asociadas

La prueba física agrupada del 31 de julio de 2026 creó una copia con formato
`AHORRO_PERSONAL_BACKUP`, sobre v1, esquema v1, una meta y checksum SHA-256.
La aplicación verificó la vista previa, exigió confirmación, creó un respaldo
automático y reemplazó correctamente el estado. Un JSON ajeno renombrado con
extensión `.json` fue rechazado antes de modificar datos o crear otro respaldo.

Android 9 deshabilitó inicialmente los archivos porque el proveedor no los
expuso como `application/json`. El selector acepta ahora cualquier MIME para no
depender de esa clasificación; el almacén de archivos conserva la validación
obligatoria de extensión, tamaño, estructura, versión y checksum.

`tests/backup-import.test.ts` cubre:

- exportación y resumen;
- primera importación en base vacía;
- confirmación obligatoria y expiración;
- respaldo automático;
- reemplazo y reconstrucción;
- checksum manipulado;
- versión futura, JSON corrupto y sobre desconocido;
- restricción persistida que provoca rollback;
- fallo de escritura antes de reemplazar;
- extensión engañosa, tamaño, carpeta, ruta y nombre inseguros;
- prevención de sobrescritura.

## Fuente técnica

Consultada el 30 de julio de 2026:

- SQLite Online Backup API, usada como referencia para la futura copia binaria
  consistente de una base viva:
  <https://www.sqlite.org/backup.html>

La copia portable actual se construye desde un snapshot transaccional validado,
no copiando directamente el archivo `.db`.

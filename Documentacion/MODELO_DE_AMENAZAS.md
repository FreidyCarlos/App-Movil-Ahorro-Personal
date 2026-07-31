# Modelo de amenazas

Fecha: 30 de julio de 2026. Estado: modelo inicial actualizado con los controles
de Fase 3. La revisión completa de compilación móvil corresponde a la Fase 5.

## Alcance y activos

Activos principales:

- metas y configuraciones históricas;
- tasas originales y equivalentes;
- movimientos, revisiones y cierres;
- proyecciones y comparaciones;
- base SQLite local;
- copias JSON;
- reglas y versiones necesarias para reproducir resultados.

No son activos almacenados porque están prohibidos: credenciales bancarias,
claves, tokens, tarjetas, cookies, secretos de nube y datos de autenticación de
entidades.

## Límites de confianza

```text
Entrada de usuario
    ↓ validación de dominio
Casos de uso
    ↓ puertos tipados
SQLite local / archivo seleccionado
    ↑ datos no confiables al importar
```

El dispositivo, el selector de documentos, un archivo externo y las
dependencias son fronteras no confiables. El almacenamiento local no equivale
a cifrado.

## Amenazas y controles actuales

### Archivo manipulado o malicioso

Riesgos: JSON inválido, profundidad, tamaño, claves desconocidas, relaciones
huérfanas, duplicados, tasa manipulada, versión falsa o checksum diferente.

Controles:

- límite antes y después de lectura;
- esquema Zod cerrado;
- profundidad iterativa;
- IDs únicos y relaciones completas;
- recálculo de equivalencias;
- límites de montos y tasas;
- SHA-256 contra daño;
- confirmación y token temporal;
- transacción con rollback.

Riesgo residual: SHA-256 no autentica al autor. Una persona puede reconstruir un
archivo falso y calcular otro hash.

### Corrupción de SQLite

Riesgos: archivo incompleto, relación inválida, migración interrumpida, cierre
durante escritura o versión futura.

Controles:

- `application_id`, `user_version` e historial;
- migraciones ascendentes y transaccionales;
- `quick_check` y `foreign_key_check`;
- claves foráneas activadas por conexión;
- WAL, sincronización completa y transacciones exclusivas;
- lectura y validación posterior;
- nunca reinicializar automáticamente.

Riesgo residual: una corrupción grave puede impedir exportar todo. La reparación
forense no forma parte del MVP.

### Inyección SQL

Riesgo: nombres, notas o referencias con sintaxis SQL.

Controles:

- todas las entradas se enlazan como parámetros;
- los nombres de tabla dinámicos provienen de una lista cerrada interna;
- las migraciones contienen SQL estático;
- extensiones SQLite deshabilitadas.

### Denegación de servicio

Riesgos: copias enormes, profundidad, demasiados registros, strings extensos o
cálculos extremos.

Controles:

- 10 MiB, profundidad 20 y máximos de colecciones;
- esquemas con longitudes;
- techos de montos y tasas;
- rechazo de no finitos;
- archivos regulares y ubicaciones autorizadas en el adaptador de pruebas.

Riesgo residual: los límites deben medirse en un Android de gama baja.

### Pérdida o acceso al dispositivo

Riesgos: lectura de SQLite, copias, capturas o respaldos del sistema.

Controles actuales:

- datos mínimos y ausencia de credenciales;
- documentación explícita de falta de cifrado;
- nombres de archivos sin rutas persistidas;
- logs financieros prohibidos.

Riesgo residual alto: no existen todavía PIN, biometría, SQLCipher ni una
decisión sobre respaldo automático del sistema operativo.

### Fallo de almacenamiento

Riesgos: espacio insuficiente, archivo parcial o cierre durante importación.

Controles:

- escritura temporal y publicación sin sobrescritura;
- sincronización antes de publicar;
- respaldo terminado antes del reemplazo;
- transacción y verificación antes de commit;
- el respaldo se conserva si falla el reemplazo.

### Dependencias y cadena de suministro

Controles actuales:

- versiones exactas en `package-lock.json`;
- sin nueva dependencia SQLite de terceros para las pruebas Node;
- `npm audit --audit-level=high`;
- dominio sin red, DOM, React, Expo o SQLite.

Pendiente:

- análisis estático móvil;
- revisión de permisos;
- revisión de scripts de instalación;
- compilación firmada y proceso de actualización.

### Logs y errores

Los errores públicos usan códigos cerrados y mensajes sin SQL, rutas, contenido
financiero o trazas. Las pruebas no deben imprimir snapshots completos.

La política de logging móvil se implementará y auditará en Fases 4 y 5.

## Controles expresamente ausentes

- cifrado de SQLite;
- cifrado o contraseña de copias;
- firma digital;
- autenticación de usuario;
- bloqueo biométrico o PIN;
- protección contra un sistema operativo comprometido;
- sincronización segura en nube.

No deben presentarse como implementados ni sustituirse con criptografía casera.

## Casos verificados en Fase 3

- archivo corrupto conservado;
- base ajena y versión futura rechazadas;
- historial de migración alterado;
- migración y escritura interrumpidas;
- relación huérfana y JSON interno manipulado;
- contenido SQL hostil parametrizado;
- checksum alterado;
- archivo grande, extensión y ruta inseguras;
- fallo de respaldo antes de reemplazo;
- unicidad violada durante importación con rollback.

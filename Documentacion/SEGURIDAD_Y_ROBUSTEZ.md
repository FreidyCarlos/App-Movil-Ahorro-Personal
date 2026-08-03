# Seguridad y robustez — Fase 5

Fecha: 3 de agosto de 2026. Estado: ejecución técnica completada localmente;
pendiente de revisión y publicación. No se generó una compilación nueva.

## Alcance ejecutado

La revisión agrupada cubrió dependencias, permisos, logs, archivos manipulados,
límites, entradas extremas, almacenamiento local, respaldos, recuperación y
actualización del modelo de amenazas. Se reutilizó la evidencia válida de
Android 9, Android 16, SQLite, importación y logs sin repetir V1–V6 ni el
diagnóstico del `SIGSEGV`.

## Dependencias y cadena de suministro

- `npm audit --omit=dev --audit-level=moderate`: cero vulnerabilidades en el
  árbol que npm clasifica para producción.
- La auditoría completa conserva 11 hallazgos moderados y cero altos o
  críticos.
- Los 11 hallazgos convergen en herramientas de configuración de Expo. La
  vulnerabilidad concreta corresponde a `uuid@7.0.3`, alcanzada mediante
  `@expo/config-plugins -> xcode -> uuid`.
- La aplicación no llama las variantes UUID afectadas ni incluye `xcode` en su
  lógica financiera o de ejecución móvil. El riesgo se mantiene en la cadena
  de herramientas, no se declara inexistente.
- `npm audit fix --force` propone degradar Expo a 46.0.21. Es una corrección
  incompatible con SDK 57 y no se aplicó.
- El lockfile solo marca un script de instalación para el paquete opcional
  `fsevents`; no está instalado en el entorno Windows. No se encontraron scripts
  de instalación activos adicionales.
- Las versiones instaladas coinciden con el lockfile y `npm ls --depth=0` no
  informó dependencias inválidas.

Decisión: aceptar temporalmente los hallazgos moderados de herramientas,
mantener el lockfile y repetir la auditoría antes de la compilación de
producción de Fase 7. Una actualización solo se hará dentro de una combinación
compatible demostrada por Expo.

## Permisos Android

La introspección local de Expo identificó permisos opcionales heredados. La
configuración ahora establece `android.allowBackup = false` y bloquea:

- `android.permission.READ_EXTERNAL_STORAGE`;
- `android.permission.WRITE_EXTERNAL_STORAGE`;
- `android.permission.VIBRATE`.

El selector del sistema y las referencias opacas de Expo no requieren acceso
general al almacenamiento. Se conserva `INTERNET` porque el stack de desarrollo
y la apertura consentida de enlaces externos pueden necesitarlo; el producto no
realiza solicitudes de red propias.

`SYSTEM_ALERT_WINDOW` pertenece al manifiesto de depuración de React Native. El
APK de desarrollo instalado lo declara junto con permisos de red propios del
development client. La comprobación no destructiva del Moto X4 confirmó que era
un binario depurable con `versionCode 7`, respaldo Android habilitado y sin
concesiones sensibles de almacenamiento, cámara, micrófono o ubicación. Este
artefacto histórico no representa el manifiesto futuro de producción.

La configuración endurecida surtirá efecto en una próxima compilación nativa.
Verificar el manifiesto final no depurable y la ausencia de permisos de
desarrollo corresponde a Fase 7.

## Logs, errores, red y ejecución dinámica

La búsqueda estática sobre `src/` encontró:

- cero llamadas a `console`, registradores o `Log`;
- cero `eval`, `Function`, WebView o JavaScript inyectado;
- cero `fetch`, `XMLHttpRequest`, WebSocket o URL de red codificada;
- cero secretos o variables públicas de entorno.

Las coincidencias con la palabra `token` son exclusivamente tokens aleatorios y
efímeros de confirmación de importación. Los errores visibles continúan pasando
por mensajes cerrados y no exponen SQL, rutas, trazas, snapshots ni valores
financieros completos.

## Archivos manipulados y consumo de recursos

Controles añadidos o reforzados:

- rechazo iterativo de claves JSON duplicadas, incluso si una usa escapes como
  `\u0066ormat`;
- una sola vista previa de importación vigente, evitando acumulación de copias
  completas en memoria y reuso de tokens anteriores;
- medición UTF-8 sin construir un arreglo por cada byte;
- rechazo de metas, movimientos y periodos de tasa excesivos antes de que Zod
  recorra sus elementos;
- comprobación de tamaño antes y después de leer en Expo;
- rechazo si el archivo cambia, su tamaño real difiere o no produce texto UTF-8
  coherente;
- verificación completa del sobre, esquema y checksum después de escribir una
  exportación o respaldo automático, retirando la copia recién creada si queda
  inválida.

Siguen vigentes los techos de 10 MiB, profundidad 20, 100 metas, 10.000
movimientos y 1.000 periodos de tasa. Las pruebas automatizadas cubren ambos
lados de las fronteras y el rechazo previo de colecciones hostiles. La medición
de una importación máxima mediante la interfaz en Android de gama baja continúa
como validación física provisional: no se provocó presión real de memoria ni
falta de espacio durante esta fase.

## Almacenamiento, respaldos y recuperación

- SQLite y los JSON permanecen sin cifrar y se sigue informando expresamente.
- El respaldo automático del sistema operativo queda deshabilitado en la
  configuración Android para no copiar silenciosamente la base sin cifrar.
- La exportación explícita sigue bajo control del usuario mediante el resolver
  de Android.
- Una copia recién escrita se relee, valida y compara antes de registrarla o de
  permitir que proteja un reemplazo por importación.
- Si falla esa verificación, SQLite no se modifica.
- Una base con `app_settings` ausente pero con otras filas ya no se interpreta
  como instalación nueva: se reporta corrupción y se conserva el contenido.
- Una base verdaderamente nueva, con todas las tablas de dominio vacías, sí
  puede recibir el snapshot inicial.
- Se conservan transacciones exclusivas, verificación posterior, claves
  foráneas, `quick_check`, rollback y rechazo de bases ajenas o futuras.

La falta real de espacio no se provocó. Su comportamiento se cubre mediante
fallos deterministas del puerto de archivos y de SQLite.

## Validación ejecutada

- `npm run check`: aprobado.
- TypeScript portable y móvil: aprobados.
- Build portable y Node: aprobado.
- 14 archivos y 131 pruebas: aprobados.
- Cobertura: 86,18 % sentencias, 77,62 % ramas, 84,98 % funciones y 86,44 %
  líneas.
- `npm audit --omit=dev --audit-level=moderate`: cero hallazgos.
- Auditoría completa: 11 moderados, cero altos y cero críticos.
- Introspección de Expo: respaldo Android deshabilitado y reglas de bloqueo
  presentes para los tres permisos innecesarios.
- Moto X4: consulta de versión, banderas y permisos únicamente; no se abrió la
  aplicación, no se cambiaron permisos y no se leyeron datos.

## Riesgos residuales y límites de la conclusión

- pérdida o compromiso del dispositivo mientras está desbloqueado;
- copias JSON compartidas y sin cifrado fuera del sandbox;
- ausencia deliberada de PIN, biometría, SQLCipher y firma de copias;
- 11 hallazgos moderados en herramientas Expo sin corrección compatible;
- límites máximos aún no medidos mediante un archivo real en Android de gama
  baja;
- manifiesto, firma, depuración, AAB y artefacto de producción pendientes de
  Fase 7;
- compatibilidad iOS pendiente.

Estos riesgos no se presentan como controles implementados. El APK `preview`
continúa aprobado solo como compilación autónoma interna.

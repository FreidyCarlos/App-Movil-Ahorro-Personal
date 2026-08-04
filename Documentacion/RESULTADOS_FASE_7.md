# Resultados de Fase 7 — validación funcional y producción

Fecha de cierre técnico: 3 de agosto de 2026.

## Resultado

La Fase 7 queda completada técnicamente. Se validaron los recorridos funcionales
del MVP, persistencia y respaldo, configuración final de Expo y dos artefactos
Android release. No se distribuyó la aplicación ni se iniciaron las Fases 8 o
9.

## Validación funcional local

- TypeScript portable y móvil: aprobados.
- 16 archivos y 145 pruebas Vitest: aprobados.
- 1 suite y 6 pruebas de componentes React Native: aprobadas.
- Total ejecutado: 151 pruebas.
- Build portable y Node: aprobado.
- Cobertura Vitest: 86,51 % de sentencias, 77,63 % de ramas, 86,54 % de
  funciones y 86,59 % de líneas.
- `expo install --check`: dependencias compatibles.
- `expo-doctor`: 20 de 20 comprobaciones aprobadas.

La ejecución incluye dos metas independientes, proyección simple y avanzada,
las rutas de tasa cero, E.A., otras tasas soportadas y tasa desconocida,
movimientos reales, ajustes con explicación, retiros, rendimiento, cierres,
comparación, proyección actualizada, estados, anulaciones lógicas y revisiones
de supuestos con motivo y vigencia. Cambiar de modo avanzado a simple crea una
nueva revisión y conserva las configuraciones avanzadas anteriores.

El recorrido portable crea una meta avanzada con movimiento, cierre y revisión,
la exporta, verifica checksum y vista previa, genera respaldo automático,
reemplaza el estado y recupera meta, revisiones, movimiento y proyección
original. Las pruebas existentes de migración, corrupción, rollback y límites
también volvieron a aprobarse.

## Dependencias, permisos y configuración

La auditoría de producción mantiene 11 hallazgos moderados transitivos en
`uuid`, alcanzado por herramientas Expo a través de `xcode` y
`@expo/config-plugins`. No hay hallazgos altos o críticos. La corrección forzada
propuesta por npm cambia dependencias Expo de forma incompatible, por lo que no
se aplicó.

La configuración Android usa `versionCode 9`, `allowBackup: false` y bloquea
lectura/escritura de almacenamiento heredado y vibración. El paquete instalado
confirmó que esos tres permisos y la bandera de respaldo están ausentes.

## Artefactos Android

EAS finalizó dos builds sobre la misma fuente y con credenciales release:

- `production`: AAB de tienda, 72.298.665 bytes, SHA-256
  `521A01FECC969C1658E6984321C19C1DD16958CCF1A35D6E41D44530BB504613`.
- `production-apk`: APK release instalable, 104.894.229 bytes, SHA-256
  `1CE2537B8CB67461E24EB35B4015D1413C7A876824BAE025DF86B2B6FB07D249`.

Las copias locales están bajo un directorio de artefactos ignorado por Git. No
se publicaron en una tienda ni se autoriza distribución con este cierre.

## Instalación y ejecución

El APK release actualizó in situ el paquete de desarrollo existente desde la
versión interna 7 a la 9 mediante una instalación que conserva datos. La
identidad de instalación permaneció igual; no hubo desinstalación ni lectura de
contenido de usuario.

La aplicación instalada quedó no depurable, contiene el bundle JavaScript
integrado, no contiene entradas de `expo-dev-launcher` o `expo-dev-menu`, abrió
con Metro ausente y permaneció en el mismo proceso durante 30 segundos. No hubo
errores críticos, solicitud de bundle remoto ni referencia a Metro o menú de
desarrollo. Una referencia interna de React Native a `DevSupportManager` quedó
sin señales de activación: el paquete no es depurable, no contiene dev launcher
y el puerto de Metro no estaba escuchando. Un segundo arranque en frío también
aprobó sin entradas críticas.

Al terminar se detuvieron la aplicación y ADB. No se modificaron ajustes del
dispositivo.

## Brechas restantes

- La dependencia transitiva moderada descrita arriba queda como limitación
  conocida hasta que Expo publique una resolución compatible.
- No se ejecutó prueba física en iOS o tablet ni medición física del caso
  máximo; continúan fuera del cierre Android del MVP.
- El AAB no se distribuyó. Publicación en tienda, migración desde el proyecto
  guía y retiro de la carpeta guía no forman parte de esta fase.

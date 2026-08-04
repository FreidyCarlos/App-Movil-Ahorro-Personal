# Resultados de Fase 8 — Migración final

Fecha: 3 de agosto de 2026.

## Alcance ejecutado

La migración final se realizó como una comparación mínima y trazable. Primero
se reutilizó el análisis público de Fase 0. Después se leyeron únicamente los
tres documentos principales de la referencia que habían sido autorizados. No
se abrió su código fuente, configuración, dependencias, datos, copias ni
artefactos.

La comparación confirmó que el MVP ya incorporaba o había descartado de forma
justificada casi todos los conceptos pertinentes. La única brecha comprobable
fue la corrección de un movimiento confirmado conservando la versión anterior.

## Elemento adaptado

Se completó el flujo móvil de corrección trazable:

- el usuario puede corregir tipo, monto, fecha y nota de un movimiento activo;
- la corrección exige un motivo explícito;
- el identificador del movimiento se conserva;
- se crea una revisión inmutable enlazada con la revisión anterior;
- el saldo y las restricciones del producto se validan antes de persistir;
- un cierre afectado por la fecha anterior o por la nueva fecha queda obsoleto;
- SQLite conserva la cadena completa;
- las copias portables exportan, inspeccionan, importan y recuperan las
  revisiones;
- la interfaz reutiliza componentes nativos, etiquetas accesibles y el sistema
  visual vigente.

No fue necesario cambiar el esquema SQLite, crear una migración, instalar una
dependencia ni copiar código de la referencia.

Durante la integración se detectó que el objeto de la revisión compartía una
referencia en memoria con el movimiento vigente. El validador de copias lo
rechazó como estructura cíclica y SQLite revirtió correctamente la transacción.
La revisión ahora conserva una copia inmutable independiente; el caso quedó
cubierto tanto antes del adaptador como sobre SQLite real.

## Elementos descartados

No se migraron:

- conciliación automática con saldos externos informados;
- borradores mensuales;
- impuestos, retenciones o GMF;
- eventos, nombres o conceptos universitarios;
- fondos, productos o entidades específicas;
- sincronización por servidor o conflictos multidispositivo;
- CSV, gráficos web, DOM, CSS o Recharts;
- secretos, datos personales, bases, respaldos o artefactos;
- dependencias del proyecto guía.

Estos elementos carecen de una brecha demostrada del MVP o contradicen sus
reglas financieras, privacidad, arquitectura local o identidad visual.

## Validación automatizada

Resultados reales después de la adaptación:

- `npm run check`: aprobado;
- TypeScript portable y móvil: aprobados;
- build portable y Node: aprobados;
- 16 archivos y 147 pruebas Vitest: aprobados;
- 1 suite y 8 pruebas de componentes: aprobadas;
- total: 155 pruebas;
- cobertura: 86,48 % de sentencias, 77,40 % de ramas, 86,68 % de funciones y
  86,56 % de líneas.

Las pruebas nuevas verifican corrección de campos, motivo obligatorio, cadena
de revisiones, invalidación de cierres, persistencia SQLite, exportación,
inspección, importación, recuperación y navegación accesible.

## Compilación Android de producción

EAS generó correctamente un AAB con perfil de tienda y `versionCode 10`. La
lista blanca de compilación excluyó el proyecto guía, contexto privado, datos,
copias y artefactos locales.

El AAB se descargó únicamente a la carpeta local ignorada para comprobar su
estructura. El contenedor tiene 1.324 entradas, incluye el manifiesto base, el
bundle Android embebido con la acción de corrección de Fase 8 y dos entradas de
metadatos de firma. No se instaló porque esta ejecución no autorizó operaciones
sobre el teléfono y un AAB no es un APK instalable. No hubo envío a una tienda
ni otra forma de distribución.

## Independencia y privacidad

La compilación remota usa una lista blanca que sólo incluye archivos necesarios
del repositorio móvil. El contexto privado, el proyecto guía, datos, copias,
artefactos y archivos locales quedan fuera.

El proyecto guía no fue modificado. La aplicación móvil no necesita la
referencia para instalar dependencias, ejecutar pruebas, compilar, persistir o
restaurar datos. No se realizó distribución ni operación sobre un teléfono.

## Fase 9

Fase 9 no se inició. Cualquier consideración futura de retiro requiere un
inventario exacto, respaldo externo verificado, demostración de independencia,
revisión de exclusiones y una confirmación destructiva explícita y separada.

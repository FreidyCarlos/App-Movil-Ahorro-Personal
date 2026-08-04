# Aplicación móvil de ahorro personal

Aplicación móvil para planear, registrar y comparar metas de ahorro personales.
Está diseñada para funcionar localmente, sin cuenta de usuario, sin conexión
bancaria y sin depender de internet para sus funciones principales.

## Estado actual

La definición del MVP, el modelo y las reglas financieras están documentados.
La Fase 2 añadió un núcleo financiero TypeScript independiente y la Fase 3
incorporó esquema SQLite v1, migraciones, repositorio transaccional y copias
JSON portables con respaldo y rollback. La Fase 4 ya contiene una interfaz
Expo/React Native inicial, formulario de meta simple, adaptadores móviles de
SQLite y archivos, un development APK generado con EAS y un APK `preview`
aprobado como compilación autónoma interna.

La Fase 5 ejecutó y publicó la revisión de seguridad y robustez: dependencias,
permisos, logs, archivos manipulados, límites, almacenamiento, recuperación y
modelo de amenazas. La configuración futura deshabilita el respaldo automático
de Android y bloquea permisos heredados de almacenamiento; las copias recién
escritas se verifican antes de proteger una importación y una base incompleta ya
no puede confundirse con una instalación nueva.

La Fase 6 quedó completada y publicada. La interfaz adopta una identidad propia de **ruta
de ahorro**, reorganiza inicio, creación de meta y copias con jerarquía
editorial, tema claro/oscuro, foco visible, objetivos táctiles de 48 puntos,
texto envolvente y reducción de movimiento. La implementación y 137 pruebas
están aprobadas localmente. En el Moto X4 se aprobaron pantalla pequeña, ambos
temas, texto al 130 %, foco, teclado, navegación táctil y reducción de
movimiento; además se corrigió y repitió el ajuste del formulario sobre el
teclado. TalkBack se habilitó manualmente, quedó enlazado y recorrió inicio,
formulario y datos con orden, nombres, estados y acciones accesibles correctos.
El dispositivo y el entorno local se restauraron al terminar.

La Fase 7 quedó completada técnicamente. La interfaz móvil ya cubre creación
simple y avanzada, realidad, cierres, comparación, revisiones auditables y
cambio conservador a modo simple. El control integral aprobó 151 pruebas, la
configuración Expo pasó 20 de 20 comprobaciones y se generaron un AAB de tienda
y un APK release instalable con `versionCode 9`. El APK actualizó el paquete
existente sin borrar datos, quedó no depurable, abrió con bundle embebido y sin
Metro y aprobó estabilidad y arranque en frío. No hubo distribución. Las Fases
8 y 9 no se han iniciado.

El núcleo calcula proyecciones simples y avanzadas, normaliza tasas, reconstruye
movimientos reales, genera cierres, compara proyectado frente a real y valida
una representación JSON de dominio. La integración usa SQLite real en pruebas
Node y conecta el mismo puerto con `expo-sqlite` en la aplicación.

La primera instalación del development APK en Android 9 fue correcta, aunque
una ejecución terminó por un fallo nativo `SIGSEGV` en el hilo JavaScript
después de cargar el bundle. Seis variantes, cuatro controles de onboarding y
una prueba funcional agrupada posterior no reprodujeron el fallo; `Continue`
no mostró relación causal. En el dispositivo se validaron el esquema SQLite v1,
la creación y persistencia de una meta tras cierre forzado, la proyección, la
exportación, la importación válida, el rechazo de un archivo inválido y el flujo
sin internet. La causa del evento original permanece indeterminada. Una
validación complementaria posterior al cierre de Fase 4 repitió el recorrido
agrupado con el mismo development APK en Android 16/API 36.
El primer `Failed to open app` se aisló a una configuración de red inválida
heredada por Metro, que devolvía HTTP 500 al solicitar el manifiesto. Al
reiniciar solo Metro con un entorno limpio, el producto abrió y aprobó meta
simple, proyección,
persistencia, exportación, importación válida, rechazo seguro de JSON inválido,
funcionamiento sin internet y estabilidad sin señales fatales. No se generó
otro APK ni se cambiaron dependencias o arquitectura.

Después se generó y probó en el mismo Android 16 un APK `preview` autónomo,
versión `0.1.0` y `versionCode 8`. Se instaló como paquete nuevo y abrió
directamente el producto con Wi-Fi y datos móviles desactivados, Metro cerrado,
el puerto 8081 libre y sin `adb reverse`. Aprobó meta simple, proyección,
persistencia tras cierre forzado, exportación al resolver de Android,
importación válida con copia automática previa, rechazo de JSON inválido y una
observación final estable de 45 segundos. No mostró el development client ni
herramientas de desarrollo, y los logs limitados al proceso no registraron
`SIGSEGV`, errores fatales ni `SplashScreenManager`. Esta evidencia aprueba el
APK como compilación autónoma interna; no equivale todavía a una compilación de
producción ni a autorización de distribución.

Estas validaciones físicas complementan el cierre de la aplicación móvil. La
revisión técnica de **Seguridad y robustez** se ejecutó después, sin convertir
el APK interno en producción. La validación visual corresponde a Fase 6 y la
validación funcional completa con compilación de producción quedó registrada
en Fase 7.

El entrypoint móvil de entrega es `expo-router/entry` y usa las rutas de
`src/app`. Los entrypoints creados exclusivamente para aislar V1–V6 fueron
retirados después del diagnóstico; sus resultados permanecen documentados.

Los datos base, revisiones, configuraciones y metadatos auditables son la fuente
de verdad. Proyecciones y comparaciones se recalculan con el motor vigente; no
se almacenan ni se incluyen en las copias.

El cierre técnico de Fase 2 fijó políticas versionadas y auditables: máximo de
`10 000 000 000 COP`, máximo de `100 % E.A.` equivalente, redondeo al peso
`HALF_UP` solo al presentar/consolidar, tolerancia de equivalencias `1e-18` y
aporte proyectado al final del día por defecto. La capitalización mensual con
movimientos intermedios permanece bloqueada porque requiere un calendario de
acreditación explícito.

### Ejecutar núcleo y persistencia

Requiere Node.js 24.15 o posterior para ejecutar las pruebas SQLite con modo
defensivo.

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm run test:coverage` genera el informe local de cobertura. `dist/`,
`coverage/` y `node_modules/` no se versionan.

Las pruebas de integración crean bases y copias únicamente en carpetas
temporales del sistema. El subpath `./node` contiene adaptadores de prueba;
la entrada principal no importa APIs de Node.

## Alcance del MVP

- Varias metas de ahorro en COP.
- Proyección simple mensual o anual.
- Proyección avanzada con saldo inicial, tasas configurables y condiciones
  básicas del producto.
- Aportes periódicos y extraordinarios.
- Retiros, ajustes y rendimientos reales.
- Proyección original y actualizada.
- Comparación entre lo proyectado y lo realmente registrado.
- Persistencia local y funcionamiento sin conexión.
- Exportación e importación versionadas.

La aplicación no conecta cuentas bancarias, no consulta saldos, no transfiere
dinero, no recomienda productos financieros y no garantiza el cumplimiento de
una meta.

## Complejidad progresiva

Una meta comienza en **Proyección simple**. El usuario indica un importe
uniforme, si lo aportará por mes o por año y la cantidad de periodos. El
resultado corresponde únicamente a la suma de los aportes.

El interruptor **Usar proyección avanzada** habilita progresivamente:

- saldo inicial;
- tasa, tipo, periodicidad y capitalización;
- periodos de tasa fija o variable;
- aportes extraordinarios y retiros;
- rendimiento estimado y real;
- cierres, proyección actualizada y comparación;
- configuración básica del producto financiero.

La captura sencilla de tasa ofrece:

- Sin rendimiento.
- Tengo una tasa E.A.
- Tengo otro tipo de tasa.
- No estoy seguro.

“No estoy seguro” no genera una conversión ni un rendimiento inventado.

## Arquitectura prevista

```text
Presentación móvil
    ↓
Casos de uso
    ↓
Dominio financiero
    ↓
Repositorios
    ↓
SQLite / archivos locales
```

El dominio financiero es independiente de React Native, Expo y SQLite. Los
importes y tasas se calculan con aritmética decimal y conservan sus datos
originales para trazabilidad.

## Datos y seguridad

SQLite es la fuente única de verdad financiera del diseño implementado. Las
copias portables usan JSON versionado, SHA-256 contra daño, validación completa
y reemplazo transaccional con respaldo previo.

La primera versión no almacenará credenciales bancarias, contraseñas, tarjetas,
tokens ni secretos. El almacenamiento local y las copias no se presentarán como
cifrados mientras no exista una solución técnica comprobada. La combinación
automática de historiales queda fuera del MVP.

## Documentación

- [Análisis de la aplicación de referencia](Documentacion/ANALISIS_PROYECTO_BASE.md)
- [Definición del MVP](Documentacion/DEFINICION_MVP.md)
- [Investigación financiera para Colombia](Documentacion/INVESTIGACION_FINANCIERA_COLOMBIA.md)
- [Historias de usuario](Documentacion/HISTORIAS_DE_USUARIO.md)
- [Mapa de navegación](Documentacion/MAPA_DE_NAVEGACION.md)
- [Modelo de datos](Documentacion/MODELO_DE_DATOS.md)
- [Reglas financieras](Documentacion/REGLAS_FINANCIERAS.md)
- [Tipos y conversiones de tasas](Documentacion/TIPOS_Y_CONVERSIONES_DE_TASAS.md)
- [Criterios de aceptación](Documentacion/CRITERIOS_DE_ACEPTACION.md)
- [Limitaciones](Documentacion/LIMITACIONES.md)
- [Decisiones pendientes](Documentacion/DECISIONES_PENDIENTES.md)
- [Arquitectura del núcleo](Documentacion/ARQUITECTURA.md)
- [Plan y resultados de pruebas](Documentacion/PLAN_DE_PRUEBAS.md)
- [Migraciones y SQLite](Documentacion/MIGRACIONES.md)
- [Respaldos e importación](Documentacion/RESPALDOS_E_IMPORTACION.md)
- [Modelo de amenazas](Documentacion/MODELO_DE_AMENAZAS.md)
- [Seguridad y robustez — Fase 5](Documentacion/SEGURIDAD_Y_ROBUSTEZ.md)
- [Validación visual y accesibilidad — Fase 6](Documentacion/VALIDACION_VISUAL_Y_ACCESIBILIDAD.md)
- [Resultados de validación funcional y producción — Fase 7](Documentacion/RESULTADOS_FASE_7.md)

La documentación pública del proyecto se mantiene en `Documentacion/`.

## Advertencia financiera

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

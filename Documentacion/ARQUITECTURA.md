# Arquitectura

Fecha: 31 de julio de 2026. Estado: núcleo financiero, persistencia y primer
flujo móvil implementados; recorrido funcional básico validado en Android 9 sin
reproducir el fallo nativo original.

## Dirección de dependencias

```text
Presentación móvil (Fase 4)
    ↓
Casos de uso
    ↓
Dominio financiero TypeScript
    ↓
Puertos de repositorio, archivos y checksum
    ↓
SQLite / archivos locales
```

El código de `src/domain/` no importa React, React Native, Expo, SQLite, DOM,
Node `fs` ni APIs de red. `src/application/` depende de dominio y puertos, no
de implementaciones SQLite o archivos. El paquete expone el contrato portable
desde `src/index.ts` y los adaptadores exclusivos de pruebas Node mediante
`./node`.

## Módulos de Fase 2

```text
src/
  domain/
    models.ts                    Entidades y resultados inmutables
    errors.ts                    Errores cerrados de dominio
    decimal.ts                   Precisión decimal y cuantización explícita
    date.ts                      Fechas civiles y convenciones de días
    canonical.ts                 JSON estable y huella no criptográfica
    calculations/
      rates.ts                   Normalización y equivalencia de tasas
      interest.ts                Capitalización periódica y al vencimiento
      simple-projection.ts       Suma uniforme mensual/anual
      advanced-projection.ts     Trayectoria por eventos y tasas vigentes
      actual-ledger.ts           Libro real, revisiones y cierres
      updated-projection.ts      Continuación desde cierre válido
      comparison.ts              Proyectado frente a real
    validation/
      schemas.ts                 Esquemas estrictos Zod
    serialization/
      snapshot.ts                Snapshot de dominio v1 validado
tests/                           Pruebas unitarias sin SQLite ni interfaz
```

## Módulos de Fase 3

```text
src/
  application/
    backup/backup-service.ts              Exportación, vista previa y reemplazo
    errors/persistence-error.ts           Errores seguros de persistencia
    ports/
      backup-file-store.ts
      checksum-provider.ts
      domain-repository.ts
  infrastructure/
    database/
      sql-database.ts                     Puerto SQL portable
      migrations.ts                       Esquema v1 e inicialización
      initialize-database.ts              Verificación segura
      expo-sqlite-adapter.ts              Adaptador estructural móvil
      node-sqlite-database.ts             SQLite real para integración
    repositories/
      sqlite-domain-repository.ts         Unidad de trabajo y consultas
    files/
      safe-node-backup-file-store.ts      Archivos temporales de integración
    crypto/
      node-sha256.ts                      SHA-256 para pruebas
```

## Módulos iniciales de Fase 4

```text
src/
  app/                                      Rutas y pantallas Expo Router
  application/
    create-empty-snapshot.ts                Estado inicial persistible
    mobile-savings-service.ts               Caso de uso de meta simple
    simple-goal-form.ts                     Validación del formulario
    mobile-navigation.ts                    Contrato de rutas
  mobile/
    infrastructure/
      mobile-runtime.ts                     Composición Expo/SQLite/copias
      expo-backup-file-store.ts             Archivos privados y seleccionados
      expo-checksum-provider.ts              SHA-256 nativo
    presentation/                           Contexto, tema y errores seguros
```

La configuración TypeScript portable permanece separada de la configuración
móvil. Metro incorpora un resolvedor limitado que traduce imports relativos
`.js` hacia fuentes TypeScript cuando no existe el JavaScript físico, sin
reescribir los imports ESM que necesita el paquete Node.

## Decisiones técnicas

- `decimal.js` trabaja con precisión de 50 dígitos significativos. Las entradas
  financieras externas se expresan como strings decimales canónicos.
- Las fechas financieras son civiles `YYYY-MM-DD`; los cálculos no usan hora
  local ni milisegundos para medir días.
- La tasa canónica es efectiva anual decimal. El valor porcentual, tipo,
  periodicidad, modalidad y método originales se conservan.
- `numeric-policy-cop-v1` limita cada monto y saldo calculado a
  `10 000 000 000 COP`, el valor original a `100 %` y la equivalencia canónica
  a `100 % E.A.`. Un caso de uso puede reducir, pero no ampliar esos topes sin
  otra versión.
- `cop-half-up-0-v1` conserva el valor preciso y cuantiza al peso únicamente al
  mostrar o consolidar un cierre.
- `rate-equivalence-tolerance-v1` usa tolerancia absoluta o relativa `1e-18` y
  exige coincidencia exacta de método, fórmula y precisión.
- El aporte periódico predeterminado es `END_OF_DAY` en la fecha de cierre del
  periodo. El valor resuelto forma parte de la huella y deberá persistirse.
- Las huellas `fnv1a64:` detectan cambios accidentales en entradas y cierres;
  no son firmas, autenticación ni cifrado.
- La copia portable usa un sobre JSON v1, SHA-256, vista previa, confirmación,
  respaldo automático, reemplazo transaccional y verificación anterior al
  `COMMIT`.
- El snapshot v1 conserva metadatos de las tres políticas anteriores y aplica
  los topes a todos los datos persistentes; importar no permite omitir controles
  de captura.
- Proyecciones y comparaciones son salidas en memoria: se recalculan con el
  motor vigente y no se guardan en SQLite ni en copias.
- Una caché futura deberá declarar versión del motor y huella de entradas, y
  podrá descartarse sin afectar la fuente de verdad.
- SQLite conserva el decimal en JSON canónico y columnas `TEXT`; nunca usa
  `REAL` para montos o tasas.
- Las columnas relacionales y claves foráneas protegen unicidad, revisiones y
  relaciones. La carga JSON se valida nuevamente al leer.
- `PRAGMA application_id`, `user_version` e historial identifican la base y
  bloquean archivos desconocidos o futuros.
- Las escrituras críticas usan transacciones exclusivas y consultas
  parametrizadas.

## Restricciones deliberadas

- Capitalización diaria admite las convenciones documentadas explícitamente.
- Capitalización mensual solo se calcula con una tasa única, meses calendario
  completos y sin movimientos intermedios. Falta un calendario de acreditación
  para simular correctamente otros casos; por ello se bloquean.
- Plazo fijo simple exige capital único, una tasa fija, vencimiento coincidente,
  sin aportes/retiros y pago al vencimiento.
- Una condición comercial declarada como no soportada bloquea el cálculo.
- `UNKNOWN` conserva únicamente el estado de captura bloqueado: no crea una
  definición de tasa ni produce equivalencia o rendimiento.

## Estado de la validación móvil

El puerto SQL ya se compone con `expo-sqlite`; el selector y los archivos usan
los módulos oficiales de Expo. El development APK se generó e instaló sin
eliminar datos. Metro empaquetó el bundle y React Native llegó a ejecutar
`main`, pero Android terminó el proceso con `SIGSEGV` en el hilo `mqt_v_js`.

Una repetición controlada posterior sí demostró el arranque completo hasta la
migración, verificación, estado vacío y lectura inicial. V6 y el flujo completo
permanecieron estables durante 120 segundos tanto con el onboarding de Expo
abierto como después de pulsar `Continue`; el fallo original no se reprodujo.
Una prueba agrupada adicional validó escritura y lectura de una meta,
persistencia tras cierre forzado, proyección, exportación, importación válida,
rechazo de archivo inválido y modo sin red. No se atribuye el evento original a
SQLite, al formateo monetario, al onboarding ni a la arquitectura nueva. Faltan
pruebas de límites, falta de espacio y Android moderno.

El mensaje por ausencia de `SplashScreenManager` proviene de una búsqueda
reflectiva opcional de `expo-dev-launcher`, capturada antes de continuar. No se
hallaron duplicados ni configuración splash y no tuvo impacto observable; no
justifica por sí solo un cambio nativo.

El entrypoint final volvió a `expo-router/entry`; las rutas productivas viven en
`src/app`. Los entrypoints y rutas creados solo para V1–V6 se retiraron al
terminar el diagnóstico. Una prueba física corta posterior confirmó apertura,
meta simple, persistencia, exportación e importaciones desde esta entrada real.

La prevalidación física confirmó Android 9/API 28 y ARM64, compatibles con el
mínimo Android 7 de Expo SDK 57. La estrategia de validación usa un development
build propio; Expo Go no es evidencia suficiente para persistencia,
configuración nativa, reinstalación o entrega.

El APK de desarrollo se generó mediante EAS Build con una lista blanca de
archivos. La alternativa sin nube sigue siendo JDK 17 más Android SDK
Command-Line Tools, plataforma y Build Tools. Android Studio no es requisito
inicial al disponer de un dispositivo físico.

La integración Node usa el SQLite incluido en Node 24.15 únicamente para pruebas
con archivos temporales reales. No es una dependencia del binario móvil.

Detalles: [MIGRACIONES.md](MIGRACIONES.md) y
[RESPALDOS_E_IMPORTACION.md](RESPALDOS_E_IMPORTACION.md).

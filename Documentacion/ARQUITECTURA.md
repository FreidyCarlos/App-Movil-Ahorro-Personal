# Arquitectura

Fecha: 30 de julio de 2026. Estado: núcleo financiero de Fase 2 implementado;
presentación, casos de uso móviles y persistencia permanecen pendientes.

## Dirección de dependencias

```text
Presentación móvil (futura)
    ↓
Casos de uso (futuros)
    ↓
Dominio financiero TypeScript
    ↓
Puertos de repositorio (Fase 3)
    ↓
SQLite / archivos locales (Fase 3)
```

El código de `src/domain/` no importa React, React Native, Expo, SQLite, DOM,
Node `fs` ni APIs de red. El paquete puede compilarse de forma independiente y
expone su contrato desde `src/index.ts`.

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
- La serialización de Fase 2 valida objetos/strings en memoria. Selección de
  archivos, checksum SHA-256 de una copia, respaldo, transacción y rollback
  pertenecen a la Fase 3.
- El snapshot v1 conserva metadatos de las tres políticas anteriores y aplica
  los topes tanto a movimientos como a resultados derivados; importar no
  permite omitir controles de captura.

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

## Frontera de la siguiente fase

La Fase 3 podrá implementar repositorios, migraciones y archivos usando estos
contratos, sin introducir dependencias de infraestructura dentro del dominio.
No se ha elegido todavía una biblioteca SQLite ni se ha creado código móvil.

# Plan de pruebas

Fecha: 30 de julio de 2026. Estado: pruebas unitarias de Fase 2 ejecutadas;
integración SQLite, componentes móviles y E2E permanecen pendientes.

## Herramientas

- TypeScript en modo estricto para validación estática.
- Vitest para pruebas unitarias.
- Cobertura V8 para medir sentencias, ramas, funciones y líneas.
- `npm audit` contra el registro oficial para vulnerabilidades conocidas.

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
| `npm test` | 8 archivos, 90 pruebas aprobadas |
| `npm run test:coverage` | 90 pruebas; 95,65 % sentencias, 87,13 % ramas, 97,16 % funciones, 95,57 % líneas |
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
- configuración activa, producto, movimiento, revisión, periodo, cierre,
  proyección y comparación con relaciones inválidas;
- ausencia de `projectionMode`, versión futura, JSON corrupto, Unicode, tamaño,
  profundidad, ciclos y máximos de registros.

Las ramas restantes se concentran en defensas imposibles de alcanzar con
JavaScript válido, campos opcionales sin efecto financiero y mensajes
alternativos de un mismo rechazo ya probado. No se añadieron pruebas
artificiales para elevar el porcentaje.

## Pendiente por fase

### Fase 3

- SQLite temporal real, migraciones, transacciones y reinicio;
- repositorios y conservación de revisiones;
- exportación/importación de archivo, respaldo y rollback;
- interrupción, falta de espacio y base dañada.

### Fase 4

- formularios, navegación, estados vacíos y errores de almacenamiento;
- datos provenientes de repositorios reales.

### Fases 5 a 7

- archivos maliciosos y límites medidos en dispositivo;
- revisión de logs, permisos, compilación y dependencias;
- accesibilidad, pantallas pequeñas y reducción de movimiento;
- flujos E2E y ejecución Android de producción.

No se declarará aprobado ninguno de estos grupos hasta ejecutarlo en su fase.

# Análisis de la aplicación previa de referencia

## Propósito

Antes de definir la aplicación móvil se estudió una aplicación web previa
únicamente como referencia funcional. El objetivo fue identificar aprendizajes
sobre proyección, seguimiento real, validaciones y persistencia, no convertir
automáticamente el producto ni copiar su interfaz.

La aplicación previa no forma parte de este repositorio. No existe dependencia
de sus archivos, rutas, servicios o componentes.

## Principios derivados del análisis

- Mantener separadas la proyección original, la realidad registrada, la
  proyección actualizada y la comparación.
- No confundir ingreso personal con dinero efectivamente ahorrado.
- Conservar trazabilidad al modificar supuestos o corregir movimientos.
- Reescribir el motor financiero para admitir varios tipos de tasa.
- Usar aritmética decimal de extremo a extremo.
- Diseñar persistencia móvil relacional y versionada.
- Validar completamente importaciones antes de modificar datos.
- Diseñar una experiencia móvil propia y progresiva.
- Eliminar conceptos especializados que no aporten a metas de ahorro generales.

## Arquitectura observada

La aplicación de referencia utilizaba una arquitectura web basada en React y
TypeScript, con estado de dominio, validación, persistencia local y una capa
gráfica orientada al navegador.

Los límites principales encontrados fueron:

- dominio acoplado a periodos mensuales;
- rendimiento expresado principalmente como E.A.;
- conversiones que perdían precisión al pasar a números binarios;
- persistencia concentrada en documentos JSON;
- importación sin recuperación transaccional completa;
- componentes visuales dependientes del DOM y del navegador;
- conceptos funcionales demasiado especializados para una aplicación general.

La aplicación móvil conservará únicamente los aprendizajes conceptuales. Su
arquitectura será independiente:

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

## Modelos conceptuales identificados

### Configuración y proyección

La referencia demostró el valor de agrupar:

- objetivo;
- plazo;
- saldo inicial;
- aporte periódico;
- tasa estimada;
- resultados por periodo;
- totales de aportes y rendimiento.

Estos conceptos se adaptan al modelo `SavingsGoal` y a revisiones inmutables de
`SavingsPlanConfiguration`.

### Seguimiento real

También resultó útil la separación entre:

- valores proyectados;
- aportes realmente registrados;
- rendimiento realmente recibido;
- diferencias frente al plan;
- continuación de la proyección desde un corte real.

En el producto móvil esta separación se reescribe mediante
`SavingsMovement`, `ActualPeriodClose`, `ProjectionResult` y
`ComparisonResult`.

### Persistencia

La referencia almacenaba un estado consolidado. Ese enfoque es práctico para
una prueba web pequeña, pero no ofrece suficiente integridad, migración ni
trazabilidad para el producto móvil.

La nueva aplicación usará:

- SQLite como fuente única de verdad;
- esquema relacional;
- versión de esquema;
- migraciones;
- claves foráneas;
- transacciones;
- revisiones y borrado lógico;
- exportación JSON versionada.

## Reglas financieras aprovechables

### Separación de aportes y rendimiento

El resultado debe mostrar de manera independiente:

- saldo inicial;
- aportes;
- retiros;
- rendimiento bruto estimado;
- rendimiento real;
- saldo final.

Esta separación se conserva y amplía.

### Momento del aporte

La referencia evidenció que el resultado depende de cuándo se aplica un aporte.
La aplicación móvil guardará una convención explícita de inicio o final del
periodo. No se asumirá que todas las entidades remuneran desde el mismo
momento.

### Proyección actualizada

Continuar desde el último estado real válido es una idea útil, pero debe
mantenerse separada de la proyección original. Una edición de supuestos crea una
revisión nueva y no reescribe resultados históricos.

### Tasa efectiva

La conversión compuesta entre una E.A. y una tasa periódica sigue siendo
aplicable. Sin embargo, el motor anterior no representaba suficientemente:

- tasas efectivas distintas de E.A.;
- tasas nominales;
- periodicidad de capitalización;
- modalidad anticipada o vencida;
- convenciones de días;
- tasas variables mediante periodos;
- reglas propias del producto.

Por ello, las fórmulas y el modelo de tasas se reescriben de acuerdo con
[`REGLAS_FINANCIERAS.md`](REGLAS_FINANCIERAS.md) y
[`TIPOS_Y_CONVERSIONES_DE_TASAS.md`](TIPOS_Y_CONVERSIONES_DE_TASAS.md).

### Precisión y redondeo

La nueva aplicación no convertirá valores decimales a punto flotante binario
durante el cálculo. Mantendrá precisión interna, registrará la versión de la
política y redondeará únicamente al mostrar o consolidar.

## Validaciones que se adaptan

Se conserva el propósito de validar:

- importes positivos;
- fechas coherentes;
- objetivo mayor que cero cuando sea obligatorio;
- plazo válido;
- ajustes con explicación;
- consistencia de totales;
- estructura de archivos importados.

Se añaden controles de dominio para:

- números finitos;
- límites de importe, tasa, horizonte y cantidad de registros;
- nominales con capitalización explícita;
- anticipadas con datos completos;
- periodos de tasa no superpuestos;
- huecos de tasa declarados;
- retiros compatibles con saldo y producto;
- identificadores y relaciones únicos;
- archivos grandes o profundamente anidados;
- versiones futuras incompatibles.

## Pruebas conceptualmente reutilizables

Se adaptarán casos sobre:

- tasa cero;
- saldo inicial;
- aportes periódicos y extraordinarios;
- meses sin aporte;
- cambios de tasa;
- conciliación entre plan y realidad;
- comparación por periodo;
- serialización y validación.

Las pruebas se reescribirán contra el dominio móvil. No se trasladarán pruebas
que dependan del DOM, APIs del navegador, estilos web o detalles de la
implementación previa.

## Componentes que no migran

- React DOM y elementos HTML;
- hojas CSS y supuestos de viewport web;
- bibliotecas gráficas dependientes del navegador;
- servidor web local;
- herramientas de compilación exclusivas del proyecto web;
- almacenamiento basado en APIs del navegador;
- descarga mediante enlaces o blobs;
- navegación y tablas diseñadas para escritorio;
- pruebas específicas de DOM.

La interfaz móvil usará componentes nativos, navegación táctil, accesibilidad,
texto ampliado, claro/oscuro y reducción de movimiento.

## Conceptos especializados descartados

La aplicación previa estaba orientada a un propósito específico. El producto
nuevo elimina:

- periodos académicos;
- costos y pagos propios de educación formal;
- calendarios académicos;
- categorías de formación;
- textos que restrinjan el ahorro a un único propósito;
- nombres internos asociados a ese dominio.

Algunas ideas se generalizan:

| Concepto especializado | Modelo general |
|---|---|
| Pago futuro programado | Hito o retiro planificado |
| Aporte adicional | Aporte extraordinario |
| Periodo de seguimiento | Cierre real |
| Desfase del plan | Comparación proyectado frente a real |
| Escenario alternativo | Revisión de configuración |

## Clasificación de reutilización

### Se conserva conceptualmente

- separación entre plan, realidad y comparación;
- desglose de aportes y rendimiento;
- cálculo reproducible;
- validación de entradas;
- pruebas de escenarios financieros básicos.

### Se adapta

- configuración de metas;
- calendario de aportes;
- cortes y conciliación;
- proyección actualizada;
- exportación e importación;
- presentación de resultados.

### Se reescribe

- motor de tasas;
- aritmética decimal;
- movimientos y revisiones;
- persistencia SQLite;
- migraciones;
- respaldo y restauración;
- validación de archivos;
- interfaz móvil;
- accesibilidad.

### Se descarta

- interfaz web;
- componentes DOM y CSS;
- infraestructura de servidor web;
- almacenamiento monolítico;
- categorías especializadas;
- supuestos vinculados a una entidad o producto concreto.

## Riesgos identificados

### Falsa precisión

Una tasa no describe por sí sola capitalización, pago, disponibilidad ni
convención de días. El motor debe bloquear configuraciones incompletas en lugar
de producir cifras aparentemente exactas.

### Pérdida de trazabilidad

Sobrescribir configuraciones o movimientos impediría explicar un resultado.
Las modificaciones deben crear revisiones y conservar el historial.

### Corrupción o importación manipulada

Un archivo puede ser incompatible, enorme o malicioso. La importación requiere
límites, esquema cerrado, respaldo, transacción, verificación y restauración.

### Precisión numérica

Redondear en cada periodo o convertir a punto flotante puede acumular
diferencias. El dominio debe usar decimal y una política versionada.

### Almacenamiento local

Guardar datos localmente no equivale a cifrarlos. La documentación y la
interfaz deben explicar las limitaciones reales de la base y de las copias.

## Conclusión

La aplicación previa aportó aprendizajes útiles de organización y seguimiento,
pero no constituye una base de código para el producto móvil. La solución nueva
generaliza el dominio, amplía el modelo financiero, adopta persistencia móvil
versionada y diseña una experiencia propia.

No se copia la interfaz ni se reutiliza literalmente código productivo. La
aplicación móvil puede desarrollarse, probarse y distribuirse sin acceso a la
referencia utilizada durante el análisis.

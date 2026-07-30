# Mapa de navegación móvil

Fecha: 30 de julio de 2026. Diseño conceptual, no interfaz implementada.

## Estructura principal

```text
Inicio
├─ Resumen de metas
├─ Alertas y siguiente aporte
├─ Registrar aporte rápido
└─ Meta seleccionada
   ├─ Detalle
   ├─ Proyección
   ├─ Proyectado vs. real
   └─ Historial

Metas
├─ Lista, filtros y orden
├─ Crear meta
└─ Editar configuración mediante nueva revisión

Registrar
├─ Aporte
├─ Aporte extraordinario
├─ Rendimiento real
├─ Retiro
└─ Ajuste con explicación

Configuración y datos
├─ Preferencias y accesibilidad
├─ Exportar copia
├─ Importar y reemplazar
├─ Integridad y recuperación
└─ Información, fuentes, seguridad y advertencias
```

En pantallas pequeñas, la navegación inferior usa **Inicio**, **Metas**,
**Registrar** y **Datos**. Proyección, comparación e historial son pestañas o
acciones del detalle de una meta, porque solo tienen sentido con contexto.

## Crear o editar una meta

Flujo progresivo:

1. **Meta simple:** nombre, importe periódico, mes/año y cantidad de periodos.
2. **Resultado inmediato:** total de aportes; controles para agregar o quitar
   periodos; fecha inicial y objetivo opcionales.
3. **Interruptor:** **Usar proyección avanzada**, desactivado por defecto.
4. **Detalles avanzados:** solo si se activa el interruptor.
5. **Revisión:** resumen de supuestos, datos bloqueantes y advertencia cuando
   corresponda.
6. **Confirmación:** crea meta o nueva revisión.

Editar no abre todos los campos a la vez. Un cambio financiero muestra desde
qué fecha rige, qué histórico se conserva y por qué se requiere un motivo.

## Proyección simple y transición

La pantalla inicial no muestra tasa, producto, saldo inicial, retiros ni
seguimiento real. Explica:

> Sin una tasa, el total corresponde únicamente a la suma de tus aportes.

Ejemplos de lectura: `$200.000 cada mes × 18 meses` y `$3.000.000 cada año × 5
años`. La cantidad se escribe libremente dentro de límites válidos; los botones
agregar/quitar son atajos y no sustituyen la entrada numérica.

Activar **Usar proyección avanzada** mantiene los campos básicos y despliega
secciones en el mismo flujo. Desactivarlo cuando existen datos avanzados abre
un diálogo que enumera qué dejará de influir. Confirmar crea una revisión simple
y conserva la configuración avanzada anterior; cancelar mantiene el modo.

## Rendimiento sencillo dentro de proyección avanzada

```text
¿Cómo deseas proyectar el rendimiento?
├─ Sin rendimiento
│  └─ Confirmar tasa cero
├─ Tengo una tasa E.A.
│  ├─ Valor y vigencia
│  ├─ Disponibilidad/plazo
│  └─ Revisión
├─ Tengo otro tipo de tasa
│  └─ Formulario avanzado
└─ No estoy seguro
   ├─ Qué datos buscar
   ├─ Guardar borrador
   └─ Proyección de aportes marcada “rendimiento pendiente”
```

“No estoy seguro” no navega a resultados de rendimiento ni convierte. Debe
indicar: abreviatura, periodo, nominal/efectiva, capitalización,
anticipada/vencida, vigencia, base de días y forma de pago.

## Rendimiento avanzado dentro de proyección avanzada

Secciones colapsables:

1. dato publicado: valor, tipo y periodicidad;
2. liquidación: capitalización, anticipada/vencida y base de días;
3. vigencia: fija/variable, inicio y final;
4. producto: disponibilidad, aportes, retiros, vencimiento y pago;
5. fuente: entidad/producto opcionales, fecha de consulta, URL/nota;
6. equivalencia: solo lectura, fórmula y bloqueos.

El resultado canónico nunca oculta la entrada original.

## Detalle de meta

- encabezado: saldo real y avance textual;
- próxima acción: siguiente aporte o dato pendiente;
- tarjetas: proyectado, real, diferencia y rendimiento;
- selector: Resumen / Proyección / Comparación / Historial;
- acción principal fija: Registrar;
- menú secundario: cambiar supuestos, pausar, completar, archivar.

Una gráfica siempre tiene valores y descripción equivalentes.

En modo simple solo se muestran resumen, total y desglose de aportes
planificados. Registrar, rendimiento, comparación y producto aparecen al
activar la proyección avanzada; no se muestran como opciones deshabilitadas que
estorben el flujo básico.

## Registrar movimiento

1. meta preseleccionada o selector;
2. tipo;
3. monto y fecha civil;
4. nota obligatoria para ajuste;
5. validación de saldo/producto;
6. resumen del efecto;
7. confirmación.

Anular o corregir crea revisión, muestra el efecto sobre cierres y pide motivo.
No existe borrado físico desde la interfaz del MVP.

## Importar copia

```text
Seleccionar archivo
→ comprobar extensión/MIME/tamaño
→ analizar y validar esquema cerrado
→ mostrar versión, metas, movimientos y rango
→ explicar reemplazo completo
→ crear respaldo local automático
→ confirmación destructiva
→ transacción
→ verificación
├─ éxito: resumen
└─ fallo: restauración y opciones de recuperación
```

Una versión futura, archivo profundo o integridad fallida se detiene antes de
modificar datos.

## Estados transversales

- vacío: explica la acción siguiente;
- carga: no bloquea navegación innecesariamente;
- error de validación: junto al campo y con solución;
- almacenamiento no disponible: bloquea escritura y conserva lectura cuando
  sea segura;
- integridad dudosa: bloquea importar/editar, ofrece exportar o recuperar;
- texto ampliado: tarjetas en una columna, sin truncar acciones;
- reducción de movimiento: transiciones instantáneas;
- offline: comportamiento normal, sin mensaje de error de red.

## Acciones destructivas

Requieren nombre de la meta/acción, consecuencia y confirmación:

- archivar;
- anular movimiento;
- reemplazar datos al importar;
- descartar un borrador con cambios.

Completar o pausar es reversible. Archivar no elimina.

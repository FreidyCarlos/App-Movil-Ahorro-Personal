# Aplicación móvil de ahorro personal

Aplicación móvil para planear, registrar y comparar metas de ahorro personales.
Está diseñada para funcionar localmente, sin cuenta de usuario, sin conexión
bancaria y sin depender de internet para sus funciones principales.

## Estado actual

La definición del MVP, el modelo conceptual y las reglas financieras están
documentados. La implementación móvil todavía no ha comenzado.

No existe aún una versión instalable, una base SQLite productiva ni
instrucciones de ejecución. Esta sección se actualizará cuando esté disponible
el primer núcleo funcional.

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

El dominio financiero será independiente de React Native, Expo y SQLite. Los
importes y tasas se calcularán con aritmética decimal y conservarán sus datos
originales para trazabilidad.

## Datos y seguridad

SQLite será la fuente única de verdad financiera. Las copias portables usarán
JSON versionado, validación completa y reemplazo transaccional con respaldo
previo.

La primera versión no almacenará credenciales bancarias, contraseñas, tarjetas,
tokens ni secretos. El almacenamiento local y las copias no se presentarán como
cifrados mientras no exista una solución técnica comprobada.

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

La documentación pública del proyecto se mantiene en `Documentacion/`.

## Advertencia financiera

> La proyección muestra valores brutos estimados. No incluye retenciones,
> impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor
> real puede ser menor.

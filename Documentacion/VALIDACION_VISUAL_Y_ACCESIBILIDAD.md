# Validación visual y accesibilidad — Fase 6

Fecha de ejecución local: 3 de agosto de 2026.

Estado: **implementación, validación automatizada, revisión física visual y
recorrido con TalkBack completados**. La Fase 6 queda cerrada técnicamente en
local y pendiente de publicación. La Fase 7 no se ha iniciado.

## Objetivo visual

La interfaz adopta el concepto propio **ruta de ahorro**. No intenta parecerse
a un tablero bancario genérico ni copia la aplicación de referencia. Usa una
composición editorial compacta para ordenar mucha información sin presentar
como ahorro real lo que solo es un plan.

Principios aplicados:

- panorama primero, detalle después;
- cada meta se presenta como un trayecto numerado;
- montos, cadencia y duración tienen jerarquías distintas;
- color coral para hitos y decisiones; verde petróleo para acciones y datos;
- superficies cálidas en modo claro y fondos profundos en modo oscuro;
- elementos gráficos creados con vistas nativas, sin imágenes pesadas;
- ninguna gráfica o color sustituye la descripción textual.

## Organización implementada

### Inicio

- encabezado editorial e identidad geométrica propia;
- resumen agregado de aportes planeados y cantidad de metas;
- estado vacío con una única acción principal;
- tarjetas numeradas que separan destino, aporte, duración y tasa cero;
- acciones de nueva meta y cuidado de datos después del contenido;
- advertencia financiera visible sin competir con la acción principal.

El total agregado suma proyecciones simples. Se rotula como **aportes
planeados** y nunca como saldo o ahorro real.

### Nueva meta

- recorrido visible en tres bloques: propósito, ritmo e inicio;
- frecuencia mensual/anual como grupo de radio;
- cantidad editable y botones de incremento/decremento como atajos;
- vista previa separada del formulario;
- mensajes junto al campo y anuncio accesible de errores;
- explicación explícita de tasa cero y ausencia de conexión bancaria.

### Cuidado de datos

- exportación, inspección y reemplazo se explican como tres decisiones;
- la diferencia entre checksum y cifrado se presenta antes de las acciones;
- la vista previa muestra metas, movimientos, esquema y archivo seleccionado;
- el reemplazo conserva resumen, copia automática previa y confirmación nativa;
- el botón destructivo permanece como descendiente accesible independiente.

## Sistema accesible

- tema claro y oscuro seleccionados por la preferencia del sistema;
- contraste mínimo automatizado de `4.5:1` para combinaciones de texto normal;
- objetivo táctil mínimo de 48 puntos;
- ancho de lectura limitado a 680 puntos y tarjetas de una columna;
- contenido envolvente, sin `numberOfLines` en las pantallas informativas;
- encabezados, botones, radios, estados y mensajes con semántica accesible;
- foco visible en botones mediante un borde violeta independiente del color de
  estado;
- errores y avisos con `accessibilityLiveRegion`;
- navegación por teclado conservada mediante controles nativos enfocables;
- transiciones de la pila desactivadas cuando el sistema solicita reducción de
  movimiento;
- orientación admitida: vertical, declarada explícitamente en Expo.

## Evidencia automatizada

La ejecución completa posterior al rediseño aprobó:

| Control | Resultado |
|---|---|
| TypeScript portable y móvil | aprobado |
| Suite completa | 15 archivos, 137 pruebas aprobadas |
| Pruebas visuales y de accesibilidad | 6 aprobadas |
| Build portable y Node | aprobado |
| Contraste claro/oscuro | todas las parejas evaluadas superan `4.5:1` |
| Whitespace y truncado explícito | sin truncado en pantallas informativas |

Las pruebas automatizadas verifican tokens de contraste, objetivos táctiles,
ancho de contenido, tema automático, orientación, reducción de movimiento,
foco, regiones anunciables, radios y confirmación destructiva. No sustituyen
una prueba real con lector de pantalla ni texto aumentado.

## Evidencia física en Moto X4

Se reutilizó el development build instalado y Metro offline; no se compiló ni
instaló otro APK. El bundle Android se generó sin errores JavaScript.

Resultados aprobados:

- inicio, tarjeta de meta, acciones y advertencia completos en pantalla de 360
  puntos de ancho;
- formulario y pantalla de datos con envoltura, jerarquía y desplazamiento;
- tema claro y oscuro con lectura y contraste conservados;
- texto aumentado de `1.0` a `1.3`: montos, tarjetas, botones y advertencias no
  se truncaron;
- foco violeta visible al navegar con Tab;
- Enter activó la acción enfocada y abrió el formulario;
- escalas de animación en cero: navegación correcta sin transición visible;
- apertura táctil de las tres pantallas sin ejecutar exportación, importación
  ni guardado;
- árbol de accesibilidad real: 50 nodos de la app, nueve descripciones y seis
  de seis etiquetas críticas encontradas;
- TalkBack habilitado manualmente y enlazado como servicio hablado, háptico y
  audible;
- foco accesible visible y desplazamiento automático aprobados en inicio,
  formulario y datos;
- inicio recorrido en orden por resumen, meta y acciones de nueva meta/cuidado
  de datos;
- formulario recorrido por nombre, monto, frecuencias, cantidad y atajos; la
  frecuencia mensual expuso correctamente su estado seleccionado;
- datos recorrido por creación de copia y selección de JSON. La acción
  destructiva conserva su rama condicional después de validar un archivo y no
  fue ejecutada;
- preferencias de texto, tema, animación, accesibilidad y exploración táctil
  restauradas exactamente a sus valores iniciales.

La prueba de teclado reveló inicialmente que Android 9 dejaba el campo enfocado
bajo el teclado. Se corrigió con medición de la posición real mediante
`measureInWindow` y desplazamiento no animado posterior al cambio de tamaño. La
repetición física mostró el campo completo por encima del teclado.

## Cierre de TalkBack

Los intentos previos por configuración segura no habían enlazado el servicio.
Tras la activación manual visible, Android informó TalkBack como servicio
enlazado con retroalimentación hablada, háptica y audible. El indicador verde de
foco permitió comprobar el recorrido real y el desplazamiento automático en
las tres pantallas. Las etiquetas y estados coincidieron con el árbol accesible
y con los contratos automatizados.

La prueba completa la brecha técnica de Fase 6. Solo queda revisar y publicar
el cambio cuando el usuario lo autorice; esa publicación no inicia Fase 7.

No se tocaron datos personales, otras aplicaciones ni contenido externo. No se
guardó la entrada sintética del formulario ni se ejecutaron copias. No se
generó APK, AAB ni compilación de producción.

Al cerrar la ejecución, TalkBack y la exploración táctil se deshabilitaron, los
servicios accesibles volvieron al estado inicial, la app quedó detenida, Metro
fue retirado, el puerto local quedó libre y el reenvío USB quedó ausente.

## Límites de esta fase

- La interfaz conectada continúa siendo el recorrido simple entregado en Fase
  4. El sistema visual queda preparado para crecer, pero no inventa pantallas
  avanzadas todavía no conectadas.
- iOS y tablet no tienen validación física.
- La orientación horizontal no forma parte del alcance admitido actual.
- La compilación de producción, E2E completo y distribución pertenecen a Fase
  7.

# Diseño de la extensión SumaTiempos

## Objetivo

Crear una extensión Manifest V3 independiente llamada `SumaTiempos` para mostrar, en tiempo real, la suma completa del tiquete que se está preparando en Gente Crystal. La extensión actuará únicamente en `https://gentecrystal.net/controllers/sales/SalesController.php*` y no modificará `TimeMasterGentecrystal` ni las demás extensiones del repositorio.

## Regla de cálculo

La tarjeta mostrará la suma de lo que ya está agregado al tiquete y lo que todavía está escrito en la sección de captura:

`total mostrado = total agregado + cantidad de números válidos × (monto normal + monto reventado)`

Las fuentes del DOM serán:

- `#ticket-numbers`: números pendientes de agregar.
- `#ticket-amount`: monto normal por cada número.
- `#ticket-amount-companion`: monto reventado por cada número, solo cuando su contenedor esté visible y el control esté habilitado.
- `#total-amount`: total que Gente Crystal ya presenta en el botón para ingresar la venta.

Por ejemplo, tres números con monto normal de `₡100`, monto reventado de `₡50` y un total ya agregado de `₡200` producirán `₡650`.

Los números se contarán a partir de grupos válidos de uno o dos dígitos separados en el campo. Los espacios consecutivos y separadores comunes no crearán entradas vacías. Los valores monetarios vacíos o no válidos se tratarán como cero, y los importes se normalizarán antes de operar para evitar concatenaciones o resultados `NaN`.

## Comportamiento

- La tarjeta permanecerá oculta cuando no haya números pendientes ni monto agregado.
- Aparecerá apenas exista al menos un número válido en `#ticket-numbers`, incluso si su suma monetaria todavía es cero.
- Se actualizará con cada cambio en los números, el monto normal, el monto reventado o el total agregado.
- Después de pulsar `#btn-add`, los números pendientes desaparecerán del cálculo cuando la página limpie el campo, pero el monto seguirá visible porque pasará a formar parte de `#total-amount`.
- Si Gente Crystal agrega, elimina o modifica líneas del tiquete, el total se recalculará desde el DOM actual.
- Al pulsar `#btn-submit-sale`, la tarjeta se ocultará y reiniciará inmediatamente, sin esperar una confirmación del servidor.
- Después del reinicio se ignorará temporalmente el valor antiguo del pie para impedir que una mutación tardía vuelva a mostrar la venta anterior. La supresión terminará cuando la página limpie el total o comience una nueva captura.
- La inicialización será idempotente para evitar tarjetas y listeners duplicados si la página reemplaza parte del contenido.

## Presentación

La extensión inyectará una tarjeta con el identificador propio `#sumatiempos-panel`, sin reutilizar clases privadas de Gente Crystal. Mostrará:

- El título `Suma total`.
- El total general en formato de colones, con dos decimales.
- El desglose `Tiquete` y `En captura`.
- La cantidad de números pendientes.

Cuando exista espacio horizontal, la tarjeta se ubicará en el área derecha y se alineará verticalmente con `.sales-capture`. Su posición se recalculará al redimensionar o desplazar la ventana. En pantallas sin espacio lateral suficiente, se convertirá en una tarjeta compacta fija en la esquina inferior derecha, con un ancho máximo que no desborde la ventana.

El estilo usará colores compatibles con la interfaz mostrada por Gente Crystal, un contraste legible y una elevación moderada. La tarjeta tendrá `pointer-events: none` para no bloquear controles de la página y atributos ARIA para anunciar cambios del total sin interrumpir la captura.

## Arquitectura y archivos

La implementación se aislará en `extensions/SumaTiempos/`:

- `manifest.json`: manifiesto V3 con coincidencia exclusiva para la URL de ventas y sin permisos de almacenamiento o red.
- `sumatiempos-core.js`: funciones puras para contar números, interpretar moneda y calcular el desglose; además expondrá un controlador DOM comprobable.
- `content.js`: arranque idempotente del controlador en la página.
- `content.css`: tarjeta lateral y variante compacta responsiva.
- `README.txt`: instalación, uso, fórmula y recarga de la extensión.
- `SumaTiempos.zip`: paquete distribuible generado a partir de los archivos de la extensión.

El script escuchará eventos `input` y `change` en los controles de captura, eventos `click` de Agregar, limpiar e ingresar venta, y observará mutaciones relevantes para detectar cambios realizados por el código propio de Gente Crystal. No interceptará ni cancelará eventos de la página.

## Compatibilidad y manejo de ausencia del DOM

Si uno de los controles opcionales no existe, la extensión continuará con los valores disponibles. Si desaparece la sección de ventas completa, retirará u ocultará la tarjeta y esperará a que el DOM vuelva a estar disponible. Ningún error de lectura impedirá escribir montos o ingresar una venta.

La extensión convivirá de forma independiente con `TimeMasterGentecrystal`, `moverenter` y las demás extensiones porque usará identificadores, estilos y estado propios, y no modificará sus nodos inyectados.

## Validación

Las pruebas con Vitest y JSDOM cubrirán:

- Conteo de números separados por espacios y separadores comunes, incluido `00`.
- Campos vacíos y contenido no válido.
- Monto normal por varios números.
- Suma combinada de monto normal y reventado.
- Exclusión del monto reventado cuando el control esté oculto o deshabilitado.
- Incorporación del total ya mostrado en `#total-amount`.
- Actualización por escritura y por mutaciones del pie.
- Permanencia del total después de Agregar mediante el valor real del pie.
- Actualización cuando se elimina una línea.
- Reinicio inmediato al pulsar Ingresar venta y protección contra mutaciones tardías.
- Inicio repetido sin duplicar tarjeta ni listeners.

También se comprobarán la sintaxis de los scripts, la validez del manifiesto, el contenido del ZIP y `git diff --check`. La posición y el aspecto se revisarán visualmente en la página real cuando haya una sesión accesible; si no la hay, se informará explícitamente como verificación pendiente.

## Fuera de alcance

- Guardar totales entre recargas o cierres del navegador.
- Cambiar la lógica de venta de Gente Crystal.
- Confirmar si el servidor aceptó la venta antes de reiniciar.
- Modificar o integrar esta función dentro de `TimeMasterGentecrystal`.

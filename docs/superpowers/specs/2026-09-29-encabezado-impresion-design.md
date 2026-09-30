# Encabezado compartido para impresiones de Tucán y Junta

## Objetivo

Crear una extensión de Chrome Manifest V3 independiente que agregue un encabezado configurable al inicio de los comprobantes de impresión de Tucán y Junta. El encabezado debe aparecer en la impresión final, con una imagen centrada seguida por líneas de texto centradas, una debajo de otra.

La misma configuración se utilizará en ambos sistemas. La extensión no modificará las extensiones existentes ni el contenido propio de los comprobantes.

## Alcance

La extensión permitirá:

- Seleccionar, previsualizar, reemplazar y eliminar una imagen.
- Definir un límite general de caracteres para todas las líneas.
- Agregar, editar, eliminar y reordenar líneas de texto.
- Guardar la configuración localmente en Chrome.
- Configurar después de la instalación el sitio de Junta, cuya URL todavía no está disponible.
- Insertar el encabezado automáticamente al imprimir desde Tucán o Junta.

No incluye sincronización entre diferentes perfiles o computadoras, edición del comprobante original, procesamiento en servidores ni administración remota de la configuración.

## Estructura de la extensión

La extensión se creará en `extensions/EncabezadoImpresion/` y tendrá, como mínimo:

- `manifest.json`: permisos, panel desplegable y scripts de contenido.
- `popup.html`, `popup.css` y `popup.js`: interfaz de configuración y vista previa.
- `settings.js`: validación, normalización y persistencia de la configuración.
- `print-content.js`: detección del comprobante e inserción idempotente del encabezado.
- `print-content.css`: estilos aislados de pantalla e impresión.
- `README.txt`: instalación, configuración de Junta, uso y límites de verificación.
- Icono de la extensión en los tamaños requeridos por Chrome.

La implementación podrá separar utilidades puras en archivos adicionales cuando esto facilite las pruebas, sin cambiar las responsabilidades anteriores.

## Configuración compartida

La configuración se almacenará en `chrome.storage.local` con una estructura versionada que contenga:

- Imagen codificada localmente para que no dependa de una URL externa.
- Límite general de caracteres.
- Lista ordenada de líneas.
- Origen autorizado de Junta.
- Versión del esquema.

El panel mostrará un campo por línea con contador de caracteres. El límite se aplicará a todos los campos mediante `maxlength` y se volverá a validar al guardar. Las líneas se normalizarán eliminando espacios sobrantes al inicio y al final; las líneas vacías no se imprimirán.

La imagen conservará su proporción y se ajustará al ancho útil del papel. Se aceptarán PNG, JPEG y WebP. Antes de guardarla, la interfaz la reducirá como máximo a 1200 píxeles de ancho; si el resultado excede 2 MB, se rechazará con un mensaje y se conservará la imagen anterior. La vista previa representará el orden final: imagen primero y líneas después.

## Permisos y configuración de Junta

Tucán usa una ventana `about:blank` creada desde el sitio de BCR. El manifiesto declarará acceso solamente al origen conocido de BCR y un script que se ejecute en `document_start` con compatibilidad para documentos `about:blank` creados por ese origen. El script también se cargará en la página BCR que lo origina, pero permanecerá inactivo si no encuentra la estructura de impresión.

Para Junta, el manifiesto declarará permisos de host opcionales para HTTP y HTTPS. El panel aceptará una URL completa, extraerá y mostrará su origen, y solicitará acceso a ese origen únicamente como resultado de una acción explícita del usuario. Después de autorizarlo, la extensión registrará dinámicamente el script de impresión para las páginas de ese origen.

Si el usuario cambia el sitio de Junta, la extensión eliminará el registro anterior y revocará el permiso anterior cuando ya no sea necesario. Si el campo queda vacío o se rechaza el permiso, Junta permanecerá inactiva sin afectar Tucán.

La detección final no dependerá solo de la URL: el script confirmará que el documento contiene la estructura característica del comprobante de Junta antes de modificarlo.

## Inserción en el comprobante

`print-content.js` se ejecutará lo antes posible y observará la construcción del documento hasta encontrar uno de estos destinos:

- Tucán: el contenedor `#tablaComprobantePago`.
- Junta: `.page`, siempre que contenga `.print-container` y al menos una tabla `.table-receipt`, tal como en la captura HTML suministrada.

Al encontrar el destino, insertará como primer contenido un bloque con un identificador exclusivo de la extensión. Esto garantiza que el encabezado quede antes del comprobante original y permite evitar duplicados.

El bloque usará elementos propios, estilos con nombres aislados e imagen con texto alternativo vacío para no interferir con la semántica del comprobante. Las líneas se renderizarán como elementos independientes y centrados. Los estilos de impresión tendrán medidas compatibles con papel térmico de hasta 80 mm, sin imponer un alto fijo ni deformar la imagen.

La extensión volverá a comprobar la inserción en el evento `beforeprint`. No reemplazará ni retrasará `window.print()`: la ejecución en `document_start` y la observación del DOM deben completar la inserción antes del `onload` automático de Junta. Este comportamiento se verificará con la captura HTML entregada.

Cuando no exista imagen ni haya líneas con contenido, no se insertará un bloque vacío. Si la imagen no puede decodificarse, se ocultará sin mostrar un marcador roto y las líneas seguirán disponibles.

## Flujo de datos

1. El usuario abre el panel, selecciona la imagen, define el límite y administra las líneas.
2. El panel valida y guarda una única configuración en `chrome.storage.local`.
3. Si se proporciona la URL de Junta, una acción separada solicita el permiso y registra el script dinámico.
4. Al abrir un comprobante, el script identifica Tucán o Junta por su estructura.
5. El script lee la configuración vigente y construye el encabezado.
6. El bloque se inserta una sola vez al inicio y se confirma nuevamente antes de imprimir.

Los cambios guardados se aplicarán a las impresiones abiertas posteriormente. No es necesario actualizar en vivo una ventana de impresión que ya esté abierta.

## Validaciones y manejo de errores

- El límite general debe ser un entero entre 1 y 200 caracteres.
- Ninguna línea guardada puede superar el límite vigente.
- El texto podrá ajustarse visualmente al ancho del papel si el límite elegido excede el espacio físico disponible; nunca se recortará ni desbordará horizontalmente.
- Una imagen inválida o demasiado grande producirá un mensaje comprensible y no reemplazará la imagen válida anterior.
- Una URL de Junta inválida no solicitará permisos.
- Rechazar el permiso de Junta conservará la configuración textual y de imagen, pero no activará ese sitio.
- Una estructura HTML desconocida no se modificará.
- La inserción será idempotente aunque se disparen el observador y `beforeprint` varias veces.
- Los errores de configuración aparecerán en el panel; los fallos del sitio no bloquearán la impresión original.

## Verificación

Las pruebas automatizadas cubrirán:

- Normalización y validación del límite general.
- Aplicación del límite a todas las líneas.
- Omisión de líneas vacías.
- Orden y reordenamiento de líneas.
- Inserción al inicio de las capturas HTML de Tucán y Junta.
- Centrado, orden de imagen y líneas, y ausencia de duplicados.
- Comportamiento sin imagen y ante una imagen inválida.
- Validación y normalización del origen de Junta.
- No modificación de documentos que no sean comprobantes reconocidos.

Además, se cargará la extensión sin empaquetar para comprobar el panel, la persistencia, la solicitud de permisos y la vista previa. Se probarán copias locales de `src/data/ImpresionTucan.md` y `src/data/ImpresionJunta.md` y se generará una impresión local a PDF. Si el entorno automatizado no permite inspeccionar el diálogo nativo de impresión, esa limitación se informará de forma explícita y se verificará el DOM y sus estilos de impresión.

La compatibilidad real con las sesiones autenticadas, el `about:blank` producido por BCR, la URL definitiva de Junta y una impresora térmica física permanecerán explícitamente como no verificadas hasta ejecutar esas pruebas en el entorno del usuario.

## Criterios de aceptación

- Existe una sola configuración compartida por Tucán y Junta.
- La imagen aparece centrada, conserva su proporción y precede al texto.
- Cada texto aparece centrado en su propia línea y respeta el límite general.
- El bloque aparece antes del contenido original en la impresión final.
- Una misma impresión nunca recibe dos encabezados.
- Tucán funciona mediante la ventana `about:blank` originada por BCR.
- Junta puede habilitarse posteriormente desde el panel sin otorgar acceso permanente a todos los sitios.
- La ausencia o el fallo de la configuración adicional no impide imprimir el comprobante original.

ENCABEZADO DE IMPRESIÓN 1.2.0
================================

Agrega una imagen y líneas de texto centradas al inicio de los comprobantes
de Tucán y Junta. Ambos sistemas comparten la misma configuración.

INSTALACIÓN SIN EMPAQUETAR
--------------------------

1. Abra chrome://extensions o edge://extensions.
2. Active el modo de desarrollador.
3. Pulse "Cargar descomprimida".
4. Seleccione la carpeta extensions/EncabezadoImpresion.
5. Fije el icono de la extensión en la barra del navegador si lo desea.

CONFIGURACIÓN DEL ENCABEZADO
----------------------------

1. Abra el panel desde el icono de la extensión.
2. Seleccione una imagen PNG, JPEG o WebP. La extensión la reduce hasta un
   máximo de 1200 píxeles de ancho y acepta hasta 2 MB después del ajuste.
3. Defina el límite general de caracteres, entre 1 y 200.
4. Pulse "+ Añadir línea" para cada texto necesario.
5. Seleccione para cada línea una fuente instalada y un tamaño entre 8 y 48 px.
6. Use Subir, Bajar y Eliminar para controlar el orden.
7. Revise la vista previa y pulse "Guardar configuración".

La extensión solicita acceso a la lista de fuentes de Chrome para llenar los
desplegables. No modifica la configuración de fuentes del navegador.

TUCÁN
-----

Tucán queda habilitado al instalar la extensión para las páginas de BCR
Corresponsales. El encabezado se intenta insertar también en la ventana
about:blank que BCR usa para construir el comprobante.

JUNTA EN GOOGLE CHROME
----------------------

Junta queda habilitado directamente para los comprobantes generados en:
https://puntosventa.jpsenlinea.go.cr/PS.ODB.ODBHandlers/Receipt/Generate

No es necesario configurar ni autorizar manualmente una URL. La extensión
reconoce el contenedor real del tiquete e inserta el encabezado antes de la
impresión automática de Google Chrome.

IMPRESIÓN
---------

La imagen aparece primero y conserva su proporción. Después se imprime cada
texto centrado en su propia línea, con la fuente y el tamaño seleccionados. Si
el límite elegido permite un texto más ancho que el papel, el texto se ajusta
visualmente sin recortarse.

VERIFICACIÓN PENDIENTE EN EL ENTORNO REAL
-----------------------------------------

Las pruebas locales validan la estructura de los dos comprobantes entregados,
el panel, las fuentes, tamaños, límites, permisos, el HTML actualizado de Junta
y la ausencia de encabezados duplicados. Los dos enlaces reales de Junta no
pudieron consultarse automáticamente porque el servidor respondió 403 fuera de
la sesión del usuario. La ventana autenticada about:blank generada por BCR y el
resultado en una impresora térmica física permanecen como condiciones no
verificadas hasta probarlas en Google Chrome con las sesiones reales.

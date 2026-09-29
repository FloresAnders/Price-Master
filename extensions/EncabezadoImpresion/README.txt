ENCABEZADO DE IMPRESIÓN 1.0.0
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
5. Use Subir, Bajar y Eliminar para controlar el orden.
6. Revise la vista previa y pulse "Guardar configuración".

TUCÁN
-----

Tucán queda habilitado al instalar la extensión para las páginas de BCR
Corresponsales. El encabezado se intenta insertar también en la ventana
about:blank que BCR usa para construir el comprobante.

JUNTA
-----

La URL de Junta se configura cuando esté disponible:

1. Abra una página real del sitio de Junta y copie su URL completa.
2. Péguela en "Sitio de Junta".
3. Pulse "Autorizar sitio de Junta" y acepte el permiso de Chrome.

La extensión extrae únicamente el origen (protocolo, dominio y puerto) y no
conserva la ruta, consulta ni credenciales. Para cambiar el sitio, pegue la
nueva URL y autorícela. Para revocar el sitio configurado, deje el campo vacío
y pulse "Autorizar sitio de Junta"; Tucán seguirá funcionando.

IMPRESIÓN
---------

La imagen aparece primero y conserva su proporción. Después se imprime cada
texto centrado en su propia línea. Si el límite elegido permite un texto más
ancho que el papel, el texto se ajusta visualmente sin recortarse.

VERIFICACIÓN PENDIENTE EN EL ENTORNO REAL
-----------------------------------------

Las pruebas locales validan la estructura de los dos comprobantes entregados,
el panel, los límites, permisos y ausencia de encabezados duplicados. La URL
definitiva de Junta, la ventana autenticada about:blank generada por BCR y el
resultado en una impresora térmica física permanecen como condiciones no
verificadas hasta probarlas en el equipo y las sesiones reales del usuario.

moverenter 1.0.0
================

Función
-------

Cuando la automatización está activada y aparece el modal de venta en
SalesController.php, la extensión pulsa una sola vez el botón "Imprimir".
El estado se conserva localmente en el navegador.

La extensión no modifica TimeMasterGentecrystal ni intercepta el teclado.

Instalación en Edge
-------------------

1. Abre edge://extensions.
2. Activa "Modo de desarrollador".
3. Pulsa "Cargar desempaquetada".
4. Selecciona la carpeta extensions/moverenter.
5. Fija el icono de moverenter y activa "Imprimir al vender" en su popup.
6. Recarga la pantalla de ventas de Gente Crystal.

Impresión automática completa
-----------------------------

La vista de impresión pertenece a Edge y una extensión no puede pulsar su
botón final. Para enviar directamente el trabajo a la impresora predeterminada,
Edge debe iniciarse con el argumento --kiosk-printing.

1. Cierra todas las ventanas de Edge.
2. Crea una copia de un acceso directo de Edge.
3. Abre sus Propiedades.
4. En "Destino", conserva la ruta existente y agrega al final:

   --kiosk-printing

   Ejemplo:

   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing

5. Inicia Edge desde ese acceso directo.
6. Confirma que la impresora correcta sea la predeterminada de Windows.

Sin --kiosk-printing, moverenter abrirá normalmente la vista de impresión y
será necesario pulsar manualmente el botón final "Imprimir".

Uso
---

- Toggle desactivado: no se realiza ningún clic automático.
- Toggle activado: cada nueva apertura del modal inicia una impresión.
- Si activas el toggle con el modal ya abierto, la impresión inicia de inmediato.

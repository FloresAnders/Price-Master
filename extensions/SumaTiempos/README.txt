SumaTiempos v1.0.0

INSTALACIÓN

1. Abre chrome://extensions o edge://extensions.
2. Activa Modo de desarrollador.
3. Pulsa Cargar descomprimida.
4. Selecciona la carpeta extensions/SumaTiempos.
5. Abre o recarga:
   https://gentecrystal.net/controllers/sales/SalesController.php

FUNCIONAMIENTO

La tarjeta Suma total aparece al escribir números o cuando el tiquete ya
tiene un monto agregado. Se actualiza automáticamente mientras cambian los
números, los montos y las líneas del tiquete.

La fórmula utilizada es:

  total agregado + cantidad de números × (monto normal + monto reventado)

Ejemplo:

  3 × (₡100 + ₡50) + ₡200 = ₡650

El monto reventado solamente se cuenta cuando su campo está visible y
habilitado. Al pulsar Ingresar venta, la tarjeta se reinicia y se oculta de
inmediato.

La extensión funciona únicamente en la pantalla de ventas indicada y no
requiere permisos de almacenamiento ni acceso adicional a la red.

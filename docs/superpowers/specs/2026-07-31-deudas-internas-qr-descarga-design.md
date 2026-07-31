# Deudas Internas: descarga por QR de deuda pagada

## Contexto

El modulo `src/app/fondogeneral/deudasinternas/page.tsx` ya muestra deudas pagadas desde el modal "Deudas pagadas" y abre el detalle en modo solo lectura. El proyecto ya usa el flujo de cierre diario para generar una imagen, subirla a Firebase Storage y mostrar un QR con la URL descargable.

## Decision aprobada

Usar el mismo patron que cierre diario:

1. Capturar un recibo visual con `html2canvas`.
2. Convertirlo a PNG.
3. Descargar la imagen localmente.
4. Subir el PNG a Firebase Storage bajo `exports/internal-debts/...`.
5. Generar un QR con `QRCode.toDataURL(downloadUrl)`.
6. Mostrar un modal con el QR y boton de descarga directa.

## Alcance

- Aplica solo cuando `selectedDebtIsPaid` es verdadero.
- No cambia el esquema Firestore de `internalDebts`.
- No cambia permisos de Firestore ni Storage.
- No agrega dependencias nuevas.
- Mantiene el detalle de deuda abierta sin cambios funcionales.

## UI

En el detalle de una deuda pagada se agrega:

- Vista tipo recibo oculta/capturable con:
  - deudor
  - acreedor
  - monto original
  - saldo
  - motivo
  - referencia, si existe
  - fecha de deuda
  - movimientos
  - fecha de exportacion
- Boton "Descargar imagen".
- Boton "Descarga movil".
- Modal QR con:
  - imagen QR
  - boton "Descargar directamente"
  - boton "Cerrar"

## Flujo

`Descargar imagen` captura el recibo y descarga PNG local.

`Descarga movil` captura el mismo recibo, lo descarga localmente, sube la imagen a Firebase Storage, genera QR desde la URL publica de descarga y abre el modal QR.

## Errores

- Si falla la captura, subida o QR, se muestra toast de error.
- Los botones quedan deshabilitados mientras se genera la imagen.
- Si falla la descarga directa desde URL remota, se abre la URL en una pestana nueva como fallback.

## Pruebas

- Ejecutar `npm run lint`.
- Ejecutar `npm run build` si el entorno tiene variables Firebase suficientes.
- Revisar manualmente:
  - deuda pagada muestra botones nuevos.
  - "Descargar imagen" baja PNG.
  - "Descarga movil" muestra QR.
  - QR abre la imagen descargable.
  - deuda abierta no muestra controles de recibo.

## Riesgos

- El QR expone una URL de Firebase Storage a quien tenga el codigo, igual que cierre diario.
- Las reglas de Storage no estan en el repo; se asume que el patron existente sigue funcionando.

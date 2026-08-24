# TimeMaster - BCR Tucán

La extensión detecta únicamente los comprobantes que BCR abre en una ventana
`about:blank` después de pulsar **Imprimir**. Del comprobante conserva fecha,
hora y monto. El texto original y los datos personales no se guardan ni se
envían; se calcula una huella SHA-256 local para evitar duplicados.

## Instalación

1. Abre `chrome://extensions` o `edge://extensions`.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona `extensions/BCR`.
4. Genera un token `tm_bcr_...` siguiendo `CREAR_TOKENS.md`.
5. Abre el popup de la extensión, configura la URL de TimeMaster y el token.
6. Recarga la página de BCR si estaba abierta antes de instalar la extensión.

La lista local puede limpiarse desde el popup sin borrar la cola ni los
comprobantes ya sincronizados con TimeMaster.

La contraseña solicitada al guardar la conexión es únicamente una barrera
operativa local, igual que en la extensión de Gente Crystal. La seguridad real
de la integración depende del token individual `tm_bcr_...`, que debe mantenerse
secreto y revocarse en Firestore si el dispositivo deja de ser confiable.

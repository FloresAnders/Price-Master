# Configuración operativa — Gmail Push para SINPE

La implementación no consulta Gmail por intervalos. Gmail publica cambios en
Pub/Sub, `/api/gmail/webhook` valida el JWT OIDC de la suscripción y el backend
consulta `users.history.list` desde el `historyId` confirmado de cada empresa.

## Variables de entorno de Vercel

- `GMAIL_API_CLIENT_ID`: cliente OAuth del proyecto Google Cloud.
- `GMAIL_API_CLIENT_SECRET`: secreto del cliente OAuth.
- `GMAIL_TOKEN_ENCRYPTION_KEY`: 32 bytes en base64 o 64 caracteres hex. Cifra
  cada refresh token con AES-256-GCM antes de guardarlo.
- `GMAIL_PUBSUB_TOPIC`: nombre completo, por ejemplo
  `projects/<project-id>/topics/timemaster-gmail-events`.
- `GMAIL_PUBSUB_SUBSCRIPTION`: nombre completo de la suscripción push.
- `GMAIL_PUBSUB_AUDIENCE`: audiencia OIDC configurada en la suscripción;
  normalmente `https://<dominio-tm>/api/gmail/webhook`.
- `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL`: service account seleccionado para
  autenticar las entregas push.
- `CRON_SECRET`: secreto aleatorio de al menos 16 caracteres. Vercel lo envía
  como `Authorization: Bearer ...` al cron diario.

Las variables existentes `FIREBASE_SERVICE_ACCOUNT_KEY` y la configuración
Firebase del cliente continúan siendo necesarias.

## Google Cloud

1. Habilitar Gmail API y Cloud Pub/Sub en el mismo proyecto del cliente OAuth.
2. Confirmar que Firebase Authentication está inicializado en el proyecto; el
   canal realtime usa tokens personalizados de propósito limitado.
3. Crear el topic indicado en `GMAIL_PUBSUB_TOPIC`.
4. Dar `roles/pubsub.publisher` sobre el topic a
   `gmail-api-push@system.gserviceaccount.com`.
5. Crear una suscripción push envuelta hacia
   `https://<dominio-tm>/api/gmail/webhook`.
6. Activar autenticación de la suscripción con un service account propio y
   configurar exactamente la audiencia de `GMAIL_PUBSUB_AUDIENCE`.
7. Permitir al agente de servicio de Pub/Sub crear tokens OIDC para ese service
   account (`roles/iam.serviceAccountTokenCreator`).
8. Crear refresh tokens por cuenta con el scope
   `https://www.googleapis.com/auth/gmail.readonly`.

No se debe habilitar payload unwrapping: el endpoint espera el sobre estándar
de Pub/Sub con `subscription` y `message.data`.

## Registro por empresa

Con una sesión de administrador autorizada para la empresa, enviar una sola vez:

```http
POST /api/gmail/watch
Content-Type: application/json

{
  "empresaId": "<id-firestore>",
  "email": "<mismo correo de correoConfigEmail>",
  "refreshToken": "<refresh-token-oauth>"
}
```

El endpoint verifica la empresa, registra `users.watch()` y cifra el token en
`gmailIntegrations/<empresaId>`. Una asignación transaccional en
`gmailAccountMappings/<hash-email>` impide vincular la misma cuenta activa con
dos empresas. Las renovaciones posteriores reutilizan el token cifrado; se
puede omitir `refreshToken` al volver a registrar la misma empresa.

## Firestore y despliegue

- Desplegar `firestore.rules` antes de habilitar las entregas. Los tokens,
  checkpoints y trabajos webhook son solo-servidor.
- Los eventos se guardan en
  `sinpeEvents/<empresaId>/events/<dedupe-id>` y solo pueden ser leídos por
  usuarios con `reportessinpe` y acceso a esa empresa.
- `/api/gmail/realtime` convierte la sesión web vigente en una credencial
  Firebase de propósito único y memoria temporal. La autorización efectiva se
  conserva en `sinpeRealtimeSessions/<userId>` por un máximo de 55 minutos; esa
  credencial usa una instancia Firebase aislada y no satisface `isSignedIn()`
  para ninguna otra ruta del ruleset.
- `vercel.json` renueva diariamente los watches y recupera trabajos pendientes.
- No exponer ni guardar refresh tokens en documentos `empresas`, variables
  `NEXT_PUBLIC_*`, logs o código cliente.

## Punto de control

No registrar cuentas reales, desplegar reglas, invocar endpoints ni enviar
correos hasta que el propietario autorice expresamente la etapa de pruebas del
plan.

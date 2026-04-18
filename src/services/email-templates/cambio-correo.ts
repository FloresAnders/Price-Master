/**
 * Template de correo para verificación de cambio de correo electrónico
 */

export type EmailChangeVerificationTemplateContext = {
  code: string;
  expiresAt: number;
};

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export const buildEmailChangeVerificationTemplate = (
  context: EmailChangeVerificationTemplateContext
): EmailTemplate => {
  const expiryTime = new Date(context.expiresAt).toLocaleString('es-CR');

  const subject = 'Código de verificación para cambio de correo';

  const text = `Solicitud de cambio de correo

Recibimos una solicitud para cambiar el correo de tu cuenta.

Tu código de verificación es: ${context.code}

Este código expira el: ${expiryTime}

Si no solicitaste este cambio, ignora este mensaje.

---
Time Master System`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px dashed #2563eb; padding: 18px; margin: 18px 0; text-align: center; font-size: 26px; letter-spacing: 4px; font-weight: 700; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 14px; margin: 18px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 26px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">Verificación de cambio de correo</h1>
        </div>
        <div class="content">
          <p>Recibimos una solicitud para cambiar el correo de tu cuenta.</p>

          <p>Ingresa este código para continuar:</p>
          <div class="code-box">${context.code}</div>

          <div class="warning">
            <strong>Importante:</strong>
            <ul style="margin: 8px 0 0 18px; padding: 0;">
              <li>Este código expira el: <strong>${expiryTime}</strong></li>
              <li>Si no solicitaste este cambio, ignora este correo</li>
            </ul>
          </div>

          <p style="margin-top: 22px; color: #6b7280; font-size: 12px;">Este es un correo automático. Por favor, no respondas a este mensaje.</p>
        </div>
        <div class="footer">
          <p>Time Master System</p>
          <p>© ${new Date().getFullYear()} Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, text, html };
};

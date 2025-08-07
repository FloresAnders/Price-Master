import { useState } from 'react';

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  response?: string;
  message?: string;
  error?: string;
}

interface EmailConfig {
  configured: boolean;
  error?: string;
  user?: string;
  message?: string;
}

export const useEmail = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEmail = async (emailData: EmailData): Promise<EmailResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar el correo');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const checkEmailConfig = async (): Promise<EmailConfig | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'GET',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al verificar configuración');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestEmail = async (toEmail: string): Promise<EmailResponse | null> => {
    const testEmailData: EmailData = {
      to: toEmail,
      subject: 'Prueba de envío - Price Master System',
      text: `Hola!

Este es un correo de prueba enviado desde el sistema Price Master.

Si recibes este mensaje, significa que la configuración de correo electrónico está funcionando correctamente.

Detalles de la prueba:
- Fecha y hora: ${new Date().toLocaleString('es-ES')}
- Sistema: Price Master Backdoor
- Tipo: Correo de prueba

¡Saludos!
El equipo de Price Master`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">🧪 Prueba de Correo - Price Master</h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745;">
              <h3 style="color: #28a745; margin-top: 0;">✅ ¡Configuración exitosa!</h3>
              <p>Este es un correo de prueba enviado desde el sistema Price Master.</p>
              <p>Si recibes este mensaje, significa que la configuración de correo electrónico está funcionando correctamente.</p>
              
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 6px;">
                <h4 style="margin: 0 0 10px 0; color: #495057;">📊 Detalles de la prueba:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #6c757d;">
                  <li><strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-ES')}</li>
                  <li><strong>Sistema:</strong> Price Master Backdoor</li>
                  <li><strong>Tipo:</strong> Correo de prueba</li>
                  <li><strong>Estado:</strong> Enviado exitosamente</li>
                </ul>
              </div>
              
              <p style="color: #6c757d; font-style: italic;">¡Saludos!<br>El equipo de Price Master</p>
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 6px;">
              <p style="margin: 0; font-size: 12px; color: #6c757d;">
                Este correo fue enviado desde el sistema Price Master como prueba de configuración. 
                Si no esperabas recibir este mensaje, por favor ignóralo.
              </p>
            </div>
          </div>
        </div>
      `
    };

    return await sendEmail(testEmailData);
  };

  return {
    sendEmail,
    sendTestEmail,
    checkEmailConfig,
    isLoading,
    error,
  };
};

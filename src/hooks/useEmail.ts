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

  return {
    sendEmail,
    checkEmailConfig,
    isLoading,
    error,
  };
};

import nodemailer from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  encoding?: string;
  contentType?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export class EmailService {
  private static createTransporter() {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5,
    });
  }

  private static getMailOptions(options: EmailOptions) {
    const { to, subject, text, html, attachments } = options;
    
    return {
      from: {
        name: 'Price Master System',
        address: process.env.GMAIL_USER || '',
      },
      to,
      subject,
      text,
      html: html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">Price Master System</h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff;">
              ${text.replace(/\n/g, '<br>')}
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 6px;">
              <p style="margin: 0; font-size: 12px; color: #6c757d;">
                Este correo fue enviado desde el sistema Price Master. 
                Si no esperabas recibir este mensaje, por favor ignóralo.
              </p>
            </div>
          </div>
        </div>
      `,
      attachments: attachments || [],
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        'X-Mailer': 'Price Master System',
        'Reply-To': process.env.GMAIL_USER || '',
      },
      messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@pricemaster.local>`,
      date: new Date(),
    };
  }

  static async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Verificar configuración
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('Configuración de email no encontrada en variables de entorno');
      }

      const transporter = this.createTransporter();
      const mailOptions = this.getMailOptions(options);

      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

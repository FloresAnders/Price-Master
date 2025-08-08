import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  encoding?: string;
  contentType?: string;
}

// Configuración del transportador de Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // App Password de Gmail
    },
    // Configuraciones adicionales para evitar spam
    pool: true,
    maxConnections: 1,
    rateDelta: 20000,
    rateLimit: 5,
  });
};

// Configuración de opciones de correo para evitar spam
const getMailOptions = (to: string, subject: string, text: string, html?: string, attachments?: EmailAttachment[]) => {
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
    // Adjuntos
    attachments: attachments || [],
    // Headers para evitar spam
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal',
      'X-Mailer': 'Price Master System',
      'Reply-To': process.env.GMAIL_USER || '',
    },
    // Configuraciones adicionales
    messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@pricemaster.local>`,
    date: new Date(),
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, text, html, attachments } = body;

    // Validaciones básicas
    if (!to || !subject || !text) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, subject, text' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // Verificar variables de entorno
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: 'Configuración de Gmail no encontrada' },
        { status: 500 }
      );
    }

    // Crear transportador
    const transporter = createTransporter();

    // Verificar conexión
    await transporter.verify();

    // Configurar opciones del correo
    const mailOptions = getMailOptions(to, subject, text, html, attachments);

    // Enviar correo
    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      messageId: info.messageId || 'unknown',
      response: info.response || 'sent',
      message: 'Correo enviado exitosamente'
    });

  } catch (error) {
    console.error('Error sending email:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error instanceof Error) {
      if (error.message.includes('Invalid login')) {
        errorMessage = 'Credenciales de Gmail inválidas';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout al conectar con Gmail';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Endpoint para probar la configuración
export async function GET() {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({
        configured: false,
        error: 'Variables de entorno GMAIL_USER y GMAIL_APP_PASSWORD no configuradas'
      });
    }

    const transporter = createTransporter();
    await transporter.verify();

    return NextResponse.json({
      configured: true,
      message: 'Configuración de Gmail válida',
      user: process.env.GMAIL_USER
    });

  } catch (error) {
    console.error('Error verifying Gmail config:', error);
    return NextResponse.json({
      configured: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

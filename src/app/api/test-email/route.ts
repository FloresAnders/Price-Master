import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '../../../services/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email es requerido' },
        { status: 400 }
      );
    }

    // Test the new queueEmail method
    await EmailService.queueEmail({
      to: email,
      subject: 'Test Email from Firestore Trigger',
      text: 'This is a test email sent via Firestore trigger.',
      html: '<h1>Test Email</h1><p>This is a test email sent via Firestore trigger.</p>'
    });

    return NextResponse.json({
      success: true,
      message: 'Email queued successfully via Firestore trigger'
    });

  } catch (error) {
    console.error('Error in test-email:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al enviar email de prueba'
      },
      { status: 500 }
    );
  }
}
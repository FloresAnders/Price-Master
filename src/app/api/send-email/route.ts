import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '../../../services/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EmailPayload = {
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
};

export async function GET() {
    return NextResponse.json({
        configured: true,
        message: 'Email service configured via Firestore triggers',
    });
}

export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as EmailPayload | null;
        if (!payload || !payload.to || !payload.subject || !payload.text) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Faltan campos obligatorios (to, subject, text)',
                },
                { status: 400 },
            );
        }

        await EmailService.queueEmail({
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
        });

        return NextResponse.json({ 
            success: true,
            message: 'Email queued successfully via Firestore trigger'
        });
    } catch (error) {
        console.error('API send-email error:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json(
            {
                success: false,
                error: message,
            },
            { status: 500 },
        );
    }
}

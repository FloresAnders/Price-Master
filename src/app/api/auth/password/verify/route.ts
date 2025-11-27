import { NextResponse } from 'next/server';
import { verifyPasswordServer } from '@/lib/auth/password.server';

export async function POST(request: Request) {
  try {
    const { password, hash } = await request.json();

    if (typeof password !== 'string' || typeof hash !== 'string' || hash.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ok = await verifyPasswordServer(password, hash);
    return NextResponse.json({ ok });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

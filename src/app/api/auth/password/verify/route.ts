import { NextResponse } from 'next/server';
// Force Node runtime for this route to avoid running on Edge; reduces 'edge' requests metrics
export const runtime = 'nodejs';
import { verifyPasswordServer } from '@/lib/auth/password.server';

export async function POST(request: Request) {
  try {
    const { password, hash } = await request.json();

    if (typeof password !== 'string' || typeof hash !== 'string' || hash.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const ok = await verifyPasswordServer(password, hash);
    return NextResponse.json({ ok }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

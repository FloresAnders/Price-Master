import { NextResponse } from 'next/server';
// Force Node runtime for this route to avoid running on Edge; reduces 'edge' requests metrics
export const runtime = 'nodejs';
import { verifyPasswordServer } from '@/lib/auth/password.server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any;
    const password = body?.password;
    const hash = body?.hash;
    const purpose = body?.purpose;

    const tryDecodeBase64 = (value: unknown): string => {
      if (typeof value !== 'string' || value.trim().length === 0) return '';
      try {
        return Buffer.from(value.trim(), 'base64').toString('utf8').trim();
      } catch {
        return '';
      }
    };

    // Special purpose: unlock /pruebas access when not authenticated.
    // Client sends only the plain password; we compare against a server-side hash.
    if (purpose === 'pruebas') {
      const rawHash = process.env.PRUEBAS_PASSWORD_HASH;
      const pruebasHash = String(rawHash ?? '')
        .trim()
        // Strip surrounding single/double quotes if dotenv kept them
        .replace(/^['"]|['"]$/g, '');

      const pruebasHashB64 = tryDecodeBase64(process.env.PRUEBAS_PASSWORD_HASH_B64);

      const effectiveHash = pruebasHash.startsWith('$argon2')
        ? pruebasHash
        : pruebasHashB64.startsWith('$argon2')
          ? pruebasHashB64
          : '';

      if (typeof password !== 'string' || password.length === 0) {
        return NextResponse.json({ ok: false }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }

      if (pruebasHash.length === 0 && pruebasHashB64.length === 0) {
        return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      // dotenv-expand may mangle values containing `$...` unless quoted in .env.local.
      // Argon2 hashes should start with `$argon2`.
      if (effectiveHash.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'PRUEBAS_PASSWORD_HASH inválido. Soluciones: (1) en .env.local escapa cada $ como \$ (recomendado), o (2) usa PRUEBAS_PASSWORD_HASH_B64 (base64 del hash Argon2). Luego reinicia el server.'
          },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const ok = await verifyPasswordServer(password, effectiveHash);
      return NextResponse.json({ ok }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Default behavior: verify plain password against provided hash
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

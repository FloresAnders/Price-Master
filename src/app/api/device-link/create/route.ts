import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { generateToken, hashToken } from '../../../../lib/devices/tokens';
import { readAuthSession } from '../../../../lib/auth/session-store.server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const authenticated = await readAuthSession(req.headers.get('cookie'));
    const userId = authenticated?.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'missing_or_invalid_session' },
        { status: 401 },
      );
    }
    const body = await req.json();
    const { durationMinutes = 120, permissions = [] } = body;

    const token = generateToken(32);
    const tokenHash = hashToken(token);

    const firestore = getAdminDb();
    const docRef = await firestore.collection('deviceLinkRequests').add({
      userId,
      status: 'pending',
      tokenHash,
      createdAt: new Date(),
      qrExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
      requestedAccessMinutes: durationMinutes,
      permissions,
    });

    const requestId = docRef.id;

    const qrUrl = `/device-link?r=${requestId}&t=${token}`;

    return NextResponse.json({ requestId, qrUrl, expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString() });
  } catch (err: any) {
    console.error('device-link/create error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

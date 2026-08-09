import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../shared/lib/firebase-admin';
import { getUserIdFromAuthorizationHeader } from '../../../../shared/lib/appAuth';
import { generateToken, hashToken } from '../../../../shared/lib/devices/tokens';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { durationMinutes = 120, permissions = [] } = body;

    const authHeader = req.headers.get('authorization') || '';
    const userId = await getUserIdFromAuthorizationHeader(authHeader);
    if (!userId) return NextResponse.json({ error: 'missing_or_invalid_token' }, { status: 401 });

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

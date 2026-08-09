import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../shared/lib/firebase-admin';
import { hashToken } from '../../../../shared/lib/devices/tokens';

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.split('=');
        return [k?.trim(), decodeURIComponent((v || []).join('='))];
      }),
    );

    const sessionToken = cookies['tm_device_session'];
    if (!sessionToken) return NextResponse.json({ error: 'no_cookie' }, { status: 401 });

    const tokenHash = hashToken(sessionToken);
    const firestore = getAdminDb();
    const sessionsQ = await firestore.collection('deviceSessions').where('sessionTokenHash', '==', tokenHash).limit(1).get();
    if (sessionsQ.empty) return NextResponse.json({ error: 'no_session' }, { status: 401 });

    const sessionDoc = sessionsQ.docs[0];
    const data: any = sessionDoc.data();
    const now = new Date();
    const expiresAt = new Date(data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt);
    if (data.revokedAt) return NextResponse.json({ error: 'revoked' }, { status: 401 });
    if (expiresAt <= now) return NextResponse.json({ error: 'expired' }, { status: 401 });

    // Fetch user data
    const userRef = firestore.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : null;

    return NextResponse.json({ ok: true, user: userData });
  } catch (err: any) {
    console.error('device-link/whoami error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

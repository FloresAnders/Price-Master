import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../shared/lib/firebase-admin';
import { hashToken, generateToken } from '../../../../shared/lib/devices/tokens';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId, token } = body;
    if (!requestId || !token) return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });

    const firestore = getAdminDb();
    const reqRef = firestore.collection('deviceLinkRequests').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data = reqSnap.data() as any;
    const now = new Date();

    if (data.status !== 'approved') return NextResponse.json({ error: 'not_approved' }, { status: 400 });

    const tokenHash = hashToken(token);
    if (tokenHash !== data.tokenHash) return NextResponse.json({ error: 'invalid_token' }, { status: 400 });

    // Find session created for this request
    const sessionsQ = await firestore.collection('deviceSessions').where('deviceLinkRequestId', '==', requestId).limit(1).get();
    if (sessionsQ.empty) return NextResponse.json({ error: 'no_session' }, { status: 404 });

    const sessionDoc = sessionsQ.docs[0];

    const sessionData: any = sessionDoc.data();
    const expiresAt = new Date(sessionData.expiresAt.toDate ? sessionData.expiresAt.toDate() : sessionData.expiresAt);
    if (expiresAt <= now) return NextResponse.json({ error: 'session_expired' }, { status: 401 });

    // Generate session token now and store its hash
    const sessionToken = generateToken(32);
    const sessionTokenHash = hashToken(sessionToken);

    await sessionDoc.ref.update({ sessionTokenHash, lastSeenAt: now });
    await reqRef.update({ status: 'used', consumedAt: now });

    const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    const res = NextResponse.json({ ok: true });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookies.set('tm_device_session', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return res;
  } catch (err: any) {
    console.error('device-link/exchange error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

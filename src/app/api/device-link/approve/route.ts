import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../shared/lib/firebase-admin';
import { getUserIdFromAuthorizationHeader } from '../../../../shared/lib/appAuth';
import { generateToken, hashToken } from '../../../../shared/lib/devices/tokens';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId } = body;
    if (!requestId) return NextResponse.json({ error: 'missing_requestId' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || '';
    const userId = await getUserIdFromAuthorizationHeader(authHeader);
    if (!userId) return NextResponse.json({ error: 'missing_or_invalid_token' }, { status: 401 });

    const firestore = getAdminDb();
    const docRef = firestore.collection('deviceLinkRequests').doc(requestId);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data = snap.data() as any;
    if (data.userId !== userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (data.status !== 'scanned') {
      // Return current status for easier debugging
      console.warn(`Attempt to approve request ${requestId} with status=${data.status}`);
      return NextResponse.json(
        { error: 'invalid_status', currentStatus: data.status },
        { status: 400 },
      );
    }

    const sessionToken = generateToken(32);
    const sessionTokenHash = hashToken(sessionToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (data.requestedAccessMinutes || 60) * 60 * 1000);

    const sessionRef = await firestore.collection('deviceSessions').add({
      userId,
      sessionTokenHash,
      createdAt: now,
      expiresAt,
      authorizedBy: userId,
      deviceLinkRequestId: requestId,
      permissions: data.permissions || [],
    });

    await docRef.update({ status: 'approved', approvedAt: now, approvedBy: userId });

    // Do NOT return sessionToken in the response. The mobile will exchange the QR token for a session.
    return NextResponse.json({ ok: true, sessionId: sessionRef.id });
  } catch (err: any) {
    console.error('device-link/approve error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

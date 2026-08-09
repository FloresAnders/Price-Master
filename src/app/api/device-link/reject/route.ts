import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../shared/lib/firebase-admin';
import { getUserIdFromAuthorizationHeader } from '../../../../shared/lib/appAuth';

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

    const now = new Date();
    await docRef.update({ status: 'rejected', rejectedAt: now });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('device-link/reject error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

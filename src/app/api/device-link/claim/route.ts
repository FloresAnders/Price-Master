import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { hashToken } from '../../../../lib/devices/tokens';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId, token, deviceInfo } = body;
    if (!requestId || !token) return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });

    const firestore = getAdminDb();
    const docRef = firestore.collection('deviceLinkRequests').doc(requestId);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data = snap.data() as any;
    const now = new Date();

    if (data.status && data.status !== 'pending') {
      // Only a freshly created request may be scanned. Re-claiming an already
      // scanned/approved/used request would overwrite its device info.
      return NextResponse.json(
        { error: 'invalid_status', currentStatus: data.status },
        { status: 409 },
      );
    }

    if (data.qrExpiresAt && new Date(data.qrExpiresAt.toDate ? data.qrExpiresAt.toDate() : data.qrExpiresAt) < now) {
      await docRef.update({ status: 'expired' });
      return NextResponse.json({ error: 'qr_expired' }, { status: 410 });
    }

    const tokenHash = hashToken(token);
    if (tokenHash !== data.tokenHash) return NextResponse.json({ error: 'invalid_token' }, { status: 400 });

    await docRef.update({
      status: 'scanned',
      scannedAt: now,
      requestedDevice: deviceInfo || {},
    });

    return NextResponse.json({ status: 'scanned' });
  } catch (err: any) {
    console.error('device-link/claim error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

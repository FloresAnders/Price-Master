import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestId = url.searchParams.get('requestId');
    if (!requestId) return NextResponse.json({ error: 'missing_requestId' }, { status: 400 });

    const firestore = getAdminDb();
    const docRef = firestore.collection('deviceLinkRequests').doc(requestId);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data = snap.data();
    return NextResponse.json({ request: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

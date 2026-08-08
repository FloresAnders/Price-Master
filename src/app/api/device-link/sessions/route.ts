import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { getUserIdFromAuthorizationHeader } from '../../../../lib/appAuth';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const userId = await getUserIdFromAuthorizationHeader(authHeader);
    if (!userId) return NextResponse.json({ error: 'missing_or_invalid_token' }, { status: 401 });

    const firestore = getAdminDb();
    const q = await firestore.collection('deviceSessions').where('userId', '==', userId).limit(50).get();
    const sessions = q.docs
      .map((d) => {
      const data: any = d.data();
      return {
        id: d.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : data.expiresAt,
        deviceLinkRequestId: data.deviceLinkRequestId,
        authorizedBy: data.authorizedBy,
        permissions: data.permissions || [],
        revokedAt: data.revokedAt ? (data.revokedAt.toDate ? data.revokedAt.toDate().toISOString() : data.revokedAt) : null,
      };
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

    return NextResponse.json({ ok: true, sessions });
  } catch (err: any) {
    console.error('device-link/sessions error:', err);
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

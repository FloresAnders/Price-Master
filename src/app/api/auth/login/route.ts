import { NextResponse } from 'next/server';
// Force Node runtime for login route (sensitive, do not run on Edge functions)
export const runtime = 'nodejs';
import { UsersService } from '@/services/users';
import { verifyPasswordServer, hashPasswordServer } from '@/lib/auth/password.server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    // Lookup active users and match by username (case-insensitive)
    const users = await UsersService.getActiveUsers();
    const user = users.find(u => (u.name ?? '').toLowerCase() === username.toLowerCase());

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    let isValid = false;
    if (user.password) {

      if (user.password.startsWith('$argon2')) {
        isValid = await verifyPasswordServer(password, user.password);
      } else {
        // Legacy plain text password: compare and optionally rehash
        isValid = user.password === password;
        if (isValid && user.id) {
          try {
            const newHash = await hashPasswordServer(password);
            await UsersService.updateUser(user.id, { password: newHash });
            user.password = newHash;
          } catch (err) {
            console.warn('Failed to upgrade legacy password hash for user', user.id, err);
          }
        }
      }
    }
    const safeUser = { ...user } as any;
    // Agregar bandera para superadmin
    const isSuperAdmin = safeUser.role === 'superadmin';
    if (!isValid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized', isSuperAdmin }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }


    delete safeUser.password;


    return NextResponse.json({
      ok: true,
      user: safeUser,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

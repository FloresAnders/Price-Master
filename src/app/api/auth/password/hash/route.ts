import { NextResponse } from 'next/server';
import { hashPasswordServer } from '@/lib/auth/password.server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }
    const hash = await hashPasswordServer(password);
    return NextResponse.json({ hash });
  } catch (error) {
    console.error('Error hashing password:', error);
    return NextResponse.json({ error: 'Hashing failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { RecoveryTokenService } from '@/services/recoveryTokenService';
import { EmailService } from '@/services/email';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email es requerido' },
        { status: 400 }
      );
    }

    // 1. Valida que el email exista en la base de datos
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Por seguridad, no revelamos si el email existe o no
      return NextResponse.json({ 
        success: true, 
        message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.' 
      });
    }

    const userData = querySnapshot.docs[0].data();
    const userId = querySnapshot.docs[0].id;

    // 2. Verifica que sea un superadmin
    if (userData.role !== 'superadmin') {
      // Por seguridad, no revelamos que el usuario no es superadmin
      return NextResponse.json({ 
        success: true, 
        message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.' 
      });
    }

    // 3. Genera token de recuperación
    const { token, expiresAt } = await RecoveryTokenService.createRecoveryToken(
      email,
      userId
    );

    // 4. Envía email
    await EmailService.sendPasswordRecoveryEmail(email, token, expiresAt);

    return NextResponse.json({ 
      success: true,
      message: 'Email de recuperación enviado exitosamente'
    });

  } catch (error) {
    console.error('Error en request-password-reset:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al procesar la solicitud' 
      },
      { status: 500 }
    );
  }
}

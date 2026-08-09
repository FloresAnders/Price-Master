import { getAdminAuth } from './firebase-admin';

const SECRET_KEY = 'pricemaster_secret_2024';

function b64Decode(input: string) {
  return Buffer.from(input, 'base64').toString('utf8');
}

function b64Encode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64');
}

function generateHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    // emulate 32-bit int overflow behavior
    hash = (hash << 5) - hash + char;
    hash = hash | 0; // force 32-bit
  }
  return Math.abs(hash).toString(36);
}

export function verifySimpleAppToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = b64Encode(
      generateHash(`${encodedHeader}.${encodedPayload}.${SECRET_KEY}`),
    );
    if (signature !== expectedSig) return null;
    const payloadJson = b64Decode(encodedPayload);
    const payload = JSON.parse(payloadJson) as any;
    if (typeof payload.exp === 'number') {
      if (Date.now() > payload.exp) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getUserIdFromAuthorizationHeader(authHeader?: string) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  const token = parts.length > 1 ? parts[1] : parts[0];
  if (!token) return null;

  // Try Firebase ID token first
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    // Fallback to app token
    const payload = verifySimpleAppToken(token);
    if (payload && payload.userId) return payload.userId;
    return null;
  }
}

import crypto from 'crypto';

export function generateToken(hexBytes = 32) {
  return crypto.randomBytes(hexBytes).toString('hex');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

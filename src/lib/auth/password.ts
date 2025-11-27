const HASH_ENDPOINT = '/api/auth/password/hash';
const VERIFY_ENDPOINT = '/api/auth/password/verify';

async function hashWithServer(plainPassword: string): Promise<string> {
  const response = await fetch(HASH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: plainPassword })
  });

  if (!response.ok) {
    throw new Error('Unable to hash password');
  }

  const data = (await response.json()) as { hash?: string };
  if (typeof data.hash !== 'string' || data.hash.length === 0) {
    throw new Error('Hash response malformed');
  }

  return data.hash;
}

async function verifyWithServer(plainPassword: string, passwordHash: string): Promise<boolean> {
  const response = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: plainPassword, hash: passwordHash })
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { ok?: boolean };
  return Boolean(data.ok);
}

export async function hashPassword(plainPassword: string): Promise<string> {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  return hashWithServer(plainPassword);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  return verifyWithServer(plainPassword, passwordHash);
}

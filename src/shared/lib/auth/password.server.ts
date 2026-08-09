'use server';

import argon2 from 'argon2';

const MEMORY_COST = 2 ** 16;
const TIME_COST = 3;
const PARALLELISM = 1;

export async function hashPasswordServer(plainPassword: string): Promise<string> {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: MEMORY_COST,
    timeCost: TIME_COST,
    parallelism: PARALLELISM,
  });
}

export async function verifyPasswordServer(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, plainPassword);
  } catch {
    return false;
  }
}

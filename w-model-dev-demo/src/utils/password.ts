import bcrypt from 'bcrypt';

const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function getHashCost(hash: string): number {
  return bcrypt.getRounds(hash);
}

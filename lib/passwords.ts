import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const keyLength = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, keyLength);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltHex, hashHex] = storedHash.split('$');
  const validFormat = algorithm === 'scrypt' && Boolean(saltHex) && Boolean(hashHex);
  const salt = validFormat ? Buffer.from(saltHex, 'hex') : Buffer.alloc(16);
  const expected = validFormat ? Buffer.from(hashHex, 'hex') : Buffer.alloc(keyLength);
  const actual = scryptSync(password, salt, keyLength);
  return expected.length === actual.length && timingSafeEqual(expected, actual) && validFormat;
}

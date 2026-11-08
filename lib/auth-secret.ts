import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function getAuthSecret() {
  const configured = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXT_PHASE === 'phase-production-build') return 'hisaabook-build-only-secret-not-valid-at-runtime';
    throw new Error('Set AUTH_SECRET before running Hisaabook in production.');
  }

  const dataDirectory = join(process.cwd(), 'data');
  const secretPath = join(dataDirectory, '.auth-secret');
  mkdirSync(dataDirectory, { recursive: true });
  if (existsSync(secretPath)) return readFileSync(secretPath, 'utf8').trim();
  const generated = randomBytes(32).toString('base64');
  try {
    writeFileSync(secretPath, `${generated}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return readFileSync(secretPath, 'utf8').trim();
    throw error;
  }
}

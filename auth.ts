import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getCredentialRecord } from '@/lib/database';
import { verifyPassword } from '@/lib/passwords';
import { getAuthSecret } from '@/lib/auth-secret';

type AuthUser = { id: string; name: string; email: string };

async function authenticate(emailInput: unknown, passwordInput: unknown): Promise<AuthUser | null> {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
  const password = typeof passwordInput === 'string' ? passwordInput : '';
  if (!email || !password || password.length > 256) return null;
  const user = await getCredentialRecord(email);
  const hash = user?.passwordHash ?? 'scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  const valid = verifyPassword(password, hash);
  if (!user || !valid) return null;
  return { id: String(user.id), email: user.email, name: user.name };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    authorize: async (credentials) => authenticate(credentials.email, credentials.password),
  })],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

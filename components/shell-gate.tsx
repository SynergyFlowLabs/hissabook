import { auth } from '@/auth';
import AppShell from '@/components/app-shell';

/**
 * Decides whether the persistent shell belongs on this page.
 *
 * The shell used to be hidden from a list of paths: `/login`, `/setup`, `/invite`.
 * That list is wrong for `/`, because `/` renders the marketing landing page for a
 * visitor with no session and the dashboard for a signed-in owner. Gating on the
 * path alone drew the sidebar and the mobile pill straight over the landing hero,
 * which is what the owner reported.
 *
 * The honest signal is the session, not the URL. This wrapper is a server
 * component, so it reads the session once per document request and hands the
 * answer down; the client shell then costs no extra request and cannot flash the
 * wrong state. It also covers every future public route without another list.
 */
export default async function ShellGate({ signedIn }: { signedIn?: boolean }) {
  if (signedIn === false) return null;
  return <AppShell />;
}

/** Server-side helper so layouts can pass a definite answer instead of guessing. */
export async function currentSession(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user);
}

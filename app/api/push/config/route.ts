import { NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const configured = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY);
  return NextResponse.json({ configured, publicKey: configured ? publicKey : null });
}

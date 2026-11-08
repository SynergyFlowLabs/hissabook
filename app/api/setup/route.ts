import { NextRequest, NextResponse } from 'next/server';
import { createInitialOwner, isSetupComplete } from '@/lib/database';
import { hashPassword } from '@/lib/passwords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (await isSetupComplete()) return NextResponse.json({ error: 'Owner setup is already complete. Sign in instead.' }, { status: 409 });
  let body: { name?: string; email?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  if (!name || name.length > 100) return NextResponse.json({ error: 'Enter your name (up to 100 characters).' }, { status: 400 });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (password.length < 12 || password.length > 128) return NextResponse.json({ error: 'Use a password between 12 and 128 characters.' }, { status: 400 });
  try {
    await createInitialOwner(name, email, hashPassword(password));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'SETUP_ALREADY_COMPLETE') return NextResponse.json({ error: 'Owner setup was just completed. Sign in instead.' }, { status: 409 });
    if (error instanceof Error && (error.message.includes('UNIQUE constraint failed') || (error as Error & { code?: string }).code === '23505')) return NextResponse.json({ error: 'That email address is already registered.' }, { status: 409 });
    console.error('Failed to create initial owner account', error);
    return NextResponse.json({ error: 'Could not create the owner account.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getInventoryData } from '@/lib/database';
import { requireWorkspaceMember } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  try {
    return NextResponse.json(getInventoryData());
  } catch (error) {
    console.error('Failed to load inventory', error);
    return NextResponse.json({ error: 'Could not load inventory.' }, { status: 500 });
  }
}

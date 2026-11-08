import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/database';
import { requireWorkspaceMember } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember();
  if (access.response) return access.response;
  try {
    return NextResponse.json(getDashboardData());
  } catch (error) {
    console.error('Failed to load dashboard data', error);
    return NextResponse.json({ error: 'Could not load business records.' }, { status: 500 });
  }
}

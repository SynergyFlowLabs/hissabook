import { NextResponse } from 'next/server';
import { getTeamData } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireWorkspaceMember([ROLE.OWNER, ROLE.ADMIN, ROLE.PAYROLL]);
  if (access.response) return access.response;
  try {
    return NextResponse.json(await getTeamData());
  } catch (error) {
    console.error('Failed to load team records', error);
    return NextResponse.json({ error: 'Could not load employee and salary records.' }, { status: 500 });
  }
}

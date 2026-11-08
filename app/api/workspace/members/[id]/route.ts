import { NextRequest, NextResponse } from 'next/server';
import { updateWorkspaceMember } from '@/lib/database';
import { requireWorkspaceMember, ROLE } from '@/lib/authorization';

const editableRoles = ['ADMIN', 'BOOKKEEPER', 'VIEWER', 'PAYROLL'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember([ROLE.OWNER]);
  if (access.response) return access.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid member id.' }, { status: 400 });
  let body: { role?: string; active?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (body.role !== undefined && !editableRoles.includes(body.role)) return NextResponse.json({ error: 'Choose an available non-owner role.' }, { status: 400 });
  if (body.active !== undefined && typeof body.active !== 'boolean') return NextResponse.json({ error: 'Active must be true or false.' }, { status: 400 });
  if (body.role === undefined && body.active === undefined) return NextResponse.json({ error: 'No membership changes were provided.' }, { status: 400 });
  try { return NextResponse.json(await updateWorkspaceMember(id, body, access.member.name, access.member.workspaceId)); }
  catch (error) {
    if (error instanceof Error && error.message === 'MEMBER_NOT_FOUND') return NextResponse.json({ error: 'Workspace member not found.' }, { status: 404 });
    if (error instanceof Error && error.message === 'OWNER_ACCESS_PROTECTED') return NextResponse.json({ error: 'Owner access cannot be changed here.' }, { status: 409 });
    console.error('Failed to update workspace member', error);
    return NextResponse.json({ error: 'Could not update workspace access.' }, { status: 500 });
  }
}

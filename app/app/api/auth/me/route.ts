import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ user: null });
  try {
    const user = getSessionUser(token);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}

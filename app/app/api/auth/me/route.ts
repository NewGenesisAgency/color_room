import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, renewSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ user: null });
  try {
    const user = getSessionUser(token);
    if (!user) return NextResponse.json({ user: null });

    // Sliding window : renouvelle la session à chaque visite (30 jours glissants)
    renewSession(token);
    const res = NextResponse.json({ user });
    res.cookies.set('crg_session', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
    });
    return res;
  } catch {
    return NextResponse.json({ user: null });
  }
}

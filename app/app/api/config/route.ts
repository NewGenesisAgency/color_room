import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getConfigSnapshot, setSetting, clearSetting, SETTING_KEYS, DEFAULTS } from '@/lib/settings';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, config: getConfigSnapshot() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'config_failed' }, { status: 500 });
  }
}

type Body = { supervisionUrl?: string | null; cs160Url?: string | null };

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  const me = token ? getSessionUser(token) : null;
  if (!me || (me.role !== 'enseignant' && me.role !== 'admin'))
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    // Chaque champ : chaîne = enregistrer, chaîne vide / null = revenir au défaut/env.
    if (body.supervisionUrl !== undefined) {
      const v = (body.supervisionUrl ?? '').trim();
      if (v === '') {
        clearSetting(SETTING_KEYS.SUPERVISION_API_URL);
      } else if (!isValidUrl(v)) {
        return NextResponse.json({ ok: false, error: 'URL Supervision invalide (ex. http://172.17.50.136:18080)' }, { status: 400 });
      } else {
        setSetting(SETTING_KEYS.SUPERVISION_API_URL, v);
      }
    }

    if (body.cs160Url !== undefined) {
      const v = (body.cs160Url ?? '').trim();
      if (v === '') {
        clearSetting(SETTING_KEYS.CS160_API_URL);
      } else if (!isValidUrl(v)) {
        return NextResponse.json({ ok: false, error: 'URL CS-160 invalide (ex. http://172.17.50.39:3000)' }, { status: 400 });
      } else {
        setSetting(SETTING_KEYS.CS160_API_URL, v);
      }
    }

    return NextResponse.json({ ok: true, config: getConfigSnapshot(), defaults: DEFAULTS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'config_failed' }, { status: 500 });
  }
}

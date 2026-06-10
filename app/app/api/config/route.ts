/**
 * @file app/api/config/route.ts
 * @brief Lecture et mise à jour de la configuration runtime (URLs externes).
 *
 * GET  : renvoie l'instantané de configuration courant -> { ok, config }.
 *        500 { ok:false, error } en cas d'échec.
 * POST : met à jour les URLs des services externes (réservé enseignant/admin).
 *        Body JSON { supervisionUrl?, cs160Url? }. Pour chaque champ : une URL
 *        http(s) valide est enregistrée, une chaîne vide réinitialise au
 *        défaut/env, une URL invalide renvoie 400. Renvoie { ok, config, defaults }.
 * Codes d'erreur : 401 (rôle insuffisant), 400 (URL invalide), 500 (erreur).
 * Effets de bord : setSetting/clearSetting (persistance des réglages).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getConfigSnapshot, setSetting, clearSetting, SETTING_KEYS, DEFAULTS } from '@/lib/settings';

/**
 * Renvoie l'instantané de configuration courant.
 * @returns 200 { ok, config } ; 500 en cas d'erreur.
 */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, config: getConfigSnapshot() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'config_failed' }, { status: 500 });
  }
}

type Body = { supervisionUrl?: string | null; cs160Url?: string | null };

/**
 * Vérifie qu'une chaîne est une URL http(s) valide.
 * @param u Chaîne à valider.
 * @returns true si l'URL est analysable et de protocole http/https.
 */
function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Met à jour les URLs des services externes (supervision, CS-160).
 * @param req Requête HTTP POST, body { supervisionUrl?, cs160Url? }.
 * @returns 200 { ok, config, defaults } ; 401/400/500 selon l'erreur.
 */
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

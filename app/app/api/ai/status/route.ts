/**
 * @file app/api/ai/status/route.ts
 * @brief Indique l'état de disponibilité du fournisseur d'IA (Gemini ou Ollama).
 *
 * GET : détermine le fournisseur actif puis vérifie qu'il est prêt. Pour Gemini,
 *       contrôle la présence d'une clé valide. Pour Ollama, interroge /api/tags
 *       (timeout 4 s) pour vérifier que le modèle attendu est chargé. Renvoie
 *       { ok, provider, ready, model, message }. Permet à l'éditeur de démarrer
 *       sans IA puis d'activer l'assistant dès que le modèle est prêt.
 * Effets de bord : appel réseau sortant vers le serveur Ollama (mode ollama).
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Choisit le fournisseur d'IA actif d'après l'environnement.
 * @returns 'gemini' si AI_PROVIDER l'impose ou si une clé Gemini valide existe,
 *          sinon 'ollama'.
 */
function provider(): 'gemini' | 'ollama' {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'ollama' || p === 'gemini') return p;
  const k = process.env.GEMINI_API_KEY;
  return k && k !== 'XXX' ? 'gemini' : 'ollama';
}

/**
 * Indique si l'IA est prête. Permet à l'éditeur de démarrer SANS IA (phase 1)
 * et d'activer l'assistant dès que le modèle local est chargé (phase 2).
 */
export async function GET() {
  const prov = provider();

  if (prov === 'gemini') {
    const k = process.env.GEMINI_API_KEY;
    const ready = !!k && k !== 'XXX';
    return NextResponse.json({ ok: true, provider: 'gemini', ready, model: 'gemini', message: ready ? 'Gemini prêt' : 'Clé Gemini manquante' });
  }

  const base = (process.env.OLLAMA_URL || 'http://ollama:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  try {
    const res = await fetch(`${base}/api/tags`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const names: string[] = Array.isArray(data?.models) ? data.models.map((m: any) => String(m?.name || '')) : [];
    const stem = model.split(':')[0];
    const ready = names.some((n) => n === model || n.startsWith(stem));
    return NextResponse.json({
      ok: true, provider: 'ollama', ready, model,
      message: ready ? `Modèle ${model} prêt` : `Téléchargement / démarrage du modèle ${model}…`,
    });
  } catch {
    return NextResponse.json({ ok: true, provider: 'ollama', ready: false, model, message: 'Serveur Ollama en cours de démarrage…' });
  }
}

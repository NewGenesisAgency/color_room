import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
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

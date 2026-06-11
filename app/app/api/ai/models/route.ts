/**
 * GET /api/ai/models
 * Retourne le catalogue complet des modèles IA disponibles (Gemini + Ollama locaux)
 * avec métadonnées : vitesse estimée, qualité, taille, disponibilité locale.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export type ModelMeta = {
  id: string;
  provider: 'gemini' | 'ollama';
  label: string;
  /** Estimation du temps de réponse (texte court, ex: "~2s", "~1min") */
  speed: string;
  /** 1 (basique) → 5 (excellente) */
  quality: number;
  /** 1 (léger) → 5 (très lourd) */
  effort: number;
  /** Taille indicative du modèle */
  size?: string;
  /** Le modèle est utilisable sans configuration supplémentaire */
  available: boolean;
  /** Raison d'indisponibilité si available=false */
  unavailableReason?: string;
};

// Estimations mesurees en conditions reelles pour generer un jeu COMPLET
// (~10 noeuds + 6 composants UI). Le premier appel d'une session est lent
// (cold start cote Google, modele en cours de chargement) ; les appels
// suivants sont 2 a 3x plus rapides grace au cache. Format : "15s · 6s".
const GEMINI_CATALOG: Omit<ModelMeta, 'available' | 'unavailableReason'>[] = [
  { id: 'gemini-3.5-flash',      provider: 'gemini', label: 'Gemini 3.5 Flash',      speed: '15s · 6s',  quality: 5, effort: 1 },
  { id: 'gemini-3.1-pro',        provider: 'gemini', label: 'Gemini 3.1 Pro',        speed: '40s · 18s', quality: 5, effort: 2 },
  { id: 'gemini-2.5-pro',        provider: 'gemini', label: 'Gemini 2.5 Pro',        speed: '45s · 22s', quality: 5, effort: 2 },
  { id: 'gemini-3.1-flash',      provider: 'gemini', label: 'Gemini 3.1 Flash',      speed: '14s · 5s',  quality: 5, effort: 1 },
  { id: 'gemini-3.1-flash-lite', provider: 'gemini', label: 'Gemini 3.1 Flash Lite', speed: '10s · 4s',  quality: 4, effort: 1 },
  { id: 'gemini-2.5-flash',      provider: 'gemini', label: 'Gemini 2.5 Flash',      speed: '16s · 7s',  quality: 5, effort: 1 },
  { id: 'gemini-2.5-flash-lite', provider: 'gemini', label: 'Gemini 2.5 Flash Lite', speed: '11s · 4s',  quality: 4, effort: 1 },
  { id: 'gemini-2.0-flash',      provider: 'gemini', label: 'Gemini 2.0 Flash',      speed: '18s · 8s',  quality: 4, effort: 1 },
];

const OLLAMA_CATALOG: Omit<ModelMeta, 'available' | 'unavailableReason'>[] = [
  { id: 'qwen2.5:0.5b', provider: 'ollama', label: 'Qwen 2.5 0.5B', speed: '~30s',  quality: 1, effort: 1, size: '400 Mo' },
  { id: 'qwen2.5:1.5b', provider: 'ollama', label: 'Qwen 2.5 1.5B', speed: '~1min', quality: 2, effort: 2, size: '1 Go' },
  { id: 'qwen2.5:3b',   provider: 'ollama', label: 'Qwen 2.5 3B',   speed: '~2min', quality: 3, effort: 3, size: '1.9 Go' },
  { id: 'llama3.2:3b',  provider: 'ollama', label: 'Llama 3.2 3B',  speed: '~2min', quality: 3, effort: 3, size: '2 Go' },
  { id: 'qwen2.5:7b',   provider: 'ollama', label: 'Qwen 2.5 7B',   speed: '~5min', quality: 4, effort: 5, size: '4.7 Go (RAM élevée)' },
  { id: 'llama3.1:8b',  provider: 'ollama', label: 'Llama 3.1 8B',  speed: '~6min', quality: 4, effort: 5, size: '4.9 Go (RAM élevée)' },
];

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY ?? '';
  const geminiOk = !!geminiKey && geminiKey !== 'XXX' && geminiKey.length > 10;

  // Quels modèles Ollama sont installés localement ?
  const base = (process.env.OLLAMA_URL || 'http://ollama:11434').replace(/\/$/, '');
  let installedOllama: string[] = [];
  try {
    const res = await fetch(`${base}/api/tags`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      installedOllama = Array.isArray(data?.models)
        ? data.models.map((m: Record<string, unknown>) => String(m?.name ?? ''))
        : [];
    }
  } catch { /* Ollama absent ou en cours de démarrage */ }

  const ollamaReachable = installedOllama.length > 0 || await (async () => {
    try {
      const r = await fetch(`${base}/api/tags`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      return r.ok;
    } catch { return false; }
  })();

  const geminiModels: ModelMeta[] = GEMINI_CATALOG.map((m) => ({
    ...m,
    available: geminiOk,
    unavailableReason: geminiOk ? undefined : 'Clé GEMINI_API_KEY manquante dans .env.local',
  }));

  const ollamaModels: ModelMeta[] = OLLAMA_CATALOG.map((m) => {
    const stem = m.id.split(':')[0];
    const installed = installedOllama.some((n) => n === m.id || n.startsWith(stem));
    return {
      ...m,
      available: installed,
      unavailableReason: installed ? undefined
        : ollamaReachable ? `Non installé - lancer : ollama pull ${m.id}`
        : 'Serveur Ollama hors-ligne',
    };
  });

  return NextResponse.json({
    ok: true,
    geminiAvailable: geminiOk,
    ollamaReachable,
    models: [...geminiModels, ...ollamaModels],
  });
}

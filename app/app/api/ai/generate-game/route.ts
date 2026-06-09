import { NextResponse } from 'next/server';

/**
 * @file Génération de jeu par IA (Google Gemini) pour l'éditeur ColorRoom.
 *
 * POST /api/ai/generate-game  { prompt: string, tileCount?: number }
 *   → { ok, model, game: { name, icon, difficulty, description, bgColor,
 *        accentColor, tileCount, nodes:[{kind,name,params,x,y}],
 *        edges:[[fromIndex,toIndex]], ui:[{kind,...}] } }
 *
 * La clé est lue dans process.env.GEMINI_API_KEY (jamais committée).
 * Cascade de modèles : on essaie du plus capable au repli jusqu'à réponse OK.
 */

export const runtime = 'nodejs';

// ── Vocabulaire autorisé (doit rester aligné avec l'éditeur) ──────────────────
const NODE_KINDS = [
  // Évènements
  'event_begin', 'on_timer', 'on_tick', 'on_key', 'on_click', 'on_tile_click', 'on_plate_click',
  'on_ui_click', 'on_score_reached', 'on_countdown_end', 'on_submit_answer',
  // Flux / logique
  'wait', 'sequence', 'if', 'while', 'loop_count', 'for_range', 'for_each_array', 'break_loop',
  'emit_event', 'wait_event', 'define_sub', 'call_sub',
  // Variables / score / maths
  'variable_set', 'variable_get', 'add_score', 'get_score', 'score_set', 'score_reset', 'random_int',
  'math_add', 'math_sub', 'math_mul', 'math_div', 'math_mod', 'math_min', 'math_max', 'math_pow',
  'math_floor', 'math_ceil', 'math_round', 'math_abs', 'math_sqrt', 'math_clamp01', 'math_lerp',
  'compare_eq', 'compare_gt', 'compare_lt', 'logic_and', 'logic_or', 'logic_not',
  'const_number', 'const_bool', 'const_color', 'time_seconds', 'random_01',
  'string_concat', 'string_from_num',
  // Tableaux / grille
  'array_create', 'array_get', 'array_set', 'array_fill', 'array_length', 'array_push', 'array_pop',
  'array_shuffle', 'array_contains', 'array_index_of', 'array_literal',
  'grid_create', 'grid_get', 'grid_set', 'grid_clear', 'grid_sync_tiles', 'grid_check_4_in_row',
  // Rendu plaques
  'fill', 'pulse', 'tile', 'tile_set', 'tile_get', 'clear_tiles', 'tile_set_var', 'tiles_from_array',
  // Animations
  'anim_fade', 'anim_strobe', 'anim_rainbow', 'anim_wave',
  // Couleur / temps / aléatoire
  'gen_target_color', 'color_mix', 'color_hsl', 'color_complement', 'color_temperature',
  'color_distance', 'color_match_score', 'show_target_on_plates', 'get_player_rgb',
  // Manches / décompte
  'round_start', 'round_end', 'next_round', 'get_round', 'countdown_start', 'countdown_stop',
  // Audio / hardware
  'play_sound', 'hardware_flash', 'hardware_send_color',
  // Multijoueur
  'mp_session', 'mp_wait_players', 'mp_broadcast', 'mp_player_input',
  // Mesure CS-160
  'measure_start', 'measure_on_result', 'measure_compare',
  // Jeux pré-faits (boîtes noires paramétrables)
  'game_tetris', 'game_simon', 'game_memory', 'game_spectrum', 'game_snake', 'game_puissance4',
] as const;

const UI_KINDS = [
  'button', 'label', 'slider', 'rgb_sliders', 'score_display', 'timer_display', 'round_badge',
  'color_swatch', 'progress_bar', 'cie_diagram', 'dpad', 'plate_grid', 'shape_rect', 'shape_circle',
  'image', 'divider', 'heart_life', 'gauge_ring', 'players_list', 'turn_indicator', 'leaderboard',
  'button_grid', 'sprite', 'svg_icon', 'message_box', 'title_banner',
] as const;

const DEFAULT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash',
  'gemini-2.5-flash',
];

function systemInstruction(tileCount: number): string {
  return `Tu es un générateur de jeux pour "ColorRoom", une salle de ${tileCount} plaques LED (grille 6 colonnes × 7 rangées, index 0..${tileCount - 1}) pilotées depuis une tablette.
Tu produis UNIQUEMENT un objet JSON décrivant un jeu jouable, sans texte autour.

Schéma de sortie STRICT :
{
  "name": string,                      // nom court du jeu
  "icon": string,                      // un nom d'icône Lucide (ex: "Gamepad2","Zap","Trophy")
  "difficulty": 1|2|3|4|5,
  "description": string,               // 1 phrase
  "bgColor": "#rrggbb", "accentColor": "#rrggbb",
  "nodes": [ { "kind": <NODE_KIND>, "name": string, "params": object, "x": number, "y": number } ],
  "edges": [ [fromIndex, toIndex] ],   // indices dans le tableau "nodes" (flux d'exécution)
  "ui": [ { "kind": <UI_KIND>, "x": number, "y": number, "width": number, "height": number,
            "text"?: string, "varBind"?: string, "colorBind"?: string, "eventId"?: string,
            "bgColor"?: "#rrggbb", "textColor"?: "#rrggbb", "fontSize"?: number,
            "dpadPreset"?: "arrows_space"|"lr_space"|"arrows"|"lr", "gridCols"?: number } ]
}

RÈGLES :
- "kind" des nœuds DOIT appartenir à : ${NODE_KINDS.join(', ')}.
- "kind" de l'UI DOIT appartenir à : ${UI_KINDS.join(', ')}.
- Commence toujours par un nœud "event_begin" (index 0) relié à la logique.
- Le bloc "if" se configure avec params {varName, op('gt'|'gte'|'lt'|'lte'|'eq'|'neq'), value}; sa 1re sortie = vrai, la 2e = faux.
- Variables: variable_set {name,value,op('set'|'add'|'sub'|'mul')}; random_int {min,max,varName}; add_score {amount}.
- Maths/logique : math_add/sub/mul/div/mod/min/max/pow {a,b,out}, math_floor/ceil/round/abs/sqrt/clamp01 {a,out}, math_lerp {a,b,t,out}, compare_eq/gt/lt {a,b,out}, logic_and/or/not {a,b,out}, const_number/bool/color {value,out}. a/b = nom de variable OU nombre ; out = variable résultat (comparaisons/logique → 1 ou 0).
- Rendu: fill {color,intensity(0..1),mask('all'|'border')}; tile/tile_set {tileIndex,color,intensity}; pulse {baseColor,targetColor,speed}.
- Boucles: for_range {varName,start,end,step}; loop_count {count}.
- Évènements d'entrée: on_key {key}, on_tile_click {tileIndex}, on_timer {intervalMs}, on_tick {intervalMs}.
- Animations (sur les dalles, durée en ms puis on continue) : anim_fade {color,fromIntensity,toIntensity,durationMs}, anim_strobe {color,hz,durationMs}, anim_rainbow {speed,durationMs}, anim_wave {color,direction('left'|'right'),speed,durationMs}.
- Boucle : while {varName,op,value,bodyNodeId} répète le corps tant que vrai.
- Multijoueur : mp_session (cree/rejoint, expose mp_code et mp_players), mp_wait_players {minPlayers,timeoutSec}, mp_broadcast {color,intensity}, mp_player_input {seat,outVar}. Affiche mp_code via un label pour que les joueurs rejoignent.
- Audio (hors-ligne): play_sound {sound}. Sons: click, select, tick, pop, swoosh, correct, wrong, success, error, alert, win, lose, levelup, coin, powerup, countdown, start, score. Utilise 'correct'/'wrong' pour le feedback pédagogique, 'win'/'lose' en fin de partie, 'coin'/'score' pour les points.
- L'UI est posée sur un canvas 860×500. Place les composants sans chevauchement.
- Lie les affichages à des variables via "varBind" (ex: un score_display avec varBind "score").
- Icônes : "sprite" (icône Lucide via "icon", ex Trophy, Star, Heart, Check, X, Zap, Crown, ThumbsUp) ou "svg_icon" (SVG perso). Pour sprite/svg_icon, "varBind" sert de visibilité : l'icône n'apparaît que si la variable est non nulle (ex. afficher un Trophy avec varBind "gagne"). Couleur via "bgColor".
- Relie les boutons à la logique via "eventId" et un nœud "on_ui_click" {buttonId} correspondant.
- Sois COHÉRENT : chaque eventId d'UI doit avoir son nœud on_ui_click; chaque variable affichée doit être écrite par la logique.
- Si un "JEU ACTUEL" est fourni, MODIFIE-le selon la demande et renvoie le jeu COMPLET mis à jour (jamais un diff ni un fragment). Conserve ce qui n'est pas concerné.

EXEMPLE de sortie valide (jeu de réflexe simple — inspire-t'en) :
{"name":"Tape la dalle","icon":"Zap","difficulty":2,"description":"Clique les dalles allumées pour marquer.","bgColor":"#0d1119","accentColor":"#22d3ee","nodes":[{"kind":"event_begin","name":"Démarrer","params":{},"x":80,"y":80},{"kind":"variable_set","name":"Score 0","params":{"name":"score","value":0,"op":"set"},"x":320,"y":80},{"kind":"fill","name":"Allumer","params":{"color":"#22d3ee","intensity":0.7,"mask":"all"},"x":560,"y":80},{"kind":"on_plate_click","name":"Clic dalle","params":{},"x":80,"y":300},{"kind":"add_score","name":"Plus 1","params":{"amount":1},"x":320,"y":300},{"kind":"play_sound","name":"Son","params":{"sound":"coin"},"x":560,"y":300}],"edges":[[0,1],[1,2],[3,4],[4,5]],"ui":[{"kind":"title_banner","x":20,"y":20,"width":400,"height":60,"text":"Tape la dalle"},{"kind":"score_display","x":20,"y":100,"width":200,"height":90,"varBind":"score","text":"Score"}]}

- Génère un jeu complet et JOUABLE, pas un squelette. Réponds en JSON pur.`;
}

type GameJson = {
  name?: string; icon?: string; difficulty?: number; description?: string;
  bgColor?: string; accentColor?: string;
  nodes?: Array<{ kind?: string; name?: string; params?: Record<string, unknown>; x?: number; y?: number }>;
  edges?: Array<[number, number]>;
  ui?: Array<Record<string, unknown>>;
};

async function callGemini(model: string, key: string, sys: string, prompt: string): Promise<GameJson | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? undefined;
  if (!text) return null;
  // Le modèle renvoie du JSON pur (responseMimeType json), mais on nettoie par sécurité.
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned) as GameJson; } catch { return null; }
}

const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);

function sanitize(raw: GameJson, tileCount: number) {
  const nodeKindSet = new Set<string>(NODE_KINDS);
  const uiKindSet = new Set<string>(UI_KINDS);

  const nodesIn = Array.isArray(raw.nodes) ? raw.nodes : [];
  // Garde l'index original -> nouvel index (on filtre les kinds inconnus)
  const keep: number[] = [];
  const nodes = nodesIn
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n && typeof n.kind === 'string' && nodeKindSet.has(n.kind))
    .map(({ n, i }, newIdx) => {
      keep[i] = newIdx;
      return {
        kind: String(n.kind),
        name: typeof n.name === 'string' && n.name.trim() ? n.name.trim().slice(0, 60) : undefined,
        params: n.params && typeof n.params === 'object' ? n.params : {},
        x: Number.isFinite(n.x) ? Number(n.x) : 80 + newIdx * 40,
        y: Number.isFinite(n.y) ? Number(n.y) : 80 + (newIdx % 6) * 90,
      };
    });

  const edges = (Array.isArray(raw.edges) ? raw.edges : [])
    .map((e) => Array.isArray(e) ? [keep[e[0]], keep[e[1]]] : null)
    .filter((e): e is [number, number] => !!e && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[0] !== e[1]);

  const ui = (Array.isArray(raw.ui) ? raw.ui : [])
    .filter((c) => c && typeof c.kind === 'string' && uiKindSet.has(c.kind as string))
    .slice(0, 40)
    .map((c) => ({
      kind: String(c.kind),
      x: Number.isFinite(c.x as number) ? Number(c.x) : 20,
      y: Number.isFinite(c.y as number) ? Number(c.y) : 20,
      width: Math.max(40, Math.min(860, Number(c.width) || 160)),
      height: Math.max(28, Math.min(500, Number(c.height) || 60)),
      ...(typeof c.text === 'string' ? { text: c.text.slice(0, 120) } : {}),
      ...(typeof c.varBind === 'string' ? { varBind: c.varBind } : {}),
      ...(typeof c.colorBind === 'string' ? { colorBind: c.colorBind } : {}),
      ...(typeof c.eventId === 'string' ? { eventId: c.eventId } : {}),
      ...(isHex(c.bgColor) ? { bgColor: c.bgColor } : {}),
      ...(isHex(c.textColor) ? { textColor: c.textColor } : {}),
      ...(Number.isFinite(c.fontSize as number) ? { fontSize: Number(c.fontSize) } : {}),
      ...(typeof c.dpadPreset === 'string' ? { dpadPreset: c.dpadPreset } : {}),
      ...(Number.isFinite(c.gridCols as number) ? { gridCols: Number(c.gridCols) } : {}),
      ...(typeof c.icon === 'string' ? { icon: c.icon } : {}),
      ...(typeof c.svg === 'string' ? { svg: c.svg.slice(0, 4000) } : {}),
    }));

  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Jeu IA',
    icon: typeof raw.icon === 'string' ? raw.icon : 'Sparkles',
    difficulty: Math.max(1, Math.min(5, Math.round(Number(raw.difficulty) || 2))),
    description: typeof raw.description === 'string' ? raw.description.slice(0, 200) : '',
    bgColor: isHex(raw.bgColor) ? raw.bgColor : '#0d1119',
    accentColor: isHex(raw.accentColor) ? raw.accentColor : '#7c3aed',
    tileCount,
    nodes, edges, ui,
  };
}

// Choix du fournisseur d'IA : explicite (AI_PROVIDER) sinon auto (Gemini si clé, sinon Ollama local).
function aiProvider(): 'gemini' | 'ollama' {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'ollama' || p === 'gemini') return p;
  const key = process.env.GEMINI_API_KEY;
  return key && key !== 'XXX' ? 'gemini' : 'ollama';
}

// Appel d'un modèle local via Ollama (hors-ligne). format:json force une sortie JSON.
async function callOllama(sys: string, user: string): Promise<GameJson | null> {
  const base = (process.env.OLLAMA_URL || 'http://ollama:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(180000), // le Raspberry Pi est lent
    // Température basse + assez de tokens : un petit modèle local suit mieux le schéma.
    body: JSON.stringify({ model, system: sys, prompt: user, format: 'json', stream: false, options: { temperature: 0.35, num_predict: 4096, num_ctx: 8192 } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text: string | undefined = data?.response;
  if (!text) return null;
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned) as GameJson; } catch { return null; }
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const prompt = String(body?.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'NO_PROMPT', message: 'Décris le jeu à créer.' }, { status: 400 });
  }
  const tileCount = Math.max(1, Math.min(42, Math.round(Number(body?.tileCount) || 42)));

  // Multi-tours : jeu actuel à modifier + historique de conversation (optionnels).
  const currentGame = body?.currentGame && typeof body.currentGame === 'object' ? body.currentGame : null;
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

  let userContent = '';
  if (history.length > 0) {
    userContent += 'CONVERSATION PRÉCÉDENTE :\n'
      + history.map((m: any) => `${m?.role === 'assistant' ? 'IA' : 'Utilisateur'}: ${String(m?.content ?? '').slice(0, 500)}`).join('\n')
      + '\n\n';
  }
  if (currentGame) {
    userContent += 'JEU ACTUEL (à modifier) :\n' + JSON.stringify(currentGame).slice(0, 60000) + '\n\n';
  }
  userContent += 'DEMANDE :\n' + prompt;

  const sys = systemInstruction(tileCount);
  const provider = aiProvider();

  // ── Modèle local (Ollama, hors-ligne) ──────────────────────────────────────
  if (provider === 'ollama') {
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    try {
      const raw = await callOllama(sys, userContent);
      if (!raw) return NextResponse.json({ ok: false, error: 'OLLAMA_EMPTY', message: `Le modèle local ${model} a renvoyé une réponse vide.` }, { status: 502 });
      const game = sanitize(raw, tileCount);
      if (game.nodes.length === 0) return NextResponse.json({ ok: false, error: 'OLLAMA_INVALID', message: 'Le modèle local n\'a produit aucun bloc valide.' }, { status: 502 });
      return NextResponse.json({ ok: true, model: `ollama/${model}`, game });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'OLLAMA_NOT_READY', message: `Modèle local indisponible (${model}). Il est peut-être encore en cours de démarrage/téléchargement. ${e?.message ?? ''}` },
        { status: 503 },
      );
    }
  }

  // ── Gemini (cloud) ─────────────────────────────────────────────────────────
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'XXX') {
    return NextResponse.json(
      { ok: false, error: 'NO_API_KEY', message: 'Aucune IA configurée : ni GEMINI_API_KEY, ni modèle local (AI_PROVIDER=ollama).' },
      { status: 503 },
    );
  }
  const models = (process.env.GEMINI_MODELS?.split(',').map((s) => s.trim()).filter(Boolean)) || DEFAULT_MODELS;
  const errors: string[] = [];
  for (const model of models) {
    try {
      const raw = await callGemini(model, key, sys, userContent);
      if (!raw) { errors.push(`${model}: réponse vide/illisible`); continue; }
      const game = sanitize(raw, tileCount);
      if (game.nodes.length === 0) { errors.push(`${model}: aucun bloc valide`); continue; }
      return NextResponse.json({ ok: true, model, game });
    } catch (e: any) {
      errors.push(`${model}: ${e?.message ?? 'erreur'}`);
    }
  }

  return NextResponse.json(
    { ok: false, error: 'ALL_MODELS_FAILED', message: 'Aucun modèle Gemini n\'a répondu.', details: errors },
    { status: 502 },
  );
}

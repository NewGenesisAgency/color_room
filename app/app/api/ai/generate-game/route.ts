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
  // Script Python (code libre exécuté quand le flux atteint le bloc)
  'script_python',
  // Animations
  'anim_fade', 'anim_strobe', 'anim_rainbow', 'anim_wave',
  // Couleur / temps / aléatoire
  'gen_target_color', 'color_mix', 'color_hsl', 'color_complement', 'color_temperature',
  'color_distance', 'color_match_score', 'show_target_on_plates', 'get_player_rgb',
  // Manches / décompte
  'round_start', 'round_end', 'next_round', 'get_round', 'countdown_start', 'countdown_stop',
  // Audio / hardware
  'play_sound', 'vibrate', 'hardware_flash', 'hardware_send_color',
  // Multijoueur
  'mp_session', 'mp_wait_players', 'mp_broadcast', 'mp_player_input',
  // Mesure CS-160
  'measure_start', 'measure_on_result', 'measure_compare',
  // Jeux pré-faits (boîtes noires paramétrables)
  'game_tetris', 'game_simon', 'game_memory', 'game_spectrum', 'game_snake', 'game_puissance4',
] as const;

// NB : 'plate_grid' est volontairement ABSENT - on n'autorise jamais l'IA à
// dessiner une représentation des dalles dans l'UI (la vue 3D le fait déjà).
const UI_KINDS = [
  'button', 'label', 'slider', 'rgb_sliders', 'score_display', 'timer_display', 'round_badge',
  'color_swatch', 'progress_bar', 'cie_diagram', 'dpad', 'shape_rect', 'shape_circle',
  'image', 'divider', 'heart_life', 'gauge_ring', 'players_list', 'turn_indicator', 'leaderboard',
  'button_grid', 'sprite', 'svg_icon', 'message_box', 'title_banner',
] as const;

const DEFAULT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash',
  'gemini-2.5-flash',
];

function systemInstruction(tileCount: number): string {
  return `Tu es un générateur de jeux pour "ColorRoom", une salle pédagogique de ${tileCount} plaques LED (grille 6 colonnes × 7 rangées, index 0..${tileCount - 1}) pilotées depuis une tablette.
Tu produis UNIQUEMENT un objet JSON décrivant un jeu jouable, sans texte autour.

CADRE STRICT - QUELS JEUX TU PEUX FAIRE :
- ColorRoom est une INSTALLATION FIXE de ${tileCount} dalles colorées au sol. Le seul input du joueur est : cliquer une dalle (depuis la tablette ou pied sur la vraie dalle), appuyer une touche clavier (tablette), ou cliquer un bouton UI tablette. Il n'y a PAS de joystick, PAS de mouvement 3D, PAS de tir, PAS de combat.
- Les jeux doivent rester EDUCATIFS / PEDAGOGIQUES / SENSORIELS : couleurs, mémoire, réflexes, motricité, mathématiques, multijoueur coopératif, exploration sensorielle (lumière/vibration/son), apprentissage du daltonisme, mélange RGB, fractions, sequences, logique.
- Exemples ACCEPTES (cible : ces jeux fonctionnent bien) : "Color Speed" (clic dalle rapide), "Simon" (suite à mémoriser), "Memory" (paires de couleurs), "Mélange RGB" (curseurs pour reproduire une couleur), "Réflexe maths" (calculer un nombre puis cliquer une dalle), "Course en couleur" (allumer en rythme), "Daltonisme" (trouver l'intrus de couleur), "Métamérisme" (deux couleurs identiques sous deux conditions), "Puissance 4 lumineux", "Chasse au trésor" (suivre des indices lumineux).
- Si la demande sort de ce cadre (Forza, GTA, Call of Duty, Fortnite, Minecraft, FPS, jeu de course voiture, jeu de combat, MMORPG, jeu en monde ouvert 3D, simulateur de vol, simulateur de vie, RPG, plateformer Mario, n'importe quel jeu vidéo "AAA" complexe, ou tout jeu nécessitant un personnage qui se déplace dans un monde), TU REFUSES POLIMENT en renvoyant exactement ce JSON :
  { "refuse": true, "reason": "ColorRoom ne peut pas reproduire ce type de jeu. C'est une installation de ${tileCount} dalles LED au sol pilotées depuis une tablette : pas de mouvement 3D, pas de tir, pas de personnage. Je peux te faire un jeu éducatif de couleurs / réflexes / mémoire / mesure de lumière. Par exemple : 'un jeu de réflexes où il faut taper la dalle qui s'allume' ou 'un Simon avec 4 couleurs'." }
  Tu ne genères AUCUN autre champ dans ce cas. Le serveur affichera le message à l'utilisateur.

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
- Vibration (tablette) : vibrate {durationMs}. Utilise-le sur les évènements forts (erreur, fin de partie).
- Audio (hors-ligne): play_sound {sound}. Sons: click, select, tick, pop, swoosh, correct, wrong, success, error, alert, win, lose, levelup, coin, powerup, countdown, start, score. Utilise 'correct'/'wrong' pour le feedback pédagogique, 'win'/'lose' en fin de partie, 'coin'/'score' pour les points.
- TIMER / compte à rebours : countdown_start {seconds} lance un minuteur ; on_countdown_end est un ÉVÈNEMENT d'entrée (comme event_begin) déclenché à 0. Pour un jeu chronométré : event_begin → countdown_start {seconds:30}, et un nœud on_countdown_end séparé → play_sound {sound:"win"} + fin. Affiche le temps avec un timer_display (varBind "time" ou via countdown).
- INTERACTION DALLE : pour réagir au clic sur UNE dalle précise, utilise on_tile_click {tileIndex:0} (tileIndex commence à 0, donc la "dalle 1" = tileIndex 0). on_plate_click réagit au clic sur N'IMPORTE quelle dalle.
- VARIABLE \`clickedTile\` : à chaque clic sur une dalle, le runtime écrit l'index dans la variable \`clickedTile\` (0..${tileCount - 1}). On_plate_click peut donc tester : compare_eq {a:"clickedTile", b:"targetTile"} → if {varName:"result", op:"eq", value:1} → succès / sinon échec. C'est LE pattern Color Speed.
- RECETTE JEU DE RÉFLEXES (type Color Speed) DÉTAILLÉE - reproduis-la fidelement :
  IMPORTANT : pour allumer une dalle à un index VARIABLE (cible aléatoire), utilise tile_set_var {indexVar:"targetTile", defaultColor:"#22d3ee", intensity:0.85} (PAS tile_set qui n'accepte qu'un index littéral).
  1. event_begin → variable_set {name:"score",value:0,op:"set"} → random_int {min:0,max:${tileCount - 1},varName:"targetTile"} → tile_set_var {indexVar:"targetTile",defaultColor:"#22d3ee",intensity:0.85} → countdown_start {seconds:30, varName:"countdown"}
  2. on_plate_click → compare_eq {a:"clickedTile",b:"targetTile",out:"hit"} → if {varName:"hit",op:"eq",value:1}
     - branche vrai : add_score {amount:1} → play_sound {sound:"correct"} → clear_tiles → random_int {min:0,max:${tileCount - 1},varName:"targetTile"} → tile_set_var {indexVar:"targetTile",defaultColor:"#22d3ee",intensity:0.85}
     - branche faux : play_sound {sound:"wrong"} → vibrate {durationMs:120}
  3. on_countdown_end {varName:"countdown"} → play_sound {sound:"win"} → clear_tiles
  L'UI DOIT contenir : title_banner + score_display(varBind:"score") + timer_display(varBind:"countdown"). JAMAIS de plate_grid (voir règle ci-dessous).
- ⛔ RÈGLE ABSOLUE SUR L'UI - NE JAMAIS REPRÉSENTER LA COLOR ROOM : l'écran de jeu affiche DÉJÀ une vue 3D temps réel des ${tileCount} dalles, sur laquelle le joueur clique directement. Donc dans l'UI Designer tu ne dois JAMAIS ajouter de composant "plate_grid", ni aucune grille/damier/carré qui imite les dalles, ni aucune mini-carte de la salle. Ce serait un doublon inutile. L'UI Designer sert UNIQUEMENT au HUD par-dessus la 3D : titre, score, minuteur, boutons, sliders de difficulté, messages, jauges, icônes de feedback. JAMAIS la salle elle-même. Cette règle s'applique à TOUS les jeux sans exception.
- L'UI est posée sur un canvas 860×500 transparent SUPERPOSÉ à la vue 3D. Garde-la AÉRÉE et sur les bords (haut pour le titre/score/timer, bas pour les messages/boutons), en laissant le CENTRE LIBRE pour qu'on voie la salle 3D derrière. CHAQUE jeu doit contenir AU MINIMUM : un title_banner (titre), un score_display si un score existe, un timer_display si un compte à rebours existe. Le joueur interagit avec les dalles via la 3D (évènements on_plate_click / on_tile_click), PAS via l'UI.
- Lie les affichages à des variables via "varBind" (ex: un score_display avec varBind "score").
- Icônes : "sprite" (icône Lucide via "icon", ex Trophy, Star, Heart, Check, X, Zap, Crown, ThumbsUp) ou "svg_icon" (SVG perso). Pour sprite/svg_icon, "varBind" sert de visibilité : l'icône n'apparaît que si la variable est non nulle (ex. afficher un Trophy avec varBind "gagne"). Couleur via "bgColor".
- Relie les boutons à la logique via "eventId" et un nœud "on_ui_click" {buttonId} correspondant.
- Sois COHÉRENT : chaque eventId d'UI doit avoir son nœud on_ui_click; chaque variable affichée doit être écrite par la logique.
- Si un "JEU ACTUEL" est fourni, MODIFIE-le selon la demande et renvoie le jeu COMPLET mis à jour (jamais un diff ni un fragment). Conserve ce qui n'est pas concerné.

RECETTES AVANCÉES (à appliquer quand la demande les évoque) :
- DEUX SALLES : la grille de ${tileCount} dalles se divise en deux moitiés. Salle GAUCHE = dalles 0 à ${Math.floor(tileCount / 2) - 1}, salle DROITE = dalles ${Math.floor(tileCount / 2)} à ${tileCount - 1}. Pour "jouer sur 1 salle ou 2", crée une variable "rooms" (1 ou 2) réglable AVANT le début et borne les random_int en conséquence (ex. si rooms=1 → max ${Math.floor(tileCount / 2) - 1}, si rooms=2 → max ${tileCount - 1}).
- DIFFICULTÉ CONFIGURABLE : avant de lancer, propose des boutons UI (button + on_ui_click) ou des labels pour régler une variable "difficulty" (1=facile…3=difficile) et/ou "speed". La difficulté influe sur : la vitesse (durée du compte à rebours, intervalle on_timer), le malus de points, le nombre de dalles simultanées, la profondeur de l'IA adverse. Mets event_begin → écran de config (titre + boutons difficulté + bouton "Démarrer"), et c'est le bouton Démarrer (on_ui_click) qui lance vraiment la partie.
- SCORE DÉGRESSIF AU TEMPS : pour "gagner des points selon la rapidité (max 50)", au moment où la cible apparaît stocke le temps (time_seconds → varName "t0"). Au clic correct, calcule l'écart (time_seconds → "t1", math_sub t1-t0 → "dt"), puis points = clamp( 50 - dt*facteur ) via math_mul + math_sub + math_max 0. add_score de ce résultat (utilise score_set/variable puis add_score, ou math puis add_score{amount}).
- CIBLE VERTE vs ROUGE (piège) : allume DEUX dalles aléatoires distinctes, une verte (bonne, defaultColor "#22c55e") et une rouge (piège, "#ef4444"). on_plate_click → compare_eq(clickedTile, greenTile) : si vrai → points selon rapidité + son "correct" ; compare_eq(clickedTile, redTile) : si vrai → malus selon difficulté (variable_set score op:"sub", montant = difficulty*5) + son "wrong" + vibrate. Garantis greenTile ≠ redTile (re-tire si égal).
- JEU AU TOUR PAR TOUR (morpion, etc.) avec 3 MODES : prévois une variable "mode" réglée avant la partie via boutons UI : "multi" (multijoueur réseau via mp_session/mp_broadcast/mp_player_input), "duo" (1 contre 1 chacun son tour sur le même appareil : alterne une variable "joueurActuel" 1↔2 à chaque coup), "ia" (contre l'ordinateur). Pour le mode IA, l'adversaire DOIT être un bloc script_python qui implémente un minimax (comme l'IA du Puissance 4) dont la PROFONDEUR/force dépend de "difficulty" : difficulty 1 = coups aléatoires ou profondeur 1, difficulty 2 = profondeur 3-4, difficulty 3 = minimax complet (imbattable). Le script lit la grille (variable/tableau d'état), calcule le meilleur coup et le joue (tile_set_var sur la dalle choisie + met à jour l'état). C'est la SEULE façon d'avoir une IA forte : les blocs seuls ne suffisent pas, le minimax va dans un script_python.
- GRILLE LOGIQUE (morpion 3×3, etc.) : représente le plateau avec array_create/grid_create (9 cases pour un morpion) et synchronise vers les dalles physiques via tiles_from_array/grid_sync_tiles. Pour un morpion "sur le mur du fond", mappe les 9 cases sur 9 dalles formant un carré 3×3 (l'utilisateur précise lesquelles ; sinon prends les 9 premières dalles de chaque salle). Vérifie la victoire avec grid_check_4_in_row adapté (3 alignées) ou une logique compare/if.

EXEMPLE COMPLET de Color Speed (jeu pédagogique simple - copie cette structure) :
{"name":"Tape la dalle","icon":"Zap","difficulty":2,"description":"Clique la dalle qui s'allume.","bgColor":"#0d1119","accentColor":"#22d3ee","nodes":[{"kind":"event_begin","name":"Démarrer","params":{},"x":80,"y":80},{"kind":"variable_set","name":"Score 0","params":{"name":"score","value":0,"op":"set"},"x":320,"y":80},{"kind":"random_int","name":"Cible aléa.","params":{"min":0,"max":${tileCount - 1},"varName":"targetTile"},"x":560,"y":80},{"kind":"tile_set_var","name":"Allumer cible","params":{"indexVar":"targetTile","defaultColor":"#22d3ee","intensity":0.85},"x":800,"y":80},{"kind":"countdown_start","name":"30s","params":{"seconds":30,"varName":"countdown"},"x":1040,"y":80},{"kind":"on_plate_click","name":"Clic dalle","params":{},"x":80,"y":260},{"kind":"compare_eq","name":"Bonne dalle ?","params":{"a":"clickedTile","b":"targetTile","out":"hit"},"x":320,"y":260},{"kind":"if","name":"Si juste","params":{"varName":"hit","op":"eq","value":1},"x":560,"y":260},{"kind":"add_score","name":"+1","params":{"amount":1},"x":800,"y":220},{"kind":"play_sound","name":"correct","params":{"sound":"correct"},"x":1040,"y":220},{"kind":"clear_tiles","name":"Éteindre","params":{},"x":1280,"y":220},{"kind":"random_int","name":"Nouvelle cible","params":{"min":0,"max":${tileCount - 1},"varName":"targetTile"},"x":1520,"y":220},{"kind":"tile_set_var","name":"Rallumer","params":{"indexVar":"targetTile","defaultColor":"#22d3ee","intensity":0.85},"x":1760,"y":220},{"kind":"play_sound","name":"wrong","params":{"sound":"wrong"},"x":800,"y":340},{"kind":"vibrate","name":"vib","params":{"durationMs":120},"x":1040,"y":340},{"kind":"on_countdown_end","name":"Fin","params":{"varName":"countdown"},"x":80,"y":460},{"kind":"play_sound","name":"win","params":{"sound":"win"},"x":320,"y":460},{"kind":"clear_tiles","name":"clear","params":{},"x":560,"y":460}],"edges":[[0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[7,13],[13,14],[15,16],[16,17]],"ui":[{"kind":"title_banner","x":20,"y":16,"width":820,"height":56,"text":"Tape la dalle"},{"kind":"score_display","x":20,"y":84,"width":220,"height":88,"varBind":"score","text":"Score"},{"kind":"timer_display","x":600,"y":84,"width":220,"height":88,"varBind":"countdown","text":"Temps"}]}
(Remarque : AUCUN plate_grid dans l'UI - le joueur clique les dalles sur la vue 3D. Le titre est en haut, le score à gauche, le timer à droite, le centre reste vide pour voir la salle 3D.)

REMARQUE : la branche FAUSSE du "if" (index 7) pointe vers play_sound "wrong" puis vibrate (edges [7,13],[13,14]). La branche VRAIE pointe vers add_score (edge [7,8]). Quand if a 2 sorties, la 1re est vrai, la 2e est faux.
RÈGLE D'OR : Si tu veux allumer une dalle dont l'index est stocké dans une VARIABLE, utilise OBLIGATOIREMENT tile_set_var {indexVar:"nomVar",defaultColor:"#xxx",intensity:0.x}. tile_set ne fonctionne qu'avec un nombre littéral.

- Génère un jeu complet et JOUABLE, pas un squelette. Réponds en JSON pur.`;
}

type GameJson = {
  /** Le modele peut renvoyer { refuse: true, reason: ... } pour les jeux hors-cadre */
  refuse?: boolean;
  reason?: string;
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
    // ⛔ On retire toute représentation de la salle dans l'UI : la vue 3D est
    // déjà affichée à l'écran de jeu. plate_grid serait un doublon trompeur.
    .filter((c) => c.kind !== 'plate_grid')
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

  // ── Auto-injection des composants HUD essentiels manquants ───────────────
  // On garantit un HUD minimal lisible PAR-DESSUS la vue 3D. On n'injecte
  // JAMAIS de plate_grid : la salle est déjà visible en 3D, le joueur clique
  // directement les dalles (évènements on_plate_click / on_tile_click).
  const usesScore = nodes.some((n) => n.kind === 'add_score' || n.kind === 'score_set' || n.kind === 'get_score' || n.kind === 'score_reset');
  const usesCountdown = nodes.some((n) => n.kind === 'countdown_start' || n.kind === 'on_countdown_end');
  const hasKind = (k: string) => ui.some((c) => c.kind === k);

  const gameName = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Jeu IA';

  // 1. title_banner toujours utile : il identifie le jeu (bandeau du haut).
  if (!hasKind('title_banner')) {
    ui.unshift({ kind: 'title_banner', x: 20, y: 16, width: 820, height: 56, text: gameName });
  }
  // 2. score_display si le jeu manipule un score (coin haut-gauche).
  if (usesScore && !hasKind('score_display')) {
    ui.push({ kind: 'score_display', x: 20, y: 84, width: 220, height: 88, varBind: 'score', text: 'Score' });
  }
  // 3. timer_display si le jeu a un compte a rebours (coin haut-droit, on
  // laisse le centre libre pour voir la 3D).
  if (usesCountdown && !hasKind('timer_display')) {
    ui.push({ kind: 'timer_display', x: 600, y: 84, width: 220, height: 88, varBind: 'countdown', text: 'Temps' });
  }

  return {
    name: gameName,
    icon: typeof raw.icon === 'string' ? raw.icon : 'Sparkles',
    difficulty: Math.max(1, Math.min(5, Math.round(Number(raw.difficulty) || 2))),
    description: typeof raw.description === 'string' ? raw.description.slice(0, 200) : '',
    bgColor: isHex(raw.bgColor) ? raw.bgColor : '#0d1119',
    accentColor: isHex(raw.accentColor) ? raw.accentColor : '#7c3aed',
    tileCount,
    nodes, edges, ui,
  };
}

// Vérifie si un id de modèle appartient à Gemini.
function isGeminiModel(id: string) { return id.startsWith('gemini'); }

/**
 * Sonde Gemini avec un timeout court pour décider si on peut l'utiliser.
 * Renvoie true si la clé est acceptée et répond dans le délai.
 */
async function geminiReachable(key: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
    // 200 ou 400 (prompt trop court) = clé valide + serveur joignable
    return res.status === 200 || res.status === 400;
  } catch {
    return false;
  }
}

// Prompt COURT pour les petits modèles locaux (moins de contexte/RAM, plus fiable).
function systemInstructionLite(tileCount: number): string {
  return `Genere UNIQUEMENT un JSON pour ColorRoom, salle EDUCATIVE de ${tileCount} dalles LED au sol (grille 6x7, index 0..${tileCount - 1}).
Si la demande est un jeu video AAA (Forza, GTA, CoD, Fortnite, FPS, course, monde ouvert, RPG 3D) renvoie {"refuse":true,"reason":"texte"} et rien d'autre.
Sinon Format strict: {"name":str,"icon":"Zap","difficulty":2,"description":str,"bgColor":"#0d1119","accentColor":"#22d3ee","nodes":[{"kind":K,"name":str,"params":{},"x":n,"y":n}],"edges":[[from,to]],"ui":[{"kind":U,"x":n,"y":n,"width":n,"height":n,"text"?:str,"varBind"?:str}]}
K possibles: event_begin, variable_set{name,value,op:"set"|"add"}, random_int{min,max,varName}, add_score{amount}, if{varName,op:"gt"|"lt"|"eq",value}, compare_eq{a,b,out}, fill{color,intensity}, tile_set{tileIndex,color,intensity}, clear_tiles, pulse{baseColor,targetColor,speed}, on_plate_click, on_tile_click{tileIndex}, on_timer{intervalMs}, on_key{key}, on_countdown_end, countdown_start{seconds}, wait{seconds}, play_sound{sound}, vibrate{durationMs}.
U possibles: title_banner, label, score_display{varBind}, timer_display{varBind}, button{eventId}, color_swatch, progress_bar{varBind}, rgb_sliders, message_box.
Variable runtime \`clickedTile\` = index de la derniere dalle cliquee (sur on_plate_click).
sons: click, correct, wrong, win, lose, coin, levelup.
REGLES :
- Commence TOUJOURS par event_begin (index 0).
- Lie l'UI aux variables via varBind (ex score_display varBind:"score").
- ⛔ JAMAIS de plate_grid ni de grille/damier dans l'UI : la vue 3D des dalles est deja affichee, le joueur clique dessus directement (evenement on_plate_click). L'UI = seulement HUD (titre, score, timer, boutons) sur les bords, centre vide.
- Reste SIMPLE, EDUCATIF, JOUABLE.
REGLE D'OR : pour allumer une dalle avec un index variable, utilise tile_set_var {indexVar:"nomVar",defaultColor:"#xxx",intensity:0.x} (pas tile_set qui ne marche qu'avec un index littéral).
EXEMPLE Color Speed (copie cette structure exacte) :
{"name":"Tape la dalle","icon":"Zap","difficulty":2,"description":"Clique la dalle qui s'allume.","bgColor":"#0d1119","accentColor":"#22d3ee","nodes":[{"kind":"event_begin","name":"Demarrer","params":{},"x":80,"y":80},{"kind":"variable_set","name":"Score","params":{"name":"score","value":0,"op":"set"},"x":320,"y":80},{"kind":"random_int","name":"Cible","params":{"min":0,"max":${tileCount - 1},"varName":"targetTile"},"x":560,"y":80},{"kind":"tile_set_var","name":"Allumer","params":{"indexVar":"targetTile","defaultColor":"#22d3ee","intensity":0.85},"x":800,"y":80},{"kind":"countdown_start","name":"30s","params":{"seconds":30,"varName":"countdown"},"x":1040,"y":80},{"kind":"on_plate_click","name":"Clic","params":{},"x":80,"y":260},{"kind":"compare_eq","name":"Bon ?","params":{"a":"clickedTile","b":"targetTile","out":"hit"},"x":320,"y":260},{"kind":"if","name":"Si juste","params":{"varName":"hit","op":"eq","value":1},"x":560,"y":260},{"kind":"add_score","name":"+1","params":{"amount":1},"x":800,"y":220},{"kind":"play_sound","name":"correct","params":{"sound":"correct"},"x":1040,"y":220},{"kind":"clear_tiles","name":"Eteindre","params":{},"x":1280,"y":220},{"kind":"random_int","name":"Nouvelle","params":{"min":0,"max":${tileCount - 1},"varName":"targetTile"},"x":1520,"y":220},{"kind":"tile_set_var","name":"Rallumer","params":{"indexVar":"targetTile","defaultColor":"#22d3ee","intensity":0.85},"x":1760,"y":220},{"kind":"play_sound","name":"wrong","params":{"sound":"wrong"},"x":800,"y":340},{"kind":"on_countdown_end","name":"Fin","params":{"varName":"countdown"},"x":80,"y":480},{"kind":"play_sound","name":"win","params":{"sound":"win"},"x":320,"y":480}],"edges":[[0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[7,13],[14,15]],"ui":[{"kind":"title_banner","x":20,"y":16,"width":820,"height":56,"text":"Tape la dalle"},{"kind":"score_display","x":20,"y":84,"width":220,"height":88,"varBind":"score","text":"Score"},{"kind":"timer_display","x":600,"y":84,"width":220,"height":88,"varBind":"countdown","text":"Temps"}]}`;
}

// Appel d'un modèle local via Ollama (hors-ligne). format:json force une sortie JSON.
async function callOllama(sys: string, user: string): Promise<GameJson | null> {
  const base = (process.env.OLLAMA_URL || 'http://ollama:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(240000), // le Raspberry Pi est lent (CPU)
    // Modèle local léger : on limite les tokens et le contexte pour répondre VITE
    // (un Pi en CPU génère lentement ; 2048 tokens suffisent pour un jeu).
    body: JSON.stringify({ model, system: sys, prompt: user, format: 'json', stream: false, options: { temperature: 0.3, num_predict: 2048, num_ctx: 4096 } }),
  });
  if (!res.ok) {
    // Remonte le VRAI message d'Ollama (ex: "model not found, try pulling it first", OOM…)
    let detail = '';
    try { detail = String((await res.json())?.error ?? ''); } catch { try { detail = await res.text(); } catch { /* ignore */ } }
    throw new Error(`HTTP ${res.status}${detail ? ' - ' + detail.slice(0, 240) : ''}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.response;
  if (!text) return null;
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned) as GameJson; } catch { return null; }
}

// ── Helpers Ollama ────────────────────────────────────────────────────────────
async function runOllama(model: string, tileCount: number, userContent: string) {
  const sys = systemInstructionLite(tileCount);
  // Surcharge le modèle env si un modèle précis est demandé
  const orig = process.env.OLLAMA_MODEL;
  if (model) process.env.OLLAMA_MODEL = model;
  try {
    return await callOllama(sys, userContent);
  } finally {
    if (orig !== undefined) process.env.OLLAMA_MODEL = orig;
    else delete process.env.OLLAMA_MODEL;
  }
}

// Detecte les demandes qu'on ne peut PAS reproduire sur 42 dalles LED.
// On fait un check rapide cote serveur (coute 0, pas d'appel IA) avant de
// brûler du quota Gemini pour un refus.
function detectImpossibleGame(prompt: string): string | null {
  const p = prompt.toLowerCase();
  // Noms de franchises 3D / FPS / racing / open world / sim
  const blockList = [
    'forza', 'gran turismo', 'need for speed', 'mario kart', 'mario',
    'gta', 'grand theft auto', 'call of duty', 'cod ', 'cod\n', 'battlefield',
    'fortnite', 'apex', 'valorant', 'counter strike', 'csgo', 'cs:go', 'cs go',
    'minecraft', 'roblox', 'fifa', 'pes ', 'nba 2k',
    'zelda', 'pokémon', 'pokemon', 'animal crossing',
    'world of warcraft', 'wow ', 'league of legends',
    'overwatch', 'rainbow six', 'r6 ', 'pubg', 'warzone',
    'gta v', 'gta 5', 'gta vi', 'rdr ', 'red dead',
    'sims', 'cyberpunk', 'witcher', 'skyrim', 'fallout',
    'doom', 'half-life', 'portal',
  ];
  for (const kw of blockList) {
    if (p.includes(kw)) return kw;
  }
  // Concepts qui ne tiennent pas sur 42 dalles (mouvement 3D, tir, monde ouvert)
  const conceptList = [
    'monde ouvert', 'open world',
    'tir à la première personne', 'fps', 'first person shooter',
    'jeu de tir', 'shoot', 'shooter',
    'jeu de course', 'racing game', 'simulateur de course',
    'simulateur de vol', 'flight sim',
    'jeu de combat', 'fighting game',
    'mmorpg', 'rpg en 3d', 'jeu en 3d', 'jeu 3d',
    'plateformer', 'plateforme',
    'battle royale', 'mmo',
  ];
  for (const kw of conceptList) {
    if (p.includes(kw)) return kw;
  }
  return null;
}

function buildRefusal(matched: string, tileCount: number) {
  return NextResponse.json({
    ok: false,
    error: 'OUT_OF_SCOPE',
    message: `ColorRoom ne peut pas reproduire ce type de jeu (« ${matched} »). C'est une installation de ${tileCount} dalles LED au sol pilotées depuis une tablette : pas de mouvement 3D, pas de tir, pas de personnage. Je peux te faire un jeu éducatif de couleurs, de réflexes, de mémoire, de mesure de lumière. Exemples : « un jeu de réflexes où il faut taper la dalle qui s'allume », « un Simon avec 4 couleurs », « un memory de paires de couleurs », « un jeu d'addition où on clique le bon nombre ».`,
  }, { status: 400 });
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const prompt = String(body?.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'NO_PROMPT', message: 'Décris le jeu à créer.' }, { status: 400 });
  }
  const tileCount = Math.max(1, Math.min(42, Math.round(Number(body?.tileCount) || 42)));

  // ── Garde-fou : refus immediat des jeux hors-cadre (Forza, GTA, FPS...)
  // Sauf si on est en multi-tours (currentGame existant) — l'utilisateur peut
  // alors continuer a affiner sans declencher le filtre sur des references
  // historiques dans son prompt.
  const isFollowUp = !!body?.currentGame;
  if (!isFollowUp) {
    const matched = detectImpossibleGame(prompt);
    if (matched) return buildRefusal(matched, tileCount);
  }

  // Modèle explicitement choisi par l'utilisateur (depuis le sélecteur UI).
  const chosenModel: string = typeof body?.model === 'string' ? body.model.trim() : '';

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
  const key = process.env.GEMINI_API_KEY ?? '';
  const hasKey = !!key && key !== 'XXX' && key.length > 10;

  // ── Modèle Ollama explicitement choisi ──────────────────────────────────────
  if (chosenModel && !isGeminiModel(chosenModel)) {
    const model = chosenModel;
    try {
      const raw = await runOllama(model, tileCount, userContent);
      if (!raw) return NextResponse.json({ ok: false, error: 'OLLAMA_EMPTY', message: `Le modèle ${model} a renvoyé une réponse vide. Réessaie avec une demande plus simple.` }, { status: 502 });
      if (raw.refuse === true) {
        return NextResponse.json({ ok: false, error: 'OUT_OF_SCOPE', message: String(raw.reason ?? 'Ce jeu ne peut pas etre reproduit sur les dalles ColorRoom.') }, { status: 400 });
      }
      const game = sanitize(raw, tileCount);
      if (game.nodes.length === 0) return NextResponse.json({ ok: false, error: 'OLLAMA_INVALID', message: `${model} n'a produit aucun bloc valide. Essaie un modèle plus capable.` }, { status: 502 });
      return NextResponse.json({ ok: true, model: `ollama/${model}`, game });
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      let hint = `Erreur Ollama avec "${model}".`;
      if (/not found|try pulling/i.test(msg)) hint = `Modèle "${model}" non installé. Lance : ollama pull ${model}`;
      else if (/memory|oom|out of/i.test(msg)) hint = `RAM insuffisante pour "${model}". Choisis un modèle plus léger.`;
      return NextResponse.json({ ok: false, error: 'OLLAMA_NOT_READY', message: `${hint} (${msg.slice(0, 200)})` }, { status: 503 });
    }
  }

  // ── Gemini (cloud) - modèle choisi ou cascade automatique ──────────────────
  if (hasKey && (!chosenModel || isGeminiModel(chosenModel))) {
    // Si modèle spécifique demandé, essaie-le en premier ; sinon cascade complète.
    const models = chosenModel
      ? [chosenModel, ...DEFAULT_MODELS.filter((m) => m !== chosenModel)]
      : (process.env.GEMINI_MODELS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_MODELS);

    // Vérification rapide de joignabilité (5 s max) avant d'engager la cascade.
    const reachable = await geminiReachable(key, 5000);
    if (!reachable) {
      // Fallback Ollama automatique
      const fallbackModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
      try {
        const raw = await callOllama(systemInstructionLite(tileCount), userContent);
        if (raw) {
          const game = sanitize(raw, tileCount);
          if (game.nodes.length > 0) return NextResponse.json({ ok: true, model: `ollama/${fallbackModel}`, fallback: true, fallbackReason: 'Gemini non joignable (>5s) - bascule locale', game });
        }
      } catch { /* ignore - on renvoie l'erreur Gemini */ }
      return NextResponse.json({ ok: false, error: 'GEMINI_UNREACHABLE', message: 'Gemini n\'a pas répondu dans les 5 secondes et le modèle local est indisponible. Vérifie ta connexion ou installe Ollama.' }, { status: 503 });
    }

    const errors: string[] = [];
    for (const model of models) {
      try {
        const raw = await callGemini(model, key, sys, userContent);
        if (!raw) { errors.push(`${model}: réponse vide/illisible`); continue; }
        // Le modele a refuse la demande (jeu hors-cadre detecte par lui-meme)
        if (raw.refuse === true) {
          return NextResponse.json({
            ok: false, error: 'OUT_OF_SCOPE',
            message: String(raw.reason ?? 'Ce jeu ne peut pas etre reproduit sur les dalles ColorRoom.'),
          }, { status: 400 });
        }
        const game = sanitize(raw, tileCount);
        if (game.nodes.length === 0) { errors.push(`${model}: aucun bloc valide`); continue; }
        return NextResponse.json({ ok: true, model, game });
      } catch (e: any) {
        errors.push(`${model}: ${e?.message ?? 'erreur'}`);
      }
    }

    // Tous les modèles Gemini ont échoué → fallback Ollama si possible
    try {
      const fallbackModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
      const raw = await callOllama(systemInstructionLite(tileCount), userContent);
      if (raw) {
        const game = sanitize(raw, tileCount);
        if (game.nodes.length > 0) return NextResponse.json({ ok: true, model: `ollama/${fallbackModel}`, fallback: true, fallbackReason: 'Gemini a échoué - bascule locale', game });
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: false, error: 'ALL_MODELS_FAILED', message: 'Aucun modèle Gemini n\'a répondu et le modèle local est indisponible.', details: errors }, { status: 502 });
  }

  // ── Ollama (pas de clé Gemini) ─────────────────────────────────────────────
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  try {
    const raw = await callOllama(systemInstructionLite(tileCount), userContent);
    if (!raw) return NextResponse.json({ ok: false, error: 'OLLAMA_EMPTY', message: `Le modèle local ${model} a renvoyé une réponse vide. Réessaie avec une demande plus simple.` }, { status: 502 });
    if (raw.refuse === true) {
      return NextResponse.json({ ok: false, error: 'OUT_OF_SCOPE', message: String(raw.reason ?? 'Ce jeu ne peut pas etre reproduit sur les dalles ColorRoom.') }, { status: 400 });
    }
    const game = sanitize(raw, tileCount);
    if (game.nodes.length === 0) return NextResponse.json({ ok: false, error: 'OLLAMA_INVALID', message: 'Le modèle local n\'a produit aucun bloc valide. Réessaie ou utilise un modèle plus capable.' }, { status: 502 });
    return NextResponse.json({ ok: true, model: `ollama/${model}`, game });
  } catch (e: any) {
    const msg = String(e?.message ?? '');
    let hint: string;
    if (/not found|try pulling/i.test(msg)) hint = `Le modèle "${model}" n'est pas encore téléchargé.`;
    else if (/memory|oom|out of/i.test(msg)) hint = `RAM insuffisante pour "${model}". Choisis un modèle plus léger.`;
    else hint = `Le serveur Ollama a renvoyé une erreur.`;
    return NextResponse.json({ ok: false, error: 'OLLAMA_NOT_READY', message: `${hint} (${msg.slice(0, 200)})` }, { status: 503 });
  }
}

'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import type { TetrisSnapshot } from '@/app/_components/TetrisGame';
import type { UILayoutComponent } from './UIDesigner';
import Coachmarks, { type CoachStep } from '@/app/_components/Coachmarks';

// Modules lourds (3D Three.js, éditeur Python/Pyodide, designer UI, panneau CS160)
// chargés à la demande pour alléger le bundle initial de /editeur.
const Room3D = dynamic(() => import('@/app/_components/Room3D'), { ssr: false });
const TetrisGame = dynamic(() => import('@/app/_components/TetrisGame'), { ssr: false });
const CS160Panel = dynamic(() => import('@/app/_components/CS160Panel'), { ssr: false });
const PythonEditor = dynamic(() => import('./PythonEditor'), { ssr: false });
const UIDesigner = dynamic(() => import('./UIDesigner'), { ssr: false });

import { Boxes, Gamepad2, Plus, Play, Pause, RotateCcw, Save, Trash2, FolderPlus, X, Lightbulb, Layers, Zap, Palette, Clock, MousePointer2, LayoutGrid, Maximize2, Minimize2, Eye, Star, Heart, Sun, Moon, Flame, Snowflake, Music, Target, Puzzle, Sparkles, Trophy, Rocket, Ghost, Dice1, Brain, Check, GitBranch, Hash, Settings2, Shuffle, Search, Users, Film, Thermometer, ScanLine, Wifi, WifiOff, Crown, Gem, Bug, Bot, Atom, Bird, Cat, Dog, Fish, Leaf, Cloud, Droplet, Mountain, Anchor, Bell, Bomb, Camera, Egg, Feather, Gift, Hexagon, Key, Lock, Medal, Pizza, Plane, Rainbow, Skull, Smile, Wand2, Waves, Crosshair, Dice5, Joystick, FlaskConical, Swords, ChevronDown, GraduationCap, type LucideIcon } from 'lucide-react';

type IdFactory = () => string;

type TileState = {
  color: string;
  intensity: number;
};

type EditorNodeKind =
  | 'fill'
  | 'pulse'
  | 'tile'
  | 'event_begin'
  | 'wait'
  | 'sequence'
  | 'while'
  | 'if'
  | 'const_number'
  | 'const_bool'
  | 'const_color'
  | 'math_add'
  | 'math_sub'
  | 'math_mul'
  | 'math_div'
  | 'math_clamp01'
  | 'math_lerp'
  | 'compare_eq'
  | 'compare_gt'
  | 'compare_lt'
  | 'logic_and'
  | 'logic_or'
  | 'logic_not'
  | 'time_seconds'
  | 'random_01'
  | 'tile_get'
  | 'tile_set'
  | 'game_tetris'
  | 'game_simon'
  | 'game_memory'
  | 'game_spectrum'
  | 'game_color_speed'
  | 'game_maitre_blanc'
  | 'game_puissance4'
  | 'game_chasseur_gamut'
  | 'game_metamere'
  | 'game_canal_mix'
  | 'game_intrus'
  | 'game_chromaticite'
  | 'game_snake'
  | 'play_sound'
  | 'on_score_reached'
  | 'on_plate_click'
  | 'on_key'
  | 'on_timer'
  | 'on_click'
  | 'on_tick'
  | 'on_tile_click'
  | 'clear_tiles'
  | 'variable_set'
  | 'variable_get'
  | 'add_score'
  | 'get_score'
  | 'random_int'
  | 'game_tetris_block'
  // CS160 Colorimeter nodes
  | 'cs160_connect'
  | 'cs160_measure'
  | 'cs160_read_xyz'
  | 'cs160_read_lvxy'
  | 'cs160_set_backlight'
  | 'cs160_set_calib_ch'
  | 'cs160_rgb_calib'
  | 'cs160_single_calib'
  // Multijoueur
  | 'mp_session'
  | 'mp_wait_players'
  | 'mp_broadcast'
  | 'mp_player_input'
  // Couleur
  | 'color_mix'
  | 'color_hsl'
  | 'color_complement'
  | 'color_temperature'
  // Animation
  | 'anim_fade'
  | 'anim_strobe'
  | 'anim_rainbow'
  | 'anim_wave'
  // Flux étendu
  | 'loop_count'
  // Blocs spécifiques Tetris
  | 'tetris_on_line_clear'
  | 'tetris_on_level_up'
  | 'tetris_on_game_over'
  | 'tetris_set_speed'
  // Blocs spécifiques Simon
  | 'simon_on_success'
  | 'simon_on_fail'
  | 'simon_on_complete'
  | 'simon_set_speed'
  // Blocs spécifiques Memory
  | 'memory_on_match'
  | 'memory_on_fail'
  | 'memory_on_complete'
  // Blocs spécifiques Spectre
  | 'spectrum_on_submit'
  | 'spectrum_on_round_end'
  | 'spectrum_on_game_over'
  // Blocs spécifiques Color Speed
  | 'cspeed_on_hit'
  | 'cspeed_on_miss'
  | 'cspeed_on_time_up'
  // Blocs spécifiques Puissance 4
  | 'p4_on_win'
  | 'p4_on_draw'
  | 'p4_set_color'
  // Blocs spécifiques Chasseur Gamut
  | 'gamut_on_hit'
  | 'gamut_on_miss'
  | 'gamut_on_complete'
  // Interface utilisateur
  | 'ui_button'
  | 'ui_label'
  | 'ui_counter'
  | 'ui_timer_display'
  | 'ui_progress'
  | 'ui_show'
  | 'ui_hide'
  | 'on_ui_click'
  // Mesure colorimétrique dans les jeux
  | 'measure_start'
  | 'measure_on_result'
  | 'measure_compare'
  | 'measure_show_cie'
  | 'measure_target_xy'
  // ─── Logique de jeu (custom game engine) ────────────────────────────────────
  | 'round_start'
  | 'round_end'
  | 'next_round'
  | 'get_round'
  // ─── Couleur / science ──────────────────────────────────────────────────────
  | 'gen_target_color'
  | 'color_distance'
  | 'color_match_score'
  | 'show_target_on_plates'
  | 'get_player_rgb'
  // ─── Chronomètre async ──────────────────────────────────────────────────────
  | 'countdown_start'
  | 'countdown_stop'
  | 'on_countdown_end'
  // ─── Flux async ─────────────────────────────────────────────────────────────
  | 'wait_event'
  | 'emit_event'
  | 'on_submit_answer'
  // ─── Hardware direct ────────────────────────────────────────────────────────
  | 'hardware_flash'
  | 'hardware_send_color'
  // ─── Score étendu ───────────────────────────────────────────────────────────
  | 'score_reset'
  | 'score_set'
  | 'score_get'
  // ─── Variables couleur ──────────────────────────────────────────────────────
  | 'var_color_set'
  | 'var_color_get'
  | 'array_create' | 'array_get' | 'array_set' | 'array_fill' | 'array_length'
  | 'array_push' | 'array_pop' | 'array_shuffle' | 'array_contains' | 'array_index_of' | 'array_literal'
  | 'for_range' | 'for_each_array' | 'break_loop'
  | 'tile_set_var' | 'tile_get_var' | 'tiles_from_array'
  | 'math_mod' | 'math_floor' | 'math_ceil' | 'math_round' | 'math_abs'
  | 'math_min' | 'math_max' | 'math_pow' | 'math_sqrt'
  | 'grid_create' | 'grid_get' | 'grid_set' | 'grid_clear' | 'grid_sync_tiles' | 'grid_check_4_in_row'
  | 'string_concat' | 'string_from_num'
  | 'define_sub' | 'call_sub';

type EditorNode = {
  id: string;
  kind: EditorNodeKind;
  name: string;
  enabled: boolean;
  params: Record<string, unknown>;
  pos: { x: number; y: number };
};

type GameDifficulty = 1 | 2 | 3 | 4 | 5;

type GameIconName =
  | 'Lightbulb' | 'Gamepad2' | 'Star' | 'Heart' | 'Sun' | 'Moon' | 'Flame' | 'Snowflake' | 'Music' | 'Target' | 'Puzzle' | 'Sparkles' | 'Trophy' | 'Rocket' | 'Ghost' | 'Palette' | 'Zap' | 'Dice1'
  | 'Crown' | 'Gem' | 'Bug' | 'Bot' | 'Atom' | 'Bird' | 'Cat' | 'Dog' | 'Fish' | 'Leaf' | 'Cloud' | 'Droplet' | 'Mountain' | 'Anchor' | 'Bell' | 'Bomb' | 'Camera' | 'Egg' | 'Feather' | 'Gift' | 'Hexagon' | 'Key' | 'Lock' | 'Medal' | 'Pizza' | 'Plane' | 'Rainbow' | 'Skull' | 'Smile' | 'Wand2' | 'Waves' | 'Crosshair' | 'Dice5' | 'Joystick' | 'FlaskConical' | 'Swords' | 'Brain' | 'Eye';

const GAME_ICON_MAP: Record<GameIconName, LucideIcon> = {
  Lightbulb, Gamepad2, Star, Heart, Sun, Moon, Flame, Snowflake, Music, Target, Puzzle, Sparkles, Trophy, Rocket, Ghost, Palette, Zap, Dice1,
  Crown, Gem, Bug, Bot, Atom, Bird, Cat, Dog, Fish, Leaf, Cloud, Droplet, Mountain, Anchor, Bell, Bomb, Camera, Egg, Feather, Gift, Hexagon, Key, Lock, Medal, Pizza, Plane, Rainbow, Skull, Smile, Wand2, Waves, Crosshair, Dice5, Joystick, FlaskConical, Swords, Brain, Eye,
};

const GAME_ICON_NAMES: GameIconName[] = Object.keys(GAME_ICON_MAP) as GameIconName[];

// Template Python "low-code" par défaut d'un nouveau jeu : un placeholder commenté
// qui sert de mini-tutoriel (API + structure de jeu) directement modifiable.
const PYTHON_TEMPLATE = `import colorroom as cr
import math

# =============================================================
#  MINI-TUTO - Jeu en Python (low-code) sur les 42 dalles LED
#  API principale :
#    cr.send_color(plate_id, r, g, b, intensity)  # dalle 1..42, intensity 0..1
#    cr.set_variable('nom', valeur) / cr.get_variable('nom')
#    cr.add_score(points) / cr.get_score()
#    cr.get_key()        # derniere touche ('ArrowLeft', 'ArrowRight', ' ', ...)
#    cr.emit_event('type')
#    cr.log('message')   # affiche dans la console ci-dessous
#    cr.tile_count       # nombre de dalles (42)
#  Clique "Executer" pour lancer. Tout est modifiable !
# =============================================================

# 1) Degrade arc-en-ciel sur toutes les dalles
for i in range(cr.tile_count):
    h = i / cr.tile_count
    r = int((0.5 + 0.5 * math.sin(h * 6.28)) * 255)
    g = int((0.5 + 0.5 * math.sin(h * 6.28 + 2.09)) * 255)
    b = int((0.5 + 0.5 * math.sin(h * 6.28 + 4.19)) * 255)
    cr.send_color(i + 1, r, g, b, 0.85)

# 2) Variables et score
cr.set_variable('niveau', 1)
cr.add_score(10)
cr.log(f"Niveau {cr.get_variable('niveau')} - score {cr.get_score()}")

# 3) Reagis a une touche du joueur
touche = cr.get_key()
if touche == ' ':
    cr.emit_event('action')
    cr.log("Espace presse -> evenement 'action' emis")

# TODO : construis ta logique de jeu ici.
`;

type UICompKind = 'button' | 'slider' | 'label' | 'counter' | 'timer';

type GameUIComponent = {
  id: string;
  kind: UICompKind;
  label: string;
  color?: string;
  nodeRef?: string;   // ID du nœud on_ui_click ou variable_set lié
  varName?: string;   // pour slider/counter
  min?: number;       // pour slider
  max?: number;       // pour slider
  step?: number;      // pour slider
  value?: number;     // valeur initiale
};

type GameDoc = {
  id: string;
  name: string;
  tileCount?: number;
  icon?: GameIconName;
  difficulty?: GameDifficulty;
  description?: string;
  bgColor?: string;
  accentColor?: string;
  maxPlayers?: number;
  gameMode?: 'solo' | 'coop' | 'versus';
  nodes: EditorNode[];
  edges: GraphEdge[];
  uiComponents?: GameUIComponent[];
  pythonCode?: string;
  uiLayout?: UILayoutComponent[];
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
};

type NodeCatalogItem = {
  kind: EditorNodeKind;
  category: string;
  title: string;
  defaults: Record<string, unknown>;
};

const NODE_CATALOG: NodeCatalogItem[] = [
  { kind: 'event_begin', category: 'Évènements', title: 'Évènement', defaults: {} },
  { kind: 'wait', category: 'Flux', title: 'Attendre', defaults: { seconds: 1 } },
  { kind: 'sequence', category: 'Flux', title: 'Séquence', defaults: {} },
  { kind: 'while', category: 'Flux', title: 'Tant que', defaults: {} },
  { kind: 'if', category: 'Flux', title: 'Si', defaults: {} },
  { kind: 'fill', category: 'Rendu', title: 'Remplissage', defaults: { color: '#00d7ff', intensity: 0.6, mask: 'all', seconds: 1 } },
  {
    kind: 'pulse',
    category: 'Rendu',
    title: 'Pulsation',
    defaults: { baseColor: '#ff2aa6', targetColor: '#00d7ff', fromIntensity: 0.1, toIntensity: 0.8, speed: 1.0, phase: 0 },
  },
  { kind: 'tile', category: 'Rendu', title: 'Surcharge tuile', defaults: { tileIndex: 0, color: '#ff2aa6', intensity: 0.9 } },
  { kind: 'tile_get', category: 'Dalles', title: 'Lire une dalle', defaults: { tileIndex: 0 } },
  { kind: 'tile_set', category: 'Dalles', title: 'Écrire une dalle', defaults: { tileIndex: 0, color: '#ffffff', intensity: 1 } },
  { kind: 'const_number', category: 'Constantes', title: 'Nombre', defaults: { value: 0 } },
  { kind: 'const_bool', category: 'Constantes', title: 'Booléen', defaults: { value: false } },
  { kind: 'const_color', category: 'Constantes', title: 'Couleur', defaults: { value: '#ffffff' } },
  { kind: 'math_add', category: 'Maths', title: 'Addition', defaults: {} },
  { kind: 'math_sub', category: 'Maths', title: 'Soustraction', defaults: {} },
  { kind: 'math_mul', category: 'Maths', title: 'Multiplication', defaults: {} },
  { kind: 'math_div', category: 'Maths', title: 'Division', defaults: {} },
  { kind: 'math_clamp01', category: 'Maths', title: 'Bornage 0..1', defaults: {} },
  { kind: 'math_lerp', category: 'Maths', title: 'Interpolation', defaults: { t: 0.5 } },
  { kind: 'compare_eq', category: 'Logique', title: 'Égal', defaults: {} },
  { kind: 'compare_gt', category: 'Logique', title: 'Supérieur à', defaults: {} },
  { kind: 'compare_lt', category: 'Logique', title: 'Inférieur à', defaults: {} },
  { kind: 'logic_and', category: 'Logique', title: 'ET', defaults: {} },
  { kind: 'logic_or', category: 'Logique', title: 'OU', defaults: {} },
  { kind: 'logic_not', category: 'Logique', title: 'NON', defaults: {} },
  { kind: 'time_seconds', category: 'Temps', title: 'Secondes', defaults: {} },
  { kind: 'random_01', category: 'Aléatoire', title: 'Aléatoire 0..1', defaults: {} },
  { kind: 'game_tetris', category: 'Jeux', title: 'Tetris Lumière', defaults: { speed: 500, bgColor: '#0a0a0f', borderColor: '#222233' } },
  { kind: 'game_simon', category: 'Jeux', title: 'Simon', defaults: { speed: 800, colors: 4 } },
  { kind: 'game_memory', category: 'Jeux', title: 'Mémoire', defaults: { pairs: 8 } },
  { kind: 'game_spectrum', category: 'Jeux', title: 'Spectre Chromatique', defaults: { maxRounds: 5, revealMs: 5000, guessMs: 30000 } },
  { kind: 'game_color_speed', category: 'Jeux', title: 'Color Speed', defaults: { tileCount: 42, gameDuration: 60 } },
  { kind: 'game_maitre_blanc', category: 'Jeux', title: 'Le Maître du Blanc', defaults: { rounds: 10, threshold: 0.025 } },
  { kind: 'game_puissance4', category: 'Jeux', title: 'Puissance 4 Chromatique', defaults: { mode: 'pvp' } },
  { kind: 'game_chasseur_gamut', category: 'Jeux', title: 'Chasseur de Gamut', defaults: { rounds: 8 } },
  { kind: 'game_metamere', category: 'Jeux', title: 'Métamérie', defaults: {} },
  { kind: 'game_canal_mix', category: 'Jeux', title: 'Mix de Canaux', defaults: {} },
  { kind: 'game_intrus', category: 'Jeux', title: "L'Intrus (Sniper)", defaults: {} },
  { kind: 'game_chromaticite', category: 'Jeux', title: 'Chromaticité CIE', defaults: {} },
  { kind: 'game_snake', category: 'Jeux', title: 'Snake Lumière', defaults: { speed: 350 } },
  { kind: 'play_sound', category: 'Audio', title: 'Jouer un son', defaults: { sound: 'click' } },
  { kind: 'on_score_reached', category: 'Évènements', title: 'Score atteint', defaults: { target: 100 } },
  { kind: 'on_plate_click', category: 'Évènements', title: 'Clic sur dalle', defaults: {} },
  { kind: 'on_key', category: 'Évènements', title: 'Touche clavier', defaults: { key: 'ArrowLeft' } },
  { kind: 'loop_count', category: 'Flux', title: 'Répéter N fois', defaults: { count: 3 } },
  { kind: 'on_timer', category: 'Évènements', title: 'Timer', defaults: { intervalMs: 1000 } },
  { kind: 'on_click', category: 'Évènements', title: 'On Click', defaults: { tileIndex: 0 } },
  { kind: 'on_tick', category: 'Évènements', title: 'Tick (on_tick)', defaults: { intervalMs: 500 } },
  { kind: 'on_tile_click', category: 'Évènements', title: 'Clic dalle', defaults: { tileIndex: -1, target: 'any' } },
  // Multijoueur
  { kind: 'mp_session', category: 'Multijoueur', title: 'Session MP', defaults: { maxPlayers: 4, timeoutSec: 300, gameMode: 'versus' } },
  { kind: 'mp_wait_players', category: 'Multijoueur', title: 'Attendre joueurs', defaults: { minPlayers: 2 } },
  { kind: 'mp_broadcast', category: 'Multijoueur', title: 'Diffuser couleur', defaults: { color: '#00d7ff', intensity: 0.8 } },
  { kind: 'mp_player_input', category: 'Multijoueur', title: 'Action joueur', defaults: { seat: 1, timeoutSec: 30 } },
  // Couleur
  { kind: 'color_mix', category: 'Couleur', title: 'Mélange couleurs', defaults: { colorA: '#ff0000', colorB: '#0000ff', t: 0.5 } },
  { kind: 'color_hsl', category: 'Couleur', title: 'Couleur HSL', defaults: { hue: 200, saturation: 80, lightness: 50 } },
  { kind: 'color_complement', category: 'Couleur', title: 'Complémentaire', defaults: { color: '#ff2200' } },
  { kind: 'color_temperature', category: 'Couleur', title: 'Température K', defaults: { kelvin: 5500, intensity: 0.8 } },
  // Animation
  { kind: 'anim_fade', category: 'Animation', title: 'Fondu', defaults: { fromIntensity: 0, toIntensity: 1, durationMs: 1000, easing: 'linear' } },
  { kind: 'anim_strobe', category: 'Animation', title: 'Stroboscope', defaults: { color: '#ffffff', hz: 4, durationMs: 2000 } },
  { kind: 'anim_rainbow', category: 'Animation', title: 'Arc-en-ciel', defaults: { speed: 1.0, durationMs: 5000 } },
  { kind: 'anim_wave', category: 'Animation', title: 'Vague', defaults: { color: '#00d7ff', direction: 'left', speed: 1.0, durationMs: 3000 } },
  // CS160 Colorimeter nodes
  { kind: 'clear_tiles', category: 'Dalles', title: 'Effacer dalles', defaults: {} },
  { kind: 'variable_set', category: 'Variables', title: 'Set Variable', defaults: { name: 'x', value: 0, op: 'set' } },
  { kind: 'variable_get', category: 'Variables', title: 'Get Variable', defaults: { name: 'x' } },
  { kind: 'add_score', category: 'Variables', title: 'Ajouter Score', defaults: { amount: 1 } },
  { kind: 'get_score', category: 'Variables', title: 'Lire Score', defaults: {} },
  { kind: 'random_int', category: 'Aléatoire', title: 'Entier aléatoire', defaults: { min: 0, max: 41, varName: 'rand' } },
  { kind: 'game_tetris_block', category: 'Jeux', title: 'Tetris Blocs', defaults: { speed: 500, cols: 6, rows: 7 } },
  // ─── Blocs Tetris ───────────────────────────────────────────────────────────
  { kind: 'tetris_on_line_clear', category: 'Tetris', title: 'Ligne effacée', defaults: { lines: 1 } },
  { kind: 'tetris_on_level_up', category: 'Tetris', title: 'Niveau supérieur', defaults: { level: 2 } },
  { kind: 'tetris_on_game_over', category: 'Tetris', title: 'Game Over', defaults: {} },
  { kind: 'tetris_set_speed', category: 'Tetris', title: 'Changer vitesse', defaults: { speedMs: 300 } },
  // ─── Blocs Simon ────────────────────────────────────────────────────────────
  { kind: 'simon_on_success', category: 'Simon', title: 'Séquence réussie', defaults: { step: 1 } },
  { kind: 'simon_on_fail', category: 'Simon', title: 'Erreur séquence', defaults: {} },
  { kind: 'simon_on_complete', category: 'Simon', title: 'Simon terminé', defaults: {} },
  { kind: 'simon_set_speed', category: 'Simon', title: 'Changer vitesse', defaults: { speedMs: 600 } },
  // ─── Blocs Memory ───────────────────────────────────────────────────────────
  { kind: 'memory_on_match', category: 'Mémoire', title: 'Paire trouvée', defaults: { pairIndex: 0 } },
  { kind: 'memory_on_fail', category: 'Mémoire', title: 'Mauvaise paire', defaults: {} },
  { kind: 'memory_on_complete', category: 'Mémoire', title: 'Memory terminé', defaults: {} },
  // ─── Blocs Spectre ──────────────────────────────────────────────────────────
  { kind: 'spectrum_on_submit', category: 'Spectre', title: 'Réponse soumise', defaults: { seat: 0 } },
  { kind: 'spectrum_on_round_end', category: 'Spectre', title: 'Fin de manche', defaults: { round: 1 } },
  { kind: 'spectrum_on_game_over', category: 'Spectre', title: 'Partie terminée', defaults: {} },
  // ─── Blocs Color Speed ──────────────────────────────────────────────────────
  { kind: 'cspeed_on_hit', category: 'Color Speed', title: 'Dalle correcte', defaults: { tileIndex: 0 } },
  { kind: 'cspeed_on_miss', category: 'Color Speed', title: 'Mauvaise dalle', defaults: {} },
  { kind: 'cspeed_on_time_up', category: 'Color Speed', title: 'Temps écoulé', defaults: {} },
  // ─── Blocs Puissance 4 ──────────────────────────────────────────────────────
  { kind: 'p4_on_win', category: 'Puissance 4', title: 'Victoire', defaults: { player: 1 } },
  { kind: 'p4_on_draw', category: 'Puissance 4', title: 'Match nul', defaults: {} },
  { kind: 'p4_set_color', category: 'Puissance 4', title: 'Couleur joueur', defaults: { player: 1, color: '#f59e0b' } },
  // ─── Blocs Chasseur Gamut ───────────────────────────────────────────────────
  { kind: 'gamut_on_hit', category: 'Chasseur Gamut', title: 'Identifié', defaults: { round: 1 } },
  { kind: 'gamut_on_miss', category: 'Chasseur Gamut', title: 'Manqué', defaults: {} },
  { kind: 'gamut_on_complete', category: 'Chasseur Gamut', title: 'Jeu terminé', defaults: {} },
  // ─── Interface ──────────────────────────────────────────────────────────────
  { kind: 'ui_button', category: 'Interface', title: 'Bouton', defaults: { label: 'Cliquer', color: '#4361ee', id: 'btn1' } },
  { kind: 'ui_label', category: 'Interface', title: 'Étiquette', defaults: { text: 'Texte', size: 16, color: '#1a1d2e' } },
  { kind: 'ui_counter', category: 'Interface', title: 'Compteur', defaults: { label: 'Score', value: 0, id: 'counter1' } },
  { kind: 'ui_timer_display', category: 'Interface', title: 'Minuterie', defaults: { durationSec: 60, id: 'timer1' } },
  { kind: 'ui_progress', category: 'Interface', title: 'Barre de progression', defaults: { label: 'Vie', id: 'progress1', value: 100, max: 100 } },
  { kind: 'ui_show', category: 'Interface', title: 'Afficher élément', defaults: { targetId: 'btn1' } },
  { kind: 'ui_hide', category: 'Interface', title: 'Masquer élément', defaults: { targetId: 'btn1' } },
  { kind: 'on_ui_click', category: 'Évènements', title: 'Clic sur bouton UI', defaults: { buttonId: 'btn1' } },
  { kind: 'cs160_connect', category: 'Colorimètre', title: 'CS160 Connect', defaults: {} },
  { kind: 'cs160_measure', category: 'Colorimètre', title: 'CS160 Mesurer', defaults: {} },
  { kind: 'cs160_read_xyz', category: 'Colorimètre', title: 'CS160 Lire XYZ', defaults: {} },
  { kind: 'cs160_read_lvxy', category: 'Colorimètre', title: 'CS160 Lire Lvxy', defaults: {} },
  { kind: 'cs160_set_backlight', category: 'Colorimètre', title: 'CS160 Rétroéclairage', defaults: { mode: 'on' } },
  { kind: 'cs160_set_calib_ch', category: 'Colorimètre', title: 'CS160 Canal Calib', defaults: { channel: 0 } },
  { kind: 'cs160_rgb_calib', category: 'Colorimètre', title: 'CS160 Calib RGB', defaults: { 
    trueRedX: 800, trueRedY: 400, trueRedZ: 300,
    trueGreenX: 600, trueGreenY: 1000, trueGreenZ: 400,
    trueBlueX: 500, trueBlueY: 600, trueBlueZ: 1000,
    calibId: 'rgb_calib_001', targetChannel: 1 
  }},
  { kind: 'cs160_single_calib', category: 'Colorimètre', title: 'CS160 Calib 1 Point', defaults: {
    trueLv: 11.0, trueX: 0.4, trueY: 0.4,
    calibId: 'single_calib_001', targetChannel: 1
  }},
  // ─── Mesure colorimétrique dans les jeux ────────────────────────────────────
  { kind: 'measure_start', category: 'Mesure Jeu', title: 'Lancer mesure', defaults: { deviceId: 'cs160', timeoutSec: 5 } },
  { kind: 'measure_on_result', category: 'Mesure Jeu', title: 'Résultat reçu', defaults: { varX: 'meas_x', varY: 'meas_y', varLv: 'meas_lv' } },
  { kind: 'measure_compare', category: 'Mesure Jeu', title: 'Comparer couleur', defaults: { targetX: 0.3127, targetY: 0.3290, toleranceDeltaE: 5 } },
  { kind: 'measure_show_cie', category: 'Mesure Jeu', title: 'Afficher CIE 1931', defaults: { showTarget: true, showResult: true } },
  { kind: 'measure_target_xy', category: 'Mesure Jeu', title: 'Cible chromatique', defaults: { x: 0.3127, y: 0.3290, label: 'D65', toleranceDeltaE: 3 } },
  // ─── Logique de jeu (moteur custom) ─────────────────────────────────────────
  { kind: 'round_start',           category: 'Jeu',       title: 'Début de manche',          defaults: { totalRounds: 5, genTarget: false, resetScore: false } },
  { kind: 'round_end',             category: 'Jeu',       title: 'Fin de manche',             defaults: {} },
  { kind: 'next_round',            category: 'Jeu',       title: 'Manche suivante',            defaults: {} },
  { kind: 'get_round',             category: 'Jeu',       title: 'N° de manche',               defaults: { varName: 'round' } },
  // ─── Couleur / science ──────────────────────────────────────────────────────
  { kind: 'gen_target_color',      category: 'Couleur',   title: 'Générer cible couleur',     defaults: { mode: 'random', varName: 'target', displayOnPlates: true, displaySeconds: 3 } },
  { kind: 'color_distance',        category: 'Couleur',   title: 'Distance ΔE couleur',       defaults: { colorAVar: 'target', colorBVar: 'player', varName: 'deltaE', method: 'deltaE76' } },
  { kind: 'color_match_score',     category: 'Couleur',   title: 'Score correspondance',      defaults: { deltaEVar: 'deltaE', maxDeltaE: 50, maxScore: 100, varName: 'matchScore' } },
  { kind: 'show_target_on_plates', category: 'Couleur',   title: 'Afficher cible dalles',     defaults: { varName: 'target', plates: 'all', intensity: 0.85 } },
  { kind: 'get_player_rgb',        category: 'Couleur',   title: 'Lire sliders joueur',       defaults: { varR: 'playerR', varG: 'playerG', varB: 'playerB', varColor: 'player' } },
  // ─── Chronomètre async ──────────────────────────────────────────────────────
  { kind: 'countdown_start',       category: 'Jeu',       title: 'Démarrer compte à rebours', defaults: { seconds: 30, varName: 'countdown' } },
  { kind: 'countdown_stop',        category: 'Jeu',       title: 'Arrêter chronomètre',       defaults: { varName: 'countdown' } },
  { kind: 'on_countdown_end',      category: 'Évènements', title: 'Chronomètre terminé',      defaults: { varName: 'countdown' } },
  // ─── Flux async ─────────────────────────────────────────────────────────────
  { kind: 'wait_event',            category: 'Flux',      title: 'Attendre événement',        defaults: { eventType: 'submit', timeoutMs: 30000 } },
  { kind: 'emit_event',            category: 'Flux',      title: 'Émettre événement',         defaults: { eventType: 'submit' } },
  { kind: 'on_submit_answer',      category: 'Évènements', title: 'Réponse soumise',          defaults: {} },
  // ─── Hardware direct ────────────────────────────────────────────────────────
  { kind: 'hardware_flash',        category: 'Hardware',  title: 'Flash dalles',             defaults: { color: '#ffffff', intensity: 1.0, durationMs: 200 } },
  { kind: 'hardware_send_color',   category: 'Hardware',  title: 'Couleur directe dalles',   defaults: { varName: 'target', plates: 'all', intensity: 0.85 } },
  // ─── Score étendu ───────────────────────────────────────────────────────────
  { kind: 'score_reset',           category: 'Variables', title: 'Réinitialiser score',      defaults: {} },
  { kind: 'score_set',             category: 'Variables', title: 'Définir score',             defaults: { value: 0 } },
  { kind: 'score_get',             category: 'Variables', title: 'Lire score',                defaults: { varName: 'score' } },
  // ─── Variables couleur ──────────────────────────────────────────────────────
  { kind: 'var_color_set',         category: 'Variables', title: 'Set Variable Couleur',     defaults: { name: 'color1', value: '#ff2200' } },
  { kind: 'var_color_get',         category: 'Variables', title: 'Get Variable Couleur',     defaults: { name: 'color1', varName: 'myColor' } },
  { kind: 'array_create',    category: 'Tableaux', title: 'Créer tableau',         defaults: { name: 'arr', size: 42, initValue: 0 } },
  { kind: 'array_get',       category: 'Tableaux', title: 'tableau[i] → var',     defaults: { arrayName: 'arr', indexVar: 'i', outVar: 'item' } },
  { kind: 'array_set',       category: 'Tableaux', title: 'tableau[i] = var',      defaults: { arrayName: 'arr', indexVar: 'i', valueVar: 'val' } },
  { kind: 'array_fill',      category: 'Tableaux', title: 'Remplir tableau',       defaults: { arrayName: 'arr', value: 0 } },
  { kind: 'array_length',    category: 'Tableaux', title: 'Longueur tableau',      defaults: { arrayName: 'arr', outVar: 'len' } },
  { kind: 'array_push',      category: 'Tableaux', title: 'Push tableau',          defaults: { arrayName: 'arr', valueVar: 'val' } },
  { kind: 'array_pop',       category: 'Tableaux', title: 'Pop tableau',           defaults: { arrayName: 'arr', outVar: 'item' } },
  { kind: 'array_shuffle',   category: 'Tableaux', title: 'Mélanger tableau',     defaults: { arrayName: 'arr' } },
  { kind: 'array_contains',  category: 'Tableaux', title: 'Contient valeur?',      defaults: { arrayName: 'arr', valueVar: 'val', outVar: 'found' } },
  { kind: 'array_index_of',  category: 'Tableaux', title: 'Index de valeur',       defaults: { arrayName: 'arr', valueVar: 'val', outVar: 'idx' } },
  { kind: 'array_literal',   category: 'Tableaux', title: 'Tableau fixe (valeurs)', defaults: { name: 'arr', values: '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0' } },
  { kind: 'for_range',       category: 'Boucles',  title: 'Pour i = N à M',       defaults: { varName: 'i', start: 0, end: 41, step: 1, bodyNodeId: '' } },
  { kind: 'for_each_array',  category: 'Boucles',  title: 'Pour chaque élément',  defaults: { arrayName: 'arr', varName: 'item', indexVar: 'idx', bodyNodeId: '' } },
  { kind: 'break_loop',      category: 'Boucles',  title: 'Sortir boucle',        defaults: {} },
  { kind: 'tile_set_var',    category: 'Dalles',   title: 'Dalle[var] = couleur',  defaults: { indexVar: 'i', colorVar: 'color', intensity: 0.85 } },
  { kind: 'tile_get_var',    category: 'Dalles',   title: 'Lire dalle[var]',       defaults: { indexVar: 'i', outColorVar: 'tileColor' } },
  { kind: 'tiles_from_array',category: 'Dalles',   title: 'Array → dalles',        defaults: { arrayName: 'arr', intensity: 0.85, bgColor: '#000000' } },
  { kind: 'math_mod',   category: 'Maths', title: 'a % b (modulo)',  defaults: { aVar: 'a', bVar: 'b', outVar: 'result' } },
  { kind: 'math_floor', category: 'Maths', title: '⌊floor⌋',         defaults: { varName: 'x', outVar: 'result' } },
  { kind: 'math_ceil',  category: 'Maths', title: '⌈ceil⌉',          defaults: { varName: 'x', outVar: 'result' } },
  { kind: 'math_round', category: 'Maths', title: 'round(x)',         defaults: { varName: 'x', outVar: 'result' } },
  { kind: 'math_abs',   category: 'Maths', title: '|x| absolu',       defaults: { varName: 'x', outVar: 'result' } },
  { kind: 'math_min',   category: 'Maths', title: 'min(a,b)',          defaults: { aVar: 'a', bVar: 'b', outVar: 'result' } },
  { kind: 'math_max',   category: 'Maths', title: 'max(a,b)',          defaults: { aVar: 'a', bVar: 'b', outVar: 'result' } },
  { kind: 'math_pow',   category: 'Maths', title: 'a ^ b puissance',   defaults: { aVar: 'a', bVar: 'b', outVar: 'result' } },
  { kind: 'math_sqrt',  category: 'Maths', title: '√x racine',         defaults: { varName: 'x', outVar: 'result' } },
  { kind: 'grid_create',        category: 'Grille', title: 'Créer grille 2D',        defaults: { name: 'grid', cols: 6, rows: 7, initValue: null } },
  { kind: 'grid_get',           category: 'Grille', title: 'grille[col,row] → var', defaults: { name: 'grid', colVar: 'col', rowVar: 'row', outVar: 'cell' } },
  { kind: 'grid_set',           category: 'Grille', title: 'grille[col,row] = var', defaults: { name: 'grid', colVar: 'col', rowVar: 'row', valueVar: 'val' } },
  { kind: 'grid_clear',         category: 'Grille', title: 'Effacer grille',         defaults: { name: 'grid', initValue: null } },
  { kind: 'grid_sync_tiles',    category: 'Grille', title: 'Grille → dalles LED',    defaults: { name: 'grid', bgColor: '#000000', bgIntensity: 0 } },
  { kind: 'grid_check_4_in_row',category: 'Grille', title: 'Vérifier 4-en-ligne',   defaults: { name: 'grid', valueVar: 'lastColor', outVar: 'hasWon' } },
  { kind: 'string_concat',   category: 'Variables', title: 'Concat a + b',           defaults: { aVar: 'a', bVar: 'b', outVar: 'result' } },
  { kind: 'string_from_num', category: 'Variables', title: 'Nombre -> Texte',    defaults: { varName: 'x', outVar: 'text', decimals: 0 } },
  { kind: 'define_sub', category: 'Flux', title: 'Définir sous-programme',          defaults: { name: 'mySub' } },
  { kind: 'call_sub',   category: 'Flux', title: 'Appeler sous-programme',           defaults: { name: 'mySub' } },
];

/** Kinds that are native built-in games - shown in catalog but NOT addable to canvas */
// Seuls Simon / Mémoire / Spectre restent "lecture seule" (logique interne /
// multijoueur non rendue par un composant). Les autres jeux natifs sont
// ajoutables au canvas et s'exécutent réellement depuis l'éditeur.
const NATIVE_GAME_KINDS: Set<EditorNodeKind> = new Set([
  'game_simon', 'game_memory', 'game_spectrum',
]);

function labelNodeKind(kind: EditorNodeKind): string {
  return NODE_CATALOG.find((x) => x.kind === kind)?.title ?? kind;
}

function categoryOfKind(kind: EditorNodeKind): string {
  return NODE_CATALOG.find((x) => x.kind === kind)?.category ?? '';
}

const NODE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Évènements': Zap,
  'Flux': GitBranch,
  'Rendu': Palette,
  'Jeux': Gamepad2,
  'Maths': Hash,
  'Logique': Brain,
  'Temps': Clock,
  'Constantes': Hash,
  'Dalles': LayoutGrid,
  'Aléatoire': Shuffle,
  'Colorimètre': Lightbulb,
  'Multijoueur': Users,
  'Couleur': Layers,
  'Animation': Film,
  'Variables': Hash,
  'Tetris': Boxes,
  'Simon': Zap,
  'Mémoire': Brain,
  'Spectre': Palette,
  'Color Speed': Shuffle,
  'Puissance 4': LayoutGrid,
  'Chasseur Gamut': Film,
  'Interface': MousePointer2,
  'Mesure Jeu': Thermometer,
};

const NODE_CATEGORY_COLORS: Record<string, string> = {
  'Évènements': '#f59e0b',
  'Flux': '#f97316',
  'Rendu': '#22d3ee',
  'Jeux': '#a855f7',
  'Maths': '#4ade80',
  'Logique': '#60a5fa',
  'Temps': '#fb7185',
  'Constantes': '#a1a1aa',
  'Dalles': '#06d6a0',
  'Aléatoire': '#34d399',
  'Colorimètre': '#fbbf24',
  'Multijoueur': '#38bdf8',
  'Couleur': '#e879f9',
  'Animation': '#fb923c',
  'Variables': '#818cf8',
  'Tetris': '#6366f1',
  'Simon': '#f43f5e',
  'Mémoire': '#8b5cf6',
  'Spectre': '#06b6d4',
  'Color Speed': '#f97316',
  'Puissance 4': '#eab308',
  'Chasseur Gamut': '#10b981',
  'Interface': '#ec4899',
  'Mesure Jeu': '#0ea5e9',
};

function clamp255(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isEditorNodeKind(v: string): v is EditorNodeKind {
  return (NODE_CATALOG as { kind: string }[]).some((x) => x.kind === v);
}

function formatNodeParamsInline(node: EditorNode): string {
  if (node.kind === 'wait') {
    const s = Math.max(0, getNum(node.params, 'seconds', 1));
    return `${s}s`;
  }
  if (node.kind === 'fill') {
    const s = Math.max(0, getNum(node.params, 'seconds', 1));
    const intensity = clamp01(getNum(node.params, 'intensity', 0.8));
    const mask = String(node.params.mask ?? 'all');
    return `${s}s • I=${intensity.toFixed(2)} • ${mask}`;
  }
  if (node.kind === 'pulse') {
    const speed = Math.max(0.01, getNum(node.params, 'speed', 1));
    return `spd=${speed.toFixed(2)}`;
  }
  if (node.kind === 'tile') {
    const idx = Math.max(0, Math.round(getNum(node.params, 'tileIndex', 0)));
    const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
    return `D${idx + 1} • I=${intensity.toFixed(2)}`;
  }
  return '';
}

type ModalState =
  | { type: 'create-project' }
  | { type: 'confirm-delete'; gameId: string; gameName: string }
  | { type: 'node-help'; kind: EditorNodeKind }
  | null;

type ViewMode = 'split' | 'tiles-only' | 'ui-only' | 'fullscreen-graph';

type VisualComponent =
  | { id: string; type: 'button'; label: string; x: number; y: number; w: number; h: number; color: string }
  | { id: string; type: 'slider'; label: string; x: number; y: number; w: number; h: number; min: number; max: number; value: number }
  | { id: string; type: 'color-picker'; label: string; x: number; y: number; w: number; h: number; color: string }
  | { id: string; type: 'label'; text: string; x: number; y: number; w: number; h: number; fontSize: number };

type LegacyJsonlNodeSpec = {
  kind: string;
  gameId?: string;
  name?: string;
  params?: Record<string, unknown>;
  pos?: { x: number; y: number };
};

type EditorSnapshot = {
  games: GameDoc[];
  activeGameId: string | null;
  selectedNodeId: string | null;
  drillDownFrom?: string;
  expandedGameNodeId?: string;
  visibleNodeIds?: string[];
};

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
  const gg = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
  const bb = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex(lerp(ra.r, rb.r, t), lerp(ra.g, rb.g, t), lerp(ra.b, rb.b, t));
}

function isHexColor(str: unknown): str is string {
  return typeof str === 'string' && /^#[0-9a-fA-F]{6}$/.test(str);
}

function getNum(params: Record<string, unknown>, key: string, fallback: number): number {
  const raw = params[key];
  const v = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function getColor(params: Record<string, unknown>, key: string, fallback: string): string {
  const raw = params[key];
  return isHexColor(raw) ? raw : fallback;
}

// ── Color science helpers ─────────────────────────────────────────────────────

function rgbToLab(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const L = 116 * f(Y) - 16;
  const a = 500 * (f(X / 0.9505) - f(Y));
  const bL = 200 * (f(Y) - f(Z / 1.089));
  return [L, a, bL];
}

function colorDistanceDeltaE(hexA: string, hexB: string): number {
  const [L1, a1, b1] = rgbToLab(hexA);
  const [L2, a2, b2] = rgbToLab(hexB);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

function blackbodyToHex(kelvin: number): string {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;
  r = temp <= 66 ? 255 : Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
  if (temp <= 66) {
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661));
  } else {
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
  }
  b = temp >= 66 ? 255 : temp <= 19 ? 0 : Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  return rgbToHex(r, g, b);
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function applyRenderNode(tiles: TileState[], node: EditorNode, tSeconds: number) {
  if (node.kind === 'fill') {
    const color = getColor(node.params, 'color', '#6d28ff');
    const intensity = clamp01(getNum(node.params, 'intensity', 0.8));
    const mask = String(node.params.mask ?? 'all');

    for (let i = 0; i < tiles.length; i++) {
      const apply = mask === 'all' || ((mask === 'border' || mask === 'borders') && i !== 4);
      if (!apply) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'pulse') {
    const legacyColor = getColor(node.params, 'color', '#ff2aa6');
    const baseColor = getColor(node.params, 'baseColor', legacyColor);
    const targetColor = getColor(node.params, 'targetColor', legacyColor);

    const legacyBase = clamp01(getNum(node.params, 'base', 0.15));
    const legacyAmp = clamp01(getNum(node.params, 'amp', 0.75));
    const fromIntensity = clamp01(getNum(node.params, 'fromIntensity', legacyBase));
    const toIntensity = clamp01(getNum(node.params, 'toIntensity', clamp01(legacyBase + legacyAmp)));

    const speed = Math.max(0.01, getNum(node.params, 'speed', 0.9));
    const phase = getNum(node.params, 'phase', 0);
    const t01 = clamp01(0.5 + 0.5 * Math.sin(tSeconds * speed * 2 * Math.PI + phase));
    const intensity = clamp01(lerp(fromIntensity, toIntensity, t01));
    const color = lerpColor(baseColor, targetColor, t01);

    for (let i = 0; i < tiles.length; i++) {
      if (intensity <= tiles[i].intensity) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'tile') {
    const tileIndexRaw = getNum(node.params, 'tileIndex', 0);
    const maxIndex = Math.max(0, tiles.length - 1);
    const tileIndex = Math.max(0, Math.min(maxIndex, Math.round(tileIndexRaw)));
    const color = getColor(node.params, 'color', '#ff2aa6');
    const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
    tiles[tileIndex] = { color, intensity };
  }
}

function computeTiles(game: GameDoc, tSeconds: number): TileState[] {
  const tileCount = Math.max(1, Math.round(Number(game.tileCount ?? 42)));
  const tiles: TileState[] = Array.from({ length: tileCount }, () => ({ color: '#000000', intensity: 0 }));

  // Runtime MVP: exécute une seule chaîne depuis event_begin en suivant les edges.
  // wait(seconds) retarde l'action suivante, fill(seconds) définit la durée d'affichage, puis boucle.
  const byId = new Map(game.nodes.map((n) => [n.id, n] as const));
  const out = new Map<string, string[]>();
  for (const e of game.edges) {
    const arr = out.get(e.from) ?? [];
    arr.push(e.to);
    out.set(e.from, arr);
  }

  const start = game.nodes.find((n) => n.kind === 'event_begin' && n.enabled);
  if (!start) {
    // fallback: comportement historique (appliquer tous les noeuds activés)
    for (const node of game.nodes) {
      if (!node.enabled) continue;
      applyRenderNode(tiles, node, tSeconds);
    }
    return tiles;
  }

  type Segment = { nodeId: string; duration: number };
  const segments: Segment[] = [];
  const visited = new Set<string>();
  let cursor: EditorNode | null = start;
  let steps = 0;

  while (cursor && steps < 100) {
    steps++;
    if (visited.has(cursor.id)) break;
    visited.add(cursor.id);

    if (cursor.enabled) {
      if (cursor.kind === 'wait') {
        const seconds = Math.max(0, getNum(cursor.params, 'seconds', 1));
        segments.push({ nodeId: cursor.id, duration: seconds });
      } else if (cursor.kind === 'fill') {
        const seconds = Math.max(0.01, getNum(cursor.params, 'seconds', 1));
        segments.push({ nodeId: cursor.id, duration: seconds });
      } else if (cursor.kind === 'pulse' || cursor.kind === 'tile') {
        // Durée par défaut courte si dans une séquence.
        segments.push({ nodeId: cursor.id, duration: 1 });
      }
    }

    const nextId: string | null = out.get(cursor.id)?.[0] ?? null;
    cursor = nextId ? byId.get(nextId) ?? null : null;
  }

  const total = segments.reduce((acc, s) => acc + s.duration, 0);
  if (total <= 0.0001 || segments.length === 0) {
    // Fallback: apply all enabled render nodes if no valid timeline
    for (const node of game.nodes) {
      if (!node.enabled) continue;
      if (node.kind === 'fill' || node.kind === 'pulse' || node.kind === 'tile') {
        applyRenderNode(tiles, node, tSeconds);
      }
    }
    return tiles;
  }

  let local = ((tSeconds % total) + total) % total;

  let activeIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (local <= seg.duration) {
      activeIndex = i;
      break;
    }
    local -= seg.duration;
  }

  if (activeIndex === -1) return tiles;

  const pickRenderableIndex = (startIndex: number): number => {
    for (let k = 0; k < segments.length; k++) {
      const idx = (startIndex - k + segments.length) % segments.length;
      const node = byId.get(segments[idx].nodeId);
      if (node && node.enabled && node.kind !== 'wait') return idx;
    }
    return -1;
  };

  const chosenIndex = pickRenderableIndex(activeIndex);
  if (chosenIndex !== -1) {
    const node = byId.get(segments[chosenIndex].nodeId);
    if (node && node.enabled && node.kind !== 'wait') {
      applyRenderNode(tiles, node, tSeconds);
    }
  }

  return tiles;
}

// Hardware control constants and functions (from /jeux)
const PLATE_ID_BY_INDEX: number[] = Array.from({ length: 42 }, (_, i) => i + 1);

function hexToRgb255(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Channel profiles matching COULEURS.md (32 LED channels per plaque)
const CHANNEL_PROFILES: { rgb: [number, number, number]; strength: number }[] = [
  { rgb: [0.30, 0.00, 0.50], strength: 1.0 },  // 1: violet foncé
  { rgb: [0.55, 0.10, 0.85], strength: 1.0 },  // 2: violet clair
  { rgb: [0.25, 0.05, 0.95], strength: 1.0 },  // 3: bleu violet
  { rgb: [0.05, 0.05, 0.40], strength: 1.0 },  // 4: bleu marine
  { rgb: [0.00, 0.65, 1.00], strength: 1.0 },  // 5: bleu turquoise
  { rgb: [0.25, 1.00, 0.35], strength: 1.0 },  // 6: vert clair
  { rgb: [0.00, 0.55, 0.12], strength: 1.0 },  // 7: vert foncé
  { rgb: [1.00, 1.00, 0.40], strength: 1.0 },  // 8: jaune clair
  { rgb: [1.00, 0.55, 0.00], strength: 1.0 },  // 9: orange
  { rgb: [0.75, 0.25, 0.00], strength: 1.0 },  // 10: rouge/orangé
  { rgb: [0.55, 0.00, 0.00], strength: 1.0 },  // 11: rouge foncé
  { rgb: [1.00, 0.05, 0.05], strength: 1.0 },  // 12: rouge pétant
  { rgb: [0.95, 0.00, 0.20], strength: 1.0 },  // 13: rouge cerise
  { rgb: [0.90, 0.00, 0.22], strength: 1.0 },  // 14: rouge cerise+
  { rgb: [0.35, 0.00, 0.00], strength: 1.0 },  // 15: rouge foncé
  { rgb: [0.20, 0.00, 0.00], strength: 0.25 }, // 16: rouge très foncé
  { rgb: [0.10, 0.00, 0.00], strength: 0.15 }, // 17: rouge invisible
  { rgb: [0.10, 0.00, 0.00], strength: 0.15 }, // 18: rouge invisible
  { rgb: [1.00, 0.58, 0.00], strength: 1.0 },  // 19: jaune orange
  { rgb: [1.00, 0.70, 0.10], strength: 1.0 },  // 20: jaune orange clair
  { rgb: [1.00, 0.78, 0.15], strength: 0.55 }, // 21
  { rgb: [1.00, 0.80, 0.20], strength: 0.45 }, // 22
  { rgb: [1.00, 0.82, 0.22], strength: 0.35 }, // 23
  { rgb: [1.00, 0.92, 0.78], strength: 1.0 },  // 24: jaune orange blanc
  { rgb: [1.00, 0.97, 0.90], strength: 1.0 },  // 25: blanc jaunis
  { rgb: [1.00, 1.00, 1.00], strength: 1.0 },  // 26: blanc
  { rgb: [0.90, 0.90, 0.90], strength: 0.75 }, // 27
  { rgb: [0.80, 0.80, 0.80], strength: 0.60 }, // 28
  { rgb: [0.55, 0.55, 0.55], strength: 0.45 }, // 29: gris
  { rgb: [0.40, 0.40, 0.40], strength: 0.40 }, // 30
  { rgb: [0.78, 0.78, 0.78], strength: 0.55 }, // 31
  { rgb: [0.92, 0.92, 0.92], strength: 0.70 }, // 32
];

/**
 * Convertit une couleur RGB (0-255) en tableau de 32 valeurs de canaux LED (0-100).
 *
 * Algorithme : décomposition achromatic + chromatique
 *   W  = min(R,G,B)          → composante blanche pure (plancher gris)
 *   Rc = R - W               → rouge chromatique
 *   Gc = G - W               → vert chromatique
 *   Bc = B - W               → bleu chromatique
 *   Y  = min(Rc, Gc)         → jaune (overlap rouge+vert)
 *   Ro = Rc - Y              → rouge résiduel
 *   Go = Gc - Y              → vert résiduel
 *
 * Chaque composante est envoyée vers les groupes de canaux physiques correspondants.
 * Aucun boost blanc automatique : le blanc n'apparaît que si la couleur source en contient.
 */
function rgbToChannels32(rgb: { r: number; g: number; b: number }, masterIntensity100: number): number[] {
  const R = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const G = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const B = Math.max(0, Math.min(255, Math.round(rgb.b)));
  const scale = Math.max(0, Math.min(100, masterIntensity100)) / 100;

  const channels = Array(32).fill(0);
  if (scale <= 1e-6 || Math.max(R, G, B) === 0) return channels;

  // Décomposition
  const W  = Math.min(R, G, B);           // blanc (achromatic)
  const Rc = R - W;                         // rouge chromatique
  const Gc = G - W;                         // vert chromatique
  const Bc = B - W;                         // bleu chromatique
  const Y  = Math.min(Rc, Gc);             // jaune (overlap R+G)
  const Ro = Rc - Y;                        // rouge pur résiduel
  const Go = Gc - Y;                        // vert pur résiduel

  // Facteur : valeur 0-255 → canal 0-100 avec masterIntensity
  const K = scale / 255;
  const v = (x: number) => Math.min(100, Math.round(x * K * 100));

  // ── Canaux blancs / gris (24-31) ──────────────────────────────────────────
  if (W > 0) {
    const wv = v(W);
    channels[25] = wv;                          // blanc pur dominant
    channels[24] = Math.round(wv * 0.70);       // blanc jaunâtre
    channels[26] = Math.round(wv * 0.55);       // blanc neutre
    channels[27] = Math.round(wv * 0.35);       // blanc froid
    channels[31] = Math.round(wv * 0.45);       // gris clair
  }

  // ── Canaux rouges (10-14) ─────────────────────────────────────────────────
  if (Ro > 0) {
    const rv = v(Ro);
    channels[11] = Math.max(channels[11], rv);
    channels[12] = Math.max(channels[12], Math.round(rv * 0.90));
    channels[13] = Math.max(channels[13], Math.round(rv * 0.85));
    channels[10] = Math.max(channels[10], Math.round(rv * 0.70));
    channels[14] = Math.max(channels[14], Math.round(rv * 0.55));
  }

  // ── Canaux verts (5-6) ────────────────────────────────────────────────────
  if (Go > 0) {
    const gv = v(Go);
    channels[5]  = Math.max(channels[5], gv);
    channels[6]  = Math.max(channels[6], Math.round(gv * 0.75));
  }

  // ── Canaux bleus / violets (0-4) ──────────────────────────────────────────
  if (Bc > 0) {
    const bv = v(Bc);
    channels[4]  = Math.max(channels[4], bv);
    channels[2]  = Math.max(channels[2], Math.round(bv * 0.80));
    channels[3]  = Math.max(channels[3], Math.round(bv * 0.65));
    channels[1]  = Math.max(channels[1], Math.round(bv * 0.60));
    channels[0]  = Math.max(channels[0], Math.round(bv * 0.40));
  }

  // ── Canaux jaune / orange (7-9, 18-19) ───────────────────────────────────
  if (Y > 0) {
    const yv = v(Y);
    channels[7]  = Math.max(channels[7],  yv);
    channels[8]  = Math.max(channels[8],  Math.round(yv * 0.85));
    channels[18] = Math.max(channels[18], Math.round(yv * 0.90));
    channels[19] = Math.max(channels[19], Math.round(yv * 0.75));
    channels[9]  = Math.max(channels[9],  Math.round(yv * 0.70));
  }

  return channels;
}

// Hardware batch: module-level ref holder - actual refs are inside the component
// sendRgbToHardware is defined inside EditeurPage and exposed via a module-level ref
type HwPlateUpdate = { plateId: number; channels: { index: number; value: number }[] };
let _scheduleSetCanal: (plaqueId: number, canalIndex: number, intensity: number) => void = () => {};

function sendChannelsToHardware(channels32: number[], plateIds: number[]) {
  for (const plaqueId of plateIds) {
    for (let i = 0; i < 32; i++) {
      const v = clamp255(channels32[i] ?? 0);
      _scheduleSetCanal(plaqueId, i, v);
    }
  }
}

function sendRgbToHardware(rgb: { r: number; g: number; b: number }, intensity100: number, plateIds: number[]) {
  const channels32 = rgbToChannels32(rgb, intensity100);
  sendChannelsToHardware(channels32, plateIds);
}

function getPlateIdsFromIndexes(indexes: number[]): number[] {
  return indexes.map((i) => PLATE_ID_BY_INDEX[i] ?? 1).filter(Boolean);
}

export default function EditeurPage() {
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  // Nouveaux états pour l'interface améliorée
  const [modal, setModal] = useState<ModalState>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showGameOverlay, setShowGameOverlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [editorTab, setEditorTab] = useState<'canvas' | 'python' | 'ui'>('canvas');
  const [visualComponents, setVisualComponents] = useState<VisualComponent[]>([]);
  const [selectedVisualComponent, setSelectedVisualComponent] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectTemplate, setNewProjectTemplate] = useState<'blank' | 'tutorial' | 'animation' | 'interactive' | 'fluorescence' | 'color-demo' | 'pulse-advanced' | 'rainbow' | 'tetris' | 'memory' | 'tetris-blueprint'>('blank');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.localStorage.getItem('crg_user_type') ?? '';
    setIsTeacher(t === 'enseignant');
  }, []);

  const [status, setStatus] = useState<string>('');
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

  // ── Statut connexion supervision API ──────────────────────────────────────
  const [hwReachable, setHwReachable] = useState<'unknown' | 'ok' | 'error'>('unknown');
  useEffect(() => {
    let cancelled = false;
    async function checkHw() {
      try {
        const r = await fetch('/api/supervision/status', { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!cancelled) setHwReachable(j?.reachable === true ? 'ok' : 'error');
      } catch {
        if (!cancelled) setHwReachable('error');
      }
    }
    void checkHw();
    const interval = setInterval(() => void checkHw(), 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  const tetrisSnapRef = useRef<TetrisSnapshot | null>(null);
  // Refs stables pour les callbacks utilisés dans le keydown handler global
  const saveActiveGameRef = useRef<(() => Promise<void>) | null>(null);
  const fitNodesToViewRef = useRef<(() => void) | null>(null);
  const autoLayoutNodesRef = useRef<(() => void) | null>(null);

  const [viewportHeight, setViewportHeight] = useState<number>(360);
  const [resizing, setResizing] = useState<{ active: boolean; y: number; start: number }>(
    { active: false, y: 0, start: 360 },
  );

  const [linkDrag, setLinkDrag] = useState<{ active: boolean; x: number; y: number; gx: number; gy: number } | null>(null);
  const [pendingAutoConnect, setPendingAutoConnect] = useState<{ fromNodeId: string } | null>(null);

  const [graphPan, setGraphPan] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  const [graphZoom, setGraphZoom] = useState<number>(0.5);
  const bpContentRef = useRef<HTMLDivElement | null>(null);
  const [pinPositions, setPinPositions] = useState<
    Record<string, { in?: { x: number; y: number }; out?: { x: number; y: number } }>
  >({});
  const measurePinsRef = useRef<(() => void) | null>(null);

  const [graphPanning, setGraphPanning] = useState<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });
  const [graphDrag, setGraphDrag] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ fromNodeId: string } | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null); // mini-tuto skippable
  const [tourOpen, setTourOpen] = useState(false); // tuto en coachmarks ancrés (blocs + designer)

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    gx: number;
    gy: number;
    q: string;
  }>({ open: false, x: 0, y: 0, gx: 0, gy: 0, q: '' });

  const [editor, setEditor] = useState<EditorSnapshot>(() => ({ games: [], activeGameId: null, selectedNodeId: null }));
  const [history, setHistory] = useState<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });

  const editorRef = useRef<EditorSnapshot>(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const games = editor.games;
  const activeGameId = editor.activeGameId ?? null;
  const selectedNodeId = editor.selectedNodeId;

  const commit = (recipe: (cur: EditorSnapshot) => EditorSnapshot) => {
    setEditor((cur) => {
      const next = recipe(cur);
      setHistory((h) => ({ past: [...h.past, cur], future: [] }));
      setDirty(true);
      return next;
    });
  };

  const updateNodeParamsById = (nodeId: string, patch: Record<string, unknown>) => {
    if (!activeGameId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  const undo = () => {
    setHistory((h) => {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      const cur = editorRef.current;
      setEditor(prev);
      return { past: h.past.slice(0, -1), future: [cur, ...h.future] };
    });
  };

  const redo = () => {
    setHistory((h) => {
      const next = h.future[0];
      if (!next) return h;
      const cur = editorRef.current;
      setEditor(next);
      return { past: [...h.past, cur], future: h.future.slice(1) };
    });
  };

  const activeGame = useMemo(() => games.find((g) => g.id === activeGameId) || null, [activeGameId, games]);

  const measurePins = () => {
    const root = bpContentRef.current;
    if (!root) return;
    const contentRect = root.getBoundingClientRect();
    const next: Record<string, { in?: { x: number; y: number }; out?: { x: number; y: number } }> = {};

    const nodes = Array.from(root.querySelectorAll('.bp-node[data-nodeid]')) as HTMLElement[];
    for (const nodeEl of nodes) {
      const nodeId = nodeEl.dataset.nodeid;
      if (!nodeId) continue;

      const inEl = nodeEl.querySelector('.bp-pin--in') as HTMLElement | null;
      const outEl = nodeEl.querySelector('.bp-pin--out') as HTMLElement | null;

      const entry: { in?: { x: number; y: number }; out?: { x: number; y: number } } = {};

      if (inEl) {
        const r = inEl.getBoundingClientRect();
        const cx = r.left + 6;
        const cy = r.top + r.height / 2;
        entry.in = {
          x: (cx - contentRect.left) / Math.max(0.0001, graphZoom),
          y: (cy - contentRect.top) / Math.max(0.0001, graphZoom),
        };
      }
      if (outEl) {
        const r = outEl.getBoundingClientRect();
        const cx = r.right - 6;
        const cy = r.top + r.height / 2;
        entry.out = {
          x: (cx - contentRect.left) / Math.max(0.0001, graphZoom),
          y: (cy - contentRect.top) / Math.max(0.0001, graphZoom),
        };
      }

      next[nodeId] = entry;
    }

    setPinPositions(next);
  };

  measurePinsRef.current = measurePins;

  const nodesLayoutKey = useMemo(() => {
    const g = activeGame;
    if (!g) return '';
    return g.nodes.map((n) => `${n.id}:${Math.round(n.pos.x)}:${Math.round(n.pos.y)}`).join('|');
  }, [activeGame]);

  useLayoutEffect(() => {
    let raf = 0;

    raf = requestAnimationFrame(() => measurePinsRef.current?.());
    window.addEventListener('resize', measurePins);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measurePins);
    };
  }, [graphZoom, graphPan.x, graphPan.y, activeGameId, games.length, nodesLayoutKey, activeGame?.edges.length]);

  // Auto-layout quand on charge un jeu dont les nœuds se superposent
  const prevActiveGameIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeGameId || activeGameId === prevActiveGameIdRef.current) return;
    prevActiveGameIdRef.current = activeGameId;

    const nodes = editorRef.current.games.find((g) => g.id === activeGameId)?.nodes ?? [];
    if (nodes.length < 2) return;

    // Calcule l'étendue des positions existantes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      if (n.pos.x < minX) minX = n.pos.x;
      if (n.pos.x > maxX) maxX = n.pos.x;
      if (n.pos.y < minY) minY = n.pos.y;
      if (n.pos.y > maxY) maxY = n.pos.y;
    });
    const spread = Math.max(maxX - minX, maxY - minY);

    // Si les nœuds sont trop serrés (< 200px d'écart), on les réorganise
    if (spread < 200) {
      // Petit délai pour laisser l'état se stabiliser
      const t = setTimeout(() => {
        autoLayoutNodesRef.current?.();
      }, 80);
      return () => clearTimeout(t);
    } else {
      // Sinon, juste centrer la vue avec fit
      const t = setTimeout(() => {
        fitNodesToViewRef.current?.();
      }, 80);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId]);

  const selectedNode = useMemo(() => {
    if (!activeGame) return null;
    return activeGame.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeGame, selectedNodeId]);


  const activeTetrisNode = useMemo(() => {
    if (!activeGame) return null;
    return activeGame.nodes.find((n) => n.kind === 'game_tetris' && n.enabled) ?? null;
  }, [activeGame]);

  const addEdge = (from: string, to: string) => {
    if (!activeGameId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        if (g.edges.some((e) => e.from === from && e.to === to)) return g;
        const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        return { ...g, edges: [...g.edges, { id, from, to }] };
      });
      return { ...cur, games: nextGames };
    });
  };

  const beginDrag = () => {
    if (dragBaseSnapshot) return;
    setDragBaseSnapshot(editorRef.current);
    setDragDidMove(false);
  };

  const endDrag = () => {
    if (!dragBaseSnapshot) return;
    if (dragDidMove) {
      setHistory((h) => ({ past: [...h.past, dragBaseSnapshot], future: [] }));
    }
    setDragBaseSnapshot(null);
    setDragDidMove(false);
  };

  const [t, setT] = useState<number>(0);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      setT((performance.now() - start) / 1000);
    }, 100); // 10 fps - suffisant pour l'aperçu des tuiles, évite le flood de re-renders
    return () => window.clearInterval(id);
  }, []);

  // ── Hardware state machine (React refs) ──────────────────────────────────────
  const hwLastSentRef = useRef<Record<string, number>>({});
  const hwBatchPendingRef = useRef<Map<number, Record<number, number>>>(new Map());
  const hwFlushScheduledRef = useRef(false);
  const hwInFlightRef = useRef(false);
  const hwPendingPlatesRef = useRef<HwPlateUpdate[] | null>(null);
  const hwCurrentCtrlRef = useRef<AbortController | null>(null);
  const hwFetchGenRef = useRef(0);

  function buildHwPlates(pending: Map<number, Record<number, number>>): HwPlateUpdate[] {
    const plates: HwPlateUpdate[] = [];
    pending.forEach((channels, plateId) => {
      const arr = Object.entries(channels).map(([i, v]) => ({ index: Number(i), value: v }));
      if (arr.length > 0) plates.push({ plateId, channels: arr });
    });
    return plates;
  }

  function doSendBatch(plates: HwPlateUpdate[]) {
    if (plates.length === 0) return;
    const gen = ++hwFetchGenRef.current;
    const ctrl = new AbortController();
    hwCurrentCtrlRef.current = ctrl;
    hwInFlightRef.current = true;
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plates, fast: true, force: true }),
      cache: 'no-store',
      signal: ctrl.signal,
    }).catch(() => {}).finally(() => {
      if (hwFetchGenRef.current !== gen) return;
      const next = hwPendingPlatesRef.current;
      hwPendingPlatesRef.current = null;
      if (next && next.length > 0) doSendBatch(next);
      else hwInFlightRef.current = false;
    });
  }

  function flushHardwareBatch() {
    const pending = hwBatchPendingRef.current;
    if (pending.size === 0) return;
    hwBatchPendingRef.current = new Map();
    const plates = buildHwPlates(pending);
    if (plates.length === 0) return;
    if (!hwInFlightRef.current) doSendBatch(plates);
    else hwPendingPlatesRef.current = plates;
  }

  function scheduleSetCanalLocal(plaqueId: number, canalIndex: number, intensity: number) {
    const key = `${plaqueId}:${canalIndex}`;
    const clamped = Math.max(0, Math.min(255, Math.round(intensity)));
    const prev = hwLastSentRef.current[key];
    if (prev === clamped) return;
    hwLastSentRef.current[key] = clamped;
    if (!hwBatchPendingRef.current.has(plaqueId)) hwBatchPendingRef.current.set(plaqueId, {});
    hwBatchPendingRef.current.get(plaqueId)![canalIndex] = clamped;
    if (!hwFlushScheduledRef.current) {
      hwFlushScheduledRef.current = true;
      queueMicrotask(() => {
        hwFlushScheduledRef.current = false;
        flushHardwareBatch();
      });
    }
  }

  // Wire up the module-level ref to this component's local function
  useEffect(() => {
    _scheduleSetCanal = scheduleSetCanalLocal;
    return () => { _scheduleSetCanal = () => {}; };
  });

  // ── Runtime engine ────────────────────────────────────────────────────────────
  type TetrisState = {
    grid: (string | null)[][];
    piece: { shape: number[][]; x: number; y: number; color: string } | null;
    gameOver: boolean;
  };

  const runtimeTilesRef = useRef<TileState[]>(Array.from({ length: 42 }, () => ({ color: '#000000', intensity: 0 })));
  const runtimeVariablesRef = useRef<Record<string, number | string>>({});
  const runtimeScoreRef = useRef<number>(0);
  const runtimeTickTimersRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const tetrisStateRef = useRef<TetrisState | null>(null);
  const fireRuntimeClickRef = useRef<((idx: number) => void) | null>(null);
  const [runtimeTiles, setRuntimeTiles] = useState<TileState[]>(Array.from({ length: 42 }, () => ({ color: '#000000', intensity: 0 })));
  const [runtimeScore, setRuntimeScore] = useState(0);
  const runtimeAbortRef = useRef<AbortController | null>(null);
  const runtimeEventBusRef = useRef<Map<string, Array<(data: unknown) => void>>>(new Map());
  const runtimeRoundRef = useRef<{ current: number; total: number }>({ current: 0, total: 5 });
  const runtimeColorVarsRef = useRef<Record<string, string>>({});
  const runtimeArraysRef = useRef<Record<string, Array<number | string | null>>>({});
  const runtimeSubsRef   = useRef<Record<string, string>>({});
  const runtimeCountdownsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const runtimePlayerRgbRef = useRef<{ r: number; g: number; b: number }>({ r: 128, g: 128, b: 128 });
  const runtimeLastKeyRef   = useRef<string>('');
  const [runtimeRound, setRuntimeRound] = useState({ current: 0, total: 5 });
  const [runtimeCountdownValue, setRuntimeCountdownValue] = useState(0);

  // Keyboard listener for Python games
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        ' ': 'space', q: 'left', d: 'right', z: 'up', s: 'down',
        Q: 'left', D: 'right', Z: 'up', S: 'down',
      };
      if (map[e.key]) { e.preventDefault(); runtimeLastKeyRef.current = map[e.key]; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const pyBridge = useMemo(() => ({
    sendColor: (plateId: number, r: number, g: number, b: number, intensity: number) => {
      sendRgbToHardware({ r, g, b }, Math.round(intensity * 100), [plateId]);
    },
    // setTile: 0-based index, updates visual tile + hardware without re-render
    setTile: (idx: number, r: number, g: number, b: number, intensity: number) => {
      const hex = rgbToHex(r, g, b);
      if (idx >= 0 && idx < runtimeTilesRef.current.length) {
        runtimeTilesRef.current[idx] = { color: hex, intensity: Math.max(0, Math.min(1, intensity)) };
      }
      const plateId = PLATE_ID_BY_INDEX[idx];
      if (plateId) sendRgbToHardware({ r, g, b }, Math.round(intensity * 100), [plateId]);
    },
    // flush: commit all setTile calls to React state (one re-render)
    flush: () => { setRuntimeTiles([...runtimeTilesRef.current]); },
    // getKey: read-and-clear the last pressed key
    getKey: (): string => { const k = runtimeLastKeyRef.current; runtimeLastKeyRef.current = ''; return k; },
    setVariable: (name: string, value: number | string) => { runtimeVariablesRef.current[name] = value; },
    getVariable: (name: string): number | string => runtimeVariablesRef.current[name] ?? 0,
    addScore: (points: number) => { runtimeScoreRef.current += points; setRuntimeScore(runtimeScoreRef.current); },
    getScore: (): number => runtimeScoreRef.current,
    emitEvent: (type: string) => {
      const ls = runtimeEventBusRef.current.get(type) ?? [];
      ls.forEach((fn: (d: unknown) => void) => fn({}));
      runtimeEventBusRef.current.delete(type);
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasRuntimeEvents = useMemo(() => {
    if (!activeGame) return false;
    return activeGame.nodes.some(n => [
      'on_tick', 'on_tile_click', 'on_submit_answer', 'on_countdown_end',
      'event_begin', 'round_start', 'gen_target_color', 'countdown_start',
      'wait_event', 'hardware_flash', 'hardware_send_color', 'show_target_on_plates',
      'for_range', 'for_each_array', 'array_create', 'grid_create', 'tiles_from_array', 'grid_sync_tiles',
    ].includes(n.kind));
  }, [activeGame]);

  // Send runtime tiles to hardware
  useEffect(() => {
    if (!hasRuntimeEvents || !isPlaying) return;
    runtimeTiles.forEach((tile, index) => {
      const plateId = PLATE_ID_BY_INDEX[index];
      if (!plateId) return;
      const rgb = hexToRgb255(tile.color);
      const intensity100 = Math.round(tile.intensity * 100);
      sendRgbToHardware(rgb, intensity100, [plateId]);
    });
  }, [runtimeTiles, hasRuntimeEvents, isPlaying]);

  // Start/stop runtime when game or isPlaying changes
  useEffect(() => {
    runtimeTickTimersRef.current.forEach(t => clearInterval(t));
    runtimeTickTimersRef.current = [];

    if (!activeGame || !isPlaying) return;
    if (!hasRuntimeEvents) return;

    // Reset state
    runtimeTilesRef.current = Array.from({ length: 42 }, () => ({ color: '#000000', intensity: 0 }));
    runtimeVariablesRef.current = {};
    runtimeScoreRef.current = 0;
    tetrisStateRef.current = null;
    setRuntimeTiles(Array.from({ length: 42 }, () => ({ color: '#000000', intensity: 0 })));
    setRuntimeScore(0);

    const game = activeGame;
    const abort = new AbortController();
    runtimeAbortRef.current = abort;
    const signal = abort.signal;

    // Reset all runtime state
    runtimeRoundRef.current = { current: 0, total: 5 };
    runtimeColorVarsRef.current = {};
    runtimeArraysRef.current = {};
    runtimeSubsRef.current = {};
    runtimeCountdownsRef.current.forEach(t => clearInterval(t));
    runtimeCountdownsRef.current.clear();
    runtimeEventBusRef.current.clear();
    setRuntimeRound({ current: 0, total: 5 });
    setRuntimeCountdownValue(0);

    // ── Event bus helpers ────────────────────────────────────────────────────
    function emitEvent(eventType: string, data: unknown = {}) {
      const listeners = runtimeEventBusRef.current.get(eventType) ?? [];
      runtimeEventBusRef.current.delete(eventType);
      listeners.forEach(fn => fn(data));
    }

    function waitForEvent(eventType: string, timeoutMs = 30000): Promise<unknown> {
      return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
        const listeners = runtimeEventBusRef.current.get(eventType) ?? [];
        listeners.push(resolve);
        runtimeEventBusRef.current.set(eventType, listeners);
        const timer = setTimeout(() => {
          const ls = runtimeEventBusRef.current.get(eventType) ?? [];
          runtimeEventBusRef.current.set(eventType, ls.filter(l => l !== resolve));
          resolve(null); // timeout = null data
        }, timeoutMs);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const ls = runtimeEventBusRef.current.get(eventType) ?? [];
          runtimeEventBusRef.current.set(eventType, ls.filter(l => l !== resolve));
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }

    function sleep(ms: number): Promise<void> {
      return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
        const t = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
      });
    }

    // ── Send helpers ─────────────────────────────────────────────────────────
    const allPlateIds = PLATE_ID_BY_INDEX.filter(Boolean) as number[];

    function sendColorToHardware(hexColor: string, intensity: number, plateIds: number[]) {
      const rgb = hexToRgb255(hexColor);
      const i100 = Math.round(clamp01(intensity) * 100);
      sendRgbToHardware(rgb, i100, plateIds);
    }

    // ── Sync executeNode (handles fill/tile/variables/score/etc.) ────────────
    function executeNodeSync(nodeId: string, depth = 0): void {
      if (depth > 50) return;
      const node = game.nodes.find(n => n.id === nodeId);
      if (!node || !node.enabled) return;

      const tiles = runtimeTilesRef.current;
      const vars = runtimeVariablesRef.current;

      switch (node.kind) {
        case 'fill': {
          const color = getColor(node.params, 'color', '#6d28ff');
          const intensity = clamp01(getNum(node.params, 'intensity', 0.8));
          for (let i = 0; i < tiles.length; i++) tiles[i] = { color, intensity };
          break;
        }
        case 'clear_tiles': {
          for (let i = 0; i < tiles.length; i++) tiles[i] = { color: '#000000', intensity: 0 };
          break;
        }
        case 'tile':
        case 'tile_set': {
          const tileIndex = Math.max(0, Math.min(41, Math.round(getNum(node.params, 'tileIndex', 0))));
          const color = getColor(node.params, 'color', '#ff2aa6');
          const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
          tiles[tileIndex] = { color, intensity };
          break;
        }
        case 'variable_set': {
          const name = String(node.params.name ?? 'x');
          let val: number | string = getNum(node.params, 'value', 0);
          const op = String(node.params.op ?? 'set');
          const prev = typeof vars[name] === 'number' ? (vars[name] as number) : 0;
          if (op === 'add') val = prev + (val as number);
          else if (op === 'sub') val = prev - (val as number);
          vars[name] = val;
          break;
        }
        case 'var_color_set': {
          const name = String(node.params.name ?? 'color1');
          const value = getColor(node.params, 'value', '#ff2200');
          runtimeColorVarsRef.current[name] = value;
          break;
        }
        case 'var_color_get': {
          const name = String(node.params.name ?? 'color1');
          const varName = String(node.params.varName ?? 'myColor');
          const color = runtimeColorVarsRef.current[name] ?? '#ffffff';
          runtimeColorVarsRef.current[varName] = color;
          break;
        }
        case 'add_score': {
          runtimeScoreRef.current += getNum(node.params, 'amount', 1);
          setRuntimeScore(runtimeScoreRef.current);
          break;
        }
        case 'score_reset': {
          runtimeScoreRef.current = 0;
          setRuntimeScore(0);
          break;
        }
        case 'score_set': {
          runtimeScoreRef.current = getNum(node.params, 'value', 0);
          setRuntimeScore(runtimeScoreRef.current);
          break;
        }
        case 'score_get': {
          const varName = String(node.params.varName ?? 'score');
          vars[varName] = runtimeScoreRef.current;
          break;
        }
        case 'get_round': {
          const varName = String(node.params.varName ?? 'round');
          vars[varName] = runtimeRoundRef.current.current;
          break;
        }
        case 'get_player_rgb': {
          const { r, g, b } = runtimePlayerRgbRef.current;
          const varR = String(node.params.varR ?? 'playerR');
          const varG = String(node.params.varG ?? 'playerG');
          const varB = String(node.params.varB ?? 'playerB');
          const varColor = String(node.params.varColor ?? 'player');
          vars[varR] = r;
          vars[varG] = g;
          vars[varB] = b;
          runtimeColorVarsRef.current[varColor] = rgbToHex(r, g, b);
          break;
        }
        case 'color_distance': {
          const aName = String(node.params.colorAVar ?? 'target');
          const bName = String(node.params.colorBVar ?? 'player');
          const varName = String(node.params.varName ?? 'deltaE');
          const colorA = runtimeColorVarsRef.current[aName] ?? '#ffffff';
          const colorB = runtimeColorVarsRef.current[bName] ?? '#000000';
          vars[varName] = colorDistanceDeltaE(colorA, colorB);
          break;
        }
        case 'color_match_score': {
          const deltaEVar = String(node.params.deltaEVar ?? 'deltaE');
          const maxDE = Math.max(1, getNum(node.params, 'maxDeltaE', 50));
          const maxScore = getNum(node.params, 'maxScore', 100);
          const varName = String(node.params.varName ?? 'matchScore');
          const de = typeof vars[deltaEVar] === 'number' ? (vars[deltaEVar] as number) : 0;
          const score = Math.max(0, Math.round(maxScore * (1 - Math.min(de, maxDE) / maxDE)));
          vars[varName] = score;
          runtimeScoreRef.current += score;
          setRuntimeScore(runtimeScoreRef.current);
          break;
        }
        case 'random_int': {
          const min = Math.round(getNum(node.params, 'min', 0));
          const max = Math.round(getNum(node.params, 'max', 10));
          const name = String(node.params.varName ?? 'rand');
          vars[name] = min + Math.floor(Math.random() * (max - min + 1));
          break;
        }
        case 'if': {
          const condVar = String(node.params.varName ?? '');
          const condOp = String(node.params.op ?? 'gt');
          const condVal = getNum(node.params, 'value', 0);
          const rawVal = vars[condVar];
          const varVal = typeof rawVal === 'number' ? rawVal : 0;
          let condResult = false;
          if (condOp === 'gt') condResult = varVal > condVal;
          else if (condOp === 'lt') condResult = varVal < condVal;
          else if (condOp === 'eq') condResult = varVal === condVal;
          else if (condOp === 'gte') condResult = varVal >= condVal;
          else if (condOp === 'lte') condResult = varVal <= condVal;
          else if (condOp === 'neq') condResult = varVal !== condVal;
          const trueTarget = String(node.params.trueTarget ?? '');
          const falseTarget = String(node.params.falseTarget ?? '');
          if (condResult && trueTarget) executeNodeSync(trueTarget, depth + 1);
          else if (!condResult && falseTarget) executeNodeSync(falseTarget, depth + 1);
          setRuntimeTiles([...runtimeTilesRef.current]);
          return;
        }
        case 'game_tetris_block': {
          const COLS = Math.round(getNum(node.params, 'cols', 6));
          const ROWS = Math.round(getNum(node.params, 'rows', 7));
          const PIECES = [
            { shape: [[1,1,1,1]], color: '#00e5ff' },
            { shape: [[1,0],[1,0],[1,1]], color: '#ff6d00' },
            { shape: [[0,1],[0,1],[1,1]], color: '#2979ff' },
            { shape: [[1,1],[1,1]], color: '#ffd600' },
            { shape: [[1,1,1],[0,1,0]], color: '#aa00ff' },
            { shape: [[0,1,1],[1,1,0]], color: '#00c853' },
            { shape: [[1,1,0],[0,1,1]], color: '#ff1744' },
          ];
          if (!tetrisStateRef.current) {
            tetrisStateRef.current = {
              grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
              piece: null,
              gameOver: false,
            };
          }
          const ts = tetrisStateRef.current;
          if (ts.gameOver) break;
          const spawnPiece = () => {
            const p = PIECES[Math.floor(Math.random() * PIECES.length)];
            ts.piece = { shape: p.shape, x: Math.floor((COLS - p.shape[0].length) / 2), y: 0, color: p.color };
          };
          const hasCollision = (piece: NonNullable<typeof ts.piece>, dx: number, dy: number) => {
            for (let r = 0; r < piece.shape.length; r++) {
              for (let c = 0; c < piece.shape[r].length; c++) {
                if (!piece.shape[r][c]) continue;
                const nr = piece.y + r + dy; const nc = piece.x + c + dx;
                if (nr >= ROWS || nc < 0 || nc >= COLS) return true;
                if (nr >= 0 && ts.grid[nr][nc]) return true;
              }
            }
            return false;
          };
          if (!ts.piece) spawnPiece();
          if (!ts.piece) break;
          if (hasCollision(ts.piece, 0, 1)) {
            for (let r = 0; r < ts.piece.shape.length; r++) {
              for (let c = 0; c < ts.piece.shape[r].length; c++) {
                if (!ts.piece.shape[r][c]) continue;
                const gr = ts.piece.y + r; const gc = ts.piece.x + c;
                if (gr < 0) { ts.gameOver = true; break; }
                if (gr < ROWS && gc < COLS) ts.grid[gr][gc] = ts.piece.color;
              }
            }
            ts.piece = null;
            let linesCleared = 0;
            ts.grid = ts.grid.filter(row => { const full = row.every(cell => cell !== null); if (full) linesCleared++; return !full; });
            while (ts.grid.length < ROWS) ts.grid.unshift(Array(COLS).fill(null));
            if (linesCleared > 0) { runtimeScoreRef.current += linesCleared * 100; setRuntimeScore(runtimeScoreRef.current); }
            if (!ts.gameOver) spawnPiece();
          } else { ts.piece.y++; }
          const merged = ts.grid.map(row => [...row]);
          if (ts.piece) {
            for (let r = 0; r < ts.piece.shape.length; r++) {
              for (let c = 0; c < ts.piece.shape[r].length; c++) {
                if (!ts.piece.shape[r][c]) continue;
                const gr = ts.piece.y + r; const gc = ts.piece.x + c;
                if (gr >= 0 && gr < ROWS && gc < COLS) merged[gr][gc] = ts.piece.color;
              }
            }
          }
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const tileIdx = r * COLS + c;
              if (tileIdx >= tiles.length) continue;
              const cell = merged[r][c];
              tiles[tileIdx] = cell ? { color: cell, intensity: 0.9 } : { color: '#050510', intensity: 0.05 };
            }
          }
          if (ts.gameOver) { for (let i = 0; i < tiles.length; i++) tiles[i] = { color: '#ff0000', intensity: 0.8 }; }
          break;
        }
        case 'array_create': {
          const an = String(node.params.name ?? 'arr');
          const as_ = Math.max(0, Math.round(getNum(node.params, 'size', 42)));
          const av = node.params.initValue !== undefined ? (node.params.initValue as number | string | null) : null;
          runtimeArraysRef.current[an] = Array.from({ length: as_ }, () => av);
          break;
        }
        case 'array_get': {
          const ag_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')] ?? [];
          const ag_idx = Math.round(Number(runtimeVariablesRef.current[String(node.params.indexVar ?? 'i')] ?? 0));
          const ag_out = String(node.params.outVar ?? 'item');
          runtimeVariablesRef.current[ag_out] = (ag_idx >= 0 && ag_idx < ag_arr.length && ag_arr[ag_idx] !== null) ? (ag_arr[ag_idx] as number | string) : 0;
          break;
        }
        case 'array_set': {
          const as2_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')];
          if (!as2_arr) break;
          const as2_idx = Math.round(Number(runtimeVariablesRef.current[String(node.params.indexVar ?? 'i')] ?? 0));
          const as2_val = runtimeVariablesRef.current[String(node.params.valueVar ?? 'val')] ?? getNum(node.params, 'value', 0);
          if (as2_idx >= 0 && as2_idx < as2_arr.length) as2_arr[as2_idx] = as2_val;
          break;
        }
        case 'array_fill': {
          const af_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')];
          if (!af_arr) break;
          const af_vv = String(node.params.valueVar ?? '');
          const af_val = (af_vv && runtimeVariablesRef.current[af_vv] !== undefined) ? runtimeVariablesRef.current[af_vv] : (node.params.value ?? 0);
          af_arr.fill(af_val as number | string | null);
          break;
        }
        case 'array_length': {
          const al_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')] ?? [];
          runtimeVariablesRef.current[String(node.params.outVar ?? 'len')] = al_arr.length;
          break;
        }
        case 'array_push': {
          const ap_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')];
          if (!ap_arr) break;
          const ap_val = runtimeVariablesRef.current[String(node.params.valueVar ?? 'val')] ?? 0;
          ap_arr.push(ap_val);
          break;
        }
        case 'array_pop': {
          const apo_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')];
          if (!apo_arr) break;
          const apo_v = apo_arr.pop();
          runtimeVariablesRef.current[String(node.params.outVar ?? 'item')] = apo_v !== undefined && apo_v !== null ? (apo_v as number | string) : 0;
          break;
        }
        case 'array_shuffle': {
          const ash_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')];
          if (!ash_arr) break;
          for (let k = ash_arr.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [ash_arr[k], ash_arr[j]] = [ash_arr[j], ash_arr[k]]; }
          break;
        }
        case 'array_contains': {
          const ac_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')] ?? [];
          const ac_needle = runtimeVariablesRef.current[String(node.params.valueVar ?? 'val')] ?? 0;
          runtimeVariablesRef.current[String(node.params.outVar ?? 'found')] = ac_arr.includes(ac_needle as any) ? 1 : 0;
          break;
        }
        case 'array_index_of': {
          const aio_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')] ?? [];
          const aio_needle = runtimeVariablesRef.current[String(node.params.valueVar ?? 'val')] ?? 0;
          runtimeVariablesRef.current[String(node.params.outVar ?? 'idx')] = aio_arr.indexOf(aio_needle as any);
          break;
        }
        case 'array_literal': {
          const alName = String(node.params.name ?? 'arr');
          const alRaw  = String(node.params.values ?? '');
          runtimeArraysRef.current[alName] = alRaw.split(',').map(v => {
            const t = v.trim();
            if (t === 'null' || t === '') return null;
            const n = Number(t);
            return Number.isFinite(n) ? n : t;
          });
          break;
        }
        case 'tile_set_var': {
          const tsv_idx = Math.round(Number(runtimeVariablesRef.current[String(node.params.indexVar ?? 'i')] ?? 0));
          if (tsv_idx >= 0 && tsv_idx < tiles.length) {
            const tsv_c = runtimeColorVarsRef.current[String(node.params.colorVar ?? 'color')] ?? getColor(node.params, 'defaultColor', '#ffffff');
            tiles[tsv_idx] = { color: tsv_c, intensity: clamp01(getNum(node.params, 'intensity', 0.85)) };
          }
          break;
        }
        case 'tile_get_var': {
          const tgv_idx = Math.round(Number(runtimeVariablesRef.current[String(node.params.indexVar ?? 'i')] ?? 0));
          if (tgv_idx >= 0 && tgv_idx < tiles.length) runtimeColorVarsRef.current[String(node.params.outColorVar ?? 'tileColor')] = tiles[tgv_idx].color;
          break;
        }
        case 'tiles_from_array': {
          const tfa_arr = runtimeArraysRef.current[String(node.params.arrayName ?? 'arr')] ?? [];
          const tfa_bg = getColor(node.params, 'bgColor', '#000000');
          const tfa_bi = clamp01(getNum(node.params, 'bgIntensity', 0));
          const tfa_i  = clamp01(getNum(node.params, 'intensity', 0.85));
          for (let k = 0; k < Math.min(tfa_arr.length, tiles.length); k++) {
            const v = tfa_arr[k];
            tiles[k] = (v === null || v === 0 || v === '') ? { color: tfa_bg, intensity: tfa_bi } : typeof v === 'string' && v.startsWith('#') ? { color: v, intensity: tfa_i } : { color: '#ffffff', intensity: tfa_i };
          }
          setRuntimeTiles([...tiles]);
          break;
        }
        case 'math_mod':   { const vm = runtimeVariablesRef.current; const _b = Number(vm[String(node.params.bVar??'b')]??1)||1; vm[String(node.params.outVar??'result')] = Number(vm[String(node.params.aVar??'a')]??0) % _b; break; }
        case 'math_floor': { const vm2 = runtimeVariablesRef.current; vm2[String(node.params.outVar??'result')] = Math.floor(Number(vm2[String(node.params.varName??'x')]??0)); break; }
        case 'math_ceil':  { const vm3 = runtimeVariablesRef.current; vm3[String(node.params.outVar??'result')] = Math.ceil(Number(vm3[String(node.params.varName??'x')]??0)); break; }
        case 'math_round': { const vm4 = runtimeVariablesRef.current; vm4[String(node.params.outVar??'result')] = Math.round(Number(vm4[String(node.params.varName??'x')]??0)); break; }
        case 'math_abs':   { const vm5 = runtimeVariablesRef.current; vm5[String(node.params.outVar??'result')] = Math.abs(Number(vm5[String(node.params.varName??'x')]??0)); break; }
        case 'math_min':   { const vm6 = runtimeVariablesRef.current; vm6[String(node.params.outVar??'result')] = Math.min(Number(vm6[String(node.params.aVar??'a')]??0), Number(vm6[String(node.params.bVar??'b')]??0)); break; }
        case 'math_max':   { const vm7 = runtimeVariablesRef.current; vm7[String(node.params.outVar??'result')] = Math.max(Number(vm7[String(node.params.aVar??'a')]??0), Number(vm7[String(node.params.bVar??'b')]??0)); break; }
        case 'math_pow':   { const vm8 = runtimeVariablesRef.current; vm8[String(node.params.outVar??'result')] = Math.pow(Number(vm8[String(node.params.aVar??'a')]??0), Number(vm8[String(node.params.bVar??'b')]??1)); break; }
        case 'math_sqrt':  { const vm9 = runtimeVariablesRef.current; vm9[String(node.params.outVar??'result')] = Math.sqrt(Math.max(0,Number(vm9[String(node.params.varName??'x')]??0))); break; }
        case 'string_concat':   { const vsc = runtimeVariablesRef.current; vsc[String(node.params.outVar??'result')] = String(vsc[String(node.params.aVar??'a')]??'') + String(vsc[String(node.params.bVar??'b')]??''); break; }
        case 'string_from_num': { const vsn = runtimeVariablesRef.current; const dec = Math.max(0,Math.round(getNum(node.params,'decimals',0))); vsn[String(node.params.outVar??'text')] = Number(vsn[String(node.params.varName??'x')]??0).toFixed(dec); break; }
        case 'grid_create': {
          const gcn = String(node.params.name??'grid'); const gcc = Math.max(1,Math.round(getNum(node.params,'cols',6))); const gcr = Math.max(1,Math.round(getNum(node.params,'rows',7)));
          const gcv = node.params.initValue !== undefined ? (node.params.initValue as number|string|null) : null;
          runtimeArraysRef.current[gcn] = Array.from({length:gcc*gcr},()=>gcv);
          runtimeVariablesRef.current[gcn+'_cols'] = gcc; runtimeVariablesRef.current[gcn+'_rows'] = gcr;
          break;
        }
        case 'grid_get': {
          const ggn = String(node.params.name??'grid'); const ggcols = Number(runtimeVariablesRef.current[ggn+'_cols']??6);
          const ggc = Math.round(Number(runtimeVariablesRef.current[String(node.params.colVar??'col')]??0));
          const ggr = Math.round(Number(runtimeVariablesRef.current[String(node.params.rowVar??'row')]??0));
          const ggarr = runtimeArraysRef.current[ggn]??[]; const ggv = ggarr[ggr*ggcols+ggc];
          runtimeVariablesRef.current[String(node.params.outVar??'cell')] = ggv !== null && ggv !== undefined ? (ggv as number|string) : 0;
          break;
        }
        case 'grid_set': {
          const gsn = String(node.params.name??'grid'); const gscols = Number(runtimeVariablesRef.current[gsn+'_cols']??6);
          const gsc = Math.round(Number(runtimeVariablesRef.current[String(node.params.colVar??'col')]??0));
          const gsr = Math.round(Number(runtimeVariablesRef.current[String(node.params.rowVar??'row')]??0));
          const gsarr = runtimeArraysRef.current[gsn]; const gsval = runtimeVariablesRef.current[String(node.params.valueVar??'val')]??0;
          if (gsarr && gsr*gscols+gsc >= 0 && gsr*gscols+gsc < gsarr.length) gsarr[gsr*gscols+gsc] = gsval;
          break;
        }
        case 'grid_clear': {
          const gcln = String(node.params.name??'grid'); const gclv = node.params.initValue !== undefined ? (node.params.initValue as number|string|null) : null;
          const gclarr = runtimeArraysRef.current[gcln]; if (gclarr) gclarr.fill(gclv);
          break;
        }
        case 'grid_sync_tiles': {
          const gstn = String(node.params.name??'grid'); const gstarr = runtimeArraysRef.current[gstn]??[];
          const gstbg = getColor(node.params,'bgColor','#000000'); const gstbi = clamp01(getNum(node.params,'bgIntensity',0));
          for (let k=0; k<Math.min(gstarr.length,tiles.length); k++) {
            const v = gstarr[k];
            tiles[k] = (v===null||v===0||v==='') ? {color:gstbg,intensity:gstbi} : typeof v==='string'&&v.startsWith('#') ? {color:v,intensity:0.85} : {color:'#ffffff',intensity:0.85};
          }
          setRuntimeTiles([...tiles]);
          break;
        }
        case 'grid_check_4_in_row': {
          const g4n = String(node.params.name??'grid'); const g4arr = runtimeArraysRef.current[g4n]??[];
          const g4cols = Number(runtimeVariablesRef.current[g4n+'_cols']??6); const g4rows = Number(runtimeVariablesRef.current[g4n+'_rows']??7);
          const g4tv = runtimeVariablesRef.current[String(node.params.valueVar??'lastColor')]??null;
          const g4get = (c:number,r:number) => g4arr[r*g4cols+c];
          const g4chk = (c:number,r:number,dc:number,dr:number) => { for(let k=0;k<4;k++){const nc=c+k*dc,nr=r+k*dr;if(nc<0||nc>=g4cols||nr<0||nr>=g4rows||g4get(nc,nr)!==g4tv)return false;}return true;};
          let g4won=false;
          g4outer:for(let r=0;r<g4rows&&!g4won;r++)for(let c=0;c<g4cols;c++){if(g4get(c,r)!==g4tv)continue;if(g4chk(c,r,1,0)||g4chk(c,r,0,1)||g4chk(c,r,1,1)||g4chk(c,r,1,-1)){g4won=true;break g4outer;}}
          runtimeVariablesRef.current[String(node.params.outVar??'hasWon')] = g4won?1:0;
          break;
        }
        case 'define_sub': case 'break_loop': break;
        case 'call_sub': {
          const cst = runtimeSubsRef.current[String(node.params.name??'mySub')];
          if (cst) executeNodeSync(cst, depth+1);
          break;
        }
        default: break;
      }

      const outgoing = game.edges.filter(e => e.from === nodeId);
      for (const edge of outgoing) executeNodeSync(edge.to, depth + 1);
      setRuntimeTiles([...runtimeTilesRef.current]);
    }

    // ── Async executeNode ─────────────────────────────────────────────────────
    async function executeNodeAsync(nodeId: string, depth = 0): Promise<void> {
      if (signal.aborted || depth > 100) return;
      const node = game.nodes.find(n => n.id === nodeId);
      if (!node || !node.enabled) return;

      try {
        switch (node.kind) {
          case 'wait': {
            const ms = Math.max(0, getNum(node.params, 'seconds', 1)) * 1000;
            await sleep(ms);
            break;
          }
          case 'wait_event': {
            const eventType = String(node.params.eventType ?? 'submit');
            const timeoutMs = Math.max(100, getNum(node.params, 'timeoutMs', 30000));
            await waitForEvent(eventType, timeoutMs);
            break;
          }
          case 'emit_event': {
            emitEvent(String(node.params.eventType ?? 'submit'));
            break;
          }
          case 'round_start': {
            const total = Math.max(1, Math.round(getNum(node.params, 'totalRounds', 5)));
            runtimeRoundRef.current.total = total;
            runtimeRoundRef.current.current += 1;
            setRuntimeRound({ current: runtimeRoundRef.current.current, total });
            if (node.params.resetScore) { runtimeScoreRef.current = 0; setRuntimeScore(0); }
            break;
          }
          case 'round_end': {
            emitEvent('round_end', { round: runtimeRoundRef.current.current });
            break;
          }
          case 'next_round': {
            runtimeRoundRef.current.current += 1;
            setRuntimeRound({ ...runtimeRoundRef.current });
            break;
          }
          case 'gen_target_color': {
            const mode = String(node.params.mode ?? 'random');
            const varName = String(node.params.varName ?? 'target');
            let color: string;
            if (mode === 'blackbody') {
              const temps = [1900, 2700, 3000, 4000, 5000, 6500, 10000];
              color = blackbodyToHex(temps[Math.floor(Math.random() * temps.length)]);
            } else if (mode === 'pastel') {
              const h = Math.floor(Math.random() * 360);
              const s = 40 + Math.floor(Math.random() * 30);
              const l = 60 + Math.floor(Math.random() * 20);
              const { r, g, b } = hslToRgb(h, s, l);
              color = rgbToHex(r, g, b);
            } else {
              color = rgbToHex(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
            }
            runtimeColorVarsRef.current[varName] = color;
            if (node.params.displayOnPlates) {
              sendColorToHardware(color, 0.85, allPlateIds);
              const tiles = runtimeTilesRef.current;
              for (let i = 0; i < tiles.length; i++) tiles[i] = { color, intensity: 0.85 };
              setRuntimeTiles([...tiles]);
              const displayMs = getNum(node.params, 'displaySeconds', 3) * 1000;
              if (displayMs > 0) await sleep(displayMs);
            }
            break;
          }
          case 'show_target_on_plates': {
            const varName = String(node.params.varName ?? 'target');
            const color = runtimeColorVarsRef.current[varName] ?? '#ffffff';
            const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
            sendColorToHardware(color, intensity, allPlateIds);
            const tiles = runtimeTilesRef.current;
            for (let i = 0; i < tiles.length; i++) tiles[i] = { color, intensity };
            setRuntimeTiles([...tiles]);
            break;
          }
          case 'hardware_send_color': {
            const varName = String(node.params.varName ?? 'target');
            const color = runtimeColorVarsRef.current[varName] ?? getColor(node.params, 'color', '#ffffff');
            const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
            sendColorToHardware(color, intensity, allPlateIds);
            const tiles = runtimeTilesRef.current;
            for (let i = 0; i < tiles.length; i++) tiles[i] = { color, intensity };
            setRuntimeTiles([...tiles]);
            break;
          }
          case 'hardware_flash': {
            const flashColor = getColor(node.params, 'color', '#ffffff');
            const flashIntensity = clamp01(getNum(node.params, 'intensity', 1.0));
            const durationMs = Math.max(50, getNum(node.params, 'durationMs', 200));
            sendColorToHardware(flashColor, flashIntensity, allPlateIds);
            const tiles = runtimeTilesRef.current;
            const prevTiles = tiles.map(t => ({ ...t }));
            for (let i = 0; i < tiles.length; i++) tiles[i] = { color: flashColor, intensity: flashIntensity };
            setRuntimeTiles([...tiles]);
            await sleep(durationMs);
            prevTiles.forEach((t, i) => { tiles[i] = t; });
            setRuntimeTiles([...tiles]);
            break;
          }
          case 'countdown_start': {
            const totalSec = Math.max(1, getNum(node.params, 'seconds', 30));
            const varName = String(node.params.varName ?? 'countdown');
            const endTime = Date.now() + totalSec * 1000;
            runtimeVariablesRef.current[varName] = totalSec;
            setRuntimeCountdownValue(totalSec);
            if (runtimeCountdownsRef.current.has(varName)) {
              clearInterval(runtimeCountdownsRef.current.get(varName)!);
            }
            const cdTimer = setInterval(() => {
              const remaining = Math.max(0, (endTime - Date.now()) / 1000);
              runtimeVariablesRef.current[varName] = remaining;
              setRuntimeCountdownValue(remaining);
              if (remaining <= 0) {
                clearInterval(cdTimer);
                runtimeCountdownsRef.current.delete(varName);
                emitEvent('countdown_end_' + varName);
                game.nodes.filter(n => n.kind === 'on_countdown_end' && n.enabled && String(n.params.varName ?? 'countdown') === varName)
                  .forEach(n => game.edges.filter(e => e.from === n.id).forEach(e => { executeNodeAsync(e.to, 0).catch(() => {}); }));
              }
            }, 200);
            runtimeTickTimersRef.current.push(cdTimer);
            runtimeCountdownsRef.current.set(varName, cdTimer);
            break;
          }
          case 'for_range': {
            const fri = String(node.params.varName??'i');
            const frs = Math.round(getNum(node.params,'start',0));
            const fre = Math.round(getNum(node.params,'end',41));
            const frst = Math.max(1,Math.round(Math.abs(getNum(node.params,'step',1))));
            const frb = String(node.params.bodyNodeId??'');
            const frMax = Math.min(10000, Math.abs(fre-frs)+2);
            let frIter = 0;
            const frDir = frs <= fre ? 1 : -1;
            for (let i=frs; (frDir>0?i<=fre:i>=fre) && !signal.aborted && frIter++<frMax; i+=frDir*frst) {
              runtimeVariablesRef.current[fri] = i;
              if (frb) await executeNodeAsync(frb, depth+1);
              if (signal.aborted) return;
            }
            const frOut = game.edges.filter(e=>e.from===nodeId);
            for (const edge of frOut) { await executeNodeAsync(edge.to, depth+1); if(signal.aborted)return; }
            return;
          }
          case 'for_each_array': {
            const feaArr = runtimeArraysRef.current[String(node.params.arrayName??'arr')]??[];
            const feaVar = String(node.params.varName??'item');
            const feaIdx = node.params.indexVar as string|undefined;
            const feaBody = String(node.params.bodyNodeId??'');
            for (let k=0; k<feaArr.length && !signal.aborted; k++) {
              runtimeVariablesRef.current[feaVar] = feaArr[k] !== null ? (feaArr[k] as number|string) : 0;
              if (feaIdx) runtimeVariablesRef.current[feaIdx] = k;
              if (feaBody) await executeNodeAsync(feaBody, depth+1);
            }
            const feaOut = game.edges.filter(e=>e.from===nodeId);
            for (const edge of feaOut) { await executeNodeAsync(edge.to, depth+1); if(signal.aborted)return; }
            return;
          }
          case 'call_sub': {
            const cst2 = runtimeSubsRef.current[String(node.params.name??'mySub')];
            if (cst2) await executeNodeAsync(cst2, depth+1);
            break;
          }
          case 'countdown_stop': {
            const varName = String(node.params.varName ?? 'countdown');
            const t = runtimeCountdownsRef.current.get(varName);
            if (t) { clearInterval(t); runtimeCountdownsRef.current.delete(varName); }
            break;
          }
          default: {
            executeNodeSync(nodeId, 0);
            return;
          }
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        console.warn('[runtime] node error', nodeId, e);
        return;
      }

      if (signal.aborted) return;
      const outgoing = game.edges.filter(e => e.from === nodeId);
      for (const edge of outgoing) {
        await executeNodeAsync(edge.to, depth + 1);
        if (signal.aborted) return;
      }
    }

    // ── Wire click handler ────────────────────────────────────────────────────
    fireRuntimeClickRef.current = (tileIndex: number) => {
      runtimeVariablesRef.current['clickedTile'] = tileIndex;
      game.nodes
        .filter(n => n.kind === 'on_tile_click' && n.enabled)
        .forEach(node => {
          game.edges.filter(e => e.from === node.id).forEach(e => executeNodeAsync(e.to, 0).catch(() => {}));
        });
    };

    // ── Wire submit handler ────────────────────────────────────────────────────
    (window as any).__colorroom_submit = () => {
      emitEvent('submit');
      game.nodes.filter(n => n.kind === 'on_submit_answer' && n.enabled)
        .forEach(n => game.edges.filter(e => e.from === n.id).forEach(e => executeNodeAsync(e.to, 0).catch(() => {})));
    };

    // ── Index define_sub nodes ────────────────────────────────────────────────
    game.nodes.filter(n => n.kind === 'define_sub' && n.enabled).forEach(n => {
      const sName = String(n.params.name ?? 'mySub');
      const fEdge = game.edges.find(e => e.from === n.id);
      if (fEdge) runtimeSubsRef.current[sName] = fEdge.to;
    });

    // ── Fire event_begin ──────────────────────────────────────────────────────
    game.nodes.filter(n => n.kind === 'event_begin' && n.enabled).forEach(n => {
      game.edges.filter(e => e.from === n.id).forEach(e => executeNodeAsync(e.to, 0).catch(() => {}));
    });

    // ── Set up on_tick timers ──────────────────────────────────────────────────
    game.nodes.filter(n => n.kind === 'on_tick' && n.enabled).forEach(node => {
      const intervalMs = Math.max(50, getNum(node.params, 'intervalMs', 1000));
      const timer = setInterval(() => {
        if (signal.aborted) { clearInterval(timer); return; }
        game.edges.filter(e => e.from === node.id).forEach(e => executeNodeAsync(e.to, 0).catch(() => {}));
      }, intervalMs);
      runtimeTickTimersRef.current.push(timer);
    });

    return () => {
      abort.abort();
      runtimeAbortRef.current = null;
      runtimeTickTimersRef.current.forEach(t => clearInterval(t));
      runtimeTickTimersRef.current = [];
      runtimeCountdownsRef.current.forEach(t => clearInterval(t));
      runtimeCountdownsRef.current.clear();
      fireRuntimeClickRef.current = null;
      delete (window as any).__colorroom_submit;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame?.id, activeGame?.nodes.length, activeGame?.edges.length, isPlaying, hasRuntimeEvents]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        setStatus('Redo');
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        setStatus('Undo');
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        setStatus('Redo');
        return;
      }

      // Ctrl+S → sauvegarder
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveActiveGameRef.current?.();
        return;
      }

      if (e.key === 'Escape') {
        setContextMenu((p) => ({ ...p, open: false }));
        setPendingLink(null);
        return;
      }

      // F → fit all nodes in view
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        fitNodesToViewRef.current?.();
        return;
      }

      // L → re-layout nodes
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        autoLayoutNodesRef.current?.();
        return;
      }

      // Home / H → reset zoom
      if (e.key === 'Home' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setGraphZoom(0.5);
        setGraphPan({ x: 120, y: 80 });
        setStatus('Zoom réinitialisé');
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedNodeId) {
        e.preventDefault();
        const nodeId = editor.selectedNodeId;
        // Prevent deletion of event_begin nodes
        const game = editor.games.find((g) => g.id === editor.activeGameId);
        const targetNode = game?.nodes.find((n) => n.id === nodeId);
        if (targetNode?.kind === 'event_begin') {
          setStatus('Impossible de supprimer l\'évènement de départ');
          return;
        }
        commit((cur) => {
          const nextGames = cur.games.map((g) => {
            if (g.id !== cur.activeGameId) return g;
            return {
              ...g,
              nodes: g.nodes.filter((n) => n.id !== nodeId),
              edges: g.edges.filter((ed) => ed.from !== nodeId && ed.to !== nodeId),
            };
          });
          return { ...cur, games: nextGames, selectedNodeId: null };
        });
        setStatus('Noeud supprimé');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setContextMenu, setPendingLink, commit, editor.selectedNodeId]);

  const editorTiles = useMemo(() => {
    if (!activeGame) return Array.from({ length: 9 }, () => ({ color: '#000000', intensity: 0 }));
    return computeTiles(activeGame, t);
  }, [activeGame, t]);

  const tiles = editorTiles;

  // Send tile changes to hardware (same logic as /jeux)
  useEffect(() => {
    if (!activeGame) return;
    if (!isPlaying) return;

    // Send each tile's color/intensity to hardware
    tiles.forEach((tile, index) => {
      const plateId = PLATE_ID_BY_INDEX[index];
      if (!plateId) return;

      const rgb = hexToRgb255(tile.color);
      const intensity100 = Math.round(tile.intensity * 100);

      // Only send if intensity > 0, otherwise black out
      if (tile.intensity > 0) {
        sendRgbToHardware(rgb, intensity100, [plateId]);
      } else {
        // Send black to turn off
        sendRgbToHardware({ r: 0, g: 0, b: 0 }, 0, [plateId]);
      }
    });
  }, [tiles, activeGame, isPlaying]);

  // PREVIEW MODE: Show selected node color on ALL plates in real-time when editing
  useEffect(() => {
    if (!activeGame || isPlaying) return;
    if (!editor.selectedNodeId) return;

    const selectedNode = activeGame.nodes.find((n) => n.id === editor.selectedNodeId);
    if (!selectedNode || !selectedNode.enabled) return;

    // Extract color and intensity from render nodes
    let previewColor: string | null = null;
    let previewIntensity = 0.8;

    if (selectedNode.kind === 'fill') {
      previewColor = getColor(selectedNode.params, 'color', '#6d28ff');
      previewIntensity = clamp01(getNum(selectedNode.params, 'intensity', 0.8));
    } else if (selectedNode.kind === 'pulse') {
      // ANIMATED pulse preview using live t
      const legacyColor = getColor(selectedNode.params, 'color', '#ff2aa6');
      const baseColor = getColor(selectedNode.params, 'baseColor', legacyColor);
      const targetColor = getColor(selectedNode.params, 'targetColor', legacyColor);
      
      const legacyBase = clamp01(getNum(selectedNode.params, 'base', 0.15));
      const legacyAmp = clamp01(getNum(selectedNode.params, 'amp', 0.75));
      const fromIntensity = clamp01(getNum(selectedNode.params, 'fromIntensity', legacyBase));
      const toIntensity = clamp01(getNum(selectedNode.params, 'toIntensity', clamp01(legacyBase + legacyAmp)));
      
      const speed = Math.max(0.01, getNum(selectedNode.params, 'speed', 0.9));
      const phase = getNum(selectedNode.params, 'phase', 0);
      const t01 = clamp01(0.5 + 0.5 * Math.sin(t * speed * 2 * Math.PI + phase));
      
      previewColor = lerpColor(baseColor, targetColor, t01);
      previewIntensity = clamp01(lerp(fromIntensity, toIntensity, t01));
    } else if (selectedNode.kind === 'tile') {
      previewColor = getColor(selectedNode.params, 'color', '#ff2aa6');
      previewIntensity = clamp01(getNum(selectedNode.params, 'intensity', 0.85));
    }

    if (!previewColor) return;

    // Send to all plates
    const rgb = hexToRgb255(previewColor);
    const intensity100 = Math.round(previewIntensity * 100);
    const allPlateIds = PLATE_ID_BY_INDEX.filter(Boolean);
    sendRgbToHardware(rgb, intensity100, allPlateIds);
  }, [activeGame, editor.selectedNodeId, isPlaying, t]);

  // Map Tetris grid to hardware tiles - throttled to 500ms interval (not every frame)
  useEffect(() => {
    if (!activeTetrisNode || !isPlaying) return;

    function syncTetrisToHardware() {
      const snap = tetrisSnapRef.current;
      if (!snap) return;
      const { grid, piece } = snap;
      if (!grid || grid.length === 0) return;

      const GRID_ROWS = grid.length;
      const GRID_COLS = grid[0]?.length ?? 6;

      // Merge current piece onto grid copy
      const merged: (string | null)[][] = grid.map(row => [...row]);
      if (piece) {
        const { shape, x: px, y: py, color: pColor } = piece;
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
              const gr = py + r;
              const gc = px + c;
              if (gr >= 0 && gr < GRID_ROWS && gc >= 0 && gc < GRID_COLS) {
                merged[gr][gc] = pColor;
              }
            }
          }
        }
      }

      const TOTAL_PLATES = 42;
      const HW_COLS = 6;
      const HW_ROWS = 7;

      // 1:1 mapping: show bottom 7 rows of Tetris grid on the 7 hardware rows
      const gridOffset = Math.max(0, GRID_ROWS - HW_ROWS);

      for (let hr = 0; hr < HW_ROWS; hr++) {
        const gridRow = gridOffset + hr;
        for (let hc = 0; hc < HW_COLS; hc++) {
          const tileIdx = hr * HW_COLS + hc;
          if (tileIdx >= TOTAL_PLATES) continue;
          const plateId = PLATE_ID_BY_INDEX[tileIdx];
          if (!plateId) continue;

          const cellColor = merged[gridRow]?.[hc] ?? null;

          if (cellColor) {
            const rgb = hexToRgb255(cellColor);
            sendRgbToHardware(rgb, 90, [plateId]);
          } else {
            sendRgbToHardware({ r: 0, g: 0, b: 0 }, 0, [plateId]);
          }
        }
      }
    }

    syncTetrisToHardware(); // initial sync
    const iv = setInterval(syncTetrisToHardware, 500); // poll every 500ms
    return () => clearInterval(iv);
  }, [activeTetrisNode, isPlaying]);

  const tileCount = tiles.length;

  useEffect(() => {
    if (typeof selectedTileIndex !== 'number') return;
    if (selectedTileIndex < 0 || selectedTileIndex >= tileCount) {
      setSelectedTileIndex(null);
    }
  }, [selectedTileIndex, tileCount]);

  // ── Conversion tiles → format Room3D (plateColors / plateActive) ──────────
  const activeTilesData = hasRuntimeEvents && isPlaying ? runtimeTiles : tiles;
  const roomPlateColors = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const tile = activeTilesData[i];
      if (!tile || tile.intensity <= 0.01) return '#000000';
      const rgb = hexToRgb255(tile.color);
      const r = Math.round(rgb.r * tile.intensity);
      const g = Math.round(rgb.g * tile.intensity);
      const b = Math.round(rgb.b * tile.intensity);
      return `rgb(${r},${g},${b})`;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTilesData]);

  const roomPlateActive = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const tile = activeTilesData[i];
      return !!tile && tile.intensity > 0.05;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTilesData]);

  const serializeGameConfig = (g: GameDoc): unknown => {
    return {
      version: 1,
      tileCount: g.tileCount ?? tiles.length,
      icon: g.icon,
      difficulty: g.difficulty,
      description: g.description,
      bgColor: g.bgColor,
      accentColor: g.accentColor,
      nodes: g.nodes,
      edges: g.edges,
      uiLayout: g.uiLayout ?? [],
      pythonCode: g.pythonCode ?? '',
    };
  };

  const parseGameConfig = (config: unknown): {
    tileCount?: number;
    icon?: GameIconName;
    difficulty?: GameDifficulty;
    description?: string;
    bgColor?: string;
    accentColor?: string;
    nodes: EditorNode[];
    edges: GraphEdge[];
    uiLayout: UILayoutComponent[];
    pythonCode?: string;
  } | null => {
    if (!config || typeof config !== 'object') return null;
    const o = config as any;
    const tileCount = typeof o.tileCount === 'number' && Number.isFinite(o.tileCount) ? o.tileCount : undefined;
    const nodes = Array.isArray(o.nodes) ? (o.nodes as EditorNode[]) : null;
    const edges = Array.isArray(o.edges) ? (o.edges as GraphEdge[]) : null;
    if (!nodes || !edges) return null;
    const icon = typeof o.icon === 'string' ? (o.icon as GameIconName) : undefined;
    const difficulty = [1,2,3,4,5].includes(Number(o.difficulty)) ? (Number(o.difficulty) as GameDifficulty) : undefined;
    const description = typeof o.description === 'string' ? o.description : undefined;
    const bgColor = typeof o.bgColor === 'string' ? o.bgColor : undefined;
    const accentColor = typeof o.accentColor === 'string' ? o.accentColor : undefined;
    const uiLayout = Array.isArray(o.uiLayout) ? (o.uiLayout as UILayoutComponent[]) : [];
    const pythonCode = typeof o.pythonCode === 'string' ? o.pythonCode : undefined;
    return { tileCount, icon, difficulty, description, bgColor, accentColor, nodes, edges, uiLayout, pythonCode };
  };

  const createDbGame = async (name: string, initialGame: GameDoc): Promise<string | null> => {
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, kind: 'editor', config: serializeGameConfig(initialGame) }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) return null;
      return String(json.game?.id ?? '');
    } catch {
      return null;
    }
  };

  const saveDbGame = async (g: GameDoc): Promise<boolean> => {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(g.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: g.name, kind: 'editor', config: serializeGameConfig(g) }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) return false;
      return true;
    } catch {
      return false;
    }
  };

  const deleteDbGame = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) return false;
      return true;
    } catch {
      return false;
    }
  };

  const createGame = async (forcedName?: string, template: 'blank' | 'tutorial' | 'animation' | 'interactive' | 'fluorescence' | 'color-demo' | 'pulse-advanced' | 'rainbow' | 'tetris' | 'memory' | 'tetris-blueprint' = 'blank') => {
    const makeId: IdFactory = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const provisionalId = makeId();
    const nextIndex = (editorRef.current.games.length || 0) + 1;
    const gameName = forcedName && forcedName.trim().length > 0 ? forcedName.trim() : `Jeu${nextIndex}`;
    
    // Créer les nœuds et connexions selon le template
    let initialNodes: EditorNode[] = [];
    let initialEdges: GraphEdge[] = [];
    const eventId = makeId();
    
    if (template === 'blank') {
      initialNodes = [
        {
          id: eventId,
          kind: 'event_begin',
          name: 'Démarrer',
          enabled: true,
          params: {},
          pos: { x: 80, y: 80 },
        },
      ];
    } else if (template === 'tutorial') {
      const fillId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: fillId, kind: 'fill', name: 'Remplissage bleu', enabled: true, params: { color: '#00d7ff', intensity: 0.6, mask: 'all', seconds: 2 }, pos: { x: 400, y: 80 } },
      ];
      initialEdges = [{ id: makeId(), from: eventId, to: fillId }];
    } else if (template === 'animation') {
      const pulseId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: pulseId, kind: 'pulse', name: 'Pulsation', enabled: true, params: { baseColor: '#ff2aa6', targetColor: '#00d7ff', fromIntensity: 0.1, toIntensity: 0.8, speed: 1.0, phase: 0 }, pos: { x: 400, y: 80 } },
      ];
      initialEdges = [{ id: makeId(), from: eventId, to: pulseId }];
    } else if (template === 'interactive') {
      const tileId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: tileId, kind: 'tile', name: 'Dalle centrale', enabled: true, params: { tileIndex: 4, color: '#ff2aa6', intensity: 0.9 }, pos: { x: 400, y: 80 } },
      ];
      initialEdges = [{ id: makeId(), from: eventId, to: tileId }];
    } else if (template === 'fluorescence') {
      const fill1 = makeId();
      const wait1 = makeId();
      const fill2 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 160 } },
        { id: fill1, kind: 'fill', name: 'UV Activation', enabled: true, params: { color: '#8b00ff', intensity: 0.3, mask: 'all', seconds: 1 }, pos: { x: 440, y: 80 } },
        { id: wait1, kind: 'wait', name: 'Pause', enabled: true, params: { seconds: 2 }, pos: { x: 440, y: 320 } },
        { id: fill2, kind: 'fill', name: 'Fluorescence', enabled: true, params: { color: '#00ff88', intensity: 0.8, mask: 'all', seconds: 3 }, pos: { x: 440, y: 560 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: fill1 },
        { id: makeId(), from: fill1, to: wait1 },
        { id: makeId(), from: wait1, to: fill2 },
      ];
    } else if (template === 'color-demo') {
      const tile1 = makeId();
      const tile2 = makeId();
      const tile3 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 300 } },
        { id: tile1, kind: 'tile', name: 'Rouge', enabled: true, params: { tileIndex: 0, color: '#ff0000', intensity: 0.8 }, pos: { x: 440, y: 80 } },
        { id: tile2, kind: 'tile', name: 'Vert', enabled: true, params: { tileIndex: 1, color: '#00ff00', intensity: 0.8 }, pos: { x: 440, y: 320 } },
        { id: tile3, kind: 'tile', name: 'Bleu', enabled: true, params: { tileIndex: 2, color: '#0000ff', intensity: 0.8 }, pos: { x: 440, y: 560 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: tile1 },
        { id: makeId(), from: eventId, to: tile2 },
        { id: makeId(), from: eventId, to: tile3 },
      ];
    } else if (template === 'pulse-advanced') {
      const pulse1 = makeId();
      const wait1 = makeId();
      const pulse2 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 160 } },
        { id: pulse1, kind: 'pulse', name: 'Pulsation chaude', enabled: true, params: { baseColor: '#ff6b00', targetColor: '#ffeb00', fromIntensity: 0.2, toIntensity: 0.9, speed: 0.8, phase: 0 }, pos: { x: 440, y: 80 } },
        { id: wait1, kind: 'wait', name: 'Transition', enabled: true, params: { seconds: 3 }, pos: { x: 440, y: 320 } },
        { id: pulse2, kind: 'pulse', name: 'Pulsation froide', enabled: true, params: { baseColor: '#00d4ff', targetColor: '#b829dd', fromIntensity: 0.2, toIntensity: 0.9, speed: 1.2, phase: 0 }, pos: { x: 440, y: 560 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: pulse1 },
        { id: makeId(), from: pulse1, to: wait1 },
        { id: makeId(), from: wait1, to: pulse2 },
      ];
    } else if (template === 'rainbow') {
      const fill1 = makeId();
      const fill2 = makeId();
      const fill3 = makeId();
      const fill4 = makeId();
      const fill5 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 560 } },
        { id: fill1, kind: 'fill', name: 'Rouge', enabled: true, params: { color: '#ff0000', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 440, y: 80 } },
        { id: fill2, kind: 'fill', name: 'Jaune', enabled: true, params: { color: '#ffff00', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 440, y: 320 } },
        { id: fill3, kind: 'fill', name: 'Vert', enabled: true, params: { color: '#00ff00', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 440, y: 560 } },
        { id: fill4, kind: 'fill', name: 'Cyan', enabled: true, params: { color: '#00ffff', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 440, y: 800 } },
        { id: fill5, kind: 'fill', name: 'Bleu', enabled: true, params: { color: '#0000ff', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 440, y: 1040 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: fill1 },
        { id: makeId(), from: fill1, to: fill2 },
        { id: makeId(), from: fill2, to: fill3 },
        { id: makeId(), from: fill3, to: fill4 },
        { id: makeId(), from: fill4, to: fill5 },
      ];
    } else if (template === 'tetris') {
      // Jeu Tetris avec nœuds internes détaillés
      const tetrisMainId = makeId();
      const initGrid = makeId();
      const spawnPiece = makeId();
      const renderGrid = makeId();
      const gameLoop = makeId();
      const moveDown = makeId();
      const checkCollision = makeId();
      const mergePiece = makeId();
      const clearLines = makeId();
      const checkGameOver = makeId();
      const gameOverFill = makeId();
      const scorePulse = makeId();
      const waitTick = makeId();
      const bgFill = makeId();
      const borderTiles = makeId();
      
      // IDs pour les 4 pièces Tetris (exemples)
      const pieceI = makeId();
      const pieceL = makeId();
      const pieceT = makeId();
      const pieceSquare = makeId();
      const rotateCheck = makeId();
      const inputHandler = makeId();
      const timerEvent = makeId();
      
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 300 } },
        // Nœud principal du jeu (celui sur lequel on double-clique)
        { id: tetrisMainId, kind: 'game_tetris', name: 'Tetris Lumière', enabled: true, params: { speed: 500, bgColor: '#0a0a0f', borderColor: '#222233' }, pos: { x: 300, y: 300 } },
        
        // Nœuds internes visibles quand on double-clique
        { id: bgFill, kind: 'fill', name: 'Fond noir', enabled: true, params: { color: '#0a0a0f', intensity: 1, mask: 'all', seconds: 0 }, pos: { x: 520, y: 80 } },
        { id: borderTiles, kind: 'tile', name: 'Bordure', enabled: true, params: { tileIndex: 21, color: '#444466', intensity: 0.5 }, pos: { x: 740, y: 80 } },
        { id: initGrid, kind: 'sequence', name: 'Init Grille', enabled: true, params: {}, pos: { x: 520, y: 180 } },
        { id: gameLoop, kind: 'while', name: 'Boucle Jeu', enabled: true, params: {}, pos: { x: 520, y: 280 } },
        { id: spawnPiece, kind: 'random_01', name: 'Nouvelle Pièce', enabled: true, params: {}, pos: { x: 740, y: 180 } },
        { id: pieceI, kind: 'tile', name: 'Pièce I (cyan)', enabled: true, params: { tileIndex: 10, color: '#00ffff', intensity: 0.9 }, pos: { x: 960, y: 80 } },
        { id: pieceL, kind: 'tile', name: 'Pièce L (orange)', enabled: true, params: { tileIndex: 11, color: '#ffaa00', intensity: 0.9 }, pos: { x: 960, y: 160 } },
        { id: pieceT, kind: 'tile', name: 'Pièce T (violet)', enabled: true, params: { tileIndex: 12, color: '#aa00ff', intensity: 0.9 }, pos: { x: 960, y: 240 } },
        { id: pieceSquare, kind: 'tile', name: 'Pièce O (jaune)', enabled: true, params: { tileIndex: 13, color: '#ffff00', intensity: 0.9 }, pos: { x: 960, y: 320 } },
        { id: moveDown, kind: 'math_add', name: 'Descendre', enabled: true, params: {}, pos: { x: 740, y: 280 } },
        { id: checkCollision, kind: 'compare_eq', name: 'Collision?', enabled: true, params: {}, pos: { x: 740, y: 360 } },
        { id: mergePiece, kind: 'sequence', name: 'Fusionner', enabled: true, params: {}, pos: { x: 960, y: 400 } },
        { id: clearLines, kind: 'pulse', name: 'Ligne complète', enabled: true, params: { baseColor: '#ffffff', targetColor: '#00ff00', fromIntensity: 0.5, toIntensity: 1, speed: 3 }, pos: { x: 1180, y: 400 } },
        { id: renderGrid, kind: 'fill', name: 'Rafraîchir', enabled: true, params: { color: '#0a0a0f', intensity: 0.1, mask: 'all', seconds: 0.05 }, pos: { x: 520, y: 480 } },
        { id: waitTick, kind: 'wait', name: 'Attente tick', enabled: true, params: { seconds: 0.5 }, pos: { x: 520, y: 560 } },
        { id: checkGameOver, kind: 'compare_gt', name: 'Game Over?', enabled: true, params: {}, pos: { x: 740, y: 560 } },
        { id: gameOverFill, kind: 'fill', name: 'Game Over Rouge', enabled: true, params: { color: '#ff0000', intensity: 0.8, mask: 'all', seconds: 2 }, pos: { x: 960, y: 560 } },
        { id: scorePulse, kind: 'pulse', name: 'Pulse Score', enabled: true, params: { baseColor: '#00ff88', targetColor: '#88ffaa', fromIntensity: 0.3, toIntensity: 0.9, speed: 4 }, pos: { x: 1180, y: 280 } },
        { id: rotateCheck, kind: 'logic_and', name: 'Rotation OK?', enabled: true, params: {}, pos: { x: 1180, y: 200 } },
        { id: inputHandler, kind: 'on_click', name: 'Input Joueur', enabled: true, params: { target: 'any' }, pos: { x: 1400, y: 300 } },
        { id: timerEvent, kind: 'on_timer', name: 'Timer Jeu', enabled: true, params: { interval: 500 }, pos: { x: 1400, y: 380 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: tetrisMainId },
        // Flux principal du jeu (ces nœuds sont "internes" au jeu)
        { id: makeId(), from: tetrisMainId, to: bgFill },
        { id: makeId(), from: bgFill, to: borderTiles },
        { id: makeId(), from: borderTiles, to: initGrid },
        { id: makeId(), from: initGrid, to: gameLoop },
        { id: makeId(), from: gameLoop, to: spawnPiece },
        { id: makeId(), from: spawnPiece, to: pieceI },
        { id: makeId(), from: spawnPiece, to: pieceL },
        { id: makeId(), from: spawnPiece, to: pieceT },
        { id: makeId(), from: spawnPiece, to: pieceSquare },
        { id: makeId(), from: pieceI, to: moveDown },
        { id: makeId(), from: pieceL, to: moveDown },
        { id: makeId(), from: pieceT, to: moveDown },
        { id: makeId(), from: pieceSquare, to: moveDown },
        { id: makeId(), from: moveDown, to: checkCollision },
        { id: makeId(), from: checkCollision, to: mergePiece },
        { id: makeId(), from: mergePiece, to: clearLines },
        { id: makeId(), from: clearLines, to: renderGrid },
        { id: makeId(), from: renderGrid, to: waitTick },
        { id: makeId(), from: waitTick, to: checkGameOver },
        { id: makeId(), from: checkGameOver, to: gameLoop },
        { id: makeId(), from: checkGameOver, to: gameOverFill },
        // Bonus score
        { id: makeId(), from: clearLines, to: scorePulse },
        // Input et rotation
        { id: makeId(), from: inputHandler, to: rotateCheck },
        { id: makeId(), from: timerEvent, to: moveDown },
      ];
    } else if (template === 'memory') {
      // Jeu de mémoire type Simon
      const seqStart = makeId();
      const tile1 = makeId();
      const tile2 = makeId();
      const tile3 = makeId();
      const tile4 = makeId();
      const wait1 = makeId();
      const wait2 = makeId();
      const wait3 = makeId();
      const wait4 = makeId();
      const pulse1 = makeId();
      const pulse2 = makeId();
      const pulse3 = makeId();
      const pulse4 = makeId();
      
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 440 } },
        // Séquence de démarrage
        { id: seqStart, kind: 'sequence', name: 'Séquence', enabled: true, params: {}, pos: { x: 420, y: 440 } },
        // Attentes entre les flashs
        { id: wait1, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 760, y: 80 } },
        { id: wait2, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 760, y: 320 } },
        { id: wait3, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 760, y: 560 } },
        { id: wait4, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 760, y: 800 } },
        // Dalles à mémoriser (coins)
        { id: tile1, kind: 'tile', name: 'Coin HG', enabled: true, params: { tileIndex: 0, color: '#ff0000', intensity: 0.9 }, pos: { x: 1100, y: 80 } },
        { id: tile2, kind: 'tile', name: 'Coin HD', enabled: true, params: { tileIndex: 5, color: '#00ff00', intensity: 0.9 }, pos: { x: 1100, y: 320 } },
        { id: tile3, kind: 'tile', name: 'Coin BG', enabled: true, params: { tileIndex: 36, color: '#0000ff', intensity: 0.9 }, pos: { x: 1100, y: 560 } },
        { id: tile4, kind: 'tile', name: 'Coin BD', enabled: true, params: { tileIndex: 41, color: '#ffff00', intensity: 0.9 }, pos: { x: 1100, y: 800 } },
        // Pulsations pour l'effet visuel
        { id: pulse1, kind: 'pulse', name: 'Pulse R', enabled: true, params: { baseColor: '#ff0000', targetColor: '#ff6666', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 1440, y: 80 } },
        { id: pulse2, kind: 'pulse', name: 'Pulse V', enabled: true, params: { baseColor: '#00ff00', targetColor: '#66ff66', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 1440, y: 320 } },
        { id: pulse3, kind: 'pulse', name: 'Pulse B', enabled: true, params: { baseColor: '#0000ff', targetColor: '#6666ff', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 1440, y: 560 } },
        { id: pulse4, kind: 'pulse', name: 'Pulse J', enabled: true, params: { baseColor: '#ffff00', targetColor: '#ffff66', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 1440, y: 800 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: seqStart },
        // Séquence: R -> pause -> V -> pause -> B -> pause -> J
        { id: makeId(), from: seqStart, to: tile1 },
        { id: makeId(), from: tile1, to: wait1 },
        { id: makeId(), from: wait1, to: tile2 },
        { id: makeId(), from: tile2, to: wait2 },
        { id: makeId(), from: wait2, to: tile3 },
        { id: makeId(), from: tile3, to: wait3 },
        { id: makeId(), from: wait3, to: tile4 },
        // Pulsations liées aux dalles
        { id: makeId(), from: tile1, to: pulse1 },
        { id: makeId(), from: tile2, to: pulse2 },
        { id: makeId(), from: tile3, to: pulse3 },
        { id: makeId(), from: tile4, to: pulse4 },
      ];
    }
    
    if (template === 'tetris-blueprint') {
      const tickId = makeId();
      const tetrisId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 200 } },
        { id: tickId, kind: 'on_tick', name: 'Tick Jeu (500ms)', enabled: true, params: { intervalMs: 500 }, pos: { x: 320, y: 200 } },
        { id: tetrisId, kind: 'game_tetris_block', name: 'Tetris Blocs', enabled: true, params: { speed: 500, cols: 6, rows: 7 }, pos: { x: 560, y: 200 } },
      ];
      initialEdges = [
        { id: makeId(), from: tickId, to: tetrisId },
      ];
    }

    const provisionalGame: GameDoc = {
      id: provisionalId,
      name: gameName,
      tileCount: 42,
      nodes: initialNodes,
      edges: initialEdges,
      pythonCode: PYTHON_TEMPLATE,
    };

    const dbId = await createDbGame(gameName, provisionalGame);
    if (!dbId) {
      setStatus('Création DB impossible');
      return;
    }

    const newGame: GameDoc = { ...provisionalGame, id: dbId };
    commit((cur) => ({
      ...cur,
      games: [...cur.games, newGame],
      activeGameId: dbId,
      selectedNodeId: initialNodes[0]?.id ?? null,
    }));
    setDirty(false);
    setStatus(`Jeu créé: ${gameName}`);
    // Lance le tuto ancré (coachmarks) automatiquement la 1re fois seulement ;
    // ensuite il reste relançable via le bouton 🎓 de la barre d'outils.
    try {
      if (!window.localStorage.getItem('crg_editor_tour_seen')) {
        setTourOpen(true);
        window.localStorage.setItem('crg_editor_tour_seen', '1');
      }
    } catch { setTourOpen(true); }
    setModal(null);
    setNewProjectName('');
  };

  useEffect(() => {
    if (isTeacher !== true) return;
    let cancelled = false;
    const load = async () => {
      setDbLoading(true);
      try {
        const res = await fetch('/api/games', { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json || json.ok !== true || !Array.isArray(json.games)) {
          return;
        }

        const rows = json.games as Array<{ id: string; name: string; kind: string; config: unknown }>;
        const editorRows = rows.filter((r) => String(r.kind) === 'editor');

        const loaded: GameDoc[] = editorRows
          .map((r) => {
            const cfg = parseGameConfig(r.config);
            if (!cfg) return null;
            return {
              id: String(r.id),
              name: String(r.name),
              tileCount: cfg.tileCount,
              icon: cfg.icon,
              difficulty: cfg.difficulty,
              description: cfg.description,
              bgColor: cfg.bgColor,
              accentColor: cfg.accentColor,
              nodes: cfg.nodes,
              edges: cfg.edges,
              uiLayout: cfg.uiLayout,
              pythonCode: cfg.pythonCode,
            } satisfies GameDoc;
          })
          .filter(Boolean) as GameDoc[];

        if (cancelled) return;

        if (loaded.length > 0) {
          setEditor({
            games: loaded,
            activeGameId: loaded[0].id,
            selectedNodeId: loaded[0].nodes[0]?.id ?? null,
          });
          editorRef.current = {
            games: loaded,
            activeGameId: loaded[0].id,
            selectedNodeId: loaded[0].nodes[0]?.id ?? null,
          };
          setHistory({ past: [], future: [] });
          setDirty(false);
          setStatus('Jeux chargés');
          return;
        }

        // Create default games if none exist
        await createGame('Simon', 'memory');
        await createGame('Tetris', 'tetris');
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  const saveActiveGame = async () => {
    if (!activeGame) return;
    const ok = await saveDbGame(activeGame);
    if (!ok) {
      setStatus('Sauvegarde impossible');
      return;
    }
    setDirty(false);
    setStatus('Sauvegardé ');
  };

  // Auto-save every 3 seconds when dirty
  useEffect(() => {
    if (!dirty || !activeGame) return;
    const timer = setTimeout(() => {
      void saveDbGame(activeGame).then((ok) => {
        if (ok) {
          setDirty(false);
          setStatus('Auto-sauvegardé ');
        }
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [dirty, activeGame]);

  const deleteActiveGame = async () => {
    if (!activeGame) return;
    const deletedId = activeGame.id;

    // ── Optimistic delete: met à jour l'UI IMMÉDIATEMENT ─────────────────────
    // Annule l'auto-save en cours avant qu'il parte (évite le délai 3s+requête)
    setDirty(false);
    setHistory({ past: [], future: [] });
    setEditor((cur) => {
      const nextGames = cur.games.filter((g) => g.id !== deletedId);
      const nextActive = nextGames[0] ?? null;
      return {
        games: nextGames,
        activeGameId: nextActive?.id ?? null,
        selectedNodeId: nextActive?.nodes[0]?.id ?? null,
        expandedGameNodeId: undefined,
        visibleNodeIds: undefined,
      };
    });
    setStatus('Jeu supprimé ');

    // DB en arrière-plan (non bloquant pour l'UI)
    void deleteDbGame(deletedId).then((ok) => {
      if (!ok) setStatus('Avertissement : suppression DB incomplète');
    });
  };

  const addNode = (kind: EditorNodeKind, pos?: { x: number; y: number }): string | null => {
    if (!activeGameId) {
      setStatus("Crée un jeu avant d'ajouter des noeuds");
      return null;
    }
    const nextId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        const basePos = pos ?? { x: 80 + g.nodes.length * 28, y: 80 + g.nodes.length * 22 };
        const spec = NODE_CATALOG.find((x) => x.kind === kind);
        const title = spec?.title ?? kind;
        const params = spec?.defaults ?? {};
        const base: Omit<EditorNode, 'pos'> = { id: nextId, kind, name: `${title} ${g.nodes.length + 1}`, enabled: true, params };
        const nodeWithPos: EditorNode = { ...base, pos: basePos };
        return { ...g, nodes: [...g.nodes, nodeWithPos] };
      });
      return { ...cur, games: nextGames, selectedNodeId: nextId };
    });
    setStatus('Noeud ajouté');
    // Écarte les voisins du nouveau bloc une fois rendu (physique anti-superposition)
    requestAnimationFrame(() => resolveOverlaps(nextId));
    return nextId;
  };

  const addNodeForGame = (
    gameId: string,
    kind: EditorNodeKind,
    pos?: { x: number; y: number },
    overrides?: { name?: string; params?: Record<string, unknown> },
  ): string => {
    const nextId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== gameId) return g;
        const basePos = pos ?? { x: 80 + g.nodes.length * 28, y: 80 + g.nodes.length * 22 };
        const spec = NODE_CATALOG.find((x) => x.kind === kind);
        const title = spec?.title ?? kind;
        const params = { ...(spec?.defaults ?? {}), ...(overrides?.params ?? {}) };
        const name = overrides?.name && overrides.name.trim().length > 0 ? overrides.name.trim() : `${title} ${g.nodes.length + 1}`;
        const base: Omit<EditorNode, 'pos'> = { id: nextId, kind, name, enabled: true, params };
        const nodeWithPos: EditorNode = { ...base, pos: basePos };
        return { ...g, nodes: [...g.nodes, nodeWithPos] };
      });
      return { ...cur, games: nextGames, activeGameId: gameId, selectedNodeId: nextId };
    });
    return nextId;
  };

  const removeNodeById = (nodeId: string) => {
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.filter((nd) => nd.id !== nodeId),
          edges: g.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
        };
      });
      const nextSelectedId = cur.selectedNodeId === nodeId ? null : cur.selectedNodeId;
      return { ...cur, games: nextGames, selectedNodeId: nextSelectedId };
    });
    setStatus('Nœud supprimé');
  };

  const renameActiveGame = (name: string) => {
    if (!activeGameId) return;
    commit((cur) => ({
      ...cur,
      games: cur.games.map((g) => (g.id === cur.activeGameId ? { ...g, name } : g)),
    }));
  };

  const updateActiveGameMeta = (patch: Partial<Pick<GameDoc, 'icon' | 'difficulty' | 'description' | 'bgColor' | 'accentColor' | 'tileCount' | 'maxPlayers' | 'gameMode'>>) => {
    if (!activeGameId) return;
    commit((cur) => ({
      ...cur,
      games: cur.games.map((g) => (g.id === cur.activeGameId ? { ...g, ...patch } : g)),
    }));
  };

  const [dragBaseSnapshot, setDragBaseSnapshot] = useState<EditorSnapshot | null>(null);
  const [dragDidMove, setDragDidMove] = useState<boolean>(false);

  // Recherche catalogue nœuds
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  const moveNode = (nodeId: string, dx: number, dy: number) => {
    setEditor((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, pos: { x: n.pos.x + dx, y: n.pos.y + dy } } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  // ── Physique anti-superposition : espace les blocs avec un padding minimal ──
  // Résout les collisions AABB par séparation itérative. Le nœud "ancré" (qu'on
  // vient de poser/déplacer) reste en place, ses voisins s'écartent pour faire place.
  const NODE_GAP = 28;
  const resolveOverlaps = (anchorId?: string) => {
    const root = bpContentRef.current;
    if (!root) return;
    const cur = editorRef.current;
    const game = cur.games.find((g) => g.id === cur.activeGameId);
    if (!game || game.nodes.length < 2) return;

    const sizes = new Map<string, { w: number; h: number }>();
    root.querySelectorAll('.bp-node[data-nodeid]').forEach((node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute('data-nodeid');
      if (id) sizes.set(id, { w: el.offsetWidth || 300, h: el.offsetHeight || 130 });
    });

    const items = game.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, w: sizes.get(n.id)?.w ?? 300, h: sizes.get(n.id)?.h ?? 130 }));
    let changed = false;
    for (let iter = 0; iter < 20; iter++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
          const dy = (a.y + a.h / 2) - (b.y + b.h / 2);
          const penX = (a.w / 2 + b.w / 2 + NODE_GAP) - Math.abs(dx);
          const penY = (a.h / 2 + b.h / 2 + NODE_GAP) - Math.abs(dy);
          if (penX <= 0 || penY <= 0) continue; // pas de chevauchement
          moved = true; changed = true;
          if (penX < penY) {
            const push = (dx >= 0 ? 1 : -1) * penX;
            if (a.id === anchorId) b.x -= push;
            else if (b.id === anchorId) a.x += push;
            else { a.x += push / 2; b.x -= push / 2; }
          } else {
            const push = (dy >= 0 ? 1 : -1) * penY;
            if (a.id === anchorId) b.y -= push;
            else if (b.id === anchorId) a.y += push;
            else { a.y += push / 2; b.y -= push / 2; }
          }
        }
      }
      if (!moved) break;
    }
    if (!changed) return;

    const SNAP = 8;
    const pos = new Map(items.map((it) => [it.id, { x: Math.max(0, Math.round(it.x / SNAP) * SNAP), y: Math.max(0, Math.round(it.y / SNAP) * SNAP) }]));
    setEditor((c) => ({
      ...c,
      games: c.games.map((g) => g.id !== c.activeGameId ? g : { ...g, nodes: g.nodes.map((n) => pos.has(n.id) ? { ...n, pos: pos.get(n.id)! } : n) }),
    }));
  };

  const assignSelectedTileToNode = (tileIndex: number) => {
    const safe = Math.max(0, Math.min(tileCount - 1, Math.round(tileIndex)));
    setSelectedTileIndex(safe);

    if (!selectedNodeId) return;
    if (!selectedNode) return;
    if (selectedNode.kind !== 'tile') return;
    updateSelectedParams({ tileIndex: safe });
    setStatus(`Dalle D${safe + 1} assignée`);
  };

  const updateSelectedNode = (patch: Partial<EditorNode>) => {
    if (!selectedNodeId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === cur.selectedNodeId ? { ...n, ...patch } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  const updateSelectedParams = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === cur.selectedNodeId ? { ...n, params: { ...n.params, ...patch } } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  function getUiComponents(): GameUIComponent[] {
    return activeGame?.uiComponents ?? [];
  }

  /** Re-layout : espace les nœuds du jeu actif en colonnes selon la profondeur BFS */
  /** Zoom/pan pour que tous les nœuds du jeu actif soient visibles */
  function fitNodesToView() {
    if (!activeGame || activeGame.nodes.length === 0) return;
    const bpEl = document.querySelector('.bp') as HTMLElement | null;
    if (!bpEl) return;
    const rect = bpEl.getBoundingClientRect();
    const W = rect.width || 800;
    const H = rect.height || 500;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeGame.nodes.forEach((n) => {
      const x = n.pos?.x ?? 0;
      const y = n.pos?.y ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + 300 > maxX) maxX = x + 300;
      if (y + 180 > maxY) maxY = y + 180;
    });
    const PAD = 60;
    const graphW = maxX - minX + PAD * 2;
    const graphH = maxY - minY + PAD * 2;
    const zoom = Math.max(0.1, Math.min(1.4, Math.min(W / graphW, H / graphH)));
    setGraphZoom(zoom);
    setGraphPan({
      x: (W - graphW * zoom) / 2 - (minX - PAD) * zoom,
      y: (H - graphH * zoom) / 2 - (minY - PAD) * zoom,
    });
    setStatus(`Fit - ${Math.round(zoom * 100)}%`);
  }

  function autoLayoutNodes() {
    if (!activeGameId || !activeGame) return;
    const nodes = activeGame.nodes;
    const edges = activeGame.edges;
    if (nodes.length === 0) return;

    const NODE_W = 340;  // largeur nœud + gap horizontal
    const NODE_H = 240;  // hauteur nœud + gap vertical

    // BFS depuis tous les nœuds événements pour calculer la profondeur (colonne)
    const depth: Record<string, number> = {};
    const queue: string[] = [];
    nodes.forEach((n) => {
      if (['event_begin', 'on_timer', 'on_click', 'on_tick', 'on_tile_click', 'on_ui_click'].includes(n.kind)) {
        depth[n.id] = 0;
        queue.push(n.id);
      }
    });
    // Si aucun nœud racine, partir du premier nœud
    if (queue.length === 0 && nodes.length > 0) {
      depth[nodes[0].id] = 0;
      queue.push(nodes[0].id);
    }

    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const curDepth = depth[cur] ?? 0;
      edges.forEach((e) => {
        if (e.from === cur && depth[e.to] === undefined) {
          depth[e.to] = curDepth + 1;
          queue.push(e.to);
        }
      });
    }
    // Nœuds sans profondeur → les mettre à la fin
    nodes.forEach((n) => {
      if (depth[n.id] === undefined) depth[n.id] = 99;
    });

    // Grouper par colonne
    const cols: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const col = depth[n.id]!;
      if (!cols[col]) cols[col] = [];
      cols[col].push(n.id);
    });

    // Calculer les nouvelles positions
    const colNums = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const newPositions: Record<string, { x: number; y: number }> = {};
    colNums.forEach((col, ci) => {
      const nodeIds = cols[col];
      const totalH = nodeIds.length * NODE_H;
      const startY = 80;
      nodeIds.forEach((id, ni) => {
        newPositions[id] = { x: 80 + ci * NODE_W, y: startY + ni * NODE_H };
      });
    });

    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => ({
            ...n,
            pos: newPositions[n.id] ?? n.pos,
          })),
        };
      });
      return { ...cur, games: nextGames };
    });
    // Recentrer la vue
    setGraphPan({ x: 120, y: 80 });
    setGraphZoom(0.7);
    setStatus('Nœuds réorganisés');
    setTimeout(() => void saveActiveGame(), 200);
  }

  // Mise à jour des refs stables (utilisées dans le keydown handler global)
  saveActiveGameRef.current = saveActiveGame;
  fitNodesToViewRef.current = fitNodesToView;
  autoLayoutNodesRef.current = autoLayoutNodes;

  function addUiComponent(kind: UICompKind) {
    if (!activeGameId) return;
    const newComp: GameUIComponent = {
      id: `ui_${Date.now().toString(36)}`,
      kind,
      label: kind === 'button' ? 'Bouton' : kind === 'slider' ? 'Slider' : kind === 'label' ? 'Texte' : kind === 'counter' ? 'Score' : 'Timer',
      color: '#4361ee',
      min: 0,
      max: 100,
      step: 1,
      value: 0,
    };
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return { ...g, uiComponents: [...(g.uiComponents ?? []), newComp] };
      });
      return { ...cur, games: nextGames };
    });
    setTimeout(() => void saveActiveGame(), 100);
  }

  function removeUiComponent(id: string) {
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return { ...g, uiComponents: (g.uiComponents ?? []).filter((c) => c.id !== id) };
      });
      return { ...cur, games: nextGames };
    });
    setTimeout(() => void saveActiveGame(), 100);
  }

  function updateUiComponent(id: string, patch: Partial<GameUIComponent>) {
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return { ...g, uiComponents: (g.uiComponents ?? []).map((c) => c.id === id ? { ...c, ...patch } : c) };
      });
      return { ...cur, games: nextGames };
    });
  }

  if (isTeacher === null) {
    return (
      <main className="editeur stage">
        <div className="ue">
          <aside className="ue__left glass">
            <div className="panelhead">
              <strong>Chargement</strong>
              <span className="panelhead__meta">Vérification…</span>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  if (isTeacher === false) {
    return (
      <main className="editeur stage" style={{ display: 'grid', placeItems: 'center' }}>
        <div
          className="glass"
          style={{
            width: 'min(720px, calc(100vw - 28px))',
            padding: 22,
            borderRadius: 22,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>Enseignant requis</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>Accès refusé</div>
            <div style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.6, marginTop: 4 }}>
              Cette page est réservée aux enseignants.
              <br />
              Connecte-toi en tant qu'enseignant depuis <a href="/jeux">/jeux</a>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <a className="btn btn--hero" href="/jeux" style={{ textDecoration: 'none' }}>
              Aller à /jeux
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Étapes du tutoriel ancré (coachmarks) : explique la création d'un jeu via les
  // blocs (Nœuds) ET le designer d'interface. Chaque `before` révèle la cible.
  const tourSteps: CoachStep[] = [
    {
      title: 'Bienvenue dans l\'éditeur de jeux 🎮',
      text: 'Ce petit tutoriel montre comment créer un jeu de A à Z. Cliquez sur « Suivant » pour voir chaque étape, ou « Passer le tuto » à tout moment.',
    },
    {
      selector: '[data-tour="editor-new"]',
      title: '1. Créer un jeu',
      text: 'Tout commence ici : « Nouveau jeu » crée un projet. Vous pouvez partir d\'un modèle ou d\'une page blanche.',
    },
    {
      selector: '[data-tour="editor-tabs"]',
      title: '2. Trois modes de création',
      text: 'Nœuds = logique en blocs reliés · Python = code low-code · Interface = designer visuel. On peut combiner les trois.',
    },
    {
      selector: '[data-tour="editor-blocs"]',
      title: '3. Les blocs (Nœuds)',
      text: 'Double-cliquez (ou clic droit) sur le canevas pour ajouter un bloc, puis reliez les points pour créer la logique : démarrer → remplir une dalle → attendre → boucler…',
      before: () => setEditorTab('canvas'),
    },
    {
      selector: '[data-tour="editor-ui"]',
      title: '4. Le designer d\'interface',
      text: 'Glissez des composants (boutons, sliders, score, minuteur, diagramme CIE…), placez-les sur l\'écran et liez-les à des variables. C\'est ce que verra le joueur.',
      before: () => setEditorTab('ui'),
    },
    {
      selector: '[data-tour="editor-play"]',
      title: '5. Tester sur les dalles',
      text: 'Activez l\'aperçu pour envoyer votre jeu sur les 42 dalles LED en temps réel et vérifier le rendu.',
      before: () => setEditorTab('canvas'),
    },
    {
      title: 'Prêt à jouer ! ✨',
      text: 'Enregistrez votre jeu : il apparaîtra dans la page « Jeux » comme un jeu natif, jouable par tous. Relancez ce tuto à tout moment via le bouton 🎓.',
    },
  ];

  return (
    <main className="editeur stage">
      <Coachmarks open={tourOpen} steps={tourSteps} onClose={() => setTourOpen(false)} finishLabel="Commencer" />
      <div className="ue">
        <aside className="ue__left" style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
            <div className="panelhead" style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '10px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gamepad2 size={14} color="#4361ee" />
                <strong style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(10,12,18,0.55)' }}>Explorateur</strong>
              </div>
            </div>

            {/* Actions toolbar */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                className="g-btn g-btn--sm g-btn--accent"
                data-tour="editor-new"
                disabled={dbLoading}
                onClick={() => setModal({ type: 'create-project' })}
                style={{ flex: 1 }}
              >
                <FolderPlus size={13} />
                <span>{dbLoading ? '…' : 'Nouveau jeu'}</span>
              </button>
              <button
                className="g-btn g-btn--sm"
                disabled={!activeGame || dbLoading}
                onClick={() => void saveActiveGame()}
                title="Sauvegarder le jeu actif"
                style={{ width: 32, padding: 0 }}
              >
                {dirty ? <Save size={13} color="#f97316" /> : <Check size={13} color="#059669" />}
              </button>
              <button
                className="g-btn g-btn--sm g-btn--danger"
                disabled={!activeGame || dbLoading}
                onClick={() => activeGame && setModal({ type: 'confirm-delete', gameId: activeGame.id, gameName: activeGame.name })}
                title="Supprimer le jeu actif"
                style={{ width: 32, padding: 0 }}
              >
                <Trash2 size={13} />
              </button>
              <button
                className="g-btn g-btn--sm"
                onClick={() => setTourOpen(true)}
                title="Lancer le tutoriel : comment créer un jeu"
                style={{ width: 32, padding: 0 }}
              >
                <GraduationCap size={13} color="#7c3aed" />
              </button>
            </div>

            {/* Liste des jeux - scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 8px' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                {games.length === 0 && (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>
                    <Gamepad2 size={24} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                    <div>Aucun jeu</div>
                    <div style={{ fontSize: 10, marginTop: 4 }}>Créez votre premier projet</div>
                  </div>
                )}
                {games.map((g) => {
                  const GIcon = GAME_ICON_MAP[g.icon ?? 'Lightbulb'] ?? Lightbulb;
                  return (
                    <button
                      key={g.id}
                      className={g.id === activeGameId ? 'list__item list__item--active' : 'list__item'}
                      onClick={() => {
                        commit((cur) => ({ ...cur, activeGameId: g.id, selectedNodeId: g.nodes[0]?.id ?? null }));
                        setStatus('Jeu sélectionné');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10 }}
                    >
                        <GIcon size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span className="list__title" style={{ flex: 1 }}>{g.name}</span>
                        <span className="list__meta" style={{ fontSize: 10 }}>{g.nodes.length}n · {g.tileCount ?? 42}d</span>
                    </button>
                  );
                })}
                </div>

                {activeGame ? (
                  <div className="g-card" style={{ marginTop: 12, padding: 14, borderRadius: 14, display: 'grid', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="g-label">Nom du projet</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="g-input"
                          value={activeGame.name}
                          onChange={(e) => renameActiveGame(e.target.value)}
                          onBlur={() => void saveActiveGame()}
                          style={{ flex: 1, height: 36, fontSize: 13 }}
                        />
                        <button 
                          className="g-btn g-btn--sm g-btn--icon"
                          onClick={() => void saveActiveGame()}
                          title="Sauvegarder"
                          style={{ width: 36, height: 36 }}
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="g-label">Description</span>
                      <textarea
                        className="g-input"
                        value={activeGame.description ?? ''}
                        onChange={(e) => updateActiveGameMeta({ description: e.target.value })}
                        onBlur={() => void saveActiveGame()}
                        placeholder="Décrivez le jeu, ses règles, son objectif…"
                        rows={4}
                        style={{ minHeight: 84, resize: 'vertical', fontSize: 13, lineHeight: 1.5, padding: '10px 12px', fontFamily: 'inherit' }}
                      />
                    </label>

                    <div>
                      <span className="g-label" style={{ display: 'block', marginBottom: 6 }}>Icône & couleurs</span>
                      {(() => {
                        const curIcon = activeGame.icon ?? 'Lightbulb';
                        const CurIcon = GAME_ICON_MAP[curIcon] ?? Lightbulb;
                        const bg = activeGame.bgColor ?? '#1a1040';
                        const accent = activeGame.accentColor ?? '#a78bfa';
                        const grad = `linear-gradient(135deg, ${bg}, ${accent})`;
                        return (
                          <div style={{ position: 'relative' }}>
                            {/* Aperçu repliable : juste l'icône, clic pour personnaliser */}
                            <button
                              onClick={() => setIconPickerOpen((o) => !o)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 8, borderRadius: 12, border: '1px solid rgba(0,0,0,0.09)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              <span style={{ width: 44, height: 44, borderRadius: 11, background: grad, display: 'grid', placeItems: 'center', boxShadow: `0 3px 10px ${accent}44`, flexShrink: 0 }}>
                                <CurIcon size={22} color="#fff" />
                              </span>
                              <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: 600, color: '#444' }}>Personnaliser l&apos;icône et le dégradé</span>
                              <ChevronDown size={16} color="#999" style={{ transform: iconPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                            </button>

                            {iconPickerOpen && (
                              <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(250,250,252,0.95)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                                {/* Dégradé : 2 couleurs */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                  <label style={{ display: 'grid', gap: 4 }}>
                                    <span className="g-label" style={{ fontSize: 10 }}>Couleur 1 (fond)</span>
                                    <input type="color" value={bg} onChange={(e) => updateActiveGameMeta({ bgColor: e.target.value })} onBlur={() => void saveActiveGame()} style={{ width: '100%', height: 30, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                                  </label>
                                  <label style={{ display: 'grid', gap: 4 }}>
                                    <span className="g-label" style={{ fontSize: 10 }}>Couleur 2 (accent)</span>
                                    <input type="color" value={accent} onChange={(e) => updateActiveGameMeta({ accentColor: e.target.value })} onBlur={() => void saveActiveGame()} style={{ width: '100%', height: 30, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                                  </label>
                                </div>
                                {/* Grille d'icônes scrollable */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
                                  {GAME_ICON_NAMES.map((iconName) => {
                                    const IconComp = GAME_ICON_MAP[iconName];
                                    const isActive = curIcon === iconName;
                                    return (
                                      <button
                                        key={iconName}
                                        onClick={() => { updateActiveGameMeta({ icon: iconName }); void saveActiveGame(); }}
                                        title={iconName}
                                        style={{ aspectRatio: '1', borderRadius: 8, border: isActive ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.07)', background: isActive ? grad : '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all 0.12s' }}
                                      >
                                        <IconComp size={16} color={isActive ? '#fff' : '#888'} />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <span className="g-label" style={{ display: 'block', marginBottom: 6 }}>Difficulté</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {([1, 2, 3, 4, 5] as GameDifficulty[]).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => { updateActiveGameMeta({ difficulty: lvl }); void saveActiveGame(); }}
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none',
                              cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center',
                              transition: 'transform 0.12s',
                            }}
                            title={`Difficulté ${lvl}`}
                          >
                            <Star size={18} fill={lvl <= (activeGame.difficulty ?? 1) ? '#fbbf24' : 'none'} color={lvl <= (activeGame.difficulty ?? 1) ? '#f59e0b' : '#ddd'} />
                          </button>
                        ))}
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 6, alignSelf: 'center', fontWeight: 600 }}>
                          {activeGame.difficulty ?? 1}/5
                        </span>
                      </div>
                    </div>

                    {/* Mode multijoueur */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label" style={{ fontSize: 11 }}>Mode</span>
                        <select
                          className="g-input"
                          style={{ height: 36 }}
                          value={activeGame.gameMode ?? 'solo'}
                          onChange={(e) => { updateActiveGameMeta({ gameMode: e.target.value as any }); void saveActiveGame(); }}
                        >
                          <option value="solo">Solo</option>
                          <option value="coop">Coop</option>
                          <option value="versus">Versus</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label" style={{ fontSize: 11 }}>Joueurs max</span>
                        <input
                          type="number" min={1} max={8} step={1}
                          className="g-input"
                          style={{ height: 36 }}
                          value={activeGame.maxPlayers ?? 1}
                          onChange={(e) => { updateActiveGameMeta({ maxPlayers: Number(e.target.value) }); void saveActiveGame(); }}
                        />
                      </label>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="g-label">Dalles cibles</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{activeGame.tileCount ?? 42}</span>
                      </div>
                      <input
                        type="range" className="g-slider g-slider--accent" min={1} max={42} step={1}
                        value={activeGame.tileCount ?? 42}
                        onChange={(e) => updateActiveGameMeta({ tileCount: Number(e.target.value) })}
                        onMouseUp={() => void saveActiveGame()}
                        style={{ width: '100%', ['--pct' as any]: `${((activeGame.tileCount ?? 42) / 42) * 100}%` }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 2 }}>
                        <span>1</span><span>21</span><span>42</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2, fontSize: 11 }}>
                      <span className="g-badge" style={{ fontSize: 10 }}>{activeGame.nodes.length} nœuds</span>
                      <span className="g-badge" style={{ fontSize: 10, background: 'rgba(6,214,160,0.1)', color: '#06d6a0', borderColor: 'rgba(6,214,160,0.15)' }}>{activeGame.edges.length} connexions</span>
                      <span className="g-badge" style={{ fontSize: 10, background: 'rgba(255,165,0,0.1)', color: '#e88a1a', borderColor: 'rgba(255,165,0,0.15)' }}>{activeGame.tileCount ?? 42} dalles</span>
                    </div>

                    <p style={{ fontSize: 10, color: '#aaa', margin: '4px 0 0', lineHeight: 1.4 }}>
                      32 canaux LED par dalle · Couleurs selon COULEURS.md
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="divider" />

              <div className="panelsection">
                <div className="panelsection__head">
                  <div className="panelsection__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Boxes size={14} style={{ color: '#06d6a0' }} />
                    <span>Nœuds</span>
                  </div>
                  <button
                    className="g-btn g-btn--sm g-btn--success"
                    disabled={!activeGameId}
                    onClick={() => {
                      const id = addNode('fill');
                      if (id) setStatus('Noeud ajouté');
                    }}
                  >
                    <Plus size={14} />
                    <span>Ajouter</span>
                  </button>
                </div>

                {/* Barre de recherche catalogue */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Rechercher nœud..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      style={{ width: '100%', height: 34, paddingLeft: 32, paddingRight: 10, fontSize: 12, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#fff' }}
                    />
                    {catalogSearch && (
                      <button
                        onClick={() => setCatalogSearch('')}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                      >
                        <X size={12} color="#888" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="list panelsection__list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {!activeGame ? (
                    <div className="muted">Crée un jeu pour commencer.</div>
                  ) : activeGame.nodes.length === 0 ? (
                    <div className="muted">Aucun noeud. Ajoute un bloc (clic droit) ou double clic pour "Remplissage".</div>
                  ) : (
                    (() => {
                      const q = catalogSearch.trim().toLowerCase();
                      const filtered = q
                        ? activeGame.nodes.filter((n) =>
                            `${n.name} ${labelNodeKind(n.kind)} ${n.kind}`.toLowerCase().includes(q)
                          )
                        : activeGame.nodes;
                      if (filtered.length === 0 && q) {
                        return <div className="muted" style={{ padding: '12px 14px' }}>Aucun nœud trouvé.</div>;
                      }
                      return filtered.map((n) => (
                        <button
                          key={n.id}
                          className={n.id === selectedNodeId ? 'list__item list__item--active' : 'list__item'}
                          onClick={() => commit((cur) => ({ ...cur, selectedNodeId: n.id }))}
                        >
                          <span className="list__title">{n.name}</span>
                          <span className="list__meta">{labelNodeKind(n.kind)}</span>
                        </button>
                      ));
                    })()
                  )}
                </div>
              </div>

            <div className="divider" />
          </aside>

          <section
            className="ue__center"
            onPointerMove={(e) => {
              if (!resizing.active) return;
              const dy = e.clientY - resizing.y;
              const next = Math.max(220, Math.min(620, resizing.start + dy));
              setViewportHeight(next);
            }}
            onPointerUp={() => {
              setResizing({ active: false, y: 0, start: viewportHeight });
            }}
          >
            <div className="ue__viewport" style={{ height: viewportHeight, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="panelhead" style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Eye size={16} color="#1a1a1a" />
                  <strong style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>Aperçu</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Indicateur statut API supervision */}
                  <div
                    title={hwReachable === 'ok' ? 'Supervision API joignable' : hwReachable === 'error' ? 'Supervision API inaccessible - vérifiez SUPERVISION_API_URL' : 'Vérification...'}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: hwReachable === 'ok' ? 'rgba(6,214,160,0.12)' : hwReachable === 'error' ? 'rgba(255,80,80,0.12)' : 'rgba(160,160,160,0.1)',
                      color: hwReachable === 'ok' ? '#06d6a0' : hwReachable === 'error' ? '#ff5050' : '#888',
                      border: `1px solid ${hwReachable === 'ok' ? 'rgba(6,214,160,0.25)' : hwReachable === 'error' ? 'rgba(255,80,80,0.25)' : 'rgba(160,160,160,0.2)'}`,
                      cursor: 'default',
                    }}
                  >
                    {hwReachable === 'ok' ? <Wifi size={12} /> : hwReachable === 'error' ? <WifiOff size={12} /> : <Wifi size={12} opacity={0.4} />}
                    <span>{hwReachable === 'ok' ? 'API OK' : hwReachable === 'error' ? 'Hors ligne' : '…'}</span>
                  </div>
                  <button
                    className="g-btn g-btn--sm"
                    data-tour="editor-play"
                    onClick={() => setIsPlaying((p) => !p)}
                    title={isPlaying ? 'Pause envoi hardware' : 'Play envoi hardware'}
                    style={isPlaying ? { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    className="g-btn g-btn--sm"
                    onClick={() => setEditorTab('ui')}
                    title="Ouvrir l'interface du jeu"
                  >
                    <LayoutGrid size={14} />
                    <span>Interface</span>
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#999' }}>{tileCount} dalles</span>
                  {hasRuntimeEvents && runtimeScore > 0 && (
                    <div style={{ background: '#ffd600', color: '#1a1a1a', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
                      Score: {runtimeScore}
                    </div>
                  )}
                  {hasRuntimeEvents && runtimeRound.total > 0 && runtimeRound.current > 0 && (
                    <div style={{ background: 'rgba(67,97,238,0.12)', color: '#4361ee', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700, border: '1px solid rgba(67,97,238,0.25)' }}>
                      Manche {runtimeRound.current}/{runtimeRound.total}
                    </div>
                  )}
                  {hasRuntimeEvents && runtimeCountdownValue > 0 && (
                    <div style={{ background: runtimeCountdownValue <= 5 ? 'rgba(239,68,68,0.12)' : 'rgba(0,0,0,0.06)', color: runtimeCountdownValue <= 5 ? '#ef4444' : '#333', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {Math.ceil(runtimeCountdownValue)}s
                    </div>
                  )}
                  {hasRuntimeEvents && isPlaying && activeGame?.nodes.some(n => n.kind === 'get_player_rgb' && n.enabled) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '4px 10px', border: '1px solid rgba(0,0,0,0.1)' }}>
                      {(['r','g','b'] as const).map((ch, i) => (
                        <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: ['#ef4444','#22c55e','#3b82f6'][i], width: 12 }}>{ch.toUpperCase()}</span>
                          <input type="range" min={0} max={255} step={1} style={{ width: 60 }}
                            value={runtimePlayerRgbRef.current[ch]}
                            onChange={(e) => {
                              runtimePlayerRgbRef.current = { ...runtimePlayerRgbRef.current, [ch]: Number(e.target.value) };
                            }} />
                        </label>
                      ))}
                      <button
                        className="g-btn g-btn--sm"
                        style={{ background: '#22c55e', color: '#fff', border: 'none', fontSize: 12, padding: '4px 10px', borderRadius: 8 }}
                        onClick={() => (window as any).__colorroom_submit?.()}
                      >
                        Soumettre
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="viewport">
                {activeGame ? (
                  activeTetrisNode ? (
                    /* ── Split view quand un nœud Tetris est actif ─── */
                    <div className="viewport__split">
                      <div className="viewport__pane viewport__pane--tiles" style={{ background: '#0a0a0f' }}>
                        <Room3D
                          plateColors={roomPlateColors}
                          plateActive={roomPlateActive}
                          onPlateClick={(idx) => {
                            if (hasRuntimeEvents && isPlaying) fireRuntimeClickRef.current?.(idx);
                            else assignSelectedTileToNode(idx);
                          }}
                          height={viewportHeight - 56}
                        />
                      </div>
                      <div className="viewport__pane viewport__pane--ui" style={{ flex: 2, minWidth: 0, overflow: 'auto' }}>
                        <TetrisGame
                          params={{ speed: Math.max(50, getNum(activeTetrisNode.params, 'speed', 500)) }}
                          isPlaying={isPlaying}
                          onSnapshot={(snap) => { tetrisSnapRef.current = snap; }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* ── Aperçu 3D plein écran (même vue que /jeux) ── */
                    <div style={{ position: 'relative', height: '100%', background: '#0a0c18', borderRadius: 18, overflow: 'hidden' }}>
                      <Room3D
                        plateColors={roomPlateColors}
                        plateActive={roomPlateActive}
                        onPlateClick={(idx) => {
                          if (hasRuntimeEvents && isPlaying) fireRuntimeClickRef.current?.(idx);
                          else assignSelectedTileToNode(idx);
                        }}
                        height={viewportHeight - 56}
                      />
                    </div>
                  )
                ) : (
                  <div className="bp-empty" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 16, textAlign: 'center', maxWidth: 320 }}>
                      <Lightbulb size={48} style={{ opacity: 0.3, color: '#4361ee', margin: '0 auto' }} />
                      <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Aucun projet</h3>
                        <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
                          Créez votre premier jeu lumineux pour commencer à explorer l'éditeur visuel.
                        </p>
                      </div>
                      <button 
                        className="g-btn g-btn--accent" 
                        onClick={() => setModal({ type: 'create-project' })}
                        style={{ marginTop: 8, height: 48, padding: '0 24px', fontSize: 14 }}
                      >
                        <FolderPlus size={18} />
                        <span>Créer un projet</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="ue__splitter"
              onPointerDown={(e) => {
                e.preventDefault();
                setResizing({ active: true, y: e.clientY, start: viewportHeight });
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              }}
            />

            <div className="ue__graph glass">
              <div className="panelhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Graphe</strong>
                <span className="panelhead__meta">Blueprint</span>
                {activeGame && (
                  <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 4 }}>
                    {activeGame.name}
                  </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Hint clavier */}
                  <span style={{ fontSize: 10, color: '#bbb', letterSpacing: '0.02em', marginRight: 6, display: 'flex', gap: 4 }}>
                    <kbd style={{ background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: '#666' }}>F</kbd>
                    <kbd style={{ background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: '#666' }}>L</kbd>
                    <kbd style={{ background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: '#666' }}>Del</kbd>
                  </span>
                  {/* Indicateur de zoom */}
                  <span style={{ fontSize: 11, color: '#888', fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right', fontWeight: 600 }}>
                    {Math.round(graphZoom * 100)}%
                  </span>
                  {/* Fit all nodes */}
                  {activeGame && (
                    <button
                      className="btn btn--mini"
                      title="Ajuster la vue à tous les nœuds [F]"
                      onClick={fitNodesToView}
                      style={{ padding: '0 8px', height: 28, fontSize: 11, gap: 4 }}
                    >
                      <ScanLine size={12} />
                      <span>Fit</span>
                    </button>
                  )}
                  {/* Bouton reset zoom */}
                  <button
                    className="btn btn--mini"
                    title="Réinitialiser le zoom [H]"
                    onClick={() => { setGraphZoom(0.5); setGraphPan({ x: 120, y: 80 }); }}
                    style={{ padding: '0 8px', height: 28, fontSize: 11 }}
                  >
                    <Minimize2 size={12} />
                  </button>
                  {/* Re-layout */}
                  {activeGame && (
                    <button
                      className="btn btn--mini"
                      title="Auto-espacer les nœuds [L]"
                      onClick={autoLayoutNodes}
                      style={{ padding: '0 8px', height: 28, fontSize: 11, gap: 4 }}
                    >
                      <LayoutGrid size={12} />
                      <span>Layout</span>
                    </button>
                  )}
                  {editor.expandedGameNodeId && (
                    <button
                      className="btn btn--mini"
                      onClick={() => {
                        commit((cur) => ({
                          ...cur,
                          expandedGameNodeId: undefined,
                          visibleNodeIds: undefined,
                        }));
                        setStatus('Vue complète');
                      }}
                      style={{ padding: '0 8px', height: 28, fontSize: 11 }}
                    >
                      Afficher tout
                    </button>
                  )}
                </div>
              </div>
              {/* Tab switcher (icônes Lucide) */}
              <div data-tour="editor-tabs" style={{ display: 'flex', gap: 5, padding: '7px 12px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
                {([
                  { tab: 'canvas' as const, label: 'Nœuds', Icon: GitBranch },
                  { tab: 'python' as const, label: 'Python', Icon: Hash },
                  { tab: 'ui' as const, label: 'Interface', Icon: LayoutGrid },
                ]).map(({ tab, label, Icon }) => {
                  const active = editorTab === tab;
                  return (
                    <button key={tab} type="button" onClick={() => setEditorTab(tab)} title={label}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 10, border: active ? '1px solid rgba(67,97,238,0.5)' : '1px solid rgba(0,0,0,0.08)', background: active ? 'linear-gradient(135deg,rgba(67,97,238,0.14),rgba(124,58,237,0.1))' : 'rgba(255,255,255,0.7)', color: active ? '#4361ee' : '#7a808c', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 130ms', boxShadow: active ? '0 2px 8px rgba(67,97,238,0.15)' : 'none' }}>
                      <Icon size={14} /> {label}
                    </button>
                  );
                })}
              </div>
              <div className="panelbody" data-tour="editor-blocs" style={{ display: editorTab === 'canvas' ? undefined : 'none' }}>
                <div
                  className="bp"
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest('.bp-node')) return;
                    if ((e.target as HTMLElement).closest('.bp-menu')) return;
                    if (!activeGameId) return;
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const gx = (x - graphPan.x) / Math.max(0.0001, graphZoom);
                    const gy = (y - graphPan.y) / Math.max(0.0001, graphZoom);
                    addNode('fill', { x: gx, y: gy });
                    setStatus('Noeud couleur ajouté');
                  }}
                  onContextMenu={(e) => {
                    if (!activeGameId) return;
                    e.preventDefault();
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const gx = (x - graphPan.x) / Math.max(0.0001, graphZoom);
                    const gy = (y - graphPan.y) / Math.max(0.0001, graphZoom);
                    setContextMenu({ open: true, x, y, gx, gy, q: '' });
                    setPendingLink(null);
                    setStatus('Ajouter un noeud');
                  }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('.bp-node')) return;
                    if ((e.target as HTMLElement).closest('.bp-menu')) return;
                    setPendingLink(null);
                    setContextMenu((p) => ({ ...p, open: false }));
                    setGraphPanning({ active: true, x: e.clientX, y: e.clientY });
                  }}
                  onPointerMove={(e) => {
                    if (linkDrag?.active) {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;

                      const contentRect = bpContentRef.current?.getBoundingClientRect();
                      const gx = contentRect
                        ? (e.clientX - contentRect.left) / Math.max(0.0001, graphZoom)
                        : (x - graphPan.x) / Math.max(0.0001, graphZoom);
                      const gy = contentRect
                        ? (e.clientY - contentRect.top) / Math.max(0.0001, graphZoom)
                        : (y - graphPan.y) / Math.max(0.0001, graphZoom);
                      setLinkDrag({ active: true, x, y, gx, gy });
                    }
                    if (graphDrag) {
                      setDragDidMove(true);
                      const dx = (e.clientX - graphDrag.x) / graphZoom;
                      const dy = (e.clientY - graphDrag.y) / graphZoom;
                      setGraphDrag({ nodeId: graphDrag.nodeId, x: e.clientX, y: e.clientY });
                      moveNode(graphDrag.nodeId, dx, dy);
                      requestAnimationFrame(() => requestAnimationFrame(() => measurePinsRef.current?.()));
                      return;
                    }
                    if (!graphPanning.active) return;
                    const dx = e.clientX - graphPanning.x;
                    const dy = e.clientY - graphPanning.y;
                    setGraphPanning({ active: true, x: e.clientX, y: e.clientY });
                    setGraphPan((p) => ({ x: p.x + dx, y: p.y + dy }));
                  }}
                  onPointerUp={(e) => {
                    setGraphPanning({ active: false, x: 0, y: 0 });
                    const droppedId = graphDrag?.nodeId;
                    setGraphDrag(null);
                    endDrag();
                    if (droppedId) requestAnimationFrame(() => resolveOverlaps(droppedId));

                    if (linkDrag?.active && pendingLink?.fromNodeId) {
                      if (!activeGameId) {
                        setLinkDrag(null);
                        return;
                      }

                      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
                      const inPin = el?.closest('.bp-pin--in');
                      if (inPin) {
                        // Le pointeur est capturé par `.bp`, donc le pointerup de l'entrée
                        // ne se déclenche pas : on crée la liaison ici, depuis le DOM.
                        const targetEl = inPin.closest('.bp-node') as HTMLElement | null;
                        const targetId = targetEl?.getAttribute('data-nodeid');
                        if (targetId && targetId !== pendingLink.fromNodeId) {
                          addEdge(pendingLink.fromNodeId, targetId);
                          setStatus('Connexion créée');
                        }
                        setPendingLink(null);
                        setPendingAutoConnect(null);
                        setLinkDrag(null);
                        return;
                      }

                      const x = linkDrag.x;
                      const y = linkDrag.y;
                      const gx = linkDrag.gx;
                      const gy = linkDrag.gy;
                      setPendingAutoConnect({ fromNodeId: pendingLink.fromNodeId });
                      setContextMenu({ open: true, x, y, gx, gy, q: '' });
                      setStatus('Ajouter un noeud');
                    }

                    setLinkDrag(null);
                  }}
                  onWheel={(e) => {
                    if ((e.target as HTMLElement).closest('.bp-menu')) return;
                    // Zoom centré sur la position de la souris
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    const factor = e.deltaY > 0 ? 0.88 : 1.12;
                    const next = Math.max(0.1, Math.min(3.0, graphZoom * factor));
                    // Ajuster le pan pour zoomer sur la souris
                    const gx = (mx - graphPan.x) / graphZoom;
                    const gy = (my - graphPan.y) / graphZoom;
                    setGraphPan({ x: mx - gx * next, y: my - gy * next });
                    setGraphZoom(next);
                  }}
                >
                  <div
                    className="bp__content"
                    style={{ transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${graphZoom})` }}
                    ref={bpContentRef}
                  >
                    {games.length === 0 ? (
                      <div className="bp-empty">
                        <div style={{ textAlign: 'center', padding: 40 }}>
                          <Gamepad2 size={48} style={{ opacity: 0.3, color: '#4361ee', marginBottom: 16 }} />
                          <p style={{ margin: '0 0 20px', fontSize: 14, opacity: 0.7 }}>Commencez par créer votre premier jeu</p>
                          <button 
                            className="g-btn g-btn--accent" 
                            onClick={() => setModal({ type: 'create-project' })}
                            style={{ height: 46, padding: '0 22px', fontSize: 14 }}
                          >
                            <FolderPlus size={18} />
                            <span>Créer un projet</span>
                          </button>
                        </div>
                        <div className="bp-empty__hint">Clic droit pour ajouter des noeuds • Double clic = Remplissage</div>
                      </div>
                    ) : null}

                    {contextMenu.open ? (
                      <div className="bp-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                        <div className="bp-menu__search">
                          <input
                            className="bp-menu__input"
                            placeholder="Rechercher un noeud…"
                            value={contextMenu.q}
                            autoFocus
                            onChange={(e) => setContextMenu((p) => ({ ...p, q: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setContextMenu((p) => ({ ...p, open: false }));
                            }}
                          />
                        </div>

                        <div className="bp-menu__list">
                          {(() => {
                            const q = contextMenu.q.trim().toLowerCase();
                            const allFiltered = NODE_CATALOG.filter((n) => {
                              if (!q) return true;
                              return `${n.category} ${n.title} ${n.kind}`.toLowerCase().includes(q);
                            });
                            const addable = allFiltered.filter((n) => !NATIVE_GAME_KINDS.has(n.kind));
                            const natives = allFiltered.filter((n) => NATIVE_GAME_KINDS.has(n.kind));
                            const categories = [...new Set(addable.map((n) => n.category))];
                            return (
                              <>
                                {categories.map((cat) => {
                                  const CatIcon = NODE_CATEGORY_ICONS[cat] ?? Boxes;
                                  const catColor = NODE_CATEGORY_COLORS[cat] ?? '#999';
                                  return (
                                    <div key={cat}>
                                      <div className="bp-menu__cathead" style={{ borderLeft: `3px solid ${catColor}` }}>
                                        <CatIcon size={11} style={{ color: catColor, flexShrink: 0 }} />
                                        <span>{cat}</span>
                                      </div>
                                      {addable.filter((n) => n.category === cat).map((n) => (
                                        <button
                                          key={n.kind}
                                          className="bp-menu__item"
                                          onClick={() => {
                                            const createdId = addNode(n.kind, { x: contextMenu.gx, y: contextMenu.gy });
                                            if (createdId && pendingAutoConnect?.fromNodeId) {
                                              addEdge(pendingAutoConnect.fromNodeId, createdId);
                                              setPendingLink(null);
                                              setPendingAutoConnect(null);
                                            }
                                            setContextMenu((p) => ({ ...p, open: false }));
                                            setStatus('Noeud ajouté');
                                          }}
                                        >
                                          <span className="bp-menu__title">{n.title}</span>
                                          <span className="bp-menu__meta" style={{ color: catColor, opacity: 0.7, fontSize: 11 }}>{n.kind.startsWith('cs160') ? 'CS160' : ''}</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })}
                                {natives.length > 0 && (
                                  <div>
                                    <div className="bp-menu__cathead" style={{ borderLeft: '3px solid #a855f7', marginTop: 8 }}>
                                      <Gamepad2 size={11} style={{ color: '#a855f7', flexShrink: 0 }} />
                                      <span>Jeux Natifs</span>
                                      <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.6, fontWeight: 600 }}>(lecture seule)</span>
                                    </div>
                                    {natives.map((n) => (
                                      <div
                                        key={n.kind}
                                        className="bp-menu__item"
                                        style={{ opacity: 0.45, cursor: 'not-allowed', userSelect: 'none' }}
                                        title="Jeu natif - non recréable via l'éditeur"
                                      >
                                        <span className="bp-menu__title">{n.title}</span>
                                        <span className="bp-menu__meta" style={{ color: '#a855f7', opacity: 0.7, fontSize: 10 }}>natif</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : null}

                    <svg className="bp__wires" width="2000" height="2000" viewBox="0 0 2000 2000" preserveAspectRatio="none">
                      <defs>
                        <marker
                          id="bp-arrow"
                          viewBox="0 0 6 6"
                          refX="5.2"
                          refY="3"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--c-action)" opacity="0.78" />
                        </marker>
                      </defs>
                      {(activeGame?.edges ?? []).map((e) => {
                        const from = (activeGame?.nodes ?? []).find((n) => n.id === e.from);
                        const to = (activeGame?.nodes ?? []).find((n) => n.id === e.to);
                        if (!from || !to) return null;

                        const p1 = pinPositions[e.from]?.out;
                        const p2 = pinPositions[e.to]?.in;
                        const NODE_W = 280;
                        const PIN_Y = 104;
                        const x1 = p1 ? p1.x : from.pos.x + NODE_W;
                        const y1 = p1 ? p1.y : from.pos.y + PIN_Y;
                        const x2 = p2 ? p2.x : to.pos.x;
                        const y2 = p2 ? p2.y : to.pos.y + PIN_Y;
                        const dx = Math.max(60, Math.min(220, (x2 - x1) * 0.5));
                        const c1x = x1 + dx;
                        const c1y = y1;
                        const c2x = x2 - dx;
                        const c2y = y2;
                        const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

                        const active = pendingLink?.fromNodeId && (pendingLink.fromNodeId === e.from || pendingLink.fromNodeId === e.to);
                        return (
                          <path
                            key={e.id}
                            d={d}
                            markerEnd="url(#bp-arrow)"
                            className={active ? 'bp-wire bp-wire--active' : 'bp-wire'}
                          />
                        );
                      })}

                      {pendingLink?.fromNodeId && linkDrag?.active && activeGame ? (() => {
                        const from = activeGame.nodes.find((n) => n.id === pendingLink.fromNodeId);
                        if (!from) return null;

                        const p1 = pinPositions[pendingLink.fromNodeId]?.out;
                        const NODE_W = 280;
                        const PIN_Y = 104;
                        const x1 = p1 ? p1.x : from.pos.x + NODE_W;
                        const y1 = p1 ? p1.y : from.pos.y + PIN_Y;
                        const x2 = linkDrag.gx;
                        const y2 = linkDrag.gy;
                        const dx = Math.max(60, Math.min(220, (x2 - x1) * 0.5));
                        const c1x = x1 + dx;
                        const c1y = y1;
                        const c2x = x2 - dx;
                        const c2y = y2;
                        const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
                        return <path key="__preview" d={d} markerEnd="url(#bp-arrow)" className="bp-wire bp-wire--preview" />;
                      })() : null}
                    </svg>

                    {(activeGame?.nodes ?? [])
                      .filter((n) => {
                        // If we have visibleNodeIds (drill-down mode), only show those nodes
                        if (editor.visibleNodeIds && editor.visibleNodeIds.length > 0) {
                          return editor.visibleNodeIds.includes(n.id);
                        }
                        return true;
                      })
                      .map((n) => {
                      const selected = n.id === selectedNodeId;
                      const hasInput = n.kind !== 'event_begin' && n.kind !== 'on_timer' && n.kind !== 'on_click' && n.kind !== 'on_tick' && n.kind !== 'on_tile_click';
                      const inLabel = 'Entrée';
                      const outLabel =
                        n.kind === 'event_begin' ? 'Commencer' :
                        n.kind === 'game_tetris' || n.kind === 'game_simon' || n.kind === 'game_memory' ? 'Fin du jeu' :
                        n.kind === 'on_timer' ? 'Tick' :
                        n.kind === 'on_click' ? 'Click' :
                        n.kind === 'if' ? 'Alors' :
                        n.kind === 'sequence' ? 'Exécuter' :
                        'Sortie';
                      const nodeAccent =
                        NODE_CATEGORY_COLORS[categoryOfKind(n.kind)] ??
                        ((['event_begin', 'on_timer', 'on_click', 'on_tick', 'on_tile_click'].includes(n.kind)) ? '#f59e0b' :
                        (['game_tetris', 'game_simon', 'game_memory', 'game_tetris_block'].includes(n.kind)) ? '#a855f7' :
                        (['fill', 'pulse', 'tile', 'tile_set', 'tile_get', 'clear_tiles'].includes(n.kind)) ? '#22d3ee' :
                        (['if', 'while', 'sequence', 'wait'].includes(n.kind)) ? '#f97316' :
                        (['math_add', 'math_sub', 'math_mul', 'math_div', 'math_clamp01', 'math_lerp'].includes(n.kind)) ? '#4ade80' :
                        (['compare_eq', 'compare_gt', 'compare_lt', 'logic_and', 'logic_or', 'logic_not'].includes(n.kind)) ? '#60a5fa' :
                        (['variable_set', 'variable_get', 'add_score', 'get_score', 'random_int'].includes(n.kind)) ? '#818cf8' :
                        '#4361ee');
                      const linkingFromThis = pendingLink?.fromNodeId === n.id;
                      const seconds = Math.max(0, getNum(n.params, 'seconds', 1));
                      const fillIntensity = clamp01(getNum(n.params, 'intensity', 0.8));
                      const fillMaskRaw = String(n.params.mask ?? 'all');
                      const fillMask = fillMaskRaw === 'border' ? 'borders' : fillMaskRaw;
                      const fillColor = getColor(n.params, 'color', '#6d28ff');
                      const pulseSpeed = Math.max(0.01, getNum(n.params, 'speed', 1));
                      const tileIndex = Math.max(0, Math.min(8, Math.round(getNum(n.params, 'tileIndex', 0))));
                      const tileColor = getColor(n.params, 'color', '#ff2aa6');
                      const tileIntensity = clamp01(getNum(n.params, 'intensity', 0.85));
                      const pulseLegacyColor = getColor(n.params, 'color', '#ff2aa6');
                      const pulseBaseColor = getColor(n.params, 'baseColor', pulseLegacyColor);
                      const pulseTargetColor = getColor(n.params, 'targetColor', pulseLegacyColor);
                      const pulseLegacyBase = clamp01(getNum(n.params, 'base', 0.1));
                      const pulseLegacyAmp = clamp01(getNum(n.params, 'amp', 0.7));
                      const pulseFrom = clamp01(getNum(n.params, 'fromIntensity', pulseLegacyBase));
                      const pulseTo = clamp01(getNum(n.params, 'toIntensity', clamp01(pulseLegacyBase + pulseLegacyAmp)));
                      return (
                        <div
                          key={n.id}
                          className={[
                            'bp-node',
                            selected ? 'bp-node--active' : '',
                            !n.enabled ? 'bp-node--disabled' : '',
                          ].filter(Boolean).join(' ')}
                          style={{ left: n.pos.x, top: n.pos.y }}
                          data-nodeid={n.id}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setContextMenu((p) => ({ ...p, open: false }));
                            commit((cur) => ({ ...cur, selectedNodeId: n.id }));
                            beginDrag();
                            setGraphDrag({ nodeId: n.id, x: e.clientX, y: e.clientY });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // Double-clic sur nœud jeu → régénère toujours les blocs internes depuis zéro
                            if (n.kind === 'game_tetris' || n.kind === 'game_simon' || n.kind === 'game_memory') {
                              const activeGame = editor.games.find(g => g.id === editor.activeGameId);
                              if (!activeGame) return;

                              // Collecte tous les nœuds déjà connectés (sortants) pour les supprimer
                              const toDelete = new Set<string>();
                              const collectDownstream = (nodeId: string) => {
                                activeGame.edges.forEach(edge => {
                                  if (edge.from === nodeId && !toDelete.has(edge.to)) {
                                    toDelete.add(edge.to);
                                    collectDownstream(edge.to);
                                  }
                                });
                              };
                              collectDownstream(n.id);

                              const makeId = () => Math.random().toString(36).slice(2);
                              const gameX = n.pos.x;
                              const gameY = n.pos.y;
                              const freshNodes: EditorNode[] = [];
                              const freshEdges: GraphEdge[] = [];

                              if (n.kind === 'game_tetris') {
                                // ── TETRIS ── 4 colonnes × 4 lignes · 460 × 420 px ────────────
                                // Col 0 = SETUP   Col 1 = BOUCLE   Col 2 = PIÈCES A   Col 3 = PIÈCES B + LOGIQUE
                                const ids = Array(16).fill(0).map(() => makeId());
                                const dx = 460, dy = 420;
                                const sx = gameX + 80, sy = gameY - 120;
                                freshNodes.push(
                                  // ── Col 0 · SETUP ─────────────────────────────────────────────
                                  { id: ids[0],  kind: 'fill',       name: 'Fond Noir',        enabled: true, params: { color: '#000000', intensity: 1,    mask: 'all', seconds: 0 },                                       pos: { x: sx,            y: sy           } },
                                  { id: ids[1],  kind: 'sequence',   name: 'Init Grille',      enabled: true, params: {},                                                                                                   pos: { x: sx,            y: sy + dy      } },
                                  { id: ids[2],  kind: 'on_timer',   name: 'Tick Jeu (500ms)', enabled: true, params: { intervalMs: 500, repeat: -1 },                                                                     pos: { x: sx,            y: sy + dy * 2  } },
                                  { id: ids[3],  kind: 'math_add',   name: 'Descente Y+1',     enabled: true, params: {},                                                                                                   pos: { x: sx,            y: sy + dy * 3  } },
                                  // ── Col 1 · BOUCLE ────────────────────────────────────────────
                                  { id: ids[4],  kind: 'random_01',  name: 'Choix Pièce',      enabled: true, params: {},                                                                                                   pos: { x: sx + dx,       y: sy           } },
                                  { id: ids[5],  kind: 'compare_gt', name: 'Collision ?',      enabled: true, params: {},                                                                                                   pos: { x: sx + dx,       y: sy + dy      } },
                                  { id: ids[6],  kind: 'sequence',   name: 'Fusionner',        enabled: true, params: {},                                                                                                   pos: { x: sx + dx,       y: sy + dy * 2  } },
                                  { id: ids[7],  kind: 'compare_eq', name: 'Ligne Pleine ?',   enabled: true, params: {},                                                                                                   pos: { x: sx + dx,       y: sy + dy * 3  } },
                                  // ── Col 2 · PIÈCES I J L T ────────────────────────────────────
                                  { id: ids[8],  kind: 'tile',       name: 'Pièce I – Cyan',   enabled: true, params: { tileIndex: 0, color: '#00e5ff', intensity: 0.95 },                                                 pos: { x: sx + dx * 2,   y: sy           } },
                                  { id: ids[9],  kind: 'tile',       name: 'Pièce J – Bleu',   enabled: true, params: { tileIndex: 1, color: '#2979ff', intensity: 0.95 },                                                 pos: { x: sx + dx * 2,   y: sy + dy      } },
                                  { id: ids[10], kind: 'tile',       name: 'Pièce L – Orange', enabled: true, params: { tileIndex: 2, color: '#ff6d00', intensity: 0.95 },                                                 pos: { x: sx + dx * 2,   y: sy + dy * 2  } },
                                  { id: ids[11], kind: 'tile',       name: 'Pièce T – Violet', enabled: true, params: { tileIndex: 3, color: '#aa00ff', intensity: 0.95 },                                                 pos: { x: sx + dx * 2,   y: sy + dy * 3  } },
                                  // ── Col 3 · PIÈCES S Z O + SCORE ─────────────────────────────
                                  { id: ids[12], kind: 'tile',       name: 'Pièce S – Vert',   enabled: true, params: { tileIndex: 4, color: '#00c853', intensity: 0.95 },                                                 pos: { x: sx + dx * 3,   y: sy           } },
                                  { id: ids[13], kind: 'tile',       name: 'Pièce Z – Rouge',  enabled: true, params: { tileIndex: 5, color: '#ff1744', intensity: 0.95 },                                                 pos: { x: sx + dx * 3,   y: sy + dy      } },
                                  { id: ids[14], kind: 'tile',       name: 'Pièce O – Jaune',  enabled: true, params: { tileIndex: 6, color: '#ffd600', intensity: 0.95 },                                                 pos: { x: sx + dx * 3,   y: sy + dy * 2  } },
                                  { id: ids[15], kind: 'pulse',      name: 'Score Flash',      enabled: true, params: { baseColor: '#00ff88', targetColor: '#88ffff', fromIntensity: 0.3, toIntensity: 1.0, speed: 6 },   pos: { x: sx + dx * 3,   y: sy + dy * 3  } },
                                );
                                freshEdges.push(
                                  { id: makeId(), from: n.id,    to: ids[0]  }, // Tetris → Fond Noir
                                  { id: makeId(), from: ids[0],  to: ids[1]  }, // Fond Noir → Init Grille
                                  { id: makeId(), from: ids[1],  to: ids[2]  }, // Init → Tick Jeu
                                  { id: makeId(), from: ids[2],  to: ids[3]  }, // Tick → Descente
                                  { id: makeId(), from: ids[2],  to: ids[4]  }, // Tick → Choix Pièce
                                  { id: makeId(), from: ids[4],  to: ids[8]  }, // Choix → Pièce I
                                  { id: makeId(), from: ids[4],  to: ids[9]  }, // Choix → Pièce J
                                  { id: makeId(), from: ids[4],  to: ids[10] }, // Choix → Pièce L
                                  { id: makeId(), from: ids[4],  to: ids[11] }, // Choix → Pièce T
                                  { id: makeId(), from: ids[4],  to: ids[12] }, // Choix → Pièce S
                                  { id: makeId(), from: ids[4],  to: ids[13] }, // Choix → Pièce Z
                                  { id: makeId(), from: ids[4],  to: ids[14] }, // Choix → Pièce O
                                  { id: makeId(), from: ids[3],  to: ids[5]  }, // Descente → Collision ?
                                  { id: makeId(), from: ids[5],  to: ids[6]  }, // Collision ? → Fusionner
                                  { id: makeId(), from: ids[6],  to: ids[7]  }, // Fusionner → Ligne Pleine ?
                                  { id: makeId(), from: ids[7],  to: ids[15] }, // Ligne Pleine ? → Score Flash
                                );

                              } else if (n.kind === 'game_simon') {
                                // ── SIMON ── 4 colonnes × 3 lignes · 460 × 420 px ─────────────
                                // Col 0 = SETUP   Col 1 = DALLES FROIDES   Col 2 = DALLES CHAUDES   Col 3 = LOGIQUE
                                const ids = Array(12).fill(0).map(() => makeId());
                                const dx = 460, dy = 420;
                                const sx = gameX + 80, sy = gameY - 80;
                                freshNodes.push(
                                  // ── Col 0 · SETUP ─────────────────────────────────────────────
                                  { id: ids[0],  kind: 'fill',       name: 'Fond Noir',          enabled: true, params: { color: '#000000', intensity: 1, mask: 'all', seconds: 0 },                                               pos: { x: sx,            y: sy          } },
                                  { id: ids[1],  kind: 'sequence',   name: 'Séquence Simon',     enabled: true, params: {},                                                                                                         pos: { x: sx,            y: sy + dy     } },
                                  { id: ids[2],  kind: 'on_timer',   name: 'Tick Affichage',     enabled: true, params: { intervalMs: 800, repeat: -1 },                                                                           pos: { x: sx,            y: sy + dy * 2 } },
                                  // ── Col 1 · DALLES FROIDES ────────────────────────────────────
                                  { id: ids[3],  kind: 'tile',       name: 'Dalle Bleue',        enabled: true, params: { tileIndex: 0, color: '#2979ff', intensity: 0.95 },                                                       pos: { x: sx + dx,       y: sy          } },
                                  { id: ids[4],  kind: 'tile',       name: 'Dalle Verte',        enabled: true, params: { tileIndex: 1, color: '#00c853', intensity: 0.95 },                                                       pos: { x: sx + dx,       y: sy + dy     } },
                                  { id: ids[5],  kind: 'random_01',  name: 'Couleur aléatoire',  enabled: true, params: {},                                                                                                         pos: { x: sx + dx,       y: sy + dy * 2 } },
                                  // ── Col 2 · DALLES CHAUDES ────────────────────────────────────
                                  { id: ids[6],  kind: 'tile',       name: 'Dalle Rouge',        enabled: true, params: { tileIndex: 2, color: '#ff1744', intensity: 0.95 },                                                       pos: { x: sx + dx * 2,   y: sy          } },
                                  { id: ids[7],  kind: 'tile',       name: 'Dalle Jaune',        enabled: true, params: { tileIndex: 3, color: '#ffd600', intensity: 0.95 },                                                       pos: { x: sx + dx * 2,   y: sy + dy     } },
                                  { id: ids[8],  kind: 'wait',       name: 'Pause affichage',    enabled: true, params: { seconds: 0.4 },                                                                                          pos: { x: sx + dx * 2,   y: sy + dy * 2 } },
                                  // ── Col 3 · LOGIQUE JOUEUR ────────────────────────────────────
                                  { id: ids[9],  kind: 'compare_eq', name: 'Bonne touche ?',     enabled: true, params: {},                                                                                                         pos: { x: sx + dx * 3,   y: sy          } },
                                  { id: ids[10], kind: 'pulse',      name: 'Score Simon',        enabled: true, params: { baseColor: '#ffffff', targetColor: '#ffd600', fromIntensity: 0.2, toIntensity: 1.0, speed: 4 },         pos: { x: sx + dx * 3,   y: sy + dy     } },
                                  { id: ids[11], kind: 'fill',       name: 'Erreur – Éclair',    enabled: true, params: { color: '#ff1744', intensity: 0.9, mask: 'all', seconds: 0.1 },                                          pos: { x: sx + dx * 3,   y: sy + dy * 2 } },
                                );
                                freshEdges.push(
                                  { id: makeId(), from: n.id,    to: ids[0]  }, // Simon → Fond Noir
                                  { id: makeId(), from: ids[0],  to: ids[1]  }, // → Séquence Simon
                                  { id: makeId(), from: ids[1],  to: ids[2]  }, // → Tick Affichage
                                  { id: makeId(), from: ids[2],  to: ids[5]  }, // Tick → Couleur aléatoire
                                  { id: makeId(), from: ids[5],  to: ids[3]  }, // Couleur → Dalle Bleue
                                  { id: makeId(), from: ids[5],  to: ids[4]  }, // Couleur → Dalle Verte
                                  { id: makeId(), from: ids[5],  to: ids[6]  }, // Couleur → Dalle Rouge
                                  { id: makeId(), from: ids[5],  to: ids[7]  }, // Couleur → Dalle Jaune
                                  { id: makeId(), from: ids[3],  to: ids[8]  }, // Dalle Bleue → Pause
                                  { id: makeId(), from: ids[8],  to: ids[9]  }, // Pause → Bonne touche ?
                                  { id: makeId(), from: ids[9],  to: ids[10] }, // Bonne → Score
                                  { id: makeId(), from: ids[9],  to: ids[11] }, // Erreur → Éclair
                                  { id: makeId(), from: ids[8],  to: ids[2]  }, // Pause ↩ Tick (boucle)
                                );

                              } else if (n.kind === 'game_memory') {
                                // ── MEMORY ── 4 colonnes × 3 lignes · 460 × 420 px ────────────
                                const ids = Array(12).fill(0).map(() => makeId());
                                const dx = 460, dy = 420;
                                const sx = gameX + 80, sy = gameY - 80;
                                freshNodes.push(
                                  // ── Col 0 · SETUP ─────────────────────────────────────────────
                                  { id: ids[0],  kind: 'fill',       name: 'Fond Noir',        enabled: true, params: { color: '#000000', intensity: 1, mask: 'all', seconds: 0 },                                                 pos: { x: sx,            y: sy          } },
                                  { id: ids[1],  kind: 'sequence',   name: 'Init Plateau',     enabled: true, params: {},                                                                                                           pos: { x: sx,            y: sy + dy     } },
                                  { id: ids[2],  kind: 'on_timer',   name: 'Révéler (800ms)',  enabled: true, params: { intervalMs: 800, repeat: 1 },                                                                              pos: { x: sx,            y: sy + dy * 2 } },
                                  // ── Col 1 · CARTES ────────────────────────────────────────────
                                  { id: ids[3],  kind: 'random_01',  name: 'Paire aléatoire',  enabled: true, params: {},                                                                                                           pos: { x: sx + dx,       y: sy          } },
                                  { id: ids[4],  kind: 'tile',       name: 'Carte A – Rose',   enabled: true, params: { tileIndex: 0, color: '#ff4488', intensity: 0.95 },                                                         pos: { x: sx + dx,       y: sy + dy     } },
                                  { id: ids[5],  kind: 'fill',       name: 'Dos de carte',     enabled: true, params: { color: '#1a1a3e', intensity: 0.7, mask: 'all', seconds: 0 },                                               pos: { x: sx + dx,       y: sy + dy * 2 } },
                                  // ── Col 2 · CARTES ────────────────────────────────────────────
                                  { id: ids[6],  kind: 'tile',       name: 'Carte B – Bleu',   enabled: true, params: { tileIndex: 1, color: '#44aaff', intensity: 0.95 },                                                         pos: { x: sx + dx * 2,   y: sy          } },
                                  { id: ids[7],  kind: 'tile',       name: 'Carte C – Vert',   enabled: true, params: { tileIndex: 2, color: '#44ffaa', intensity: 0.95 },                                                         pos: { x: sx + dx * 2,   y: sy + dy     } },
                                  { id: ids[8],  kind: 'wait',       name: 'Pause retour',     enabled: true, params: { seconds: 0.8 },                                                                                             pos: { x: sx + dx * 2,   y: sy + dy * 2 } },
                                  // ── Col 3 · LOGIQUE ───────────────────────────────────────────
                                  { id: ids[9],  kind: 'compare_eq', name: 'Paire trouvée ?',  enabled: true, params: {},                                                                                                           pos: { x: sx + dx * 3,   y: sy          } },
                                  { id: ids[10], kind: 'pulse',      name: 'Match ! Flash',    enabled: true, params: { baseColor: '#ffaa00', targetColor: '#ffffff', fromIntensity: 0.4, toIntensity: 1.0, speed: 5 },            pos: { x: sx + dx * 3,   y: sy + dy     } },
                                  { id: ids[11], kind: 'sequence',   name: 'Prochain tour',    enabled: true, params: {},                                                                                                           pos: { x: sx + dx * 3,   y: sy + dy * 2 } },
                                );
                                freshEdges.push(
                                  { id: makeId(), from: n.id,    to: ids[0]  }, // Memory → Fond Noir
                                  { id: makeId(), from: ids[0],  to: ids[1]  }, // → Init Plateau
                                  { id: makeId(), from: ids[1],  to: ids[3]  }, // → Paire aléatoire
                                  { id: makeId(), from: ids[3],  to: ids[4]  }, // Paire → Carte A
                                  { id: makeId(), from: ids[3],  to: ids[6]  }, // Paire → Carte B
                                  { id: makeId(), from: ids[3],  to: ids[7]  }, // Paire → Carte C
                                  { id: makeId(), from: ids[1],  to: ids[2]  }, // Init → Révéler
                                  { id: makeId(), from: ids[4],  to: ids[9]  }, // Carte A → Paire trouvée ?
                                  { id: makeId(), from: ids[6],  to: ids[9]  }, // Carte B → Paire trouvée ?
                                  { id: makeId(), from: ids[9],  to: ids[10] }, // Trouvée → Match Flash
                                  { id: makeId(), from: ids[9],  to: ids[5]  }, // Pas trouvée → Dos de carte
                                  { id: makeId(), from: ids[5],  to: ids[8]  }, // Dos → Pause retour
                                  { id: makeId(), from: ids[8],  to: ids[11] }, // Pause → Prochain tour
                                  { id: makeId(), from: ids[10], to: ids[11] }, // Match → Prochain tour
                                  { id: makeId(), from: ids[11], to: ids[1]  }, // Prochain tour ↩ Init (boucle)
                                );
                              }

                              // Commit: supprime anciens nœuds aval + insère les nouveaux
                              commit((cur) => {
                                const gi = cur.games.findIndex(g => g.id === cur.activeGameId);
                                if (gi === -1) return cur;
                                const g = cur.games[gi];
                                const updated = {
                                  ...g,
                                  nodes: [...g.nodes.filter(nd => !toDelete.has(nd.id)), ...freshNodes],
                                  edges: [...g.edges.filter(e => !toDelete.has(e.from) && !toDelete.has(e.to)), ...freshEdges],
                                };
                                const newGames = [...cur.games];
                                newGames[gi] = updated;
                                const visibleIds = [n.id, ...freshNodes.map(nd => nd.id)];
                                return { ...cur, games: newGames, expandedGameNodeId: n.id, visibleNodeIds: visibleIds };
                              });
                              setStatus(`${n.name} régénéré - ${freshNodes.length} nœuds`);
                            }
                          }}
                        >
                          <div className="bp-node__header" style={{
                            background: nodeAccent,
                            borderBottom: `2px solid ${nodeAccent}`,
                          }}>
                            <div className="bp-node__header-left">
                              {(() => { const CatIcon = NODE_CATEGORY_ICONS[categoryOfKind(n.kind)] ?? Boxes; return <CatIcon size={13} style={{ color: '#fff', flexShrink: 0 }} />; })()}
                              <span className="bp-node__name" style={{ color: '#fff' }}>{n.name}</span>
                            </div>
                            <div className="bp-node__header-right">
                              <button
                                className="bp-node__hbtn"
                                title={n.enabled ? 'Désactiver' : 'Activer'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  commit((cur) => ({
                                    ...cur,
                                    games: cur.games.map((g) => {
                                      if (g.id !== cur.activeGameId) return g;
                                      return { ...g, nodes: g.nodes.map((nd) => nd.id === n.id ? { ...nd, enabled: !nd.enabled } : nd) };
                                    }),
                                  }));
                                }}
                                style={{ color: n.enabled ? '#22d3ee' : '#ef4444' }}
                              >
                                {n.enabled ? <Check size={11} /> : <X size={11} />}
                              </button>
                              <button
                                className="bp-node__hbtn bp-node__hbtn--del"
                                title="Supprimer le nœud"
                                onClick={(e) => { e.stopPropagation(); removeNodeById(n.id); }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="bp-node__kind-bar" style={{ color: nodeAccent }}>
                            {labelNodeKind(n.kind)}
                          </div>

                          {n.kind === 'wait' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Durée</span>
                                <div className="bp-node__varctrl">
                                  <input
                                    className="bp-node__varinput"
                                    type="number"
                                    step={0.1}
                                    value={seconds}
                                    onChange={(e) => updateNodeParamsById(n.id, { seconds: Number(e.target.value) })}
                                  />
                                  <span className="bp-node__varunit">s</span>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'fill' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Durée</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varinput"
                                      type="number"
                                      step={0.1}
                                      value={seconds}
                                      onChange={(e) => updateNodeParamsById(n.id, { seconds: Number(e.target.value) })}
                                    />
                                    <span className="bp-node__varunit">s</span>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={fillIntensity}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: fillIntensity,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: fillColor }} />
                                <input
                                  className="bp-node__colorinput"
                                  type="color"
                                  value={fillColor}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })}
                                />
                              </div>

                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Masque</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(n.params.mask ?? 'all')}
                                      onChange={(e) => updateNodeParamsById(n.id, { mask: e.target.value })}>
                                      <option value="all">Tous</option>
                                      <option value="border">Bords</option>
                                      <option value="corners">Coins</option>
                                      <option value="center">Centre</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Boucle</span>
                                  <div className="bp-node__varctrl">
                                    <input type="checkbox" checked={Boolean(n.params.loop)}
                                      onChange={(e) => updateNodeParamsById(n.id, { loop: e.target.checked })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'pulse' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Base</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__colorinput"
                                      type="color"
                                      value={pulseBaseColor}
                                      onChange={(e) => updateNodeParamsById(n.id, { baseColor: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Cible</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__colorinput"
                                      type="color"
                                      value={pulseTargetColor}
                                      onChange={(e) => updateNodeParamsById(n.id, { targetColor: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">I0</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={pulseFrom}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: pulseFrom,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { fromIntensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">I1</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={pulseTo}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: pulseTo,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { toIntensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Vitesse</span>
                                <div className="bp-node__varctrl">
                                  <input
                                    className="bp-node__varrange"
                                    type="range"
                                    min={0.05}
                                    max={4}
                                    step={0.05}
                                    value={pulseSpeed}
                                    style={{
                                      ['--min' as any]: 0.05,
                                      ['--max' as any]: 4,
                                      ['--value' as any]: pulseSpeed,
                                    }}
                                    onChange={(e) => updateNodeParamsById(n.id, { speed: Number(e.target.value) })}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'tile' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Dalle</span>
                                  <div className="bp-node__varctrl">
                                    <select
                                      className="bp-node__varselect"
                                      value={String(tileIndex)}
                                      onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}
                                    >
                                      {Array.from({ length: 9 }, (_, i) => (
                                        <option key={i} value={i}>
                                          D{i + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={tileIntensity}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: tileIntensity,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: tileColor }} />
                                <input
                                  className="bp-node__colorinput"
                                  type="color"
                                  value={tileColor}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })}
                                />
                              </div>
                            </div>
                          ) : n.kind === 'game_tetris' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Vitesse (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={200} max={2000} step={50}
                                      value={getNum(n.params, 'speed', 500)}
                                      onChange={(e) => updateNodeParamsById(n.id, { speed: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Niveau départ</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={1} max={10} step={1}
                                      value={getNum(n.params, 'startLevel', 1)}
                                      onChange={(e) => updateNodeParamsById(n.id, { startLevel: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'game_simon' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Vitesse (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={300} max={2000} step={50}
                                      value={getNum(n.params, 'speed', 800)}
                                      onChange={(e) => updateNodeParamsById(n.id, { speed: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Couleurs</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(getNum(n.params, 'colors', 4))}
                                      onChange={(e) => updateNodeParamsById(n.id, { colors: Number(e.target.value) })}>
                                      <option value="2">2</option>
                                      <option value="4">4</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'game_memory' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Paires</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="number" min={2} max={12} step={1}
                                    value={getNum(n.params, 'pairs', 8)}
                                    onChange={(e) => updateNodeParamsById(n.id, { pairs: Number(e.target.value) })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'game_spectrum' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Manches</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={1} max={10} step={1}
                                      value={getNum(n.params, 'maxRounds', 5)}
                                      onChange={(e) => updateNodeParamsById(n.id, { maxRounds: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Révélation (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={2000} max={15000} step={500}
                                      value={getNum(n.params, 'revealMs', 5000)}
                                      onChange={(e) => updateNodeParamsById(n.id, { revealMs: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'on_timer' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Intervalle (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={100} max={60000} step={100}
                                      value={getNum(n.params, 'intervalMs', 1000)}
                                      onChange={(e) => updateNodeParamsById(n.id, { intervalMs: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Répétitions</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={-1} max={9999} step={1}
                                      value={getNum(n.params, 'repeat', -1)}
                                      onChange={(e) => updateNodeParamsById(n.id, { repeat: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'on_click' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Dalle</span>
                                <div className="bp-node__varctrl">
                                  <select className="bp-node__varselect"
                                    value={String(Math.max(0, Math.round(getNum(n.params, 'tileIndex', 0))))}
                                    onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}>
                                    {Array.from({ length: 42 }, (_, i) => <option key={i} value={i}>D{i + 1}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'tile_set' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Dalle</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(Math.max(0, Math.round(getNum(n.params, 'tileIndex', 0))))}
                                      onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}>
                                      {Array.from({ length: 42 }, (_, i) => <option key={i} value={i}>D{i + 1}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varrange" type="range" min={0} max={1} step={0.01}
                                      value={clamp01(getNum(n.params, 'intensity', 1))}
                                      style={{ ['--min' as any]: 0, ['--max' as any]: 1, ['--value' as any]: clamp01(getNum(n.params, 'intensity', 1)) }}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: getColor(n.params, 'color', '#ffffff') }} />
                                <input className="bp-node__colorinput" type="color"
                                  value={getColor(n.params, 'color', '#ffffff')}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })} />
                              </div>
                            </div>
                          ) : n.kind === 'if' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Condition</span>
                                <div className="bp-node__varctrl">
                                  <input type="checkbox" checked={Boolean(n.params.condition)}
                                    onChange={(e) => updateNodeParamsById(n.id, { condition: e.target.checked })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'mp_session' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Mode</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect" value={String(n.params.gameMode ?? 'versus')}
                                      onChange={(e) => updateNodeParamsById(n.id, { gameMode: e.target.value })}>
                                      <option value="versus">Versus</option>
                                      <option value="coop">Coop</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Joueurs max</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={1} max={8} step={1}
                                      value={getNum(n.params, 'maxPlayers', 4)}
                                      onChange={(e) => updateNodeParamsById(n.id, { maxPlayers: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'mp_wait_players' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Min joueurs</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="number" min={1} max={8} step={1}
                                    value={getNum(n.params, 'minPlayers', 2)}
                                    onChange={(e) => updateNodeParamsById(n.id, { minPlayers: Number(e.target.value) })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'mp_broadcast' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varrange" type="range" min={0} max={1} step={0.01}
                                      value={clamp01(getNum(n.params, 'intensity', 0.8))}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: getColor(n.params, 'color', '#00d7ff') }} />
                                <input className="bp-node__colorinput" type="color"
                                  value={getColor(n.params, 'color', '#00d7ff')}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })} />
                              </div>
                            </div>
                          ) : n.kind === 'mp_player_input' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Siège</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect" value={Math.max(1, Math.round(getNum(n.params, 'seat', 1)))}
                                      onChange={(e) => updateNodeParamsById(n.id, { seat: Number(e.target.value) })}>
                                      {Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>J{i + 1}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Timeout (s)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={5} max={300} step={5}
                                      value={getNum(n.params, 'timeoutSec', 30)}
                                      onChange={(e) => updateNodeParamsById(n.id, { timeoutSec: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'color_mix' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Mix (0-1)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varrange" type="range" min={0} max={1} step={0.01}
                                      value={clamp01(getNum(n.params, 't', 0.5))}
                                      onChange={(e) => updateNodeParamsById(n.id, { t: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <div className="bp-node__color" style={{ flex: 1 }}>
                                  <div className="bp-node__colorpreview" style={{ background: getColor(n.params, 'colorA', '#ff0000') }} />
                                  <input className="bp-node__colorinput" type="color"
                                    value={getColor(n.params, 'colorA', '#ff0000')}
                                    onChange={(e) => updateNodeParamsById(n.id, { colorA: e.target.value })} />
                                </div>
                                <div className="bp-node__color" style={{ flex: 1 }}>
                                  <div className="bp-node__colorpreview" style={{ background: getColor(n.params, 'colorB', '#0000ff') }} />
                                  <input className="bp-node__colorinput" type="color"
                                    value={getColor(n.params, 'colorB', '#0000ff')}
                                    onChange={(e) => updateNodeParamsById(n.id, { colorB: e.target.value })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'color_hsl' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Teinte</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={0} max={360} step={1}
                                      value={getNum(n.params, 'hue', 200)}
                                      onChange={(e) => updateNodeParamsById(n.id, { hue: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Saturation %</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={0} max={100} step={1}
                                      value={getNum(n.params, 'saturation', 80)}
                                      onChange={(e) => updateNodeParamsById(n.id, { saturation: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Luminosité %</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={0} max={100} step={1}
                                      value={getNum(n.params, 'lightness', 50)}
                                      onChange={(e) => updateNodeParamsById(n.id, { lightness: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'anim_fade' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">De</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varrange" type="range" min={0} max={1} step={0.01}
                                      value={clamp01(getNum(n.params, 'fromIntensity', 0))}
                                      onChange={(e) => updateNodeParamsById(n.id, { fromIntensity: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">À</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varrange" type="range" min={0} max={1} step={0.01}
                                      value={clamp01(getNum(n.params, 'toIntensity', 1))}
                                      onChange={(e) => updateNodeParamsById(n.id, { toIntensity: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Durée (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={100} max={30000} step={100}
                                      value={getNum(n.params, 'durationMs', 1000)}
                                      onChange={(e) => updateNodeParamsById(n.id, { durationMs: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Easing</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect" value={String(n.params.easing ?? 'linear')}
                                      onChange={(e) => updateNodeParamsById(n.id, { easing: e.target.value })}>
                                      <option value="linear">Linear</option>
                                      <option value="easeIn">Ease In</option>
                                      <option value="easeOut">Ease Out</option>
                                      <option value="easeInOut">Ease In-Out</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'anim_strobe' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Hz</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={1} max={30} step={1}
                                      value={getNum(n.params, 'hz', 4)}
                                      onChange={(e) => updateNodeParamsById(n.id, { hz: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Durée (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={500} max={30000} step={500}
                                      value={getNum(n.params, 'durationMs', 2000)}
                                      onChange={(e) => updateNodeParamsById(n.id, { durationMs: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: getColor(n.params, 'color', '#ffffff') }} />
                                <input className="bp-node__colorinput" type="color"
                                  value={getColor(n.params, 'color', '#ffffff')}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })} />
                              </div>
                            </div>
                          ) : n.kind === 'on_tick' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Intervalle (ms)</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="number" min={50} max={60000} step={50}
                                    value={getNum(n.params, 'intervalMs', 1000)}
                                    onChange={(e) => updateNodeParamsById(n.id, { intervalMs: Number(e.target.value) })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'on_tile_click' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Mode</span>
                                <div className="bp-node__varctrl">
                                  <select className="bp-node__varselect"
                                    value={String(n.params.target ?? 'any')}
                                    onChange={(e) => updateNodeParamsById(n.id, { target: e.target.value })}>
                                    <option value="any">Toute dalle</option>
                                    <option value="specific">Dalle spécifique</option>
                                  </select>
                                </div>
                              </div>
                              {n.params.target === 'specific' && (
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Dalle</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(Math.max(0, Math.round(getNum(n.params, 'tileIndex', 0))))}
                                      onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}>
                                      {Array.from({ length: 42 }, (_, i) => <option key={i} value={i}>D{i+1}</option>)}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : n.kind === 'variable_set' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Nom</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="text"
                                    value={String(n.params.name ?? 'x')}
                                    onChange={(e) => updateNodeParamsById(n.id, { name: e.target.value })} />
                                </div>
                              </div>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Op.</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(n.params.op ?? 'set')}
                                      onChange={(e) => updateNodeParamsById(n.id, { op: e.target.value })}>
                                      <option value="set">= (set)</option>
                                      <option value="add">+= (add)</option>
                                      <option value="sub">-= (sub)</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Val.</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" step={1}
                                      value={getNum(n.params, 'value', 0)}
                                      onChange={(e) => updateNodeParamsById(n.id, { value: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'add_score' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Points</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="number" step={1}
                                    value={getNum(n.params, 'amount', 1)}
                                    onChange={(e) => updateNodeParamsById(n.id, { amount: Number(e.target.value) })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'random_int' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Stocker dans</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="text"
                                    value={String(n.params.varName ?? 'rand')}
                                    onChange={(e) => updateNodeParamsById(n.id, { varName: e.target.value })} />
                                </div>
                              </div>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Min</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" step={1}
                                      value={getNum(n.params, 'min', 0)}
                                      onChange={(e) => updateNodeParamsById(n.id, { min: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Max</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" step={1}
                                      value={getNum(n.params, 'max', 41)}
                                      onChange={(e) => updateNodeParamsById(n.id, { max: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'game_tetris_block' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Colonnes</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={3} max={10} step={1}
                                      value={getNum(n.params, 'cols', 6)}
                                      onChange={(e) => updateNodeParamsById(n.id, { cols: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Lignes</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={3} max={10} step={1}
                                      value={getNum(n.params, 'rows', 7)}
                                      onChange={(e) => updateNodeParamsById(n.id, { rows: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div style={{ fontSize: 11, color: '#888', padding: '0 2px', lineHeight: 1.5 }}>
                                Connecte un <strong>on_tick</strong> pour piloter la vitesse de chute.
                              </div>
                            </div>
                          ) : null}

                          <div className="bp-node__io">
                            {hasInput ? (
                              <div
                                className="bp-pin bp-pin--in"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onPointerUp={(e) => {
                                  e.stopPropagation();
                                  if (!pendingLink?.fromNodeId) return;
                                  if (pendingLink.fromNodeId === n.id) {
                                    setPendingLink(null);
                                    setPendingAutoConnect(null);
                                    setLinkDrag(null);
                                    return;
                                  }
                                  addEdge(pendingLink.fromNodeId, n.id);
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                  setLinkDrag(null);
                                  setStatus('Connexion créée');
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!pendingLink) return;
                                  if (pendingLink.fromNodeId === n.id) {
                                    setPendingLink(null);
                                    return;
                                  }
                                  addEdge(pendingLink.fromNodeId, n.id);
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                  setStatus('Connexion créée');
                                }}
                              >
                                <span className={pendingLink ? 'bp-dot bp-dot--hot' : 'bp-dot'} />
                                <span className="bp-pin__label">{inLabel}</span>
                              </div>
                            ) : (
                              <div className="bp-pin bp-pin--in" style={{ opacity: 0.35 }}>
                                <span className="bp-dot" />
                                <span className="bp-pin__label">-</span>
                              </div>
                            )}
                            <div
                              className="bp-pin bp-pin--out"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setPendingLink({ fromNodeId: n.id });
                                setPendingAutoConnect(null);
                                setStatus('Choisis une entrée');
                                const rect = (e.currentTarget as HTMLDivElement).closest('.bp')?.getBoundingClientRect();
                                const x = rect ? e.clientX - rect.left : 0;
                                const y = rect ? e.clientY - rect.top : 0;
                                const contentRect = bpContentRef.current?.getBoundingClientRect();
                                const gx = contentRect
                                  ? (e.clientX - contentRect.left) / Math.max(0.0001, graphZoom)
                                  : (x - graphPan.x) / Math.max(0.0001, graphZoom);
                                const gy = contentRect
                                  ? (e.clientY - contentRect.top) / Math.max(0.0001, graphZoom)
                                  : (y - graphPan.y) / Math.max(0.0001, graphZoom);
                                setLinkDrag({ active: true, x, y, gx, gy });
                                (e.currentTarget as HTMLDivElement).closest('.bp')?.setPointerCapture(e.pointerId);
                              }}
                              onPointerMove={(e) => {
                                e.stopPropagation();
                                if (!linkDrag?.active) return;
                                const rect = (e.currentTarget as HTMLDivElement).closest('.bp')?.getBoundingClientRect();
                                const x = rect ? e.clientX - rect.left : 0;
                                const y = rect ? e.clientY - rect.top : 0;
                                const contentRect = bpContentRef.current?.getBoundingClientRect();
                                const gx = contentRect
                                  ? (e.clientX - contentRect.left) / Math.max(0.0001, graphZoom)
                                  : (x - graphPan.x) / Math.max(0.0001, graphZoom);
                                const gy = contentRect
                                  ? (e.clientY - contentRect.top) / Math.max(0.0001, graphZoom)
                                  : (y - graphPan.y) / Math.max(0.0001, graphZoom);
                                setLinkDrag({ active: true, x, y, gx, gy });
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (linkingFromThis) {
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                  setStatus('Liaison annulée');
                                  return;
                                }
                                setPendingLink({ fromNodeId: n.id });
                                setPendingAutoConnect(null);
                                setStatus('Choisis une entrée');
                              }}
                            >
                              <span className="bp-pin__label">{outLabel}</span>
                              <span className={linkingFromThis ? 'bp-dot bp-dot--active' : 'bp-dot'} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {editorTab === 'python' && activeGame && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <PythonEditor
                    code={activeGame.pythonCode ?? ''}
                    onChange={code => commit(cur => ({ ...cur, games: cur.games.map(g => g.id === cur.activeGameId ? { ...g, pythonCode: code } : g) }))}
                    bridge={pyBridge}
                    tileCount={Math.max(1, Math.round(Number(activeGame.tileCount ?? 42)))}
                  />
                </div>
              )}
              {editorTab === 'ui' && activeGame && (
                <div data-tour="editor-ui" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <UIDesigner
                    components={activeGame.uiLayout ?? []}
                    onChange={comps => commit(cur => ({ ...cur, games: cur.games.map(g => g.id === cur.activeGameId ? { ...g, uiLayout: comps } : g) }))}
                    gameVariables={Object.keys(runtimeVariablesRef.current)}
                  />
                </div>
              )}
            </div>
          </section>

          <aside className="ue__right" style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="panelhead" style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Settings2 size={16} color="#1a1a1a" />
                <strong style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>Paramètres</strong>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>{selectedNode ? labelNodeKind(selectedNode.kind) : '-'}</span>
            </div>

            <div className="panelbody" style={{ padding: 20 }}>
              {!selectedNode ? (
                <div className="muted" style={{ padding: 24, textAlign: 'center', color: '#999' }}>Sélectionne un noeud dans le graphe.</div>
              ) : (
                <div className="form">
                  <label className="field">
                    <span className="g-label">Nom</span>
                    <input
                      value={selectedNode.name}
                      onChange={(e) => updateSelectedNode({ name: e.target.value })}
                      className="g-input"
                      style={{ height: 38, fontSize: 13 }}
                    />
                  </label>

                  <label className="field field--row">
                    <span className="g-label">Actif</span>
                    <input
                      type="checkbox"
                      className="g-check"
                      checked={selectedNode.enabled}
                      onChange={(e) => updateSelectedNode({ enabled: e.target.checked })}
                    />
                  </label>

                  <div className="divider" />

                  {selectedNode.kind === 'fill' ? (
                    <>
                      {(() => {
                        const color = getColor(selectedNode.params, 'color', '#6d28ff');
                        const rgb = hexToRgb(color);
                        const intensity = clamp01(getNum(selectedNode.params, 'intensity', 0.8));
                        const updateColor = (r: number, g: number, b: number) => {
                          updateSelectedParams({ color: rgbToHex(r, g, b) });
                        };

                        const SliderRow = ({ label, value, max, color: c, onChange }: { label: string; value: number; max: number; color: string; onChange: (v: number) => void }) => {
                          const pct = `${(value / max) * 100}%`;
                          const variant = c === '#e53e3e' || c === '#ef4444' ? 'g-slider--red' : c === '#38a169' || c === '#22c55e' ? 'g-slider--green' : c === '#3182ce' || c === '#3b82f6' ? 'g-slider--blue' : '';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 36px', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.02em' }}>{label}</span>
                              <input
                                type="range"
                                className={`g-slider ${variant}`}
                                min={0}
                                max={max}
                                step={1}
                                value={value}
                                onChange={(e) => onChange(Number(e.target.value))}
                                style={{ ['--pct' as any]: pct }}
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                            </div>
                          );
                        };

                        return (
                          <>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: color,
                                border: '1px solid rgba(0,0,0,0.1)',
                                flexShrink: 0,
                              }} />
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => updateSelectedParams({ color: e.target.value })}
                                style={{
                                  width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
                                  cursor: 'pointer', padding: 0, background: '#fff',
                                }}
                              />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                              display: 'grid', gap: 12,
                            }}>
                              <SliderRow label="R" value={rgb.r} max={255} color="#ef4444" onChange={(v) => updateColor(v, rgb.g, rgb.b)} />
                              <SliderRow label="G" value={rgb.g} max={255} color="#22c55e" onChange={(v) => updateColor(rgb.r, v, rgb.b)} />
                              <SliderRow label="B" value={rgb.b} max={255} color="#3b82f6" onChange={(v) => updateColor(rgb.r, rgb.g, v)} />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12, marginTop: 4,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 12, alignItems: 'center' }}>
                                <div>
                                  <span className="g-label" style={{ marginBottom: 8, display: 'block' }}>Intensité</span>
                                  <input
                                    type="range" className="g-slider g-slider--accent" min={0} max={1} step={0.01} value={intensity}
                                    onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                                    style={{ ['--pct' as any]: `${intensity * 100}%` }}
                                  />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{Math.round(intensity * 100)}%</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Durée (s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={Math.max(0, getNum(selectedNode.params, 'seconds', 1))}
                            onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })}
                            className="g-input"
                            style={{ height: 36, fontSize: 13 }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Masque</span>
                          <select
                            className="g-select"
                            style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.mask ?? 'all')}
                            onChange={(e) => updateSelectedParams({ mask: e.target.value })}
                          >
                            <option value="all">Tout</option>
                            <option value="border">Bord</option>
                            <option value="corners">Coins</option>
                            <option value="center">Centre</option>
                          </select>
                        </label>
                      </div>

                      <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4, lineHeight: 1.4 }}>Clique une dalle dans le viewport pour l'assigner.</p>
                    </>
                  ) : selectedNode.kind === 'pulse' ? (
                    <>
                      {(() => {
                        const baseColor = getColor(selectedNode.params, 'baseColor', getColor(selectedNode.params, 'color', '#ff2aa6'));
                        const targetColor = getColor(selectedNode.params, 'targetColor', getColor(selectedNode.params, 'color', '#ff2aa6'));
                        const fromI = clamp01(getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0))));
                        const toI = clamp01(getNum(selectedNode.params, 'toIntensity', clamp01(getNum(selectedNode.params, 'base', 0) + clamp01(getNum(selectedNode.params, 'amp', 0.8)))));
                        const speed = Math.max(0.01, getNum(selectedNode.params, 'speed', 1));

                        const MiniSlider = ({ label, value, max, unit, color: c, onChange }: { label: string; value: number; max: number; unit: string; color: string; onChange: (v: number) => void }) => {
                          const pct = `${(value / max) * 100}%`;
                          const variant = c === '#4361ee' ? 'g-slider--accent' : c === '#b829dd' || c === '#805ad5' ? 'g-slider--purple' : c === '#06d6a0' || c === '#319795' ? 'g-slider--teal' : 'g-slider--accent';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: 10, alignItems: 'center' }}>
                              <div>
                                <span className="g-label" style={{ marginBottom: 6, display: 'block' }}>{label}</span>
                                <input
                                  type="range" className={`g-slider ${variant}`} min={0} max={max} step={max > 2 ? 0.05 : 0.01} value={value}
                                  onChange={(e) => onChange(Number(e.target.value))}
                                  style={{ ['--pct' as any]: pct }}
                                />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{max <= 2 ? `${Math.round(value * 100)}%` : value.toFixed(1)}{unit}</span>
                            </div>
                          );
                        };

                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span className="g-label">Base</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: baseColor, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                  <input type="color" value={baseColor} onChange={(e) => updateSelectedParams({ baseColor: e.target.value })} style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0, background: '#fff' }} />
                                </div>
                              </label>
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span className="g-label">Cible</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: targetColor, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                  <input type="color" value={targetColor} onChange={(e) => updateSelectedParams({ targetColor: e.target.value })} style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0, background: '#fff' }} />
                                </div>
                              </label>
                            </div>

                            <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                              <MiniSlider label="Int. départ" value={fromI} max={1} unit="" color="#4361ee" onChange={(v) => updateSelectedParams({ fromIntensity: v })} />
                              <MiniSlider label="Int. cible" value={toI} max={1} unit="" color="#b829dd" onChange={(v) => updateSelectedParams({ toIntensity: v })} />
                              <MiniSlider label="Vitesse" value={speed} max={10} unit="" color="#06d6a0" onChange={(v) => updateSelectedParams({ speed: v })} />
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : selectedNode.kind === 'wait' ? (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Durée (secondes)</span>
                        <input
                          className="g-input"
                          type="number"
                          step={0.1}
                          style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'seconds', 1)}
                          onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })}
                        />
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Retarde l'exécution de la prochaine action dans la séquence.</p>
                    </>
                  ) : selectedNode.kind === 'game_tetris' ? (
                    <>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div>
                            <span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Vitesse (ms)</span>
                            <input
                              type="range" className="g-slider g-slider--accent" min={80} max={1200} step={10}
                              value={getNum(selectedNode.params, 'speed', 500)}
                              onChange={(e) => updateSelectedParams({ speed: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'speed', 500) - 80) / 1120) * 100}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{Math.round(getNum(selectedNode.params, 'speed', 500))}ms</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div>
                            <span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Niveau de départ</span>
                            <input
                              type="range" className="g-slider g-slider--accent" min={1} max={10} step={1}
                              value={getNum(selectedNode.params, 'startLevel', 1)}
                              onChange={(e) => updateSelectedParams({ startLevel: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'startLevel', 1) - 1) / 9) * 100}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>Niv.{Math.round(getNum(selectedNode.params, 'startLevel', 1))}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Fond</span>
                            <input type="color" value={getColor(selectedNode.params, 'bgColor', '#0a0a0f')}
                              onChange={(e) => updateSelectedParams({ bgColor: e.target.value })}
                              style={{ width: '100%', height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Bordure</span>
                            <input type="color" value={getColor(selectedNode.params, 'borderColor', '#222233')}
                              onChange={(e) => updateSelectedParams({ borderColor: e.target.value })}
                              style={{ width: '100%', height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }}
                            />
                          </label>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4, lineHeight: 1.4 }}>
                        Tetris interactif dans le viewport. Contrôles: ← → ↑ ↓ Espace.
                        <br />Les couleurs sont envoyées sur les dalles physiques en temps réel.
                      </p>
                    </>
                  ) : selectedNode.kind === 'on_timer' ? (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Intervalle (ms)</span>
                        <input className="g-input" type="number" step={100} min={50}
                          style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'intervalMs', 1000)}
                          onChange={(e) => updateSelectedParams({ intervalMs: Number(e.target.value) })}
                        />
                      </label>
                    </>
                  ) : selectedNode.kind === 'on_click' ? (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Dalle cible</span>
                        <select className="g-select" style={{ height: 36, fontSize: 13 }}
                          value={String(Math.round(getNum(selectedNode.params, 'tileIndex', 0)))}
                          onChange={(e) => updateSelectedParams({ tileIndex: Number(e.target.value) })}
                        >
                          {Array.from({ length: tileCount }, (_, i) => (
                            <option key={i} value={i}>D{i + 1}</option>
                          ))}
                        </select>
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Se déclenche quand la dalle est cliquée/touchée.</p>
                    </>
                  ) : selectedNode.kind.startsWith('cs160_') ? (
                    <>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'grid', placeItems: 'center' }}>
                            <Target size={18} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Colorimètre CS160</div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>Konica Minolta</div>
                          </div>
                        </div>
                        
                        {selectedNode.kind === 'cs160_connect' && (
                          <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                            Connecte le colorimètre CS160 via USB/RS232.
                          </p>
                        )}
                        
                        {selectedNode.kind === 'cs160_measure' && (
                          <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                            Lance une mesure one-shot (mesure + polling + lecture).
                          </p>
                        )}
                        
                        {selectedNode.kind === 'cs160_read_xyz' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 8 }}>
                              Lit les valeurs XYZ de la dernière mesure.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>X</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Y</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Z</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {selectedNode.kind === 'cs160_read_lvxy' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 8 }}>
                              Lit les valeurs Lv, x, y de la dernière mesure.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Lv</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>x</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>y</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {selectedNode.kind === 'cs160_set_backlight' && (
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="g-label">Mode rétroéclairage</span>
                            <select 
                              className="g-select" 
                              style={{ height: 36, fontSize: 13 }}
                              value={String(selectedNode.params.mode ?? 'on')}
                              onChange={(e) => updateSelectedParams({ mode: e.target.value })}
                            >
                              <option value="on">ON</option>
                              <option value="off">OFF</option>
                            </select>
                          </label>
                        )}
                        
                        {selectedNode.kind === 'cs160_set_calib_ch' && (
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="g-label">Canal de calibration</span>
                            <select 
                              className="g-select" 
                              style={{ height: 36, fontSize: 13 }}
                              value={Number(selectedNode.params.channel ?? 0)}
                              onChange={(e) => updateSelectedParams({ channel: Number(e.target.value) })}
                            >
                              {Array.from({ length: 11 }, (_, i) => (
                                <option key={i} value={i}>Canal {i}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        
                        {selectedNode.kind === 'cs160_rgb_calib' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 12 }}>
                              Calibration RGB: mesure Rouge, Vert, Bleu puis calcule la matrice.
                            </p>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>ID Calibration</span>
                                <input 
                                  type="text" 
                                  className="g-input"
                                  style={{ height: 32, fontSize: 12 }}
                                  value={String(selectedNode.params.calibId ?? 'rgb_calib_001')}
                                  onChange={(e) => updateSelectedParams({ calibId: e.target.value })}
                                />
                              </label>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>Canal cible</span>
                                <select 
                                  className="g-select" 
                                  style={{ height: 32, fontSize: 12 }}
                                  value={Number(selectedNode.params.targetChannel ?? 1)}
                                  onChange={(e) => updateSelectedParams({ targetChannel: Number(e.target.value) })}
                                >
                                  {Array.from({ length: 10 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>Canal {i + 1}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </>
                        )}
                        
                        {selectedNode.kind === 'cs160_single_calib' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 12 }}>
                              Calibration 1 point: mesure une source blanche de référence.
                            </p>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>Valeur blanc Lv (cd/m²)</span>
                                <input 
                                  type="number" 
                                  step="0.1"
                                  className="g-input"
                                  style={{ height: 32, fontSize: 12 }}
                                  value={Number(selectedNode.params.trueLv ?? 11.0)}
                                  onChange={(e) => updateSelectedParams({ trueLv: Number(e.target.value) })}
                                />
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <span className="g-label" style={{ fontSize: 11 }}>x</span>
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="g-input"
                                    style={{ height: 32, fontSize: 12 }}
                                    value={Number(selectedNode.params.trueX ?? 0.4)}
                                    onChange={(e) => updateSelectedParams({ trueX: Number(e.target.value) })}
                                  />
                                </label>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <span className="g-label" style={{ fontSize: 11 }}>y</span>
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="g-input"
                                    style={{ height: 32, fontSize: 12 }}
                                    value={Number(selectedNode.params.trueY ?? 0.4)}
                                    onChange={(e) => updateSelectedParams({ trueY: Number(e.target.value) })}
                                  />
                                </label>
                              </div>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>Canal cible</span>
                                <select 
                                  className="g-select" 
                                  style={{ height: 32, fontSize: 12 }}
                                  value={Number(selectedNode.params.targetChannel ?? 1)}
                                  onChange={(e) => updateSelectedParams({ targetChannel: Number(e.target.value) })}
                                >
                                  {Array.from({ length: 10 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>Canal {i + 1}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>
                        Utilisez le panneau CS160 dans la barre latérale pour le contrôle direct.
                      </p>
                    </>
                  ) : selectedNode.kind === 'game_simon' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#ef476f,#f72585)', display: 'grid', placeItems: 'center' }}><Brain size={18} color="#fff" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Simon</div><div style={{ fontSize: 12, opacity: 0.6 }}>Jeu de mémoire visuel</div></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Vitesse (ms)</span>
                            <input type="range" className="g-slider g-slider--accent" min={200} max={2000} step={50}
                              value={getNum(selectedNode.params, 'speed', 800)}
                              onChange={(e) => updateSelectedParams({ speed: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'speed', 800) - 200) / 1800) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{getNum(selectedNode.params, 'speed', 800)}ms</span>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Nombre de couleurs (2–4)</span>
                          <select className="g-select" style={{ height: 36, fontSize: 13 }}
                            value={String(getNum(selectedNode.params, 'colors', 4))}
                            onChange={(e) => updateSelectedParams({ colors: Number(e.target.value) })}>
                            <option value="2">2 couleurs (facile)</option>
                            <option value="3">3 couleurs (normal)</option>
                            <option value="4">4 couleurs (difficile)</option>
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Longueur max séquence</span>
                          <input className="g-input" type="number" min={3} max={30} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'maxLength', 10)}
                            onChange={(e) => updateSelectedParams({ maxLength: Number(e.target.value) })} />
                        </label>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Reproduis la séquence de couleurs sur les dalles. Chaque erreur réinitialise.</p>
                    </div>
                  ) : selectedNode.kind === 'game_memory' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#06d6a0,#0099cc)', display: 'grid', placeItems: 'center' }}><Puzzle size={18} color="#fff" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Mémoire</div><div style={{ fontSize: 12, opacity: 0.6 }}>Memory de couleurs</div></div>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Nombre de paires (2–21)</span>
                          <input className="g-input" type="number" min={2} max={21} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'pairs', 8)}
                            onChange={(e) => updateSelectedParams({ pairs: Math.max(2, Math.min(21, Number(e.target.value))) })} />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Temps révélation (ms)</span>
                            <input type="range" className="g-slider g-slider--accent" min={500} max={5000} step={100}
                              value={getNum(selectedNode.params, 'revealMs', 1500)}
                              onChange={(e) => updateSelectedParams({ revealMs: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'revealMs', 1500) - 500) / 4500) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{getNum(selectedNode.params, 'revealMs', 1500)}ms</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Retrouve les paires de dalles de même couleur. Les dalles se retournent après révélation.</p>
                    </div>
                  ) : selectedNode.kind === 'game_spectrum' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'grid', placeItems: 'center' }}><Sparkles size={18} color="#fff" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Spectre Chromatique</div><div style={{ fontSize: 12, opacity: 0.6 }}>CIE 1931 multijoueur</div></div>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Nombre de manches</span>
                          <input className="g-input" type="number" min={1} max={20} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'maxRounds', 5)}
                            onChange={(e) => updateSelectedParams({ maxRounds: Number(e.target.value) })} />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Révélation (ms)</span>
                            <input type="range" className="g-slider g-slider--accent" min={1000} max={15000} step={500}
                              value={getNum(selectedNode.params, 'revealMs', 5000)}
                              onChange={(e) => updateSelectedParams({ revealMs: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'revealMs', 5000) - 1000) / 14000) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{(getNum(selectedNode.params, 'revealMs', 5000) / 1000).toFixed(0)}s</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Temps réponse (ms)</span>
                            <input type="range" className="g-slider g-slider--accent" min={5000} max={120000} step={1000}
                              value={getNum(selectedNode.params, 'guessMs', 30000)}
                              onChange={(e) => updateSelectedParams({ guessMs: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'guessMs', 30000) - 5000) / 115000) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{(getNum(selectedNode.params, 'guessMs', 30000) / 1000).toFixed(0)}s</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Reproduis la couleur cible sur le diagramme CIE 1931. Score selon la précision chromatique.</p>
                    </div>
                  ) : selectedNode.kind === 'game_color_speed' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'grid', placeItems: 'center' }}><Zap size={18} color="#fff" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Color Speed</div><div style={{ fontSize: 12, opacity: 0.6 }}>Réaction aux couleurs</div></div>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Dalles actives</span>
                          <input className="g-input" type="number" min={1} max={42} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'tileCount', 42)}
                            onChange={(e) => updateSelectedParams({ tileCount: Math.max(1, Math.min(42, Number(e.target.value))) })} />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Durée partie (s)</span>
                            <input type="range" className="g-slider g-slider--accent" min={10} max={300} step={5}
                              value={getNum(selectedNode.params, 'gameDuration', 60)}
                              onChange={(e) => updateSelectedParams({ gameDuration: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'gameDuration', 60) - 10) / 290) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{getNum(selectedNode.params, 'gameDuration', 60)}s</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Appuie sur les dalles de la bonne couleur le plus vite possible.</p>
                    </div>
                  ) : selectedNode.kind === 'game_maitre_blanc' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', display: 'grid', placeItems: 'center' }}><Sun size={18} color="#1a1a1a" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Maître du Blanc</div><div style={{ fontSize: 12, opacity: 0.6 }}>Perception du blanc pur</div></div>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Nombre de manches</span>
                          <input className="g-input" type="number" min={1} max={30} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'rounds', 10)}
                            onChange={(e) => updateSelectedParams({ rounds: Number(e.target.value) })} />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Seuil tolérance ΔE</span>
                            <input type="range" className="g-slider g-slider--accent" min={0.005} max={0.1} step={0.005}
                              value={getNum(selectedNode.params, 'threshold', 0.025)}
                              onChange={(e) => updateSelectedParams({ threshold: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'threshold', 0.025) - 0.005) / 0.095) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>±{getNum(selectedNode.params, 'threshold', 0.025).toFixed(3)}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Trouve la combinaison RGB qui donne le blanc le plus pur. Mesuré par colorimètre CS160.</p>
                    </div>
                  ) : selectedNode.kind === 'game_puissance4' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', display: 'grid', placeItems: 'center' }}><Layers size={18} color="#fff" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Puissance 4 Chromatique</div><div style={{ fontSize: 12, opacity: 0.6 }}>4 en ligne avec teintes LED</div></div>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Mode de jeu</span>
                          <select className="g-select" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.mode ?? 'pvp')}
                            onChange={(e) => updateSelectedParams({ mode: e.target.value })}>
                            <option value="pvp">Joueur vs Joueur</option>
                            <option value="pvc">Joueur vs IA</option>
                            <option value="coop">Coopératif (même poste)</option>
                          </select>
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Couleur J1</span>
                            <input type="color" value={getColor(selectedNode.params, 'colorP1', '#f59e0b')}
                              onChange={(e) => updateSelectedParams({ colorP1: e.target.value })}
                              style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }} />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Couleur J2</span>
                            <input type="color" value={getColor(selectedNode.params, 'colorP2', '#ef4444')}
                              onChange={(e) => updateSelectedParams({ colorP2: e.target.value })}
                              style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }} />
                          </label>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Aligne 4 jetons de ta couleur en ligne, colonne ou diagonale sur les dalles LED.</p>
                    </div>
                  ) : selectedNode.kind === 'game_chasseur_gamut' ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#4ade80,#06d6a0)', display: 'grid', placeItems: 'center' }}><Target size={18} color="#fff" /></div>
                          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Chasseur de Gamut</div><div style={{ fontSize: 12, opacity: 0.6 }}>Couleurs hors-gamut sRGB</div></div>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Nombre de manches</span>
                          <input className="g-input" type="number" min={1} max={20} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'rounds', 8)}
                            onChange={(e) => updateSelectedParams({ rounds: Number(e.target.value) })} />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div><span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Temps par manche (s)</span>
                            <input type="range" className="g-slider g-slider--accent" min={5} max={60} step={1}
                              value={getNum(selectedNode.params, 'roundTimeS', 20)}
                              onChange={(e) => updateSelectedParams({ roundTimeS: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'roundTimeS', 20) - 5) / 55) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{getNum(selectedNode.params, 'roundTimeS', 20)}s</span>
                        </div>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Difficulté</span>
                          <select className="g-select" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.difficulty ?? 'normal')}
                            onChange={(e) => updateSelectedParams({ difficulty: e.target.value })}>
                            <option value="easy">Facile</option>
                            <option value="normal">Normal</option>
                            <option value="hard">Difficile</option>
                          </select>
                        </label>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Identifie les couleurs hors-gamut sRGB. Entraîne la perception colorimétrique.</p>
                    </div>
                  ) : selectedNode.kind === 'event_begin' ? (
                    <div style={{ padding: 16, borderRadius: 12, background: '#fffbeb', border: '1px solid rgba(245,158,11,0.2)', display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Zap size={18} color="#f59e0b" />
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Point d&apos;entrée</div>
                      </div>
                      <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>Démarre la séquence quand le jeu est lancé. Un seul nœud &ldquo;Évènement&rdquo; par jeu.</p>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Label (optionnel)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.label ?? '')}
                          placeholder="ex: Début du jeu"
                          onChange={(e) => updateSelectedParams({ label: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'sequence' ? (
                    <div style={{ padding: 16, borderRadius: 12, background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)', display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <GitBranch size={18} color="#f97316" />
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Séquence</div>
                      </div>
                      <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>Exécute les nœuds connectés en série, l&apos;un après l&apos;autre.</p>
                    </div>
                  ) : selectedNode.kind === 'loop_count' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nombre de répétitions</span>
                        <input className="g-input" type="number" min={1} max={1000} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'count', 3)}
                          onChange={(e) => updateSelectedParams({ count: Number(e.target.value) })} />
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Répète le corps de la boucle N fois avant de passer à la suite.</p>
                    </div>
                  ) : selectedNode.kind === 'const_number' ? (
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span className="g-label">Valeur numérique</span>
                      <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                        value={getNum(selectedNode.params, 'value', 0)}
                        onChange={(e) => updateSelectedParams({ value: Number(e.target.value) })} />
                    </label>
                  ) : selectedNode.kind === 'const_bool' ? (
                    <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input type="checkbox" className="g-check"
                        checked={Boolean(selectedNode.params.value ?? false)}
                        onChange={(e) => updateSelectedParams({ value: e.target.checked })} />
                      <span className="g-label" style={{ margin: 0 }}>Valeur booléenne</span>
                    </label>
                  ) : selectedNode.kind === 'const_color' ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <span className="g-label">Couleur</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: getColor(selectedNode.params, 'value', '#ffffff'), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                        <input type="color" value={getColor(selectedNode.params, 'value', '#ffffff')}
                          onChange={(e) => updateSelectedParams({ value: e.target.value })}
                          style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }} />
                      </div>
                    </div>
                  ) : selectedNode.kind === 'random_int' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Min</span>
                          <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'min', 0)}
                            onChange={(e) => updateSelectedParams({ min: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Max</span>
                          <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'max', 41)}
                            onChange={(e) => updateSelectedParams({ max: Number(e.target.value) })} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable résultat</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'rand')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'variable_set' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom de variable</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'x')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeur</span>
                        <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'value', 0)}
                          onChange={(e) => updateSelectedParams({ value: Number(e.target.value) })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Opération</span>
                        <select className="g-select" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.op ?? 'set')}
                          onChange={(e) => updateSelectedParams({ op: e.target.value })}>
                          <option value="set">= Assigner</option>
                          <option value="add">+= Ajouter</option>
                          <option value="sub">-= Soustraire</option>
                          <option value="mul">*= Multiplier</option>
                        </select>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'variable_get' ? (
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span className="g-label">Nom de variable</span>
                      <input className="g-input" style={{ height: 36, fontSize: 13 }}
                        value={String(selectedNode.params.name ?? 'x')}
                        onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                    </label>
                  ) : selectedNode.kind === 'add_score' ? (
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span className="g-label">Points à ajouter</span>
                      <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                        value={getNum(selectedNode.params, 'amount', 1)}
                        onChange={(e) => updateSelectedParams({ amount: Number(e.target.value) })} />
                    </label>
                  ) : selectedNode.kind === 'tetris_on_line_clear' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur efface une ou plusieurs lignes.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Lignes minimum</span>
                        <input className="g-input" type="number" min={1} max={4} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'lines', 1)}
                          onChange={(e) => updateSelectedParams({ lines: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'tetris_on_level_up' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur atteint un nouveau niveau.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Niveau déclencheur</span>
                        <input className="g-input" type="number" min={1} max={99} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'level', 2)}
                          onChange={(e) => updateSelectedParams({ level: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'tetris_on_game_over' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur perd (plateau plein). Pas de paramètre.</p>
                    </div>
                  ) : selectedNode.kind === 'tetris_set_speed' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Vitesse de chute (ms)</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input type="range" min={100} max={1500} step={50} style={{ flex: 1 }}
                            value={getNum(selectedNode.params, 'speedMs', 500)}
                            onChange={(e) => updateSelectedParams({ speedMs: Number(e.target.value) })} />
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 45, textAlign: 'right' }}>{getNum(selectedNode.params, 'speedMs', 500)}ms</span>
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'simon_on_success' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur répète correctement la séquence.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Étape (0 = toutes)</span>
                        <input className="g-input" type="number" min={0} max={50} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'step', 1)}
                          onChange={(e) => updateSelectedParams({ step: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'simon_on_fail' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur tape la mauvaise couleur.</p>
                    </div>
                  ) : selectedNode.kind === 'simon_on_complete' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand toutes les séquences sont complétées.</p>
                    </div>
                  ) : selectedNode.kind === 'simon_set_speed' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Intervalle flash (ms)</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input type="range" min={200} max={2000} step={50} style={{ flex: 1 }}
                            value={getNum(selectedNode.params, 'speedMs', 600)}
                            onChange={(e) => updateSelectedParams({ speedMs: Number(e.target.value) })} />
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 45, textAlign: 'right' }}>{getNum(selectedNode.params, 'speedMs', 600)}ms</span>
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'memory_on_match' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand une paire de dalles identiques est trouvée.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Index de paire (0 = toutes)</span>
                        <input className="g-input" type="number" min={0} max={20} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'pairIndex', 0)}
                          onChange={(e) => updateSelectedParams({ pairIndex: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'memory_on_fail' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur retourne deux dalles différentes.</p>
                    </div>
                  ) : selectedNode.kind === 'memory_on_complete' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand toutes les paires sont trouvées.</p>
                    </div>
                  ) : selectedNode.kind === 'spectrum_on_submit' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand un joueur soumet sa réponse.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Siège (0 = tous)</span>
                        <input className="g-input" type="number" min={0} max={30} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'seat', 0)}
                          onChange={(e) => updateSelectedParams({ seat: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'spectrum_on_round_end' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché à la fin de chaque round de Spectre Chromatique.</p>
                    </div>
                  ) : selectedNode.kind === 'spectrum_on_game_over' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché à la fin de la partie Spectre.</p>
                    </div>
                  ) : selectedNode.kind === 'cspeed_on_hit' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur tape la bonne dalle colorée.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Index dalle (0 = toutes)</span>
                        <input className="g-input" type="number" min={0} max={41} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'tileIndex', 0)}
                          onChange={(e) => updateSelectedParams({ tileIndex: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'cspeed_on_miss' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur tape la mauvaise dalle.</p>
                    </div>
                  ) : selectedNode.kind === 'cspeed_on_time_up' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le temps de la partie Color Speed est écoulé.</p>
                    </div>
                  ) : selectedNode.kind === 'p4_on_win' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand un joueur gagne à Puissance 4.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Joueur (1 ou 2, 0 = tous)</span>
                        <input className="g-input" type="number" min={0} max={2} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'player', 1)}
                          onChange={(e) => updateSelectedParams({ player: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'p4_on_draw' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand la partie se termine par un match nul.</p>
                    </div>
                  ) : selectedNode.kind === 'p4_set_color' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Joueur</span>
                        <select className="g-select" style={{ height: 36, fontSize: 13 }}
                          value={String(getNum(selectedNode.params, 'player', 1))}
                          onChange={(e) => updateSelectedParams({ player: Number(e.target.value) })}>
                          <option value="1">Joueur 1</option>
                          <option value="2">Joueur 2</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Couleur</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: getColor(selectedNode.params, 'color', '#f59e0b'), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                          <input type="color" value={getColor(selectedNode.params, 'color', '#f59e0b')}
                            onChange={(e) => updateSelectedParams({ color: e.target.value })}
                            style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }} />
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'gamut_on_hit' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur identifie correctement une couleur hors-gamut.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Round (0 = tous)</span>
                        <input className="g-input" type="number" min={0} max={20} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'round', 1)}
                          onChange={(e) => updateSelectedParams({ round: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'gamut_on_miss' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur rate l&apos;identification hors-gamut.</p>
                    </div>
                  ) : selectedNode.kind === 'gamut_on_complete' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand toutes les rounds du Chasseur de Gamut sont terminées.</p>
                    </div>
                  ) : selectedNode.kind === 'measure_start' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Lance une mesure colorimétrique via le CS-160. Connectez la sortie à <strong>measure_on_result</strong>.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Timeout (sec)</span>
                        <input className="g-input" type="number" min={1} max={30} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'timeoutSec', 5)}
                          onChange={(e) => updateSelectedParams({ timeoutSec: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'measure_on_result' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand la mesure CS-160 est reçue. Les coordonnées CIE xy et la luminance Lv sont stockées dans des variables.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable x</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varX ?? 'meas_x')}
                          onChange={(e) => updateSelectedParams({ varX: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable y</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varY ?? 'meas_y')}
                          onChange={(e) => updateSelectedParams({ varY: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable Lv (luminance)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varLv ?? 'meas_lv')}
                          onChange={(e) => updateSelectedParams({ varLv: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'measure_compare' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Compare la dernière mesure à une cible CIE xy. Retourne vrai si ΔE &lt; tolérance.</p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Cible x</span>
                          <input className="g-input" type="number" step={0.001} min={0} max={1} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'targetX', 0.3127)}
                            onChange={(e) => updateSelectedParams({ targetX: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Cible y</span>
                          <input className="g-input" type="number" step={0.001} min={0} max={1} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'targetY', 0.329)}
                            onChange={(e) => updateSelectedParams({ targetY: Number(e.target.value) })} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Tolérance ΔE</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input type="range" min={1} max={20} step={0.5} style={{ flex: 1 }}
                            value={getNum(selectedNode.params, 'toleranceDeltaE', 5)}
                            onChange={(e) => updateSelectedParams({ toleranceDeltaE: Number(e.target.value) })} />
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 30 }}>ΔE {getNum(selectedNode.params, 'toleranceDeltaE', 5)}</span>
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'measure_show_cie' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Affiche un diagramme CIE 1931 avec la mesure et la cible dans l&apos;interface du jeu.</p>
                      </div>
                      <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="checkbox" className="g-check"
                          checked={Boolean(selectedNode.params.showTarget ?? true)}
                          onChange={(e) => updateSelectedParams({ showTarget: e.target.checked })} />
                        <span className="g-label" style={{ margin: 0 }}>Afficher la cible</span>
                      </label>
                      <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="checkbox" className="g-check"
                          checked={Boolean(selectedNode.params.showResult ?? true)}
                          onChange={(e) => updateSelectedParams({ showResult: e.target.checked })} />
                        <span className="g-label" style={{ margin: 0 }}>Afficher le résultat</span>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'measure_target_xy' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Label de la cible</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.label ?? 'D65')}
                          onChange={(e) => updateSelectedParams({ label: e.target.value })} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">x CIE</span>
                          <input className="g-input" type="number" step={0.001} min={0} max={0.8} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'x', 0.3127)}
                            onChange={(e) => updateSelectedParams({ x: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">y CIE</span>
                          <input className="g-input" type="number" step={0.001} min={0} max={0.9} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'y', 0.329)}
                            onChange={(e) => updateSelectedParams({ y: Number(e.target.value) })} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Tolérance ΔE</span>
                        <input className="g-input" type="number" step={0.5} min={0.5} max={30} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'toleranceDeltaE', 3)}
                          onChange={(e) => updateSelectedParams({ toleranceDeltaE: Number(e.target.value) })} />
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>D65 = (0.3127, 0.3290) · D50 = (0.3457, 0.3585) · Illuminant A = (0.4476, 0.4074)</p>
                    </div>
                  ) : selectedNode.kind === 'ui_button' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Bouton cliquable affiché dans l&apos;interface du jeu. Utilisez <strong>on_ui_click</strong> pour déclencher des actions.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ID du bouton</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.id ?? 'btn1')}
                          placeholder="ex: btn_start"
                          onChange={(e) => updateSelectedParams({ id: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Texte du bouton</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.label ?? 'Cliquer')}
                          placeholder="ex: Démarrer"
                          onChange={(e) => updateSelectedParams({ label: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Couleur</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: getColor(selectedNode.params, 'color', '#4361ee'), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                          <input type="color" value={getColor(selectedNode.params, 'color', '#4361ee')}
                            onChange={(e) => updateSelectedParams({ color: e.target.value })}
                            style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }} />
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'ui_label' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Texte affiché</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.text ?? 'Texte')}
                          onChange={(e) => updateSelectedParams({ text: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Taille (px)</span>
                        <input className="g-input" type="number" min={10} max={96} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'size', 16)}
                          onChange={(e) => updateSelectedParams({ size: Number(e.target.value) })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Couleur texte</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: getColor(selectedNode.params, 'color', '#1a1d2e'), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                          <input type="color" value={getColor(selectedNode.params, 'color', '#1a1d2e')}
                            onChange={(e) => updateSelectedParams({ color: e.target.value })}
                            style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }} />
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'ui_counter' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Affiche un compteur numérique (score, vies, etc.) dans l&apos;interface du jeu.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ID du compteur</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.id ?? 'counter1')}
                          placeholder="ex: score_display"
                          onChange={(e) => updateSelectedParams({ id: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Label</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.label ?? 'Score')}
                          onChange={(e) => updateSelectedParams({ label: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeur initiale</span>
                        <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'value', 0)}
                          onChange={(e) => updateSelectedParams({ value: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'ui_timer_display' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ID de la minuterie</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.id ?? 'timer1')}
                          placeholder="ex: game_timer"
                          onChange={(e) => updateSelectedParams({ id: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Durée (secondes)</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input type="range" min={5} max={600} step={5} style={{ flex: 1 }}
                            value={getNum(selectedNode.params, 'durationSec', 60)}
                            onChange={(e) => updateSelectedParams({ durationSec: Number(e.target.value) })} />
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{getNum(selectedNode.params, 'durationSec', 60)}s</span>
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'ui_progress' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ID de la barre</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.id ?? 'progress1')}
                          placeholder="ex: health_bar"
                          onChange={(e) => updateSelectedParams({ id: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Label</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.label ?? 'Vie')}
                          onChange={(e) => updateSelectedParams({ label: e.target.value })} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Valeur</span>
                          <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'value', 100)}
                            onChange={(e) => updateSelectedParams({ value: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Maximum</span>
                          <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'max', 100)}
                            onChange={(e) => updateSelectedParams({ max: Number(e.target.value) })} />
                        </label>
                      </div>
                    </div>
                  ) : selectedNode.kind === 'ui_show' || selectedNode.kind === 'ui_hide' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
                          {selectedNode.kind === 'ui_show' ? 'Affiche un élément UI caché.' : 'Masque un élément UI visible.'}
                        </p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ID de l&apos;élément cible</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.targetId ?? 'btn1')}
                          placeholder="ex: btn_start"
                          onChange={(e) => updateSelectedParams({ targetId: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'on_ui_click' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Évènement déclenché quand le joueur clique sur un bouton UI. Reliez à une séquence d&apos;actions.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ID du bouton</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.buttonId ?? 'btn1')}
                          placeholder="ex: btn_start"
                          onChange={(e) => updateSelectedParams({ buttonId: e.target.value })} />
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>L&apos;ID doit correspondre à celui du nœud <strong>Bouton</strong> correspondant.</p>
                    </div>
                  ) : ['math_add','math_sub','math_mul','math_div','math_clamp01','math_lerp','compare_eq','compare_gt','compare_lt','logic_and','logic_or','logic_not','time_seconds','random_01','get_score'].includes(selectedNode.kind) ? (
                    <div style={{ padding: 16, borderRadius: 12, background: '#f8f9ff', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                        {selectedNode.kind === 'math_lerp' ? 'Interpolation linéaire A→B selon t (0..1).' :
                         selectedNode.kind === 'math_clamp01' ? 'Borne la valeur entre 0 et 1.' :
                         selectedNode.kind === 'time_seconds' ? 'Retourne le temps écoulé en secondes.' :
                         selectedNode.kind === 'random_01' ? 'Génère un nombre aléatoire entre 0 et 1.' :
                         selectedNode.kind === 'get_score' ? 'Retourne le score actuel du joueur.' :
                         'Nœud de calcul. Connectez les entrées A et B.'}
                      </p>
                    </div>
                  ) : selectedNode.kind === 'round_start' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Démarre une manche. Incrémente le compteur de manches. Connectez à <strong>gen_target_color</strong> pour générer la couleur cible.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nombre total de manches</span>
                        <input className="g-input" type="number" min={1} max={99} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'totalRounds', 5)}
                          onChange={(e) => updateSelectedParams({ totalRounds: Number(e.target.value) })} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={Boolean(selectedNode.params.resetScore)} onChange={(e) => updateSelectedParams({ resetScore: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Réinitialiser le score au début</span>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'round_end' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Marque la fin d&apos;une manche. Émet l&apos;événement <code>round_end</code>. Connectez à <strong>next_round</strong> ou aux nœuds de score.</p>
                    </div>
                  ) : selectedNode.kind === 'next_round' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Passe à la manche suivante. Incrémente le compteur de manches et continue l&apos;exécution.</p>
                    </div>
                  ) : selectedNode.kind === 'get_round' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Lit le numéro de manche courant et le stocke dans une variable.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable destination</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'round')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'gen_target_color' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Génère une couleur cible aléatoire et la stocke dans une variable. Peut l&apos;afficher directement sur les dalles.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Mode de génération</span>
                        <select className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.mode ?? 'random')}
                          onChange={(e) => updateSelectedParams({ mode: e.target.value })}>
                          <option value="random">Aléatoire (RGB)</option>
                          <option value="blackbody">Température de corps noir</option>
                          <option value="pastel">Pastel</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable destination</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'target')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={Boolean(selectedNode.params.displayOnPlates ?? true)} onChange={(e) => updateSelectedParams({ displayOnPlates: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Afficher sur les dalles</span>
                      </label>
                      {Boolean(selectedNode.params.displayOnPlates ?? true) && (
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Durée d&apos;affichage (secondes)</span>
                          <input className="g-input" type="number" step={0.5} min={0} max={30} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'displaySeconds', 3)}
                            onChange={(e) => updateSelectedParams({ displaySeconds: Number(e.target.value) })} />
                        </label>
                      )}
                    </div>
                  ) : selectedNode.kind === 'color_distance' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Calcule la distance ΔE CIE76 entre deux couleurs stockées dans des variables. Résultat : 0 = identique, 100+ = très différent.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable couleur A (cible)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.colorAVar ?? 'target')}
                          onChange={(e) => updateSelectedParams({ colorAVar: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable couleur B (joueur)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.colorBVar ?? 'player')}
                          onChange={(e) => updateSelectedParams({ colorBVar: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable résultat (ΔE)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'deltaE')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'color_match_score' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Convertit un ΔE en score (0–maxScore). Ajoute automatiquement le score au total. ΔE = 0 → score max. ΔE ≥ maxΔE → 0 points.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable ΔE source</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.deltaEVar ?? 'deltaE')}
                          onChange={(e) => updateSelectedParams({ deltaEVar: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">ΔE maximal (= 0 points)</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input type="range" min={5} max={100} step={1} style={{ flex: 1 }}
                            value={getNum(selectedNode.params, 'maxDeltaE', 50)}
                            onChange={(e) => updateSelectedParams({ maxDeltaE: Number(e.target.value) })} />
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 30 }}>ΔE {getNum(selectedNode.params, 'maxDeltaE', 50)}</span>
                        </div>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Score maximal</span>
                        <input className="g-input" type="number" min={1} max={10000} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'maxScore', 100)}
                          onChange={(e) => updateSelectedParams({ maxScore: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'show_target_on_plates' || selectedNode.kind === 'hardware_send_color' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable couleur source</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'target')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Intensité</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input type="range" min={0} max={1} step={0.05} style={{ flex: 1 }}
                            value={clamp01(getNum(selectedNode.params, 'intensity', 0.85))}
                            onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })} />
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36 }}>{Math.round(clamp01(getNum(selectedNode.params, 'intensity', 0.85)) * 100)}%</span>
                        </div>
                      </label>
                    </div>
                  ) : selectedNode.kind === 'hardware_flash' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Flash instantané sur toutes les dalles, puis retour à l&apos;état précédent. Utile pour la rétroaction (bonne/mauvaise réponse).</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Couleur du flash</span>
                        <input type="color" value={getColor(selectedNode.params, 'color', '#ffffff')}
                          onChange={(e) => updateSelectedParams({ color: e.target.value })}
                          style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Durée (ms)</span>
                        <input className="g-input" type="number" min={50} max={2000} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'durationMs', 200)}
                          onChange={(e) => updateSelectedParams({ durationMs: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'get_player_rgb' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Lit les valeurs actuelles des sliders RGB du joueur et les stocke dans des variables. La couleur combinée est aussi stockée.</p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Var R</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.varR ?? 'playerR')} onChange={(e) => updateSelectedParams({ varR: e.target.value })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Var G</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.varG ?? 'playerG')} onChange={(e) => updateSelectedParams({ varG: e.target.value })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Var B</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.varB ?? 'playerB')} onChange={(e) => updateSelectedParams({ varB: e.target.value })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Var couleur</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.varColor ?? 'player')} onChange={(e) => updateSelectedParams({ varColor: e.target.value })} />
                        </label>
                      </div>
                    </div>
                  ) : selectedNode.kind === 'countdown_start' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Démarre un compte à rebours. À zéro, déclenche les nœuds <strong>on_countdown_end</strong> avec le même nom de variable.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Durée (secondes)</span>
                        <input className="g-input" type="number" min={1} max={600} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'seconds', 30)}
                          onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom du chronomètre (variable)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'countdown')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'countdown_stop' || selectedNode.kind === 'on_countdown_end' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom du chronomètre (variable)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'countdown')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'wait_event' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Suspend l&apos;exécution jusqu&apos;à ce que l&apos;événement spécifié soit émis (par <strong>emit_event</strong> ou <strong>on_submit_answer</strong>). Timeout = reprise automatique.</p>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Type d&apos;événement</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.eventType ?? 'submit')}
                          onChange={(e) => updateSelectedParams({ eventType: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Timeout (ms, 0 = infini)</span>
                        <input className="g-input" type="number" min={0} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'timeoutMs', 30000)}
                          onChange={(e) => updateSelectedParams({ timeoutMs: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'emit_event' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Type d&apos;événement à émettre</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.eventType ?? 'submit')}
                          onChange={(e) => updateSelectedParams({ eventType: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'on_submit_answer' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Déclenché quand le joueur soumet sa réponse (bouton &quot;Soumettre&quot; ou appel à <code>window.__colorroom_submit()</code>). Les sliders joueur doivent être lus via <strong>get_player_rgb</strong>.</p>
                    </div>
                  ) : selectedNode.kind === 'score_reset' ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>Remet le score à zéro.</p>
                    </div>
                  ) : selectedNode.kind === 'score_set' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeur du score</span>
                        <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'value', 0)}
                          onChange={(e) => updateSelectedParams({ value: Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'score_get' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable destination</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'score')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'var_color_set' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom de la variable couleur</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'color1')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeur initiale</span>
                        <input type="color" value={getColor(selectedNode.params, 'value', '#ff2200')}
                          onChange={(e) => updateSelectedParams({ value: e.target.value })}
                          style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                      </label>
                    </div>
                  ) : selectedNode.kind === 'var_color_get' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable source</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'color1')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable destination</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'myColor')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                    </div>

                  ) : selectedNode.kind === 'array_literal' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', fontSize: 12, color: 'var(--c-content)', lineHeight: 1.5 }}>
                        Tableau initialisé avec des valeurs fixes. Séparez par des virgules. Utilisez <code>null</code> pour une cellule vide.
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom du tableau</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'arr')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeurs (séparées par virgules)</span>
                        <textarea className="g-input" rows={4} style={{ fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
                          value={String(selectedNode.params.values ?? '')}
                          placeholder="1,0,1,0,null,1,..."
                          onChange={(e) => updateSelectedParams({ values: e.target.value })} />
                      </label>
                      <div style={{ fontSize: 11, color: 'var(--c-content)', opacity: 0.5 }}>
                        Longueur actuelle : {String(selectedNode.params.values ?? '').split(',').filter(v => v.trim() !== '').length} éléments
                      </div>
                    </div>

                  ) : selectedNode.kind === 'for_range' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', fontSize: 12, lineHeight: 1.5 }}>
                        Exécute le <strong>Corps de boucle</strong> pour chaque valeur de <em>i</em>. Après la boucle, suit les connexions normales.
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable compteur (i)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.varName ?? 'i')}
                          onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Début</span>
                          <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'start', 0)}
                            onChange={(e) => updateSelectedParams({ start: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Fin (inclus)</span>
                          <input className="g-input" type="number" style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'end', 41)}
                            onChange={(e) => updateSelectedParams({ end: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Pas</span>
                          <input className="g-input" type="number" min={1} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'step', 1)}
                            onChange={(e) => updateSelectedParams({ step: Math.max(1, Number(e.target.value)) })} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Corps de boucle (nœud exécuté à chaque tour)</span>
                        <select className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.bodyNodeId ?? '')}
                          onChange={(e) => updateSelectedParams({ bodyNodeId: e.target.value })}>
                          <option value="">- Aucun -</option>
                          {activeGame?.nodes.filter(n => n.id !== selectedNode.id).map(n => (
                            <option key={n.id} value={n.id}>{n.name} ({n.kind})</option>
                          ))}
                        </select>
                      </label>
                      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.04)', fontSize: 11, opacity: 0.6 }}>
                        Plage : {getNum(selectedNode.params,'start',0)} → {getNum(selectedNode.params,'end',41)}, pas {getNum(selectedNode.params,'step',1)} → {Math.max(0, Math.floor((getNum(selectedNode.params,'end',41) - getNum(selectedNode.params,'start',0)) / Math.max(1,getNum(selectedNode.params,'step',1))) + 1)} itérations
                      </div>
                    </div>

                  ) : selectedNode.kind === 'for_each_array' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', fontSize: 12, lineHeight: 1.5 }}>
                        Itère sur chaque élément d&apos;un tableau. La variable <em>item</em> contient la valeur courante.
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Tableau source</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.arrayName ?? 'arr')}
                          onChange={(e) => updateSelectedParams({ arrayName: e.target.value })} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Variable valeur</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.varName ?? 'item')}
                            onChange={(e) => updateSelectedParams({ varName: e.target.value })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Variable index (optionnel)</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.indexVar ?? '')}
                            placeholder="idx"
                            onChange={(e) => updateSelectedParams({ indexVar: e.target.value || undefined })} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Corps de boucle (nœud exécuté à chaque élément)</span>
                        <select className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.bodyNodeId ?? '')}
                          onChange={(e) => updateSelectedParams({ bodyNodeId: e.target.value })}>
                          <option value="">- Aucun -</option>
                          {activeGame?.nodes.filter(n => n.id !== selectedNode.id).map(n => (
                            <option key={n.id} value={n.id}>{n.name} ({n.kind})</option>
                          ))}
                        </select>
                      </label>
                    </div>

                  ) : selectedNode.kind === 'array_create' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom du tableau</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'arr')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Taille</span>
                        <input className="g-input" type="number" min={0} max={10000} style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'size', 42)}
                          onChange={(e) => updateSelectedParams({ size: Number(e.target.value) })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeur initiale (null = vide)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={selectedNode.params.initValue === null || selectedNode.params.initValue === undefined ? 'null' : String(selectedNode.params.initValue)}
                          onChange={(e) => { const v = e.target.value; updateSelectedParams({ initValue: v === 'null' ? null : isNaN(Number(v)) ? v : Number(v) }); }} />
                      </label>
                    </div>

                  ) : selectedNode.kind === 'array_get' || selectedNode.kind === 'tile_get_var' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {selectedNode.kind === 'array_get' && <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Tableau</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.arrayName ?? 'arr')} onChange={(e) => updateSelectedParams({ arrayName: e.target.value })} /></label>}
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable index</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.indexVar ?? 'i')}
                          onChange={(e) => updateSelectedParams({ indexVar: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable résultat</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params[selectedNode.kind === 'tile_get_var' ? 'outColorVar' : 'outVar'] ?? (selectedNode.kind === 'tile_get_var' ? 'tileColor' : 'item'))}
                          onChange={(e) => updateSelectedParams({ [selectedNode.kind === 'tile_get_var' ? 'outColorVar' : 'outVar']: e.target.value })} />
                      </label>
                    </div>

                  ) : selectedNode.kind === 'array_set' || selectedNode.kind === 'tile_set_var' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {selectedNode.kind === 'array_set' && <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Tableau</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.arrayName ?? 'arr')} onChange={(e) => updateSelectedParams({ arrayName: e.target.value })} /></label>}
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable index</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.indexVar ?? 'i')}
                          onChange={(e) => updateSelectedParams({ indexVar: e.target.value })} />
                      </label>
                      {selectedNode.kind === 'array_set' && (
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Variable valeur</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.valueVar ?? 'val')}
                            onChange={(e) => updateSelectedParams({ valueVar: e.target.value })} />
                        </label>
                      )}
                      {selectedNode.kind === 'tile_set_var' && (
                        <>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Variable couleur (color var)</span>
                            <input className="g-input" style={{ height: 36, fontSize: 13 }}
                              value={String(selectedNode.params.colorVar ?? 'color')}
                              onChange={(e) => updateSelectedParams({ colorVar: e.target.value })} />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Intensité (0–1)</span>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <input type="range" min={0} max={1} step={0.05} style={{ flex: 1 }}
                                value={clamp01(getNum(selectedNode.params, 'intensity', 0.85))}
                                onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })} />
                              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36 }}>{Math.round(clamp01(getNum(selectedNode.params, 'intensity', 0.85)) * 100)}%</span>
                            </div>
                          </label>
                        </>
                      )}
                    </div>

                  ) : selectedNode.kind === 'tiles_from_array' || selectedNode.kind === 'grid_sync_tiles' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(67,97,238,0.07)', border: '1px solid rgba(67,97,238,0.18)', fontSize: 12, lineHeight: 1.5 }}>
                        {selectedNode.kind === 'tiles_from_array' ? 'Synchronise un tableau 1D de couleurs vers les 42 dalles LED.' : 'Synchronise une grille 2D vers les dalles LED (colonne-majeur).'}
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">{selectedNode.kind === 'grid_sync_tiles' ? 'Nom de la grille' : 'Nom du tableau'}</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params[selectedNode.kind === 'grid_sync_tiles' ? 'name' : 'arrayName'] ?? (selectedNode.kind === 'grid_sync_tiles' ? 'grid' : 'arr'))}
                          onChange={(e) => updateSelectedParams({ [selectedNode.kind === 'grid_sync_tiles' ? 'name' : 'arrayName']: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Couleur fond (cellule nulle)</span>
                        <input type="color" value={getColor(selectedNode.params, 'bgColor', '#000000')}
                          onChange={(e) => updateSelectedParams({ bgColor: e.target.value })}
                          style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                      </label>
                      {selectedNode.kind === 'tiles_from_array' && (
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Intensité des dalles actives</span>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input type="range" min={0} max={1} step={0.05} style={{ flex: 1 }}
                              value={clamp01(getNum(selectedNode.params, 'intensity', 0.85))}
                              onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })} />
                            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36 }}>{Math.round(clamp01(getNum(selectedNode.params, 'intensity', 0.85)) * 100)}%</span>
                          </div>
                        </label>
                      )}
                    </div>

                  ) : selectedNode.kind === 'grid_create' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom de la grille</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'grid')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Colonnes</span>
                          <input className="g-input" type="number" min={1} max={42} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'cols', 6)}
                            onChange={(e) => updateSelectedParams({ cols: Number(e.target.value) })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Lignes</span>
                          <input className="g-input" type="number" min={1} max={42} style={{ height: 36, fontSize: 13 }}
                            value={getNum(selectedNode.params, 'rows', 7)}
                            onChange={(e) => updateSelectedParams({ rows: Number(e.target.value) })} />
                        </label>
                      </div>
                      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.04)', fontSize: 11, opacity: 0.6 }}>
                        {getNum(selectedNode.params,'cols',6)} × {getNum(selectedNode.params,'rows',7)} = {getNum(selectedNode.params,'cols',6) * getNum(selectedNode.params,'rows',7)} cellules - variables auto : <code>{String(selectedNode.params.name??'grid')}_cols</code>, <code>{String(selectedNode.params.name??'grid')}_rows</code>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Valeur initiale (null = vide)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={selectedNode.params.initValue === null || selectedNode.params.initValue === undefined ? 'null' : String(selectedNode.params.initValue)}
                          onChange={(e) => { const v = e.target.value; updateSelectedParams({ initValue: v === 'null' ? null : isNaN(Number(v)) ? v : Number(v) }); }} />
                      </label>
                    </div>

                  ) : selectedNode.kind === 'grid_get' || selectedNode.kind === 'grid_set' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom de la grille</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'grid')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Variable colonne</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.colVar ?? 'col')}
                            onChange={(e) => updateSelectedParams({ colVar: e.target.value })} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Variable ligne</span>
                          <input className="g-input" style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.rowVar ?? 'row')}
                            onChange={(e) => updateSelectedParams({ rowVar: e.target.value })} />
                        </label>
                      </div>
                      {selectedNode.kind === 'grid_get'
                        ? <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable résultat</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.outVar ?? 'cell')} onChange={(e) => updateSelectedParams({ outVar: e.target.value })} /></label>
                        : <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable valeur à écrire</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.valueVar ?? 'val')} onChange={(e) => updateSelectedParams({ valueVar: e.target.value })} /></label>
                      }
                    </div>

                  ) : selectedNode.kind === 'grid_check_4_in_row' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', fontSize: 12, lineHeight: 1.5 }}>
                        Vérifie si la valeur de <em>valueVar</em> forme 4 cellules consécutives dans la grille (horizontal, vertical, diagonal). Résultat dans <em>outVar</em> : 1 = gagné, 0 = non.
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom de la grille</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'grid')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable valeur à chercher</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.valueVar ?? 'lastColor')}
                          onChange={(e) => updateSelectedParams({ valueVar: e.target.value })} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Variable résultat (0/1)</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.outVar ?? 'hasWon')}
                          onChange={(e) => updateSelectedParams({ outVar: e.target.value })} />
                      </label>
                    </div>

                  ) : selectedNode.kind === 'define_sub' || selectedNode.kind === 'call_sub' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', fontSize: 12, lineHeight: 1.5 }}>
                        {selectedNode.kind === 'define_sub' ? 'Définit un sous-programme réutilisable. Les nœuds connectés en sortie forment le corps du sous-programme.' : 'Appelle un sous-programme défini par un nœud define_sub. L\'exécution revient ensuite à la suite.'}
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Nom du sous-programme</span>
                        <input className="g-input" style={{ height: 36, fontSize: 13 }}
                          value={String(selectedNode.params.name ?? 'mySub')}
                          onChange={(e) => updateSelectedParams({ name: e.target.value })} />
                      </label>
                      {selectedNode.kind === 'call_sub' && (
                        <div style={{ fontSize: 11, opacity: 0.6 }}>
                          Sous-programmes définis : {activeGame?.nodes.filter(n => n.kind === 'define_sub').map(n => String(n.params.name ?? 'mySub')).join(', ') || '(aucun)'}
                        </div>
                      )}
                    </div>

                  ) : ['math_mod','math_min','math_max','math_pow'].includes(selectedNode.kind) ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable a</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.aVar ?? 'a')} onChange={(e) => updateSelectedParams({ aVar: e.target.value })} /></label>
                        <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable b</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.bVar ?? 'b')} onChange={(e) => updateSelectedParams({ bVar: e.target.value })} /></label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable résultat</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.outVar ?? 'result')} onChange={(e) => updateSelectedParams({ outVar: e.target.value })} /></label>
                    </div>

                  ) : ['math_floor','math_ceil','math_round','math_abs','math_sqrt'].includes(selectedNode.kind) ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable x</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.varName ?? 'x')} onChange={(e) => updateSelectedParams({ varName: e.target.value })} /></label>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable résultat</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.outVar ?? 'result')} onChange={(e) => updateSelectedParams({ outVar: e.target.value })} /></label>
                    </div>

                  ) : selectedNode.kind === 'string_concat' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable a</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.aVar ?? 'a')} onChange={(e) => updateSelectedParams({ aVar: e.target.value })} /></label>
                        <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable b</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.bVar ?? 'b')} onChange={(e) => updateSelectedParams({ bVar: e.target.value })} /></label>
                      </div>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable résultat</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.outVar ?? 'result')} onChange={(e) => updateSelectedParams({ outVar: e.target.value })} /></label>
                    </div>

                  ) : selectedNode.kind === 'string_from_num' ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable nombre</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.varName ?? 'x')} onChange={(e) => updateSelectedParams({ varName: e.target.value })} /></label>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Variable texte résultat</span><input className="g-input" style={{ height: 36, fontSize: 13 }} value={String(selectedNode.params.outVar ?? 'text')} onChange={(e) => updateSelectedParams({ outVar: e.target.value })} /></label>
                      <label style={{ display: 'grid', gap: 4 }}><span className="g-label">Décimales</span><input className="g-input" type="number" min={0} max={10} style={{ height: 36, fontSize: 13 }} value={getNum(selectedNode.params,'decimals',0)} onChange={(e) => updateSelectedParams({ decimals: Number(e.target.value) })} /></label>
                    </div>

                  ) : (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Dalle</span>
                        <select
                          className="g-select"
                          style={{ height: 36, fontSize: 13 }}
                          value={String(Math.max(0, Math.min(tileCount - 1, Math.round(getNum(selectedNode.params, 'tileIndex', 0)))))}
                          onChange={(e) => {
                            const idx = Math.max(0, Math.min(tileCount - 1, Number(e.target.value)));
                            setSelectedTileIndex(idx);
                            updateSelectedParams({ tileIndex: idx });
                          }}
                        >
                          {Array.from({ length: tileCount }, (_, i) => (
                            <option key={i} value={i}>
                              D{i + 1}
                            </option>
                          ))}
                        </select>
                      </label>

                      {(() => {
                        const color = getColor(selectedNode.params, 'color', '#ff2aa6');
                        const rgb = hexToRgb(color);
                        const intensity = clamp01(getNum(selectedNode.params, 'intensity', 0.85));
                        const updateColor = (r: number, g: number, b: number) => {
                          updateSelectedParams({ color: rgbToHex(r, g, b) });
                        };

                        const SliderRow = ({ label, value, max, color: c, onChange }: { label: string; value: number; max: number; color: string; onChange: (v: number) => void }) => {
                          const pct = `${(value / max) * 100}%`;
                          const variant = c === '#e53e3e' || c === '#ef4444' ? 'g-slider--red' : c === '#38a169' || c === '#22c55e' ? 'g-slider--green' : c === '#3182ce' || c === '#3b82f6' ? 'g-slider--blue' : '';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 36px', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.02em' }}>{label}</span>
                              <input
                                type="range"
                                className={`g-slider ${variant}`}
                                min={0}
                                max={max}
                                step={1}
                                value={value}
                                onChange={(e) => onChange(Number(e.target.value))}
                                style={{ ['--pct' as any]: pct }}
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                            </div>
                          );
                        };

                        return (
                          <>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: color,
                                border: '1px solid rgba(0,0,0,0.1)',
                                flexShrink: 0,
                              }} />
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => updateSelectedParams({ color: e.target.value })}
                                style={{
                                  width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
                                  cursor: 'pointer', padding: 0, background: '#fff',
                                }}
                              />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                              display: 'grid', gap: 12,
                            }}>
                              <SliderRow label="R" value={rgb.r} max={255} color="#ef4444" onChange={(v) => updateColor(v, rgb.g, rgb.b)} />
                              <SliderRow label="G" value={rgb.g} max={255} color="#22c55e" onChange={(v) => updateColor(rgb.r, v, rgb.b)} />
                              <SliderRow label="B" value={rgb.b} max={255} color="#3b82f6" onChange={(v) => updateColor(rgb.r, rgb.g, v)} />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12, marginTop: 4,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 12, alignItems: 'center' }}>
                                <div>
                                  <span className="g-label" style={{ marginBottom: 8, display: 'block' }}>Intensité</span>
                                  <input
                                    type="range" className="g-slider g-slider--accent" min={0} max={1} step={0.01} value={intensity}
                                    onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                                    style={{ ['--pct' as any]: `${intensity * 100}%` }}
                                  />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{Math.round(intensity * 100)}%</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4, lineHeight: 1.4 }}>Clique une dalle dans le viewport pour l'assigner.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* CS160 Colorimeter Panel */}
            <div style={{ marginTop: 16, padding: '0 20px 20px' }}>
              <CS160Panel />
            </div>
        </aside>
      </div>

      {/* Modal de création de projet amélioré */}
      {modal?.type === 'create-project' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
          }}
          onClick={() => setModal(null)}
        >
          <div
            className="g-glass"
            style={{
              width: 'min(520px, calc(100vw - 40px))',
              padding: 28,
              borderRadius: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #4361ee, #3a56d4)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <FolderPlus size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Nouveau projet</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.6 }}>Créez un jeu lumineux interactif</p>
                </div>
              </div>
              <button
                className="g-btn g-btn--icon"
                onClick={() => setModal(null)}
                style={{ width: 38, height: 38 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                  Nom du projet
                </label>
                <input
                  type="text"
                  className="g-input"
                  placeholder="Mon super jeu..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{ width: '100%', height: 44, fontSize: 15 }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void createGame(newProjectName, newProjectTemplate);
                    }
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, opacity: 0.9 }}>
                  Template de départ
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {[
                    { id: 'blank', icon: Layers, label: 'Vide', desc: 'Projet vide avec événement initial' },
                    { id: 'tutorial', icon: Zap, label: 'Tutoriel', desc: 'Remplissage simple démonstratif' },
                    { id: 'animation', icon: Play, label: 'Animation', desc: 'Pulsation automatique' },
                    { id: 'interactive', icon: MousePointer2, label: 'Interactif', desc: 'Contrôle d\'une dalle' },
                    { id: 'fluorescence', icon: Palette, label: 'Fluorescence UV', desc: 'Activation UV → Fluorescence verte' },
                    { id: 'color-demo', icon: Palette, label: 'Démo RGB', desc: '3 dalles RGB primaires' },
                    { id: 'pulse-advanced', icon: Clock, label: 'Pulsations', desc: 'Alternance chaud/froid' },
                    { id: 'rainbow', icon: Palette, label: 'Arc-en-ciel', desc: 'Séquence colorée complète' },
                    { id: 'tetris', icon: Gamepad2, label: 'Tetris Lumière', desc: 'Jeu Tetris interactif sur les dalles' },
                    { id: 'memory', icon: Brain, label: 'Jeu de Mémoire', desc: 'Mémorisation de séquences lumineuses type Simon' },
                    { id: 'tetris-blueprint', icon: Gamepad2, label: 'Tetris Blueprint (UE5)', desc: 'Tetris jouable via nœuds on_tick + game_tetris_block' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setNewProjectTemplate(t.id as typeof newProjectTemplate)}
                      className="g-card"
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        border: newProjectTemplate === t.id ? '2px solid #4361ee' : '1px solid rgba(255,255,255,0.6)',
                        background: newProjectTemplate === t.id ? 'rgba(67, 97, 238, 0.06)' : 'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55))',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <t.icon size={18} color={newProjectTemplate === t.id ? '#4361ee' : '#666'} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                className="g-btn"
                onClick={() => setModal(null)}
                style={{ height: 42, padding: '0 20px' }}
              >
                Annuler
              </button>
              <button
                className="g-btn g-btn--accent"
                onClick={() => void createGame(newProjectName, newProjectTemplate)}
                disabled={dbLoading}
                style={{ height: 42, padding: '0 24px' }}
              >
                {dbLoading ? 'Création...' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-tuto skippable à chaque création de jeu */}
      {onboardingStep !== null && (() => {
        const STEPS = [
          { icon: Boxes, title: 'Bienvenue dans l’éditeur', text: 'Crée ton jeu en assemblant des blocs (nœuds) ou en code Python. Ce mini-tuto se passe quand tu veux.' },
          { icon: GitBranch, title: 'Les blocs (Nœuds)', text: 'Clic droit (ou glisse depuis une sortie) sur le canvas pour ajouter un nœud. Relie la sortie d’un bloc à l’entrée d’un autre. Les blocs ne se chevauchent plus (physique anti-superposition).' },
          { icon: LayoutGrid, title: 'L’interface (UI)', text: 'Onglet Interface : dépose des composants (score, minuteur, diagramme CIE, D-pad…), déplace-les, et personnalise-les dans le panneau de droite.' },
          { icon: Gamepad2, title: 'Jeux natifs', text: 'Ajoute un bloc-jeu (Puissance 4, Snake, L’Intrus, Chromaticité…) : le vrai jeu s’exécute, avec ton interface par-dessus.' },
          { icon: Zap, title: 'Python low-code', text: 'Onglet Python : un script d’exemple commenté est déjà prêt (API cr.send_color, get_key, add_score…). Modifie-le et clique Exécuter.' },
        ];
        const step = STEPS[Math.min(onboardingStep, STEPS.length - 1)];
        const Icon = step.icon;
        const last = onboardingStep >= STEPS.length - 1;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.26), rgba(245,247,255,0.42))', backdropFilter: 'blur(18px) saturate(140%)', display: 'grid', placeItems: 'center', zIndex: 10001 }}>
            <div className="glass" style={{ width: 'min(440px, calc(100vw - 40px))', padding: 26, borderRadius: 22, background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,247,255,0.86))', border: '1px solid rgba(255,255,255,0.75)', boxShadow: '0 24px 64px rgba(120,140,200,0.22)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4361ee,#7c3aed)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={22} color="#fff" /></div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1a1d2e' }}>{step.title}</div>
              </div>
              <p style={{ fontSize: 13.5, color: '#4a4f5e', lineHeight: 1.6, margin: '0 0 18px' }}>{step.text}</p>
              <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                {STEPS.map((_, i) => <span key={i} style={{ height: 5, flex: 1, borderRadius: 3, background: i <= onboardingStep ? '#4361ee' : 'rgba(0,0,0,0.1)', transition: 'background 0.2s' }} />)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="g-btn" onClick={() => setOnboardingStep(null)} style={{ height: 40, padding: '0 16px', fontSize: 13 }}>Passer</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {onboardingStep > 0 && <button className="g-btn" onClick={() => setOnboardingStep((s) => Math.max(0, (s ?? 0) - 1))} style={{ height: 40, padding: '0 16px' }}>Précédent</button>}
                  <button className="g-btn g-btn--accent" onClick={() => last ? setOnboardingStep(null) : setOnboardingStep((s) => (s ?? 0) + 1)} style={{ height: 40, padding: '0 20px' }}>{last ? 'Commencer' : 'Suivant'}</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de confirmation de suppression */}
      {modal?.type === 'confirm-delete' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.26), rgba(245,247,255,0.42))',
            backdropFilter: 'blur(18px) saturate(140%)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
          }}
          onClick={() => setModal(null)}
        >
          <div
            className="glass"
            style={{
              width: 'min(400px, calc(100vw - 40px))',
              padding: 28,
              borderRadius: 24,
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(245,247,255,0.82))',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 20px 60px rgba(140, 160, 200, 0.14), 0 2px 0 rgba(255,255,255,0.8) inset',
              backdropFilter: 'blur(28px) saturate(160%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(239,71,111,0.12), rgba(239,71,111,0.06))',
                border: '1px solid rgba(0,0,0,0.08)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <Trash2 size={26} color="#1a1a1a" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>Supprimer le projet ?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#444', lineHeight: 1.5 }}>
              "{modal.gameName}" sera définitivement supprimé.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => setModal(null)}
                style={{
                  height: 44,
                  padding: '0 24px',
                  background: 'rgba(255,255,255,0.7)',
                  color: '#1a1a1a',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
                  fontWeight: 600,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                className="btn"
                onClick={() => {
                  void deleteActiveGame();
                  setModal(null);
                }}
                style={{
                  height: 44,
                  padding: '0 24px',
                  background: 'linear-gradient(135deg, #ef476f, #c9184a)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(239, 71, 111, 0.25)',
                  fontWeight: 600,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'outils flottante pour le viewport */}
      {activeGame && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 12,
            background: '#fff',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            zIndex: 100,
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <button
            className="btn btn--mini"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause' : 'Lecture'}
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div style={{ width: 1, background: 'rgba(0, 0, 0, 0.1)', margin: '4px 4px' }} />
          <button
            className="btn btn--mini"
            onClick={() => setViewMode(viewMode === 'split' ? 'tiles-only' : viewMode === 'tiles-only' ? 'ui-only' : 'split')}
            title="Changer vue"
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {viewMode === 'split' ? <LayoutGrid size={16} /> : viewMode === 'tiles-only' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            className="btn btn--mini"
            onClick={() => setShowGrid(!showGrid)}
            title="Grille"
            style={{ width: 36, height: 36, padding: 0, opacity: showGrid ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderRadius: 3 }} />
          </button>
          <div style={{ width: 1, background: 'rgba(0, 0, 0, 0.1)', margin: '4px 4px' }} />
          <button
            className="btn btn--mini"
            onClick={() => {
              setGraphZoom(1);
              setGraphPan({ x: 0, y: 0 });
            }}
            title="Réinitialiser vue"
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcw size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{Math.round(graphZoom * 100)}%</span>
          </div>
        </div>
      )}

      {/* Overlay 2D du jeu - Visuel en plein écran */}
      {showGameOverlay && activeGame && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10001,
            padding: 20,
          }}
          onClick={() => setShowGameOverlay(false)}
        >
          <div
            style={{
              width: 'min(1100px, calc(100vw - 40px))',
              height: 'min(750px, calc(100vh - 40px))',
              padding: 0,
              borderRadius: 16,
              display: 'grid',
              gridTemplateColumns: '1fr 320px',
              overflow: 'hidden',
              background: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Zone principale - Aperçu du jeu */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Eye size={20} color="#1a1a1a" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>Visuel 2D du Jeu</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>{activeGame.name}</p>
                  </div>
                </div>
                <button
                  className="g-btn g-btn--icon"
                  onClick={() => setShowGameOverlay(false)}
                  style={{ width: 36, height: 36 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Game Viewport */}
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  placeItems: 'center',
                  padding: '20px 28px',
                  background: '#fafafa',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 560 }}>
                  {/* Grille de dalles - layout physique ColorRoom : 6 cols × 7 rows */}
                  <div style={{ background: '#0a0c14', borderRadius: 16, padding: 14, border: '1px solid #1e2030' }}>
                    {/* Légendes salles */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 3, textAlign: 'center', fontSize: 9, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>◂ Salle gauche</div>
                      <div style={{ width: 8 }} />
                      <div style={{ flex: 3, textAlign: 'center', fontSize: 9, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Salle droite ▸</div>
                    </div>
                    {/* 7 rangées, chacune = 3 dalles gauche + séparateur + 3 dalles droite */}
                    <div style={{ display: 'grid', gap: 4 }}>
                      {Array.from({ length: 7 }, (_, row) => (
                        <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 8px repeat(3, 1fr)', gap: 4 }}>
                          {/* 3 dalles salle gauche */}
                          {[0,1,2].map(c => {
                            const idx = row * 6 + c;
                            const tile = tiles[idx] ?? { color: '#111', intensity: 0 };
                            const hex = (v: number) => Math.min(255, Math.round(v)).toString(16).padStart(2, '0');
                            return (
                              <div key={c} title={`Dalle ${idx + 1}`} style={{
                                aspectRatio: '1', borderRadius: 5,
                                background: tile.intensity > 0.02 ? `radial-gradient(circle at 38% 32%, ${tile.color}ff, ${tile.color}${hex(tile.intensity * 140)})` : '#131526',
                                boxShadow: tile.intensity > 0.05 ? `0 0 ${tile.intensity * 12}px ${tile.color}${hex(tile.intensity * 160)}` : 'none',
                                border: `1px solid ${tile.intensity > 0.05 ? tile.color + '44' : '#1e2030'}`,
                                transition: 'background 0.25s, box-shadow 0.25s',
                                display: 'grid', placeItems: 'center',
                                color: tile.intensity > 0.4 ? '#fff' : '#3a3d55',
                                fontSize: 8, fontWeight: 700,
                              }}>
                                {idx + 1}
                              </div>
                            );
                          })}
                          {/* Séparateur */}
                          <div style={{ background: '#1e2030', borderRadius: 2 }} />
                          {/* 3 dalles salle droite */}
                          {[3,4,5].map(c => {
                            const idx = row * 6 + c;
                            const tile = tiles[idx] ?? { color: '#111', intensity: 0 };
                            const hex = (v: number) => Math.min(255, Math.round(v)).toString(16).padStart(2, '0');
                            return (
                              <div key={c} title={`Dalle ${idx + 1}`} style={{
                                aspectRatio: '1', borderRadius: 5,
                                background: tile.intensity > 0.02 ? `radial-gradient(circle at 38% 32%, ${tile.color}ff, ${tile.color}${hex(tile.intensity * 140)})` : '#131526',
                                boxShadow: tile.intensity > 0.05 ? `0 0 ${tile.intensity * 12}px ${tile.color}${hex(tile.intensity * 160)}` : 'none',
                                border: `1px solid ${tile.intensity > 0.05 ? tile.color + '44' : '#1e2030'}`,
                                transition: 'background 0.25s, box-shadow 0.25s',
                                display: 'grid', placeItems: 'center',
                                color: tile.intensity > 0.4 ? '#fff' : '#3a3d55',
                                fontSize: 8, fontWeight: 700,
                              }}>
                                {idx + 1}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {/* Légende rangées */}
                    <div style={{ display: 'flex', marginTop: 6, gap: 4 }}>
                      {[0,1,2,3,4,5].map(c => (
                        <div key={c} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: '#3a3d55' }}>
                          {c < 3 ? `G${c+1}` : `D${c-2}`}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info du jeu */}
                  <div
                    style={{
                      padding: 16,
                      background: '#fff',
                      borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, marginBottom: 4, color: '#999', fontWeight: 600 }}>Nœuds</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{activeGame.nodes.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, marginBottom: 4, color: '#999', fontWeight: 600 }}>Connexions</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{activeGame.edges.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, marginBottom: 4, color: '#999', fontWeight: 600 }}>Dalles</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{tileCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer avec contrôles */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <button
                      className="g-btn"
                      onClick={() => setIsPlaying(!isPlaying)}
                      style={{ height: 40, padding: '0 20px', background: isPlaying ? '#1a1a1a' : undefined, color: isPlaying ? '#fff' : undefined, borderColor: isPlaying ? '#1a1a1a' : undefined }}
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      <span>{isPlaying ? 'Pause' : 'Lecture'}</span>
                    </button>
                    <button
                      className="g-btn"
                      onClick={() => setShowGameOverlay(false)}
                      style={{ height: 40, padding: '0 20px' }}
                    >
                      <X size={16} />
                      <span>Fermer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Panneau latéral - Configuration UI */}
            <div style={{ display: 'flex', flexDirection: 'column', width: 300, flexShrink: 0, borderLeft: '1px solid rgba(0,0,0,0.07)', background: '#f8f9fb', overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MousePointer2 size={15} color="#4361ee" />
                <strong style={{ fontSize: 13, fontWeight: 800, color: '#1a1d2e' }}>Configuration UI</strong>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid', gap: 16 }}>
                {/* Affichage dalles */}
                <div>
                  <div className="g-label" style={{ marginBottom: 6 }}>Affichage des dalles</div>
                  <select className="g-select" style={{ height: 34, fontSize: 12, width: '100%' }}
                    value={String(activeGame?.tileCount ?? 42)}
                    onChange={(e) => { updateActiveGameMeta({ tileCount: Number(e.target.value) }); void saveActiveGame(); }}>
                    <option value="9">9 dalles (3×3)</option>
                    <option value="12">12 dalles</option>
                    <option value="21">21 dalles</option>
                    <option value="42">42 dalles (toutes)</option>
                  </select>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
                    Nombre de dalles visibles : <strong>{activeGame?.tileCount ?? 42}</strong>
                  </div>
                </div>

                <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

                {/* Composants UI */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className="g-label" style={{ margin: 0 }}>Composants UI du jeu</span>
                    <span style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>{getUiComponents().length} ajouté{getUiComponents().length !== 1 ? 's' : ''}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#999', marginBottom: 10, lineHeight: 1.5 }}>
                    Boutons et sliders pour contrôler le jeu depuis <strong>/jeux</strong>
                  </p>

                  {/* Boutons d'ajout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                    {(['button', 'slider', 'label', 'counter', 'timer'] as UICompKind[]).map((kind) => (
                      <button key={kind} className="g-btn g-btn--sm" style={{ justifyContent: 'flex-start', fontSize: 11, padding: '0 10px' }}
                        disabled={!activeGameId}
                        onClick={() => addUiComponent(kind)}>
                        <Plus size={12} />
                        <span>{kind === 'button' ? 'Bouton' : kind === 'slider' ? 'Slider' : kind === 'label' ? 'Texte' : kind === 'counter' ? 'Compteur' : 'Timer'}</span>
                      </button>
                    ))}
                  </div>

                  {/* Liste des composants */}
                  {getUiComponents().length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#bbb', fontSize: 12, background: '#fff', borderRadius: 10, border: '1px dashed rgba(0,0,0,0.1)' }}>
                      <MousePointer2 size={20} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                      <div>Aucun composant UI</div>
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>Ajoutez un bouton ou slider ci-dessus</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {getUiComponents().map((comp) => (
                        <div key={comp.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: comp.color ?? '#4361ee', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, flex: 1, color: '#1a1d2e' }}>{comp.label}</span>
                            <span style={{ fontSize: 10, color: '#888', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{comp.kind}</span>
                            <button onClick={() => removeUiComponent(comp.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#dc2626', opacity: 0.6 }}
                              title="Supprimer">
                              <X size={12} />
                            </button>
                          </div>
                          <input className="g-input" style={{ height: 30, fontSize: 11 }}
                            value={comp.label}
                            placeholder="Label"
                            onChange={(e) => updateUiComponent(comp.id, { label: e.target.value })}
                            onBlur={() => void saveActiveGame()} />
                          {/* Lien nœud */}
                          <div>
                            <div style={{ fontSize: 10, color: '#888', marginBottom: 4, fontWeight: 600 }}>Nœud lié (on_ui_click ID)</div>
                            <select className="g-select" style={{ height: 30, fontSize: 11, width: '100%' }}
                              value={comp.nodeRef ?? ''}
                              onChange={(e) => { updateUiComponent(comp.id, { nodeRef: e.target.value }); void saveActiveGame(); }}>
                              <option value="">-- Aucun --</option>
                              {(activeGame?.nodes ?? []).filter((n) => n.kind === 'on_ui_click' || n.kind === 'variable_set').map((n) => (
                                <option key={n.id} value={n.id}>{n.name} ({n.kind})</option>
                              ))}
                            </select>
                          </div>
                          {comp.kind === 'slider' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                              <label style={{ display: 'grid', gap: 3 }}>
                                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Min</span>
                                <input className="g-input" type="number" style={{ height: 28, fontSize: 11 }}
                                  value={comp.min ?? 0}
                                  onChange={(e) => { updateUiComponent(comp.id, { min: Number(e.target.value) }); void saveActiveGame(); }} />
                              </label>
                              <label style={{ display: 'grid', gap: 3 }}>
                                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Max</span>
                                <input className="g-input" type="number" style={{ height: 28, fontSize: 11 }}
                                  value={comp.max ?? 100}
                                  onChange={(e) => { updateUiComponent(comp.id, { max: Number(e.target.value) }); void saveActiveGame(); }} />
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prévisualisation des composants dans le jeu */}
                {getUiComponents().length > 0 && (
                  <>
                    <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
                    <div>
                      <div className="g-label" style={{ marginBottom: 10 }}>Prévisualisation</div>
                      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {getUiComponents().map((comp) => {
                          if (comp.kind === 'button') return (
                            <button key={comp.id} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: comp.color ?? '#4361ee', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              {comp.label}
                            </button>
                          );
                          if (comp.kind === 'slider') return (
                            <div key={comp.id} style={{ width: '100%' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#1a1d2e' }}>{comp.label}</div>
                              <input type="range" min={comp.min ?? 0} max={comp.max ?? 100} step={comp.step ?? 1} defaultValue={comp.value ?? 50} style={{ width: '100%' }} />
                            </div>
                          );
                          if (comp.kind === 'label') return (
                            <div key={comp.id} style={{ fontSize: 13, fontWeight: 600, color: '#1a1d2e' }}>{comp.label}</div>
                          );
                          if (comp.kind === 'counter') return (
                            <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f2ff', borderRadius: 8, padding: '6px 12px' }}>
                              <span style={{ fontSize: 11, color: '#666' }}>{comp.label}</span>
                              <span style={{ fontSize: 18, fontWeight: 800, color: '#4361ee' }}>{comp.value ?? 0}</span>
                            </div>
                          );
                          if (comp.kind === 'timer') return (
                            <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff7ed', borderRadius: 8, padding: '6px 12px' }}>
                              <Clock size={14} color="#f97316" />
                              <span style={{ fontSize: 16, fontWeight: 800, color: '#f97316', fontVariantNumeric: 'tabular-nums' }}>60s</span>
                            </div>
                          );
                          return null;
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

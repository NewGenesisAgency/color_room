/**
 * Seed script – injecte le jeu custom "ChromaDetect – Load Test" dans la DB.
 * Usage : node scripts/seed-loadtest.mjs
 *
 * Design du blueprint :
 *
 *  [Début] ──► [CS150 Connect] ──► [Lancer mesure]
 *
 *  [Résultat reçu] ──► [Aperçu couleur 5s] ──► [Éteindre] ──► [Afficher CIE 1931]
 *                                                                      │
 *                                                               [Comparer couleur]
 *                                                                /             \
 *                                                        [Score +200]    [Réessayer]
 *
 *  Note : [Résultat reçu] est un EVENT node asynchrone (comme on_tick).
 *         Il ne reçoit PAS d'edge depuis [Lancer mesure] — il se déclenche
 *         automatiquement quand le CS-150 renvoie ses données.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Résolution du chemin DB (même logique que lib/db/index.ts) ──────────────
function resolveDbPath() {
  const inDocker = '/data/ColorRoomDB.db';
  if (fs.existsSync(inDocker)) return inDocker;
  const local = path.join(__dirname, '..', '..', '..', 'SupervisionAPI', 'data', 'ColorRoomDB.db');
  if (fs.existsSync(local)) return local;
  return path.join(__dirname, '..', 'data', 'ColorRoomDB.db');
}

// ── ID factory (même format que l'éditeur) ──────────────────────────────────
function makeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Nœuds du blueprint ───────────────────────────────────────────────────────
const nodes = [
  // ── LIGNE 1 : Initialisation (y = 320) ─────────────────────────────────
  {
    id: 'lt_begin',
    kind: 'event_begin',
    name: 'Début',
    enabled: true,
    params: {},
    pos: { x: 80, y: 320 },
  },
  {
    id: 'lt_connect',
    kind: 'cs150_connect',
    name: 'Connecter CS-150',
    enabled: true,
    params: {},
    pos: { x: 380, y: 320 },
  },
  {
    id: 'lt_label_instruct',
    kind: 'ui_label',
    name: 'Instruction',
    enabled: true,
    params: {
      text: '🔬 Pointez le CS-150 vers une source lumineuse et appuyez sur Mesurer',
      size: 14,
      color: '#a0c4ff',
    },
    pos: { x: 680, y: 160 },
  },
  {
    id: 'lt_measure',
    kind: 'measure_start',
    name: 'Lancer mesure CS-150',
    enabled: true,
    params: { deviceId: 'cs150', timeoutSec: 30 },
    pos: { x: 680, y: 320 },
  },

  // ── LIGNE 2 : Handler résultat (EVENT asynchrone, y = 560) ─────────────
  // measure_on_result est déclenché par le runtime quand le CS-150 renvoie
  // ses valeurs — il n'est pas connecté EN ENTRÉE depuis measure_start.
  {
    id: 'lt_on_result',
    kind: 'measure_on_result',
    name: 'Résultat reçu',
    enabled: true,
    params: {
      varX: 'meas_x',
      varY: 'meas_y',
      varLv: 'meas_lv',
    },
    pos: { x: 380, y: 560 },
  },

  // ── LIGNE 2 suite : aperçu couleur sur les 42 dalles pendant 5s ────────
  {
    id: 'lt_fill',
    kind: 'fill',
    name: 'Aperçu couleur 5s',
    enabled: true,
    params: {
      // Le runtime injecte la couleur mesurée depuis les variables meas_x/y/lv
      color: '#ffffff',
      intensity: 1.0,
      seconds: 5,
    },
    pos: { x: 780, y: 560 },
  },

  // ── Extinction après l'aperçu ───────────────────────────────────────────
  {
    id: 'lt_clear',
    kind: 'clear_tiles',
    name: 'Éteindre dalles',
    enabled: true,
    params: {},
    pos: { x: 1100, y: 560 },
  },

  // ── Affichage CIE 1931 + interaction joueur ─────────────────────────────
  {
    id: 'lt_show_cie',
    kind: 'measure_show_cie',
    name: 'Diagramme CIE 1931',
    enabled: true,
    params: {
      showTarget: false,   // ne révèle pas la cible d'emblée
      showResult: true,    // affiche le point mesuré APRÈS que le joueur a cliqué
    },
    pos: { x: 1400, y: 560 },
  },

  // ── Comparaison : joueur doit pointer la couleur mesurée ────────────────
  {
    id: 'lt_compare',
    kind: 'measure_compare',
    name: 'Comparer couleur',
    enabled: true,
    params: {
      // Ces valeurs sont remplacées par le runtime avec meas_x / meas_y
      targetX: 0.3127,
      targetY: 0.3290,
      toleranceDeltaE: 8,
    },
    pos: { x: 1720, y: 560 },
  },

  // ── Succès ──────────────────────────────────────────────────────────────
  {
    id: 'lt_score',
    kind: 'add_score',
    name: 'Score +200',
    enabled: true,
    params: { amount: 200 },
    pos: { x: 2060, y: 400 },
  },
  {
    id: 'lt_label_win',
    kind: 'ui_label',
    name: 'Victoire',
    enabled: true,
    params: {
      text: '🎉 Bravo ! Vous avez retrouvé la couleur mesurée !',
      size: 18,
      color: '#00ffaa',
    },
    pos: { x: 2060, y: 560 },
  },

  // ── Échec ───────────────────────────────────────────────────────────────
  {
    id: 'lt_label_retry',
    kind: 'ui_label',
    name: 'Pas encore',
    enabled: true,
    params: {
      text: '❌ Pas tout à fait… Réessayez !',
      size: 14,
      color: '#ff7070',
    },
    pos: { x: 2060, y: 720 },
  },
  {
    id: 'lt_retry_measure',
    kind: 'measure_start',
    name: 'Relancer mesure',
    enabled: true,
    params: { deviceId: 'cs150', timeoutSec: 30 },
    pos: { x: 2380, y: 720 },
  },
];

// ── Arêtes (edges) ──────────────────────────────────────────────────────────
const edges = [
  // Séquence d'initialisation
  { id: 'lt_e1', from: 'lt_begin',        to: 'lt_connect' },
  { id: 'lt_e2', from: 'lt_connect',      to: 'lt_label_instruct' },
  { id: 'lt_e3', from: 'lt_connect',      to: 'lt_measure' },

  // Handler résultat → aperçu → extinction → CIE → comparaison
  { id: 'lt_e4', from: 'lt_on_result',    to: 'lt_fill' },
  { id: 'lt_e5', from: 'lt_fill',         to: 'lt_clear' },
  { id: 'lt_e6', from: 'lt_clear',        to: 'lt_show_cie' },
  { id: 'lt_e7', from: 'lt_show_cie',     to: 'lt_compare' },

  // Résultats de la comparaison
  { id: 'lt_e8',  from: 'lt_compare',    to: 'lt_score' },
  { id: 'lt_e9',  from: 'lt_compare',    to: 'lt_label_win' },
  { id: 'lt_e10', from: 'lt_compare',    to: 'lt_label_retry' },

  // Relance automatique si raté
  { id: 'lt_e11', from: 'lt_label_retry', to: 'lt_retry_measure' },
];

// ── Config complète ─────────────────────────────────────────────────────────
const config = {
  version: 1,
  tileCount: 42,
  icon: 'Palette',
  difficulty: 3,
  description: 'Mesure avec le CS-150\nRetrouve la couleur\nsur le diagramme CIE',
  bgColor: '#0d1117',
  accentColor: '#7c3aed',
  nodes,
  edges,
};

// ── Insertion en DB ──────────────────────────────────────────────────────────
const dbPath = resolveDbPath();
console.log(`📂 DB : ${dbPath}`);
if (!fs.existsSync(dbPath)) {
  console.error('❌ Fichier DB introuvable. Lancez l\'app au moins une fois pour créer la DB.');
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Idempotent : supprimer l'ancienne version
const existing = db
  .prepare("SELECT id FROM crg_games WHERE name = 'ChromaDetect – Load Test';")
  .get();
if (existing) {
  db.prepare('DELETE FROM crg_games WHERE id = ?;').run(existing.id);
  console.log(`🗑  Ancien jeu supprimé : ${existing.id}`);
}

const gameId = makeId();
db.prepare(
  "INSERT INTO crg_games(id, name, kind, config_json, updated_at) VALUES(?, ?, ?, ?, datetime('now'));",
).run(gameId, 'ChromaDetect – Load Test', 'editor', JSON.stringify(config));

console.log(`✅ Jeu créé   : ${gameId}`);
console.log(`   Nom        : ChromaDetect – Load Test`);
console.log(`   Nœuds      : ${nodes.length}`);
console.log(`   Arêtes     : ${edges.length}`);
console.log(`   Difficulté : ⭐⭐⭐`);
console.log('');
console.log('💡 Ouvrez http://localhost:3000/editeur pour voir le jeu dans l\'éditeur.');

db.close();

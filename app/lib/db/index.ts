/**
 * @file lib/db/index.ts
 * @brief Accès à la base SQLite (better-sqlite3) : singleton, chemin et migrations.
 *
 * Fournit un client SQLite unique (singleton) pour toute l'application. Le
 * chemin de la base est résolu dans l'ordre : variable COLOR_ROOM_DB_PATH,
 * puis /data/ColorRoomDB.db (montage Docker), puis un emplacement local. Au
 * premier accès, migrate() crée les tables manquantes (CREATE TABLE IF NOT
 * EXISTS) : utilisateurs, sessions, classes, scores, jeux, conversations IA,
 * sessions multijoueur, parties Puissance 4, etc. better-sqlite3 est synchrone.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

let dbSingleton: Database.Database | null = null;

function resolveDbPath(): string {
  const explicit = process.env.COLOR_ROOM_DB_PATH;
  if (explicit) return explicit;

  const inDocker = '/data/ColorRoomDB.db';
  if (fs.existsSync(inDocker)) return inDocker;

  const local = path.join(process.cwd(), '..', '..', 'SupervisionAPI', 'data', 'ColorRoomDB.db');
  if (fs.existsSync(local)) return local;

  return path.join(process.cwd(), 'data', 'ColorRoomDB.db');
}

function migrate(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  // Note : les tables crg_flows / crg_runtime_* / crg_morpion_rooms ont été
  // retirées avec leurs sous-systèmes (ancien éditeur "flow", moteur runtime,
  // morpion remplacé par le Puissance 4). Aucune migration de suppression n'est
  // nécessaire : on cesse simplement de les créer.

  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_mp_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), status TEXT NOT NULL, game_id TEXT NOT NULL, state_json TEXT NOT NULL);",
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_mp_sessions_updated ON crg_mp_sessions(updated_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_mp_sessions_status ON crg_mp_sessions(status);');

  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_mp_players (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), token TEXT NOT NULL, name TEXT NOT NULL, seat INTEGER NOT NULL, last_seen_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(session_id) REFERENCES crg_mp_sessions(id));",
  );
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_crg_mp_player_token ON crg_mp_players(token);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_mp_player_session ON crg_mp_players(session_id);');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_crg_mp_player_seat ON crg_mp_players(session_id, seat);');

  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_games (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), name TEXT NOT NULL, kind TEXT NOT NULL, config_json TEXT NOT NULL DEFAULT '{}');",
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_games_updated ON crg_games(updated_at);');

  // Conversations IA (chat de génération de jeux dans l'éditeur). messages_json :
  // [{ id, role:'user'|'assistant', content, ts, model?, summary? }]
  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_ai_chats (id TEXT PRIMARY KEY, game_id TEXT, title TEXT NOT NULL DEFAULT '', messages_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_ai_chats_game ON crg_ai_chats(game_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_ai_chats_updated ON crg_ai_chats(updated_at);');

  // Puissance 4 multijoueur (2 joueurs sur téléphone, plateau sur les dalles).
  // board_json = 42 cases (row*6+col), valeurs '' | 'R' | 'J'. turn/winner = 'R'|'J'.
  db.exec(`CREATE TABLE IF NOT EXISTS crg_p4_rooms (
    id              TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    player_r_token  TEXT,
    player_j_token  TEXT,
    board_json      TEXT NOT NULL DEFAULT '[]',
    turn            TEXT NOT NULL DEFAULT 'R',
    winner          TEXT,
    status          TEXT NOT NULL DEFAULT 'waiting'
  );`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_p4_rooms_updated ON crg_p4_rooms(updated_at);');

  // Réglages applicatifs clé/valeur (URLs des APIs modifiables à chaud depuis le site)
  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );

  // ─── Auth & utilisateurs ─────────────────────────────────────────────────────
  // Ces tables doivent être créées ici pour survivre à un restart sur serveur neuf.
  db.exec(`CREATE TABLE IF NOT EXISTS crg_users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    user_type     TEXT NOT NULL DEFAULT 'apprenant',
    password_hash TEXT,
    niveau        TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    avatar_color  TEXT DEFAULT '#4361ee',
    avatar_icon   TEXT DEFAULT 'User'
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS crg_sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES crg_users(id) ON DELETE CASCADE
  );`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_sessions_user ON crg_sessions(user_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_sessions_token ON crg_sessions(token);');

  // ─── Classes pédagogiques ────────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS crg_classes (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    code       TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    niveau     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS crg_class_members (
    id        TEXT PRIMARY KEY,
    class_id  TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(class_id, user_id)
  );`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_class_members_class ON crg_class_members(class_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_class_members_user ON crg_class_members(user_id);');

  // ─── Scores ──────────────────────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS crg_scores (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL,
    game_name TEXT NOT NULL,
    score     INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_scores_user ON crg_scores(user_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_scores_played ON crg_scores(played_at DESC);');

  // ─── Purge sessions expirées (exécutée à chaque démarrage) ───────────────────
  try {
    db.prepare("DELETE FROM crg_sessions WHERE expires_at < datetime('now')").run();
  } catch { /* table peut ne pas exister sur très vieux schéma */ }

  // ─── Room system additions ────────────────────────────────────────────────
  try { db.exec("ALTER TABLE crg_mp_sessions ADD COLUMN room_code TEXT;"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_sessions ADD COLUMN room_name TEXT DEFAULT 'Partie';"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_sessions ADD COLUMN max_players INTEGER DEFAULT 8;"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_sessions ADD COLUMN difficulty INTEGER DEFAULT 2;"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_sessions ADD COLUMN mode TEXT DEFAULT 'versus';"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_sessions ADD COLUMN settings_json TEXT DEFAULT '{}';"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_players ADD COLUMN is_ready INTEGER DEFAULT 0;"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_mp_players ADD COLUMN seat_score INTEGER DEFAULT 0;"); } catch { /* already exists */ }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_crg_mp_sessions_room_code ON crg_mp_sessions(room_code) WHERE room_code IS NOT NULL;");

  // ─── Migrations crg_users : colonnes ajoutees apres coup ───────────────────
  // Une base creee avec un schema plus ancien n'a pas avatar_color/avatar_icon
  // (CREATE TABLE IF NOT EXISTS ne modifie pas une table existante). Sans ces
  // ALTER, le SELECT du login plante : "no such column: avatar_color".
  try { db.exec("ALTER TABLE crg_users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'apprenant';"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_users ADD COLUMN password_hash TEXT;"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_users ADD COLUMN niveau TEXT;"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_users ADD COLUMN avatar_color TEXT DEFAULT '#4361ee';"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE crg_users ADD COLUMN avatar_icon TEXT DEFAULT 'User';"); } catch { /* already exists */ }

  // ─── Compte admin/enseignant via .env (optionnel) ───────────────────────────
  seedAdminFromEnv(db);

  // ─── Jeux seed ───────────────────────────────────────────────────────────────
  seedChromatectGame(db);
  seedLibreRGBGame(db);

  // ─── Nettoyage : retire les jeux seed retirés du catalogue ──────────────────
  // (« Test Simple - Clic Dalle » et « Color Speed - Réflexes ») y compris sur
  // les bases déjà installées. Suppression par préfixe d'ID (robuste au renommage).
  try {
    db.prepare("DELETE FROM crg_games WHERE id LIKE 'test_simple_%' OR id LIKE 'color_speed_%';").run();
  } catch { /* table absente au tout premier démarrage : sans effet */ }
}

/**
 * Crée (ou met à jour) un compte enseignant/administrateur d'après les
 * variables d'environnement ADMIN_USERNAME (défaut 'admin') et ADMIN_PASSWORD.
 *
 * - Si ADMIN_PASSWORD est vide/absent : ne fait rien (setup manuel via /jeux).
 * - Sinon : garantit qu'un compte enseignant porte ce nom et ce mot de passe.
 *   Le mot de passe est REPOSÉ à chaque démarrage sur la valeur du .env, ce qui
 *   sert aussi de récupération « mot de passe oublié » (il suffit d'éditer .env
 *   et de relancer le conteneur). Le hash est pbkdf2 (sel aléatoire, sha512).
 */
function seedAdminFromEnv(db: Database.Database) {
  const password = (process.env.ADMIN_PASSWORD ?? '').trim();
  if (!password) return; // pas de compte admin auto demandé

  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim() || 'admin';
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  const passwordHash = `${salt}:${hash}`;

  try {
    const existing = db.prepare('SELECT id FROM crg_users WHERE name = ? COLLATE NOCASE').get(username) as { id: string } | undefined;
    if (existing) {
      // Repose le mot de passe et garantit le rôle enseignant.
      db.prepare("UPDATE crg_users SET password_hash = ?, user_type = 'enseignant' WHERE id = ?").run(passwordHash, existing.id);
    } else {
      const id = randomBytes(16).toString('hex');
      db.prepare("INSERT INTO crg_users (id, name, user_type, password_hash, avatar_color, avatar_icon) VALUES (?, ?, 'enseignant', ?, '#7c3aed', 'Crown')")
        .run(id, username, passwordHash);
    }
  } catch (e) {
    console.warn('[seedAdminFromEnv] impossible de seeder le compte admin :', e instanceof Error ? e.message : e);
  }
}

function seedChromatectGame(db: Database.Database) {
  const GAME_NAME = 'ChromaDetect - CS-160';
  // Gameplay limpide en 2 boutons, 100% blocs implémentés par le runtime /jeux :
  //   « Nouvelle couleur mystère » → salle orange/verte/bleue (aléatoire)
  //   « Mesurer avec le CS-160 »   → mesure RÉELLE, comparaison à la couleur
  //                                    affichée, points proportionnels à la précision.
  const ORANGE = { color: '#ff8800', x: 0.50, y: 0.41 };
  const VERT   = { color: '#00cc44', x: 0.30, y: 0.60 };
  const BLEU   = { color: '#2244ff', x: 0.15, y: 0.06 };
  const TOL = 10, PTS = 300;
  const config = {
    version: 1,
    tileCount: 42,
    bgColor: '#0d1117',
    accentColor: '#06d6a0',
    icon: 'Target',
    difficulty: 2,
    description: 'Mesurez la couleur spectrale affichée sur les dalles avec le CS-160 et comparez au spectre cible. Plus vous êtes précis, plus vous marquez.',
    // Espacement : un bloc fait ~290px de large et 150-260px de haut selon ses
    // paramètres → pas horizontal de 380px et rangées espacées de 320px minimum
    // pour une lecture aérée gauche→droite, haut→bas.
    nodes: [
      // ─ Rangée 1 · Démarrage : la salle s'allume direct en orange (couleur n°1) ─
      { id: 'n_begin',  kind: 'event_begin',  name: 'Démarrer',             enabled: true, params: {},                                           pos: { x: 60,   y: 60 } },
      { id: 'n_snd0',   kind: 'play_sound',   name: 'Son départ',           enabled: true, params: { sound: 'start' },                           pos: { x: 440,  y: 60 } },
      { id: 'n_reset',  kind: 'score_reset',  name: 'Score à 0',            enabled: true, params: {},                                           pos: { x: 820,  y: 60 } },
      { id: 'n_setc1',  kind: 'variable_set', name: 'Couleur n°1 (orange)', enabled: true, params: { name: 'couleur_num', value: 1, op: 'set' }, pos: { x: 1200, y: 60 } },
      { id: 'n_fill0',  kind: 'fill',         name: 'Salle orange',         enabled: true, params: { color: ORANGE.color, intensity: 0.9 },      pos: { x: 1580, y: 60 } },
      // ─ Rangée 2 · Bouton « Nouvelle couleur mystère » ─
      { id: 'n_clkn',   kind: 'on_ui_click',  name: 'Bouton nouvelle couleur', enabled: true, params: { buttonId: 'nouvelle' },                  pos: { x: 60,   y: 460 } },
      { id: 'n_sndc',   kind: 'play_sound',   name: 'Son clic',             enabled: true, params: { sound: 'click' },                           pos: { x: 440,  y: 460 } },
      { id: 'n_rand',   kind: 'random_int',   name: 'Tirage 1 à 3',         enabled: true, params: { min: 1, max: 3, varName: 'couleur_num' },   pos: { x: 820,  y: 460 } },
      { id: 'n_ifc1',   kind: 'if',           name: 'Si couleur n°1',       enabled: true, params: { varName: 'couleur_num', op: 'eq', value: 1 }, pos: { x: 1200, y: 460 } },
      { id: 'n_fillo',  kind: 'fill',         name: 'Salle orange',         enabled: true, params: { color: ORANGE.color, intensity: 0.9 },      pos: { x: 1580, y: 360 } },
      { id: 'n_ifc2',   kind: 'if',           name: 'Si couleur n°2',       enabled: true, params: { varName: 'couleur_num', op: 'eq', value: 2 }, pos: { x: 1580, y: 620 } },
      { id: 'n_fillv',  kind: 'fill',         name: 'Salle verte',          enabled: true, params: { color: VERT.color, intensity: 0.9 },        pos: { x: 1960, y: 520 } },
      { id: 'n_fillb',  kind: 'fill',         name: 'Salle bleue',          enabled: true, params: { color: BLEU.color, intensity: 0.9 },        pos: { x: 1960, y: 800 } },
      // ─ Rangée 3 · Bouton « Mesurer » : mesure réelle + comparaison à la couleur active ─
      { id: 'n_clkm',   kind: 'on_ui_click',  name: 'Bouton mesurer',       enabled: true, params: { buttonId: 'mesurer' },                      pos: { x: 60,   y: 1080 } },
      { id: 'n_sndt',   kind: 'play_sound',   name: 'Son tic',              enabled: true, params: { sound: 'tick' },                            pos: { x: 440,  y: 1080 } },
      { id: 'n_meas',   kind: 'measure_start', name: 'Mesure CS-160',       enabled: true, params: { varX: 'meas_x', varY: 'meas_y', varLv: 'meas_lv', timeoutSec: 25 }, pos: { x: 820, y: 1080 } },
      { id: 'n_ifok',   kind: 'if',           name: 'Si mesure OK',         enabled: true, params: { varName: 'meas_ok', op: 'eq', value: 1 },   pos: { x: 1200, y: 1080 } },
      { id: 'n_mifc1',  kind: 'if',           name: 'Si couleur n°1',       enabled: true, params: { varName: 'couleur_num', op: 'eq', value: 1 }, pos: { x: 1580, y: 980 } },
      { id: 'n_cmpo',   kind: 'measure_compare', name: 'Comparer à orange', enabled: true, params: { targetX: ORANGE.x, targetY: ORANGE.y, toleranceDeltaE: TOL, maxPoints: PTS }, pos: { x: 1960, y: 1080 } },
      { id: 'n_mifc2',  kind: 'if',           name: 'Si couleur n°2',       enabled: true, params: { varName: 'couleur_num', op: 'eq', value: 2 }, pos: { x: 1960, y: 1360 } },
      { id: 'n_cmpv',   kind: 'measure_compare', name: 'Comparer à vert',   enabled: true, params: { targetX: VERT.x, targetY: VERT.y, toleranceDeltaE: TOL, maxPoints: PTS }, pos: { x: 2340, y: 1260 } },
      { id: 'n_cmpb',   kind: 'measure_compare', name: 'Comparer à bleu',   enabled: true, params: { targetX: BLEU.x, targetY: BLEU.y, toleranceDeltaE: TOL, maxPoints: PTS }, pos: { x: 2340, y: 1540 } },
      { id: 'n_snds',   kind: 'play_sound',   name: 'Son points',           enabled: true, params: { sound: 'score' },                           pos: { x: 2720, y: 1080 } },
      { id: 'n_vib',    kind: 'vibrate',      name: 'Vibration',            enabled: true, params: { durationMs: 150 },                          pos: { x: 3100, y: 1080 } },
      { id: 'n_snde',   kind: 'play_sound',   name: 'Son erreur mesure',    enabled: true, params: { sound: 'error' },                           pos: { x: 1580, y: 1320 } },
    ],
    edges: [
      { id: 'e1',  from: 'n_begin', to: 'n_snd0' },
      { id: 'e2',  from: 'n_snd0',  to: 'n_reset' },
      { id: 'e3',  from: 'n_reset', to: 'n_setc1' },
      { id: 'e4',  from: 'n_setc1', to: 'n_fill0' },
      // Ordre des sorties du « Si » : 1re = vrai, 2e = faux.
      { id: 'e5',  from: 'n_clkn',  to: 'n_sndc' },
      { id: 'e6',  from: 'n_sndc',  to: 'n_rand' },
      { id: 'e7',  from: 'n_rand',  to: 'n_ifc1' },
      { id: 'e8',  from: 'n_ifc1',  to: 'n_fillo' },
      { id: 'e9',  from: 'n_ifc1',  to: 'n_ifc2' },
      { id: 'e10', from: 'n_ifc2',  to: 'n_fillv' },
      { id: 'e11', from: 'n_ifc2',  to: 'n_fillb' },
      { id: 'e12', from: 'n_clkm',  to: 'n_sndt' },
      { id: 'e13', from: 'n_sndt',  to: 'n_meas' },
      { id: 'e14', from: 'n_meas',  to: 'n_ifok' },
      { id: 'e15', from: 'n_ifok',  to: 'n_mifc1' },
      { id: 'e16', from: 'n_ifok',  to: 'n_snde' },
      { id: 'e17', from: 'n_mifc1', to: 'n_cmpo' },
      { id: 'e18', from: 'n_mifc1', to: 'n_mifc2' },
      { id: 'e19', from: 'n_mifc2', to: 'n_cmpv' },
      { id: 'e20', from: 'n_mifc2', to: 'n_cmpb' },
      { id: 'e21', from: 'n_cmpo',  to: 'n_snds' },
      { id: 'e22', from: 'n_cmpv',  to: 'n_snds' },
      { id: 'e23', from: 'n_cmpb',  to: 'n_snds' },
      { id: 'e24', from: 'n_snds',  to: 'n_vib' },
    ],
    uiLayout: [
      { id: 'u_title',  kind: 'title_banner',  x: 20,  y: 14,  width: 480, height: 50, text: 'ChromaDetect - CS-160' },
      { id: 'u_msg',    kind: 'message_box',   x: 20,  y: 76,  width: 480, height: 84, bgColor: '#7c3aed',
        text: '1. Allume une couleur mystère · 2. Pointe le CS-160 vers une dalle · 3. Mesure : plus tu es précis, plus tu marques !' },
      { id: 'u_btn1',   kind: 'button',        x: 20,  y: 176, width: 480, height: 52, text: '1. Nouvelle couleur mystère', eventId: 'nouvelle', bgColor: '#f97316', textColor: '#ffffff', fontSize: 16 },
      { id: 'u_btn2',   kind: 'button',        x: 20,  y: 240, width: 480, height: 52, text: '2. Mesurer avec le CS-160',   eventId: 'mesurer',  bgColor: '#4361ee', textColor: '#ffffff', fontSize: 16 },
      { id: 'u_score',  kind: 'score_display', x: 20,  y: 308, width: 150, height: 70, text: 'Score',    varBind: 'score' },
      { id: 'u_mx',     kind: 'score_display', x: 186, y: 308, width: 150, height: 70, text: 'x mesuré', varBind: 'meas_x' },
      { id: 'u_my',     kind: 'score_display', x: 352, y: 308, width: 148, height: 70, text: 'y mesuré', varBind: 'meas_y' },
      { id: 'u_gauge',  kind: 'gauge_ring',    x: 20,  y: 392, width: 96,  height: 96, varBind: 'meas_accuracy', bgColor: '#06d6a0' },
      { id: 'u_lbl1',   kind: 'label',         x: 130, y: 392, width: 370, height: 44, text: 'Précision de la dernière mesure (0 à 100 %)', textColor: '#a0c4ff', fontSize: 13 },
      { id: 'u_lbl2',   kind: 'label',         x: 130, y: 440, width: 370, height: 44, text: 'La salle reste allumée dans la couleur à mesurer', textColor: '#8892a8', fontSize: 12 },
      { id: 'u_grid',   kind: 'plate_grid',    x: 520, y: 14,  width: 320, height: 474 },
    ],
    comments: [],
    pythonCode: '',
  };

  // INSERT uniquement si absent - check par PRÉFIXE D'ID (robuste aux renommages
  // faits dans l'éditeur, contrairement à un check par nom).
  const existing = db.prepare("SELECT id FROM crg_games WHERE id LIKE 'chromadetect_%';").get();
  if (!existing) {
    const id = `chromadetect_${Date.now().toString(36)}`;
    db.prepare("INSERT INTO crg_games(id, name, kind, config_json, updated_at) VALUES(?, ?, 'editor', ?, datetime('now'));")
      .run(id, GAME_NAME, JSON.stringify(config));
  }
}

function seedLibreRGBGame(db: Database.Database) {
  const GAME_NAME = 'Mode Libre - Couleur RGB';
  // Jeu construit en blocs réels (pas de composant natif monolithique) :
  //   on_tick (50ms) → get_player_rgb → show_target_on_plates
  // Les sliders R/G/B apparaissent dans la barre de l'éditeur pendant l'exécution.
  // L'UI designer affiche la vraie interface du jeu.
  const config = {
    version: 1,
    tileCount: 42,
    bgColor: '#0b0f1c',
    accentColor: '#4361ee',
    icon: 'Palette',
    description: 'Explorez librement les couleurs : 3 curseurs R/G/B allument les dalles et le diagramme CIE 1931 se met à jour en temps réel.',
    // Pas horizontal de 380px (bloc ~290px de large) → lecture aérée.
    nodes: [
      // ─ Déclencheur ─────────────────────────────────────────────────────────
      { id: 'n_start',   kind: 'event_begin',          name: 'Démarrer',            enabled: true,  params: {}, pos: { x: 60,  y: 160 } },
      // ─ Boucle temps réel (50 ms) ───────────────────────────────────────────
      { id: 'n_tick',    kind: 'on_tick',               name: 'Tick 50 ms',          enabled: true,  params: { intervalMs: 50 }, pos: { x: 440, y: 160 } },
      // ─ Lecture sliders joueur ──────────────────────────────────────────────
      { id: 'n_rgb',     kind: 'get_player_rgb',        name: 'Lire R/G/B joueur',   enabled: true,  params: { varR: 'r', varG: 'g', varB: 'b', varColor: 'couleur' }, pos: { x: 820, y: 160 } },
      // ─ Envoi aux dalles ────────────────────────────────────────────────────
      { id: 'n_send',    kind: 'show_target_on_plates', name: 'Allumer les dalles',  enabled: true,  params: { varName: 'couleur', plates: 'all', intensity: 0.90 }, pos: { x: 1200, y: 160 } },
      // ─ Affichage CIE (optionnel – déclenchable manuellement) ───────────────
      { id: 'n_cie',     kind: 'measure_show_cie',      name: 'Diagramme CIE',       enabled: true,  params: { showTarget: false, showResult: true }, pos: { x: 1580, y: 160 } },
    ],
    edges: [
      { id: 'e1', from: 'n_start',  to: 'n_tick' },
      { id: 'e2', from: 'n_tick',   to: 'n_rgb'  },
      { id: 'e3', from: 'n_rgb',    to: 'n_send' },
      { id: 'e4', from: 'n_send',   to: 'n_cie'  },
    ],
    uiLayout: [
      // Titre
      { id: 'u_title',   kind: 'title_banner',  x: 20,  y: 12,  width: 820, height: 52,
        text: 'Mode Libre - Couleur RGB', bgColor: '#0b0f1c', textColor: '#e8eaf0' },
      // Pastille couleur courante (liée à la variable 'couleur')
      { id: 'u_swatch',  kind: 'color_swatch',  x: 20,  y: 80,  width: 100, height: 100,
        colorBind: 'couleur' },
      // Sliders R/G/B
      { id: 'u_rgb',     kind: 'rgb_sliders',   x: 136, y: 80,  width: 360, height: 130 },
      // Valeurs numériques R
      { id: 'u_lr',      kind: 'label',         x: 510, y: 80,  width: 120, height: 36,
        text: 'R', varBind: 'r', textColor: '#ef4444', fontSize: 18 },
      // Valeurs numériques G
      { id: 'u_lg',      kind: 'label',         x: 510, y: 122, width: 120, height: 36,
        text: 'G', varBind: 'g', textColor: '#22c55e', fontSize: 18 },
      // Valeurs numériques B
      { id: 'u_lb',      kind: 'label',         x: 510, y: 164, width: 120, height: 36,
        text: 'B', varBind: 'b', textColor: '#3b82f6', fontSize: 18 },
      // Diagramme CIE 1931
      { id: 'u_cie',     kind: 'cie_diagram',   x: 20,  y: 228, width: 400, height: 300,
        cieRandom: false },
      // Grille 42 dalles (preview)
      { id: 'u_grid',    kind: 'plate_grid',    x: 440, y: 228, width: 400, height: 300 },
    ],
  };
  // Check par PRÉFIXE D'ID - robuste aux renommages faits dans l'éditeur.
  const existing = db.prepare("SELECT id FROM crg_games WHERE id LIKE 'libre_rgb_%';").get();
  if (!existing) {
    const id = `libre_rgb_${Date.now().toString(36)}`;
    db.prepare("INSERT INTO crg_games(id, name, kind, config_json, updated_at) VALUES(?, ?, 'editor', ?, datetime('now'));")
      .run(id, GAME_NAME, JSON.stringify(config));
  }
}

export function getDb(): Database.Database {
  if (dbSingleton) return dbSingleton;

  const file = resolveDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  migrate(db);

  dbSingleton = db;
  return db;
}

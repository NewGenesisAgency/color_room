import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

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

  // ─── Jeux seed ───────────────────────────────────────────────────────────────
  seedChromatectGame(db);
  seedLibreRGBGame(db);
}

function seedChromatectGame(db: Database.Database) {
  const GAME_NAME = 'ChromaDetect – Load Test CS-160';
  const config = {
    version: 1,
    tileCount: 42,
    bgColor: '#0a0f1a',
    accentColor: '#06d6a0',
    icon: 'Crosshair',
    description: 'Mesurez la couleur spectrale affichée sur les dalles avec le CS-160 et comparez au spectre cible. Plus vous êtes précis, plus vous marquez.',
    nodes: [
      { id: 'n_start', kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 120 } },
    ],
    edges: [],
    uiLayout: [
      // Bandeau titre
      { id: 'u_title', kind: 'title_banner', x: 10, y: 10, width: 700, height: 50,
        text: 'ChromaDetect – CS-160', bgColor: '#0a0f1a', textColor: '#06d6a0', fontSize: 20 },
      // Diagramme CIE 1931 — cœur du jeu : cible aléatoire, mesure CS-160, ΔE, score
      { id: 'u_cie', kind: 'cie_diagram', x: 10, y: 70, width: 700, height: 480,
        cieTargetX: 0.3127, cieTargetY: 0.3290, cieTolerance: 5, cieRandom: true, points: 1000 },
    ],
  };

  // INSERT uniquement si absent — ne pas écraser les personnalisations faites dans l'éditeur
  const existing = db.prepare("SELECT id FROM crg_games WHERE name = ?;").get(GAME_NAME);
  if (!existing) {
    const id = `chromadetect_${Date.now().toString(36)}`;
    db.prepare("INSERT INTO crg_games(id, name, kind, config_json, updated_at) VALUES(?, ?, 'editor', ?, datetime('now'));")
      .run(id, GAME_NAME, JSON.stringify(config));
  }
}

function seedLibreRGBGame(db: Database.Database) {
  const GAME_NAME = 'Mode Libre — Couleur RGB';
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
    nodes: [
      // ─ Déclencheur ─────────────────────────────────────────────────────────
      { id: 'n_start',   kind: 'event_begin',          name: '▶ Démarrer',            enabled: true,  params: {}, pos: { x: 60,  y: 160 } },
      // ─ Boucle temps réel (50 ms) ───────────────────────────────────────────
      { id: 'n_tick',    kind: 'on_tick',               name: '⏱ Tick 50ms',           enabled: true,  params: { intervalMs: 50 }, pos: { x: 280, y: 160 } },
      // ─ Lecture sliders joueur ──────────────────────────────────────────────
      { id: 'n_rgb',     kind: 'get_player_rgb',        name: '🎨 Lire R/G/B joueur',  enabled: true,  params: { varR: 'r', varG: 'g', varB: 'b', varColor: 'couleur' }, pos: { x: 520, y: 160 } },
      // ─ Envoi aux dalles ────────────────────────────────────────────────────
      { id: 'n_send',    kind: 'show_target_on_plates', name: '💡 Allumer les dalles', enabled: true,  params: { varName: 'couleur', plates: 'all', intensity: 0.90 }, pos: { x: 760, y: 160 } },
      // ─ Affichage CIE (optionnel – déclenchable manuellement) ───────────────
      { id: 'n_cie',     kind: 'measure_show_cie',      name: '📊 Diagramme CIE',      enabled: true,  params: { showTarget: false, showResult: true }, pos: { x: 760, y: 320 } },
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
        text: 'Mode Libre — Couleur RGB', bgColor: '#0b0f1c', textColor: '#e8eaf0' },
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
  const existing = db.prepare("SELECT id FROM crg_games WHERE name = ?;").get(GAME_NAME);
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

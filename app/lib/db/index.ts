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

  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_flows (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, flow_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_runtime_runs (id TEXT PRIMARY KEY, flow_name TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT, status TEXT NOT NULL);",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_runtime_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, ts TEXT NOT NULL DEFAULT (datetime('now')), level TEXT NOT NULL, message TEXT NOT NULL, data_json TEXT, FOREIGN KEY(run_id) REFERENCES crg_runtime_runs(id));",
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_runtime_logs_run ON crg_runtime_logs(run_id);');

  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_morpion_rooms (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), player_x_token TEXT NOT NULL, player_o_token TEXT, board_json TEXT NOT NULL, turn TEXT NOT NULL, winner TEXT, status TEXT NOT NULL DEFAULT 'waiting');",
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_morpion_updated ON crg_morpion_rooms(updated_at);');

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
  const config = {
    version: 1,
    tileCount: 42,
    bgColor: '#0b0f1c',
    accentColor: '#4361ee',
    icon: 'Palette',
    description: 'Explorez librement les couleurs : 3 curseurs R/G/B allument les dalles, le diagramme CIE 1931 se met à jour en temps réel.',
    nodes: [
      { id: 'n_start', kind: 'event_begin',   name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 120 } },
      { id: 'n_game',  kind: 'game_libre_rgb', name: 'Mode Libre RGB', enabled: true, params: {}, pos: { x: 380, y: 120 } },
    ],
    edges: [{ id: 'e1', from: 'n_start', to: 'n_game' }],
    uiLayout: [
      { id: 'u_title',  kind: 'title_banner', x: 40, y: 16,  width: 420, height: 52, text: 'Mode Libre — Couleur RGB' },
      { id: 'u_swatch', kind: 'color_swatch', x: 40, y: 84,  width: 80,  height: 80  },
      { id: 'u_slid',   kind: 'rgb_sliders',  x: 136, y: 84, width: 310, height: 130 },
      { id: 'u_cie',    kind: 'cie_diagram',  x: 40, y: 232, width: 420, height: 300 },
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

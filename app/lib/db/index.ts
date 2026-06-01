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

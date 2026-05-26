import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// ── Singleton sur globalThis ───────────────────────────────────────────────────
// En mode dev Next.js, les modules serveur sont reconstruits à chaque hot-reload
// MAIS globalThis survit. Sans ça, chaque reload crée un nouveau handle
// better-sqlite3 qui tente d'ouvrir le fichier encore verrouillé par l'ancien
// handle → SQLITE_CANTOPEN / "unable to open database file" sur Windows.
// En production le module n'est chargé qu'une fois, donc globalThis = module : aucune différence.
const g = globalThis as typeof globalThis & { __colorRoomDb?: Database.Database };

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

  // crg_users uses real column names: name (not username), user_type (not role)
  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, user_type TEXT NOT NULL DEFAULT 'apprenant', password_hash TEXT, niveau TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_crg_users_type ON crg_users(user_type);');

  // Colonnes ajoutées après la création initiale de la table
  try { db.exec('ALTER TABLE crg_users ADD COLUMN password_hash TEXT;'); } catch { /* existe déjà */ }
  try { db.exec('ALTER TABLE crg_users ADD COLUMN niveau TEXT;'); } catch { /* existe déjà */ }

  db.exec(
    "CREATE TABLE IF NOT EXISTS crg_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(user_id) REFERENCES crg_users(id));",
  );
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_crg_sessions_token ON crg_sessions(token);');
}

function openDb(file: string): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  // Checkpoint immédiat : fusionne le WAL dans le fichier principal.
  // Évite qu'un gros .db-wal (490 Ko ici) ralentisse l'ouverture
  // ou cause des problèmes de verrou sur Windows.
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* non-fatal */ }
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  // Réutiliser la connexion existante si elle est encore ouverte
  if (g.__colorRoomDb?.open) return g.__colorRoomDb;

  const file = resolveDbPath();

  try {
    const db = openDb(file);
    g.__colorRoomDb = db;
    return db;
  } catch (err) {
    // Dernier recours : supprimer les fichiers WAL/SHM verrouillés et réessayer.
    // Cela peut arriver quand le serveur dev Next.js recharge le module sans
    // fermer proprement le handle précédent (Windows garde le .db-shm verrouillé).
    console.warn('[db] Échec ouverture initiale, tentative de nettoyage WAL :', err);
    for (const ext of ['-shm', '-wal']) {
      try { fs.unlinkSync(file + ext); } catch { /* fichier absent — ok */ }
    }
    const db = openDb(file); // 2e tentative sans les fichiers WAL orphelins
    g.__colorRoomDb = db;
    return db;
  }
}

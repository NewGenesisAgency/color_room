import { getDb } from '@/lib/db';

export type SpSeat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type SpPhase = 'lobby' | 'reveal' | 'guess' | 'result' | 'finished';

export type SpPlayer = {
  seat: SpSeat;
  name: string;
  guessR: number;
  guessG: number;
  guessB: number;
  submitted: boolean;
  roundScore: number;
  totalScore: number;
};

export type SpState = {
  gameId: 'spectre';
  phase: SpPhase;
  round: number;
  maxRounds: number;
  targetR: number;
  targetG: number;
  targetB: number;
  revealDurationMs: number;
  guessDurationMs: number;
  phaseEndsAtMs: number;
  players: Partial<Record<SpSeat, SpPlayer>>;
  createdAt: string;
};

export type SpSessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'finished';
  game_id: string;
  state_json: string;
  room_code: string | null;
};

export type SpPlayerRow = {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  token: string;
  name: string;
  seat: number;
  last_seen_at: string;
};

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I O U 1 L 0 (ambigus)

function generateSpectreCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function uniqueSpectreCode(db: import('better-sqlite3').Database): string {
  let code = generateSpectreCode();
  for (let tries = 0; tries < 20; tries++) {
    const clash = db.prepare("SELECT 1 FROM crg_mp_sessions WHERE room_code = ? AND status = 'active';").get(code);
    if (!clash) return code;
    code = generateSpectreCode();
  }
  return code; // en dernier recours (collision très improbable sur 6 chars base32)
}

function randomVividColor(): { r: number; g: number; b: number } {
  const h = Math.floor(Math.random() * 360);
  const s = 65 + Math.floor(Math.random() * 35);
  const l = 35 + Math.floor(Math.random() * 25);
  return hslToRgb(h, s, l);
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else              { r1 = c; g1 = 0; b1 = x; }
  return {
    r: Math.max(0, Math.min(255, Math.round((r1 + m) * 255))),
    g: Math.max(0, Math.min(255, Math.round((g1 + m) * 255))),
    b: Math.max(0, Math.min(255, Math.round((b1 + m) * 255))),
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function colorScore(tR: number, tG: number, tB: number, gR: number, gG: number, gB: number): number {
  const dr = tR - gR, dg = tG - gG, db = tB - gB;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const maxDist = Math.sqrt(3 * 255 * 255);
  return Math.round(Math.max(0, (1 - dist / maxDist) * 1000));
}

export function getActiveSpectreSession(): { session: SpSessionRow; state: SpState } | null {
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT id, created_at, updated_at, status, game_id, state_json, room_code FROM crg_mp_sessions WHERE status = 'active' AND game_id = 'spectre' ORDER BY updated_at DESC LIMIT 1;"
    ).get() as SpSessionRow | undefined;
    if (!row) return null;
    return { session: row, state: JSON.parse(row.state_json) as SpState };
  } catch { return null; }
}

export function getSpectreSessionById(sessionId: string): { session: SpSessionRow; state: SpState } | null {
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT id, created_at, updated_at, status, game_id, state_json, room_code FROM crg_mp_sessions WHERE id = ? AND game_id = 'spectre';"
    ).get(sessionId) as SpSessionRow | undefined;
    if (!row) return null;
    return { session: row, state: JSON.parse(row.state_json) as SpState };
  } catch { return null; }
}

export function getLatestSpectreSession(): { session: SpSessionRow; state: SpState } | null {
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT id, created_at, updated_at, status, game_id, state_json, room_code FROM crg_mp_sessions WHERE game_id = 'spectre' ORDER BY updated_at DESC LIMIT 1;"
    ).get() as SpSessionRow | undefined;
    if (!row) return null;
    return { session: row, state: JSON.parse(row.state_json) as SpState };
  } catch { return null; }
}

export function startSpectreSession(opts?: { reset?: boolean; maxRounds?: number }): { sessionId: string; roomCode: string; state: SpState } {
  const db = getDb();
  const reset = Boolean(opts?.reset);
  const maxRounds = (opts?.maxRounds && opts.maxRounds > 0) ? opts.maxRounds : 5;

  if (reset) {
    db.prepare("UPDATE crg_mp_sessions SET status = 'finished', updated_at = datetime('now') WHERE status = 'active' AND game_id = 'spectre';").run();
  }

  const existing = getActiveSpectreSession();
  if (existing && !reset) {
    const roomCode = existing.session.room_code ?? existing.session.id;
    return { sessionId: existing.session.id, roomCode, state: existing.state };
  }

  const sessionId = randomId();
  const roomCode = uniqueSpectreCode(db);
  const color = randomVividColor();
  const state: SpState = {
    gameId: 'spectre',
    phase: 'lobby',
    round: 0,
    maxRounds,
    targetR: color.r, targetG: color.g, targetB: color.b,
    revealDurationMs: 5000,
    guessDurationMs: 30000,
    phaseEndsAtMs: 0,
    players: {},
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT INTO crg_mp_sessions(id, status, game_id, state_json, updated_at, room_code) VALUES(?, 'active', ?, ?, datetime('now'), ?);"
  ).run(sessionId, 'spectre', JSON.stringify(state), roomCode);

  return { sessionId, roomCode, state };
}

export function listSpectrePlayers(sessionId: string): SpPlayerRow[] {
  try {
    const db = getDb();
    return db.prepare(
      "SELECT id, session_id, created_at, updated_at, token, name, seat, last_seen_at FROM crg_mp_players WHERE session_id = ? AND last_seen_at >= datetime('now', '-30 seconds') ORDER BY seat ASC;"
    ).all(sessionId) as SpPlayerRow[];
  } catch { return []; }
}

export function joinSpectreSession(codeOrId: string, name?: string): { token: string; seat: SpSeat; sessionId: string } | null {
  try {
    const db = getDb();
    // Accepte un room_code court (6 chars) OU l'ID interne (long)
    const byCode = db.prepare(
      "SELECT id, status, state_json FROM crg_mp_sessions WHERE room_code = ? AND game_id = 'spectre';"
    ).get(codeOrId.toUpperCase()) as { id: string; status: string; state_json: string } | undefined;
    const session = byCode ?? (
      db.prepare(
        "SELECT id, status, state_json FROM crg_mp_sessions WHERE id = ? AND game_id = 'spectre';"
      ).get(codeOrId) as { id: string; status: string; state_json: string } | undefined
    );
    if (!session || session.status !== 'active') return null;
    const sessionId = session.id;

    const state = JSON.parse(session.state_json) as SpState;
    if (state.phase !== 'lobby') return null;

    const players = listSpectrePlayers(sessionId);
    const taken = new Set(players.map((p) => p.seat));
    const seat: SpSeat | null =
      !taken.has(1) ? 1 : !taken.has(2) ? 2 : !taken.has(3) ? 3 : !taken.has(4) ? 4 :
      !taken.has(5) ? 5 : !taken.has(6) ? 6 : !taken.has(7) ? 7 : !taken.has(8) ? 8 : null;
    if (!seat) return null;

    const token = randomId();
    const id = randomId();
    const safeName = name?.trim() || `Joueur${seat}`;

    db.prepare(
      "INSERT INTO crg_mp_players(id, session_id, token, name, seat, updated_at, last_seen_at) VALUES(?, ?, ?, ?, ?, datetime('now'), datetime('now'));"
    ).run(id, sessionId, token, safeName, seat);

    if (!state.players) state.players = {};
    state.players[seat] = {
      seat, name: safeName,
      guessR: 128, guessG: 128, guessB: 128,
      submitted: false, roundScore: 0, totalScore: 0,
    };
    db.prepare("UPDATE crg_mp_sessions SET state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(JSON.stringify(state), sessionId);

    return { token, seat, sessionId };
  } catch { return null; }
}

export function touchSpectrePlayer(token: string): SpPlayerRow | null {
  try {
    const db = getDb();
    db.prepare("UPDATE crg_mp_players SET last_seen_at = datetime('now'), updated_at = datetime('now') WHERE token = ?;").run(token);
    return db.prepare(
      "SELECT id, session_id, created_at, updated_at, token, name, seat, last_seen_at FROM crg_mp_players WHERE token = ?;"
    ).get(token) as SpPlayerRow | null;
  } catch { return null; }
}

export function submitSpectreGuess(token: string, r: number, g: number, b: number): { sessionId: string; state: SpState } | null {
  try {
    const player = touchSpectrePlayer(token);
    if (!player) return null;
    const db = getDb();
    const sessionRow = db.prepare(
      "SELECT id, created_at, updated_at, status, game_id, state_json, room_code FROM crg_mp_sessions WHERE id = ? AND game_id = 'spectre';"
    ).get(player.session_id) as SpSessionRow | undefined;
    if (!sessionRow || sessionRow.status !== 'active') return null;

    const state = JSON.parse(sessionRow.state_json) as SpState;
    if (state.phase !== 'guess') return null;

    const seat = Number(player.seat) as SpSeat;
    const cr = Math.max(0, Math.min(255, Math.round(r)));
    const cg = Math.max(0, Math.min(255, Math.round(g)));
    const cb = Math.max(0, Math.min(255, Math.round(b)));

    if (!state.players[seat]) {
      state.players[seat] = { seat, name: player.name, guessR: cr, guessG: cg, guessB: cb, submitted: false, roundScore: 0, totalScore: 0 };
    }
    const p = state.players[seat]!;
    p.guessR = cr; p.guessG = cg; p.guessB = cb;
    p.submitted = true;
    p.roundScore = colorScore(state.targetR, state.targetG, state.targetB, cr, cg, cb);

    db.prepare("UPDATE crg_mp_sessions SET state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(JSON.stringify(state), sessionRow.id);
    return { sessionId: sessionRow.id, state };
  } catch { return null; }
}

export function advanceSpectrePhase(sessionId: string): { state: SpState } | null {
  try {
    const db = getDb();
    const sessionRow = db.prepare(
      "SELECT id, created_at, updated_at, status, game_id, state_json, room_code FROM crg_mp_sessions WHERE id = ? AND game_id = 'spectre';"
    ).get(sessionId) as SpSessionRow | undefined;
    if (!sessionRow || sessionRow.status !== 'active') return null;

    const state = JSON.parse(sessionRow.state_json) as SpState;
    const now = Date.now();

    switch (state.phase) {
      case 'lobby': {
        const c = randomVividColor();
        state.round = 1;
        state.targetR = c.r; state.targetG = c.g; state.targetB = c.b;
        state.phase = 'reveal';
        state.phaseEndsAtMs = now + state.revealDurationMs;
        for (const p of Object.values(state.players)) {
          if (p) { p.submitted = false; p.roundScore = 0; p.guessR = 128; p.guessG = 128; p.guessB = 128; }
        }
        break;
      }
      case 'reveal': {
        state.phase = 'guess';
        state.phaseEndsAtMs = now + state.guessDurationMs;
        break;
      }
      case 'guess': {
        for (const p of Object.values(state.players)) {
          if (!p) continue;
          if (!p.submitted) p.roundScore = colorScore(state.targetR, state.targetG, state.targetB, p.guessR, p.guessG, p.guessB);
          p.totalScore += p.roundScore;
        }
        state.phase = 'result';
        state.phaseEndsAtMs = now + 10000;
        break;
      }
      case 'result': {
        if (state.round >= state.maxRounds) {
          state.phase = 'finished';
          state.phaseEndsAtMs = 0;
          db.prepare("UPDATE crg_mp_sessions SET status = 'finished', state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(JSON.stringify(state), sessionId);
          return { state };
        }
        const c = randomVividColor();
        state.round += 1;
        state.targetR = c.r; state.targetG = c.g; state.targetB = c.b;
        state.phase = 'reveal';
        state.phaseEndsAtMs = now + state.revealDurationMs;
        for (const p of Object.values(state.players)) {
          if (p) { p.submitted = false; p.roundScore = 0; p.guessR = 128; p.guessG = 128; p.guessB = 128; }
        }
        break;
      }
      default: return null;
    }

    db.prepare("UPDATE crg_mp_sessions SET state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(JSON.stringify(state), sessionId);
    return { state };
  } catch { return null; }
}

export function stopSpectreSession(token: string): { sessionId: string } | null {
  try {
    const player = touchSpectrePlayer(token);
    if (!player || Number(player.seat) !== 1) return null;
    const db = getDb();
    db.prepare("UPDATE crg_mp_sessions SET status = 'finished', updated_at = datetime('now') WHERE id = ?;").run(player.session_id);
    return { sessionId: player.session_id };
  } catch { return null; }
}

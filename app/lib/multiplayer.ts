import { getDb } from '@/lib/db';

export type MpSeat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type MpSessionState = {
  gameId: 'split-screen';
  createdAt: string;
  durationMs: number;
  endsAtMs: number;
  channelBySeat: Partial<Record<MpSeat, number>>;
  targetValueBySeat: Partial<Record<MpSeat, number>>;
  submittedValueBySeat: Partial<Record<MpSeat, number>>;
  score: number;
};

export type MpSessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'finished';
  game_id: string;
  state_json: string;
};

export type MpPlayerRow = {
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

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function randomValue255(): number {
  return clamp255(Math.floor(Math.random() * 256));
}

function pickUniqueTintChannel(used: Set<number>): number {
  const candidates: number[] = [];
  for (let i = 1; i <= 32; i++) if (!used.has(i)) candidates.push(i);
  if (candidates.length <= 0) return 26;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0] ?? 26;
}

function isExpired(state: MpSessionState, nowMs: number): boolean {
  const ends = Number(state.endsAtMs || 0);
  if (!Number.isFinite(ends) || ends <= 0) return false;
  return nowMs >= ends;
}

export function getActiveSession(): { session: MpSessionRow; state: MpSessionState } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, created_at, updated_at, status, game_id, state_json FROM crg_mp_sessions WHERE status = ? ORDER BY updated_at DESC LIMIT 1;')
    .get('active') as MpSessionRow | undefined;
  if (!row) return null;
  try {
    const state = JSON.parse(row.state_json) as MpSessionState;
    return { session: row, state };
  } catch {
    return null;
  }
}

export function getLatestSession(): { session: MpSessionRow; state: MpSessionState } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, created_at, updated_at, status, game_id, state_json FROM crg_mp_sessions ORDER BY updated_at DESC LIMIT 1;')
    .get() as MpSessionRow | undefined;
  if (!row) return null;
  try {
    const state = JSON.parse(row.state_json) as MpSessionState;
    return { session: row, state };
  } catch {
    return null;
  }
}

export function startNewSession(opts?: { reset?: boolean; durationMs?: number }): { sessionId: string; state: MpSessionState } {
  const db = getDb();
  const reset = Boolean(opts?.reset);
  const durationMs = typeof opts?.durationMs === 'number' && opts.durationMs > 0 ? opts.durationMs : 2 * 60 * 1000;

  if (reset) {
    db.prepare("UPDATE crg_mp_sessions SET status = 'finished', updated_at = datetime('now') WHERE status = 'active';").run();
  }

  const existing = getActiveSession();
  if (existing && !reset) return { sessionId: existing.session.id, state: existing.state };

  const sessionId = randomId();
  const nowMs = Date.now();

  const state: MpSessionState = {
    gameId: 'split-screen',
    createdAt: new Date(nowMs).toISOString(),
    durationMs,
    // lobby: timer starts when >= 2 players are present
    endsAtMs: 0,
    channelBySeat: {},
    targetValueBySeat: {},
    submittedValueBySeat: {},
    score: 0,
  };

  db.prepare(
    "INSERT INTO crg_mp_sessions(id, status, game_id, state_json, updated_at) VALUES(?, 'active', ?, ?, datetime('now'));",
  ).run(sessionId, state.gameId, JSON.stringify(state));

  return { sessionId, state };
}

export function createOrGetActiveSession(): { sessionId: string; state: MpSessionState } {
  return startNewSession({ reset: false, durationMs: 2 * 60 * 1000 });
}

export function listPlayers(sessionId: string): MpPlayerRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, session_id, created_at, updated_at, token, name, seat, last_seen_at FROM crg_mp_players WHERE session_id = ? AND last_seen_at >= datetime('now', '-20 seconds') ORDER BY seat ASC;",
    )
    .all(sessionId) as MpPlayerRow[];
}

export function joinGuest(sessionId: string, name?: string): { token: string; seat: MpSeat } | null {
  const db = getDb();
  const session = db
    .prepare('SELECT id, status, state_json FROM crg_mp_sessions WHERE id = ?;')
    .get(sessionId) as { id: string; status: string; state_json: string } | undefined;
  if (!session || session.status !== 'active') return null;

  try {
    const st = JSON.parse(session.state_json) as MpSessionState;
    if (isExpired(st, Date.now())) return null;
  } catch {
    return null;
  }

  const players = listPlayers(sessionId);
  const taken = new Set(players.map((p) => p.seat));

  const seat: MpSeat | null =
    !taken.has(1)
      ? 1
      : !taken.has(2)
        ? 2
        : !taken.has(3)
          ? 3
          : !taken.has(4)
            ? 4
            : !taken.has(5)
              ? 5
              : !taken.has(6)
                ? 6
                : !taken.has(7)
                  ? 7
                  : !taken.has(8)
                    ? 8
                    : null;
  if (!seat) return null;

  const token = randomId();
  const id = randomId();
  const safeName = (name && name.trim().length > 0 ? name.trim() : `Guest${seat}`) as string;

  db.prepare(
    "INSERT INTO crg_mp_players(id, session_id, token, name, seat, updated_at, last_seen_at) VALUES(?, ?, ?, ?, ?, datetime('now'), datetime('now'));",
  ).run(id, sessionId, token, safeName, seat);

  // Ensure state has a channel + target for this seat
  try {
    const st = JSON.parse(session.state_json) as MpSessionState;
    const used = new Set<number>();
    for (const v of Object.values(st.channelBySeat ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 1 && n <= 32) used.add(n);
    }
    if (!st.channelBySeat) st.channelBySeat = {};
    if (!st.targetValueBySeat) st.targetValueBySeat = {};
    if (!st.submittedValueBySeat) st.submittedValueBySeat = {};

    if (!st.channelBySeat[seat]) st.channelBySeat[seat] = pickUniqueTintChannel(used);
    if (st.targetValueBySeat[seat] === undefined) st.targetValueBySeat[seat] = randomValue255();
    if (st.submittedValueBySeat[seat] === undefined) st.submittedValueBySeat[seat] = 0;

    db.prepare("UPDATE crg_mp_sessions SET state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(
      JSON.stringify(st),
      sessionId,
    );
  } catch {
    // ignore
  }

  return { token, seat };
}

export function touchPlayer(token: string): MpPlayerRow | null {
  const db = getDb();
  db.prepare("UPDATE crg_mp_players SET last_seen_at = datetime('now'), updated_at = datetime('now') WHERE token = ?;").run(token);
  const row = db
    .prepare('SELECT id, session_id, created_at, updated_at, token, name, seat, last_seen_at FROM crg_mp_players WHERE token = ?;')
    .get(token) as MpPlayerRow | undefined;
  return row ?? null;
}

export function submitChannelValue(token: string, value: number): { sessionId: string; state: MpSessionState } | null {
  const player = touchPlayer(token);
  if (!player) return null;

  const db = getDb();
  const sessionRow = db
    .prepare('SELECT id, created_at, updated_at, status, game_id, state_json FROM crg_mp_sessions WHERE id = ?;')
    .get(player.session_id) as MpSessionRow | undefined;
  if (!sessionRow || sessionRow.status !== 'active') return null;

  let state: MpSessionState;
  try {
    state = JSON.parse(sessionRow.state_json) as MpSessionState;
  } catch {
    return null;
  }

  const nowMs = Date.now();
  if (isExpired(state, nowMs)) {
    db.prepare("UPDATE crg_mp_sessions SET status = 'finished', updated_at = datetime('now') WHERE id = ?;").run(sessionRow.id);
    return null;
  }

  const seat = Number(player.seat) as MpSeat;
  if (!state.submittedValueBySeat) state.submittedValueBySeat = {};
  state.submittedValueBySeat[seat] = clamp255(value);

  const players = listPlayers(sessionRow.id);
  const activeSeats = players
    .map((p) => Number(p.seat))
    .filter((s) => Number.isFinite(s) && s >= 1 && s <= 8) as MpSeat[];

  const tol = 12;
  const canScore = activeSeats.length >= 2;
  let allOk = canScore;
  for (const s of activeSeats) {
    const t = Number(state.targetValueBySeat?.[s] ?? NaN);
    const v = Number(state.submittedValueBySeat?.[s] ?? NaN);
    if (!Number.isFinite(t) || !Number.isFinite(v) || Math.abs(clamp255(v) - clamp255(t)) > tol) {
      allOk = false;
      break;
    }
  }

  if (allOk) {
    state.score = (state.score ?? 0) + 1;
    for (const s of activeSeats) {
      if (state.targetValueBySeat) state.targetValueBySeat[s] = randomValue255();
      if (state.submittedValueBySeat) state.submittedValueBySeat[s] = 0;
    }
  }

  db.prepare("UPDATE crg_mp_sessions SET state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(
    JSON.stringify(state),
    sessionRow.id,
  );

  return { sessionId: sessionRow.id, state };
}

export function stopSession(token: string): { sessionId: string } | null {
  const player = touchPlayer(token);
  if (!player) return null;
  if (Number(player.seat) !== 1) return null;

  const db = getDb();
  const sessionRow = db
    .prepare('SELECT id, status FROM crg_mp_sessions WHERE id = ?;')
    .get(player.session_id) as { id: string; status: string } | undefined;
  if (!sessionRow || sessionRow.status !== 'active') return null;

  db.prepare("UPDATE crg_mp_sessions SET status = 'finished', updated_at = datetime('now') WHERE id = ?;").run(sessionRow.id);
  return { sessionId: sessionRow.id };
}

// Script d'insertion du jeu Tetris complet dans la base de données
// Usage : node scripts/insert-tetris.mjs

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, '..', 'data', 'ColorRoomDB.db');

const TETRIS_PYTHON = `\
import asyncio
import random

# ─── Configuration ────────────────────────────────────────────────────────────
COLS = 6
ROWS = 7

# Formes des 7 pièces Tetris (grilles 4×4)
PIECES = [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],  # I
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],  # O
    [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],  # T
    [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],  # S
    [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],  # Z
    [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],  # J
    [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],  # L
]
COLORS = ['#00e5ff','#ffd600','#aa00ff','#00c853','#ff1744','#2979ff','#ff6d00']

# ─── État du jeu ──────────────────────────────────────────────────────────────
grid      = [[None]*COLS for _ in range(ROWS)]
score     = 0
level     = 1
game_over = False

def new_piece():
    t = random.randint(0, 6)
    return {'type': t, 'shape': [row[:] for row in PIECES[t]],
            'x': COLS//2 - 2, 'y': -1, 'color': COLORS[t]}

current = new_piece()

# ─── Fonctions de jeu ─────────────────────────────────────────────────────────
def collides(piece, dx=0, dy=0, shape=None):
    s = shape if shape is not None else piece['shape']
    for r, row in enumerate(s):
        for c, cell in enumerate(row):
            if not cell:
                continue
            nx = piece['x'] + c + dx
            ny = piece['y'] + r + dy
            if nx < 0 or nx >= COLS or ny >= ROWS:
                return True
            if ny >= 0 and grid[ny][nx] is not None:
                return True
    return False

def rotate_cw(shape):
    n = 4
    new_s = [[0]*n for _ in range(n)]
    for r in range(n):
        for c in range(n):
            new_s[c][n-1-r] = shape[r][c]
    return new_s

def lock():
    global current, score, level, game_over, grid
    for r, row in enumerate(current['shape']):
        for c, cell in enumerate(row):
            if cell:
                ny = current['y'] + r
                nx = current['x'] + c
                if ny < 0:
                    game_over = True
                    return
                grid[ny][nx] = current['color']
    # Effacement des lignes complètes
    full = [r for r in range(ROWS) if all(grid[r][c] is not None for c in range(COLS))]
    for r in sorted(full, reverse=True):
        grid.pop(r)
        grid.insert(0, [None]*COLS)
    pts = [0, 100, 300, 500, 800]
    gained = pts[min(len(full), 4)]
    score += gained
    if gained > 0:
        cr.add_score(gained)
        cr.log(f"+{gained} pts — {len(full)} ligne{'s' if len(full)>1 else ''} !")
    level = 1 + score // 500
    current = new_piece()
    if collides(current):
        game_over = True

def render():
    for row in range(ROWS):
        for col in range(COLS):
            idx   = row * COLS + col
            color = grid[row][col]
            # Superposer la pièce courante
            for pr, prow in enumerate(current['shape']):
                for pc, pcell in enumerate(prow):
                    if pcell and current['x']+pc == col and current['y']+pr == row:
                        color = current['color']
            if color:
                r_v = int(color[1:3], 16)
                g_v = int(color[3:5], 16)
                b_v = int(color[5:7], 16)
                cr.set_tile(idx, r_v, g_v, b_v, 0.9)
            else:
                cr.set_tile(idx, 2, 2, 10, 0.04)
    cr.flush()

# ─── Démarrage ────────────────────────────────────────────────────────────────
cr.log("🎮 Tetris LED — Contrôles :")
cr.log("  ← → (ou Q D) : déplacer   ↑ (ou Z) : rotation")
cr.log("  ↓ (ou S) : descendre       Espace : chute rapide")
render()

drop_timer = 0

# ─── Boucle principale ────────────────────────────────────────────────────────
async def game_loop():
    global current, game_over, drop_timer, score, level

    while not game_over:
        # Lecture des touches
        key = cr.get_key()
        if key == 'left':
            if not collides(current, dx=-1):
                current['x'] -= 1
        elif key == 'right':
            if not collides(current, dx=1):
                current['x'] += 1
        elif key == 'up':
            rotated = rotate_cw(current['shape'])
            if not collides(current, shape=rotated):
                current['shape'] = rotated
        elif key == 'down':
            if not collides(current, dy=1):
                current['y'] += 1
        elif key == 'space':
            # Chute instantanée
            while not collides(current, dy=1):
                current['y'] += 1
            lock()

        # Gravité automatique
        drop_timer += 1
        speed = max(2, 12 - level)  # accélère avec le niveau
        if drop_timer >= speed:
            drop_timer = 0
            if collides(current, dy=1):
                lock()
            else:
                current['y'] += 1

        render()
        await asyncio.sleep(0.1)

    # Animation Game Over
    cr.log(f"💀 Game Over !  Score final : {score}  Niveau : {level}")
    for flash in range(6):
        intensity = 0.9 if flash % 2 == 0 else 0.04
        r_f, g_f, b_f = (220, 38, 38) if flash % 2 == 0 else (5, 5, 15)
        for i in range(COLS * ROWS):
            cr.set_tile(i, r_f, g_f, b_f, intensity)
        cr.flush()
        await asyncio.sleep(0.3)

await game_loop()
`;

// GameDoc complet — aucun nœud de blocs, tout dans pythonCode
const gameDoc = {
  id:          undefined, // sera attribué par l'API
  name:        'Tetris LED',
  tileCount:   42,
  icon:        'Gamepad2',
  difficulty:  3,
  description: 'Tetris complet sur 42 dalles LED (6×7). Contrôles clavier : ←→ déplacer, ↑ rotation, ↓ accélérer, Espace chute rapide.',
  gameMode:    'solo',
  maxPlayers:  1,
  nodes:       [],
  edges:       [],
  uiComponents: [],
  pythonCode:  TETRIS_PYTHON,
};

function randomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const db  = new Database(DB_PATH);
const id  = randomId();

db.prepare(`
  INSERT INTO crg_games(id, name, kind, config_json, updated_at)
  VALUES (?, ?, 'editor', ?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    name       = excluded.name,
    kind       = excluded.kind,
    config_json= excluded.config_json,
    updated_at = excluded.updated_at
`).run(id, gameDoc.name, JSON.stringify(gameDoc));

const saved = db.prepare('SELECT id, name, created_at FROM crg_games WHERE id = ?').get(id);
console.log('✅ Jeu inséré en DB :');
console.log('   ID         :', saved.id);
console.log('   Nom        :', saved.name);
console.log('   Créé le    :', saved.created_at);
console.log('   Ouvrir dans l\'éditeur → onglet Python → ▶ Exécuter');
db.close();

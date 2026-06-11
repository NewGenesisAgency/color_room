# ColorRoom — Guide technique (extraits de code expliqués)

Document compagnon des diagrammes UML. Il explique les **morceaux de code
importants**, la configuration **`.env`**, et le fonctionnement de l'**IA**
(Ollama local + Google AI Studio / Gemini).

---

## 1. Le fichier `.env` (configuration)

Le fichier réel `.env` **n'est jamais commité** (il contient la clé secrète).
Seul `.env.example` est versionné comme modèle. On le copie :

```bash
cp app/.env.example app/.env
```

### Contenu détaillé, ligne par ligne

```bash
# ─── Google AI Studio (Gemini, cloud) ─────────────────────────────
# Clé API pour la génération de jeux par IA dans /editeur.
# Obtenir une clé GRATUITE : https://aistudio.google.com/apikey
GEMINI_API_KEY=                # ← colle ta clé ici (sinon vide = IA locale)

# Optionnel : ordre des modèles Gemini essayés (du meilleur au repli).
# GEMINI_MODELS=gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3-flash

# ─── IA locale (Ollama, 100 % hors-ligne) ─────────────────────────
# AI_PROVIDER : 'gemini' (cloud) | 'ollama' (local) | vide = automatique
#   (Gemini si une clé existe, sinon bascule sur Ollama local)
# AI_PROVIDER=ollama           # ← force le tout-local (aucun cloud)

# Modèle Ollama chargé sur le Raspberry Pi :
#   qwen2.5:1.5b (~1 Go)  → défaut, RAPIDE sur Pi 4 Go (~1 min/réponse)
#   qwen2.5:3b   (~1.9 Go) → meilleure qualité, ~2× plus lent
#   qwen2.5:7b   (~4.7 Go) → TROP LOURD : tué (OOM) sur un Pi 4 Go
# OLLAMA_MODEL=qwen2.5:1.5b

# URL du serveur Ollama (service docker-compose par défaut)
# OLLAMA_URL=http://ollama:11434

# ─── Base de données ──────────────────────────────────────────────
# Chemin du fichier SQLite (sinon /data/ColorRoomDB.db en Docker)
# COLOR_ROOM_DB_PATH=/data/ColorRoomDB.db
```

> **Règle d'or :** si `GEMINI_API_KEY` est vide → l'app utilise **automatiquement**
> Ollama en local. Tout fonctionne **sans Internet**.

---

## 2. Comment l'IA est choisie (cascade Gemini → Ollama)

`app/api/ai/generate-game/route.ts` décide quel moteur utiliser. La logique :

```ts
const key = process.env.GEMINI_API_KEY ?? '';
const hasKey = !!key && key !== 'XXX' && key.length > 10;

// 1) Si une clé Gemini valide existe → on essaie le cloud d'abord
if (hasKey && (!chosenModel || isGeminiModel(chosenModel))) {
  // Test de joignabilité (5 s max) AVANT d'engager la cascade
  const reachable = await geminiReachable(key, 5000);
  if (!reachable) {
    // Pas d'Internet → bascule AUTOMATIQUE sur Ollama local
    const raw = await callOllama(systemInstructionLite(tileCount), userContent);
    ...
  }
  // Sinon : on essaie chaque modèle Gemini, du meilleur au repli
  for (const model of models) {
    const raw = await callGemini(model, key, sys, userContent);
    if (raw) return NextResponse.json({ ok: true, model, game });
  }
}

// 2) Pas de clé → directement Ollama local
const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
const raw = await callOllama(systemInstructionLite(tileCount), userContent);
```

**À retenir :**
- Clé présente + Internet → **Gemini** (cloud, plus malin).
- Clé présente + pas d'Internet → **bascule auto sur Ollama** (5 s de timeout).
- Pas de clé → **Ollama** directement.

---

## 3. Appel à Google Gemini (cloud)

```ts
async function callGemini(model, key, sys, prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}`
    + `:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: sys }] },
      generationConfig: {
        responseMimeType: 'application/json', // force une réponse JSON pure
        temperature: 0.8,
        maxOutputTokens: 8192,
      },
    }),
  });
}
```

- `responseMimeType: 'application/json'` garantit que Gemini renvoie du **JSON
  exploitable** directement (le schéma d'un jeu : `nodes`, `edges`, `uiLayout`).
- La clé voyage en **paramètre d'URL** (`?key=...`) — c'est l'API officielle
  Google AI Studio.

### Obtenir une clé Google AI Studio (gratuit)
1. Aller sur **https://aistudio.google.com/apikey**
2. Se connecter avec un compte Google → **« Create API key »**
3. Copier la clé dans `app/.env` → `GEMINI_API_KEY=...`
4. Le palier gratuit suffit largement pour générer des jeux en classe.

---

## 4. Appel à Ollama (IA locale, hors-ligne)

```ts
async function callOllama(sys, user) {
  const base  = (process.env.OLLAMA_URL || 'http://ollama:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({
      model,
      system: sys,
      prompt: user,
      format: 'json',          // équivalent local du "responseMimeType json"
      stream: false,
      options: {
        temperature: 0.3,      // bas = plus déterministe (JSON fiable)
        num_predict: 2048,     // longueur max de réponse
        num_ctx: 4096,         // taille de la fenêtre de contexte
      },
    }),
  });
}
```

- `http://ollama:11434` = le **conteneur Docker `ollama`** (réseau interne
  docker-compose). Aucune sortie Internet.
- `temperature: 0.3` (bas) car on veut du **JSON structuré et stable**, pas de
  la créativité.
- `format: 'json'` force Ollama à ne produire que du JSON valide.

### Installer le modèle local
```bash
# Une seule fois, au premier démarrage :
docker exec -it ollama ollama pull qwen2.5:1.5b
```
Le modèle (~1 Go) est ensuite stocké et fonctionne **100 % hors-ligne**.

---

## 5. Authentification — hachage du mot de passe (`lib/auth.ts`)

Les mots de passe ne sont **jamais stockés en clair**. On utilise **PBKDF2**
(SHA-512, 100 000 itérations) avec un sel aléatoire par utilisateur :

```ts
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');               // sel unique
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;                                   // stocké "sel:hash"
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return verify === hash;                                     // comparaison
}
```

**Pourquoi c'est sûr :**
- **Sel aléatoire** → deux utilisateurs avec le même mot de passe ont des
  hachés différents.
- **100 000 itérations** → rend le brute-force coûteux.
- On ne peut **pas** retrouver le mot de passe depuis le haché.

### Session par cookie (`auth/login/route.ts`)
```ts
const token = createSession(user.id);          // jeton aléatoire 32 octets, +30j
res.cookies.set('crg_session', token, {
  httpOnly: true,    // inaccessible au JavaScript (anti-vol XSS)
  maxAge: 30 * 24 * 3600,
  sameSite: 'lax',   // protection CSRF de base
});
```

---

## 6. Le remappage des dalles Rouge / Bleu (`lib/tileChannels.ts`)

Point **critique** du projet : il existe deux types physiques de dalles
(**rouge** et **bleu**) qui n'ont **pas le même câblage de canaux** (longueurs
d'onde sur des index différents). Toute commande couleur doit être traduite :

```ts
// Avant CHAQUE envoi à supervision.exe :
const channels = computeChannels(rgb);          // calculés en référence ROUGE
const finalChannels = PLATE_TYPE[plateId] === 'bleu'
  ? remapChannels32(channels, 'rouge', 'bleu')  // traduction R → B
  : channels;                                    // dalle rouge : inchangé
```

Sans ce remappage, une dalle bleue afficherait la **mauvaise couleur**. C'est
la raison du diagramme d'activité *« Envoi couleur à une dalle »*.

---

## 7. Accès base de données (`lib/db/index.ts`)

Un **singleton SQLite** (better-sqlite3, synchrone) avec création automatique
des tables au premier accès :

```ts
function resolveDbPath(): string {
  if (process.env.COLOR_ROOM_DB_PATH) return process.env.COLOR_ROOM_DB_PATH;
  if (fs.existsSync('/data/ColorRoomDB.db')) return '/data/ColorRoomDB.db'; // Docker
  return path.join(process.cwd(), 'data', 'ColorRoomDB.db');               // local
}

function migrate(db) {
  db.pragma('journal_mode = WAL');     // meilleures perfs concurrentes
  db.pragma('foreign_keys = ON');      // intégrité référentielle
  db.exec('CREATE TABLE IF NOT EXISTS crg_users (...)');
  // ... 11 tables créées si absentes (idempotent)
}
```

- **WAL** (Write-Ahead Logging) = lectures/écritures simultanées sans blocage.
- `CREATE TABLE IF NOT EXISTS` = **idempotent** : redémarrer ne casse rien.
- Voir le schéma complet dans le diagramme **ERD**.

---

## 8. Récapitulatif des flux IA

| Situation | Moteur utilisé | Internet ? |
|-----------|----------------|------------|
| Clé Gemini + connexion OK | **Gemini** (cloud) | Oui |
| Clé Gemini + hors-ligne | **Ollama** (bascule auto à 5 s) | Non |
| Pas de clé Gemini | **Ollama** (local) | Non |
| `AI_PROVIDER=ollama` | **Ollama** forcé | Non |

> En salle de classe **sans Internet**, laisser `GEMINI_API_KEY` vide et
> installer `qwen2.5:1.5b` : tout fonctionne en local.

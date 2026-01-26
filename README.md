# Color Room Games (Next.js + SQLite)

Application web pour exécuter des activités (jeux) et permettre aux enseignants de créer/éditer des jeux via un éditeur.

## Stack
- UI + API: Next.js 14 / React 18 / TypeScript
- Base de données: SQLite (via `better-sqlite3`)
- Déploiement: Docker Compose (port 8080)

## Démarrage rapide (Docker)

Depuis la racine du dépôt:

```bash
docker compose -f docker_javascript/docker-compose.yml up -d --build
```

Puis ouvrir:
- `http://localhost:8080/`

Healthcheck:
- `http://localhost:8080/api/health`

Arrêt:

```bash
docker compose -f docker_javascript/docker-compose.yml down
```

## Démarrage en dev (sans Docker)

Dans `docker_javascript/app`:

```bash
npm install
npm run dev
```

Puis:
- `http://localhost:3000/`

## Base de données (SQLite)

Le projet utilise un fichier SQLite unique.

### Chemin du fichier
Le chemin est déterminé par (dans l’ordre):

1. Variable d’environnement `COLOR_ROOM_DB_PATH`
2. `/data/ColorRoomDB.db` (contexte Docker)
3. `../SupervisionAPI/data/ColorRoomDB.db` (si présent)
4. `docker_javascript/app/data/ColorRoomDB.db`

Dans Docker, le `docker-compose.yml` monte un volume sur:
- `/data/ColorRoomDB.db`

### Tables principales
- `crg_games`: jeux stockés (métadonnées + config JSON)
- `crg_users`: utilisateurs (nom + type)
- `crg_sessions`: sessions (cookie HTTP-only)

## Authentification (DB-only)

L’authentification est persistée en base via une session et un cookie **HTTP-only**.

### Endpoints
- `POST /api/auth/login`
  - body: `{ "name": string, "userType": "apprenant" | "enseignant" }`
  - effet: crée/maj l’utilisateur en DB, crée une session, pose le cookie

- `POST /api/auth/logout`
  - effet: supprime la session en DB et efface le cookie

- `GET /api/me`
  - retour: `{ ok: true, user: { id, name, userType } | null }`

### Règle d’accès éditeur
- `/editeur` est réservé aux utilisateurs dont `userType === "enseignant"` (vérifié via `/api/me`).

## Jeux (DB)

### API
- `GET /api/games`: liste
- `POST /api/games`: création
- `GET /api/games/:id`: lecture
- `PATCH /api/games/:id`: mise à jour (nom/kind/config)
- `DELETE /api/games/:id`: suppression

### Conventions
- Les jeux de l’éditeur sont stockés avec `kind: "editor"`.
- La config du jeu est stockée dans `config_json`.

## Structure du projet (repères)
- UI: `docker_javascript/app/app/*`
  - Page jeux: `/jeux`
  - Éditeur: `/editeur`
- API: `docker_javascript/app/app/api/*`
- DB + migrations: `docker_javascript/app/lib/db/index.ts`

## Notes
- La DB est partagée avec `SupervisionAPI` si le volume est monté (voir `docker-compose.yml`).
- Le mode de session utilise un cookie: il faut garder la même DB entre redémarrages pour conserver les utilisateurs/sessions.

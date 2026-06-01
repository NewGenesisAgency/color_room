# Color Room Games — Next.js + SQLite

Interface web immersive pour la **ColorRoom** : 42 dalles LED pilotées par 32 canaux spectraux chacune.  
Elle permet aux élèves de jouer à des jeux sérieux sur la lumière et la couleur, et aux enseignants de créer leurs propres jeux depuis un éditeur visuel.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 16 / React 19 / TypeScript |
| Base de données | SQLite via `better-sqlite3` |
| Auth | Sessions HTTP-only cookie + PBKDF2-SHA512 |
| 3D | Three.js |
| Animations | GSAP, Lenis |
| Déploiement | Docker Compose (port 8080) |

---

## Manuel d'installation

### Prérequis

- **Docker** ≥ 24 et **Docker Compose** v2 (`docker compose` sans tiret)
- **Node.js** ≥ 20 (uniquement pour le mode développement sans Docker)
- Un accès réseau à l'API de supervision (`SupervisionAPI`) si les dalles LED sont connectées

### 1. Cloner le dépôt

```bash
git clone <url-du-dépôt>
cd <dossier-du-dépôt>
```

### 2. Configurer les variables d'environnement

Dans `docker_javascript/app/`, créez ou éditez le fichier `.env.local` :

```env
# Compte administrateur créé automatiquement au premier démarrage
ADMIN_USERNAME=admin
ADMIN_PASSWORD=***REDACTED***
```

> ⚠️ Changez le mot de passe avant la mise en production.

### 3. Démarrage avec Docker (recommandé)

Depuis la **racine du dépôt** :

```bash
docker compose -f docker_javascript/docker-compose.yml up -d --build
```

L'application est accessible sur :

```
http://localhost:8080/
```

Vérification de santé :

```
http://localhost:8080/api/health
```

Arrêt :

```bash
docker compose -f docker_javascript/docker-compose.yml down
```

### 4. Démarrage sans Docker (mode développement)

```bash
cd docker_javascript/app
npm install
npm run dev
```

Application disponible sur `http://localhost:3000/`.

### 5. Installation en service permanent (Raspberry Pi)

```bash
sudo bash docker_javascript/rpi/install.sh
```

Le service systemd `color-room.service` démarre automatiquement au boot.

Commandes utiles :

```bash
sudo systemctl status color-room.service
sudo systemctl restart color-room.service
sudo journalctl -u color-room.service -f
```

---

## Base de données (SQLite)

### Chemin du fichier

Résolution dans l'ordre :

1. Variable d'environnement `COLOR_ROOM_DB_PATH`
2. `/data/ColorRoomDB.db` (volume Docker)
3. `../SupervisionAPI/data/ColorRoomDB.db` (si présent)
4. `docker_javascript/app/data/ColorRoomDB.db` (fallback local)

### Tables principales

| Table | Description |
|---|---|
| `crg_games` | Jeux créés dans l'éditeur (métadonnées + config JSON) |
| `crg_users` | Utilisateurs (pseudo, type, hash mot de passe, niveau, couleur avatar) |
| `crg_sessions` | Sessions actives (token HTTP-only, expiration 7 jours) |
| `crg_classes` | Classes créées par les enseignants (code 6 caractères) |
| `crg_class_members` | Appartenance élève ↔ classe |
| `crg_scores` | Historique des scores par jeu et par utilisateur |

Les migrations sont appliquées automatiquement au démarrage via `lib/db/index.ts`.

---

## Authentification

### Rôles

| Rôle | Création | Accès |
|---|---|---|
| `admin` | Via `.env.local` (seeding automatique) | Tout + gestion utilisateurs |
| `enseignant` | Par un admin depuis `/gestion` | Éditeur + tableau de bord |
| `apprenant` | Auto-inscription depuis `/jeux` | Jeux uniquement |

### Endpoints

```
POST /api/auth/login      — Connexion (username + password)
POST /api/auth/logout     — Déconnexion (supprime la session)
POST /api/auth/register   — Inscription élève (+ code de classe optionnel)
GET  /api/auth/me         — Utilisateur courant (via cookie session)
```

### Sécurité

- Mots de passe hashés avec **PBKDF2-SHA512** (100 000 itérations, sel aléatoire 16 octets)
- Cookie `crg_session` : HTTP-only, SameSite=lax, durée 7 jours
- Application 100 % offline — aucun service externe requis

---

## API des jeux

```
GET    /api/games          — Liste des jeux
POST   /api/games          — Création
GET    /api/games/:id      — Lecture
PATCH  /api/games/:id      — Mise à jour (nom / kind / config)
DELETE /api/games/:id      — Suppression
```

---

## API de gestion

```
GET    /api/admin/users          — Liste utilisateurs (admin : tous ; prof : ses élèves)
POST   /api/admin/users          — Créer enseignant/admin (admin only)
PATCH  /api/admin/users/:id      — Reset mot de passe / assigner niveau
DELETE /api/admin/users/:id      — Supprimer utilisateur (admin only)

GET    /api/classes               — Liste des classes
POST   /api/classes               — Créer une classe
GET    /api/classes/:id           — Détail + membres
DELETE /api/classes/:id           — Supprimer

POST   /api/classes/join          — Rejoindre une classe par code

GET    /api/scores                — Scores (all=1 pour admin/prof)
POST   /api/scores                — Enregistrer un score
```

---

## Pages de l'application

| URL | Description | Accès |
|---|---|---|
| `/` | Accueil | Tous |
| `/jeux` | Jeux + connexion | Tous (auth requise pour jouer) |
| `/editeur` | Éditeur visuel de jeux | Enseignants / admin |
| `/gestion` | Tableau de bord (users, classes, scores) | Enseignants / admin |
| `/spectre` | Spectre lumineux temps réel | Tous |
| `/chromaticite` | Diagramme CIE 1931 | Tous |
| `/mesure` | Mesures CS-150 | Tous |
| `/aide` | Guide d'utilisation | Tous |

---

## Structure du projet

```
docker_javascript/
├── app/
│   ├── app/
│   │   ├── _components/     # Composants partagés (LoginScreen, NavigationMenu, Room3D…)
│   │   ├── _games/          # Jeux embarqués (maitre-du-blanc, chromaticity-diagram…)
│   │   ├── api/             # Routes API Next.js
│   │   │   ├── auth/        # login / logout / register / me
│   │   │   ├── admin/       # Gestion utilisateurs
│   │   │   ├── classes/     # Gestion classes
│   │   │   ├── scores/      # Historique scores
│   │   │   └── games/       # CRUD jeux
│   │   ├── jeux/            # Page jeux + moteur custom
│   │   ├── editeur/         # Éditeur visuel (ReactFlow)
│   │   ├── gestion/         # Tableau de bord admin/prof
│   │   ├── aide/            # Guide d'utilisation
│   │   ├── spectre/         # Spectre chromatique
│   │   ├── chromaticite/    # Diagramme CIE 1931
│   │   └── mesure/          # Mesures instruments
│   └── lib/
│       ├── db/              # Connexion SQLite + migrations
│       └── auth.ts          # PBKDF2, sessions, getSessionUser
├── rpi/                     # Scripts d'installation Raspberry Pi
├── docker-compose.yml
└── README.md
```

---

## Notes

- La DB est partagée avec `SupervisionAPI` via le volume Docker — conservez le même fichier entre redémarrages pour garder utilisateurs et sessions.
- Le canal LED 19–32 correspond aux LEDs phosphore blanc chaud ; les canaux 1–18 sont des LEDs spectrales (404–780 nm).
- L'éditeur de jeux utilise **ReactFlow** pour le graphe de blocs logiques.

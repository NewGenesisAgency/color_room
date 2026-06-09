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

Dans `app/`, créez le fichier `.env` (jamais versionné — un modèle existe dans `app/.env.example`) :

```env
# Compte administrateur créé automatiquement au premier démarrage
ADMIN_USERNAME=admin
ADMIN_PASSWORD=***REDACTED***

# Génération de jeux par IA dans l'éditeur (Google Gemini)
# Obtenir une clé : https://aistudio.google.com/apikey
GEMINI_API_KEY=VOTRE_CLE_GEMINI
# Optionnel : cascade de modèles (du plus capable au repli)
# GEMINI_MODELS=gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3-flash,gemini-2.5-flash
```

> ⚠️ Changez le mot de passe avant la mise en production.
> La clé `GEMINI_API_KEY` ne sert qu'à l'assistant IA de l'éditeur (côté serveur). L'audio et les jeux fonctionnent **hors-ligne**.

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
| `/mesure` | Mesures CS-160 | Tous |
| `/aide` | Guide d'utilisation | Tous |
| `/health` | Santé & diagnostic (connexion APIs, test des plaques, contrôle des 32 canaux) | Tous |

---

## Jeux disponibles (`/jeux`)

La liste se charge **4 par 4** (bouton « Charger plus ») et est **recherchable**. Chaque partie met à jour le **score universel** et le compteur de **jeux réussis**.

| Jeu | Type | Détails |
|---|---|---|
| Tetris Lumière | Réflexe | Tetris sur les 42 dalles, clavier + **D-pad tactile** |
| Snake Lumière | Réflexe | Serpent 6×7, flèches + D-pad tactile |
| Color Speed | Réflexe | Cliquer la dalle qui s'allume |
| Simon Lumière | Mémoire | Reproduire les séquences |
| Le Maître du Blanc | Colorimétrie | Recréer une teinte en dosant R/G/B |
| Puissance 4 Chromatique | Réflexion | IA minimax renforcée (anti-piège), thème sombre minimaliste |
| Métamérie | Colorimétrie | Trouver l'éclairage qui révèle/cache un texte |
| Mix de Canaux | Colorimétrie | **Triangle** des 3 canaux LED + **3 sliders** d'intensité (point = barycentre, pas de placement) |
| Chromaticité CIE | Colorimétrie | Diagramme CIE 1931 **coloré** (repris de `/mesure`) + sliders x/y |
| L'Intrus (Sniper) | **Mesure CS-160** | Dalles identiques sauf une (écart infime) ; le joueur **mesure au CS-160** pour la débusquer. Écran identique partout (pas de triche), différence réelle uniquement sur les dalles |
| Spectre Chromatique | **Multijoueur** | Jusqu'à 8 joueurs, une teinte par joueur |

Les diagrammes de chromaticité partagent le composant `CieDiagramCanvas` (gamut peint pixel par pixel). Les jeux de mesure utilisent `cs160Service` → `/api/cs160`.

---

## Éditeur de jeux (`/editeur`)

Éditeur visuel type **blueprint** (façon Unreal Engine) + **UI Designer** + **Python low-code**.

- **Nœuds (blocs)** : ajout via clic droit / glissé depuis une sortie ; liaisons en **pointillés animés qui défilent** ; **physique anti-superposition** (les blocs s'espacent automatiquement avec un padding) ; design glass minimaliste.
- **Jeux natifs comme blocs** : poser un bloc-jeu (Puissance 4, Snake, L'Intrus, Chromaticité, Color Speed, Maître du Blanc, Métamérie, Mix de Canaux, Tetris) → le **vrai jeu s'exécute** dans `/jeux`, avec l'interface dessinée par-dessus.
- **UI Designer** (onglet Interface) : composants déplaçables (Bouton, Texte, Slider, Score, Minuteur, Manche, Couleur, Progression, **Diagramme CIE**, **D-pad tactile**), personnalisables ; icônes Lucide.
- **Python low-code** : chaque nouveau jeu reçoit un **script d'exemple commenté** (API `cr.send_color`, `cr.get_key`, `cr.add_score`, `cr.emit_event`…). Exécution via Pyodide.
- **Mini-tutoriel** skippable à chaque création de jeu.
- Métadonnées : description (textarea), **icône + couleur + dégradé** (popup, ~55 icônes), difficulté, mode (solo/coop/versus), dalles cibles.

### Assistant IA (Google Gemini)

- Bouton **« Créer avec l'IA »** → panneau de **chat** (style outil de code) docké à droite : l'éditeur reste visible et les **blocs + liaisons se construisent en direct**.
- **Multi-tours** : créer puis **modifier** le jeu par messages successifs (l'IA reçoit le jeu actuel + l'historique).
- **Annuler / Réessayer** par réponse (chaque génération IA = un seul pas d'historique, branché sur l'undo/redo de l'éditeur).
- **Conversations persistées** en base (`crg_ai_chats`), rechargées à l'ouverture.
- Cascade de modèles avec repli, configurable via `GEMINI_MODELS`. Route serveur : `POST /api/ai/generate-game`, `/api/ai/conversations`.

### Audio & visuels

- **Sons hors-ligne** : bloc « Jouer un son » avec 18 effets synthétisés (Web Audio, aucun fichier) — `correct`, `wrong`, `win`, `lose`, `levelup`, `coin`… Moteur partagé `lib/audio/sfx.ts`, aperçu **« Écouter »** dans l'éditeur.
- **Icônes** : composant **Sprite** (icônes Lucide étendues) et **Icône SVG** (markup SVG personnalisé), cliquables (événement) et **affichables selon une variable** (visibilité pilotée par événement).
- **Bloc `Si` (condition)** : teste une variable réelle (`>`, `≥`, `<`, `≤`, `=`, `≠`) — 1ʳᵉ sortie = Alors.

---

## Structure du projet

```
.                            # racine du dépôt
├── app/                     # projet Next.js
│   ├── app/
│   │   ├── _components/     # Composants partagés (LoginScreen, NavigationMenu, Room3D…)
│   │   ├── _games/          # Jeux embarqués (maitre-du-blanc, chromaticity-diagram…)
│   │   ├── api/             # Routes API Next.js
│   │   │   ├── auth/        # login / logout / register / me
│   │   │   ├── admin/       # Gestion utilisateurs
│   │   │   ├── classes/     # Gestion classes
│   │   │   ├── scores/      # Historique scores
│   │   │   ├── games/       # CRUD jeux
│   │   │   ├── ai/          # Génération de jeu par IA (Gemini) + conversations
│   │   │   ├── health/      # Santé / diagnostic
│   │   │   └── supervision/ # Proxy plaques LED
│   │   ├── jeux/            # Page jeux + moteur custom
│   │   ├── editeur/         # Éditeur visuel (ReactFlow)
│   │   ├── gestion/         # Tableau de bord admin/prof
│   │   ├── aide/            # Guide d'utilisation
│   │   ├── spectre/         # Spectre chromatique
│   │   ├── chromaticite/    # Diagramme CIE 1931
│   │   └── mesure/          # Mesures instruments
│   └── lib/
│       ├── db/              # Connexion SQLite + migrations
│       ├── audio/           # Moteur SFX hors-ligne (sfx.ts)
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

# Color Room Games - Next.js + SQLite

Interface web immersive pour la **ColorRoom** : une salle de **42 dalles LED**, chacune pilotée par **32 canaux spectraux** (404-780 nm + blanc chaud).

Elle permet :
- aux **élèves** de jouer à des jeux sérieux sur la lumière et la couleur (solo ou multijoueur, depuis la tablette de la salle ou leur téléphone) ;
- aux **enseignants** de créer leurs propres jeux dans un éditeur visuel à blocs (façon Unreal Engine Blueprint), avec UI designer, Python low-code et assistant IA.

---

## Sommaire

1. [Stack technique](#stack-technique)
2. [Installation rapide](#installation-rapide)
3. [Configuration (.env)](#configuration-env)
4. [Intelligence artificielle (Gemini + Ollama)](#intelligence-artificielle-gemini--ollama)
5. [Pages de l'application](#pages-de-lapplication)
6. [Jeux disponibles](#jeux-disponibles)
7. [Multijoueur](#multijoueur)
8. [Éditeur de jeux](#éditeur-de-jeux)
9. [Mesure colorimétrique (CS-160)](#mesure-colorimétrique-cs-160)
10. [Base de données](#base-de-données)
11. [Authentification et rôles](#authentification-et-rôles)
12. [Référence API](#référence-api)
13. [Structure du projet](#structure-du-projet)
14. [Notes matérielles](#notes-matérielles)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 16 / React 19 / TypeScript |
| Base de données | SQLite via `better-sqlite3` (migrations automatiques) |
| Auth | Sessions cookie HTTP-only + PBKDF2-SHA512 |
| 3D | Three.js (visualisation de la salle) |
| Animations | GSAP, Lenis |
| IA | Google Gemini (cloud) avec repli **Ollama** (local, hors-ligne) |
| Python in-browser | Pyodide (blocs Python de l'éditeur) |
| Audio | Web Audio API (18 effets synthétisés, aucun fichier) |
| Déploiement | Docker Compose (port 8080) ou `npm run dev` (port 3000) |

---

## Installation rapide

### Prérequis

- **Docker** >= 24 et **Docker Compose** v2 (`docker compose` sans tiret), ou
- **Node.js** >= 20 pour le mode développement sans Docker
- Un accès réseau à l'API de supervision (`SupervisionAPI`) si les dalles LED sont branchées (sinon l'app fonctionne en mode simulation à l'écran)

### Option A : Docker (recommandé, production / Raspberry Pi)

Depuis la **racine du dépôt** :

```bash
docker compose -f docker_javascript/docker-compose.yml up -d --build
```

| URL | Rôle |
|---|---|
| `http://localhost:8080/` | Application |
| `http://localhost:8080/api/health` | Vérification de santé |

Arrêt :

```bash
docker compose -f docker_javascript/docker-compose.yml down
```

Le compose démarre aussi un service **Ollama** : le modèle IA local se télécharge en arrière-plan au premier démarrage (l'app reste utilisable sans IA pendant ce temps).

### Option B : développement local (sans Docker)

```bash
cd docker_javascript/app
npm install
npm run dev
```

Application sur `http://localhost:3000/`.

### Option C : service permanent (Raspberry Pi)

```bash
sudo bash docker_javascript/rpi/install.sh
```

Le service systemd `color-room.service` démarre au boot.

```bash
sudo systemctl status color-room.service     # état
sudo systemctl restart color-room.service    # redémarrage
sudo journalctl -u color-room.service -f     # logs en direct
```

---

## Configuration (.env)

Dans `app/`, créez `.env` (ou `.env.local` en dev). Un modèle commenté existe dans `app/.env.example`. **Aucune de ces variables n'est obligatoire** pour démarrer.

```env
# Compte administrateur créé automatiquement au premier démarrage
ADMIN_USERNAME=admin
ADMIN_PASSWORD=***REDACTED***

# URLs des APIs matérielles (modifiables aussi à chaud depuis /configuration)
SUPERVISION_API_URL=http://172.17.50.136:18080
CS160_API_URL=http://172.17.50.39:3000

# ── IA : génération de jeux dans l'éditeur ──────────────────────────────────
# Clé Google Gemini (cloud). Obtenir une clé : https://aistudio.google.com/apikey
GEMINI_API_KEY=VOTRE_CLE_GEMINI
# Optionnel : cascade de modèles Gemini (du plus capable au repli)
# GEMINI_MODELS=gemini-2.5-flash,gemini-2.0-flash

# IA locale (Ollama, 100 % hors-ligne) - utilisée si Gemini absent ou injoignable
# AI_PROVIDER=ollama            # forcer le local (jamais de cloud)
# OLLAMA_MODEL=qwen2.5:1.5b     # ~1 Go, rapide sur Raspberry Pi 4 Go
# OLLAMA_URL=http://ollama:11434

# Chemin de la base SQLite (sinon résolution automatique, voir plus bas)
# COLOR_ROOM_DB_PATH=/data/ColorRoomDB.db
```

> Changez le mot de passe admin avant la mise en production.
> Tout le reste de l'application (jeux, audio, mesures) fonctionne **hors-ligne**.

---

## Intelligence artificielle (Gemini + Ollama)

L'assistant IA de l'éditeur crée et modifie des jeux complets (blocs + interface) à partir d'une description en français.

**Cascade automatique** :

1. Si une clé `GEMINI_API_KEY` est présente, l'app sonde Gemini avec un **timeout de 5 secondes**.
2. Gemini répond : la génération passe par le cloud (rapide, ~3 s).
3. Gemini injoignable (pas d'internet, clé invalide) : **bascule automatique sur Ollama local**, sans intervention.
4. Pas de clé du tout : Ollama directement.

**Sélecteur de modèle** : dans le panneau IA de l'éditeur, un menu liste tous les modèles disponibles (5 Gemini cloud + 6 Ollama locaux) avec pour chacun la **vitesse estimée**, la **qualité** (5 points), la **taille RAM** et la **disponibilité**. Le mode « Auto » applique la cascade ci-dessus.

| Modèle | Type | Vitesse | Qualité |
|---|---|---|---|
| Gemini 2.5 Flash | Cloud | ~3 s | 5/5 |
| Gemini 2.5 Flash Lite | Cloud | ~2 s | 4/5 |
| Qwen 2.5 1.5B | Local (1 Go) | ~45 s | 2/5 |
| Qwen 2.5 3B | Local (1.9 Go) | ~90 s | 3/5 |
| Qwen 2.5 7B | Local (4.7 Go, RAM !) | ~4 min | 4/5 |

Routes serveur : `POST /api/ai/generate-game`, `GET /api/ai/models`, `GET /api/ai/status`, `/api/ai/conversations`.

---

## Pages de l'application

| URL | Description | Accès |
|---|---|---|
| `/` | Accueil | Tous |
| `/jeux` | Catalogue de jeux + connexion | Tous (auth pour jouer) |
| `/editeur` | Éditeur visuel de jeux | Enseignants / admin |
| `/gestion` | Tableau de bord (utilisateurs, classes, scores) | Enseignants / admin |
| `/jouer` | **Manette téléphone** : chaque joueur pilote SA dalle | Tous (téléphone) |
| `/p4` | **Puissance 4 téléphone** : jouer son tour à distance | Tous (téléphone) |
| `/spectre` | Spectre lumineux temps réel + jeu multijoueur | Tous |
| `/salles` | Plan des salles | Tous |
| `/chromaticite` | Diagramme CIE 1931 interactif | Tous |
| `/mesure` | Mesures réelles au colorimètre CS-160 | Tous |
| `/configuration` | URLs des APIs matérielles, modifiables à chaud | Tous |
| `/aide` | Guide d'utilisation | Tous |
| `/health` | Santé et diagnostic (APIs, test des dalles, 32 canaux) | Tous |

---

## Jeux disponibles

Dans `/jeux`, la liste se charge 4 par 4 (bouton « Charger plus ») et est recherchable. Chaque partie met à jour le **score universel** et le compteur de **jeux réussis**.

| Jeu | Type | Détails |
|---|---|---|
| Tetris Lumière | Réflexe | Tetris sur les 42 dalles, clavier + D-pad tactile |
| Snake Lumière | Réflexe | Serpent 6x7, flèches + D-pad tactile |
| Color Speed | Réflexe | Cliquer la dalle qui s'allume |
| Simon Lumière | Mémoire | Reproduire les séquences lumineuses |
| Le Maître du Blanc | Colorimétrie | Recréer une teinte en dosant R/G/B |
| **Puissance 4** | Réflexion | **3 modes : contre l'IA (minimax 5 niveaux), 2 joueurs sur le même appareil, ou 1 vs 1 en ligne (2 téléphones, QR code, plateau sur les dalles)** |
| Métamérie | Colorimétrie | Trouver l'éclairage qui révèle ou cache un texte |
| Mix de Canaux | Colorimétrie | Triangle des 3 canaux LED + 3 sliders d'intensité |
| Chromaticité CIE | Colorimétrie | Diagramme CIE 1931 coloré + sliders x/y |
| L'Intrus (Sniper) | Mesure CS-160 | Une dalle diffère imperceptiblement : seul le colorimètre peut la débusquer |
| ChromaDetect - CS-160 | Mesure CS-160 | Couleur mystère sur les dalles, mesure réelle, points selon la précision |
| Mode Libre - Couleur RGB | Exploration | 3 curseurs R/G/B, dalles + diagramme CIE en temps réel |
| Spectre Chromatique | Multijoueur | Jusqu'à 8 joueurs, mémoriser et reproduire une couleur |
| Multijoueur - 1 joueur / plaque | Multijoueur | Chaque téléphone pilote sa propre dalle (page `/jouer`) |

---

## Multijoueur

Trois systèmes indépendants, tous via QR code (aucune installation côté téléphone) :

| Mode | Flux | API |
|---|---|---|
| **Puissance 4 - 1 vs 1** | La tablette crée la salle et affiche un QR. 2 joueurs scannent (`/p4?room=...`), jouent chacun leur tour depuis leur téléphone. Le plateau s'affiche sur les dalles de la salle (jetons rouge/jaune, ligne gagnante en surbrillance). | `/api/p4/create`, `join`, `move`, `state` |
| **Spectre Chromatique** | Jusqu'à 8 joueurs rejoignent par code de salle (6 caractères) ou QR (`/spectre?code=...`). L'hôte (siège 1) fait avancer les manches. | `/api/spectre/start`, `join`, `guess`, `advance`, `state`, `stop` |
| **1 joueur / plaque** | Chaque téléphone (page `/jouer`) contrôle une dalle de la salle en temps réel. Les sièges des joueurs déconnectés (> 20 s) sont automatiquement libérés. | `/api/multiplayer/join`, `submit`, `state`, `rooms`, ... |

Les classes utilisent aussi des QR / deep-links : `/jeux?classe=CODE` pour rejoindre une classe.

---

## Éditeur de jeux

Éditeur visuel type **blueprint** (façon Unreal Engine) + **UI Designer** + **Python low-code**, en design **white liquid glass** (blocs blancs translucides, blur, ombres douces).

### Blocs (graphe logique)

- Ajout par **clic droit** ou glissé depuis une sortie ; liaisons en pointillés animés.
- Chaque bloc porte une **icône Lucide** colorée par catégorie (Évènements, Flux, Rendu, Maths, Variables, Multijoueur, Mesure...). Aucun emoji.
- **Auto-layout** (touche `L`) : colonnes par profondeur d'exécution, espacement large, les blocs enfants se placent sous leurs parents.
- Bloc **Si** (condition) : 1re sortie = vrai, 2e = faux. Bloc **Python** : code libre exécuté via Pyodide (API `cr.send_color`, `cr.add_score`, `cr.emit_event`...).
- **Jeux natifs comme blocs** : poser un bloc-jeu (Puissance 4, Snake, Tetris...) exécute le vrai jeu dans `/jeux` avec l'interface dessinée par-dessus.

### UI Designer (onglet Interface)

Composants déplaçables sur un canvas 860x500 : bouton, texte, sliders RGB, score, minuteur, jauge de précision, pastille couleur, barre de progression, **diagramme CIE** (avec mesure CS-160 réelle intégrée), D-pad tactile, grille des 42 dalles en direct, icônes Lucide / SVG...

### Assistant IA

- Bouton **« Créer avec l'IA »** : panneau de chat docké à droite, les blocs et liaisons se construisent en direct puis sont **réorganisés automatiquement** (auto-layout).
- **Multi-tours** : créer puis modifier le jeu par messages successifs (l'IA reçoit le jeu actuel + l'historique).
- **Annuler / Réessayer** par réponse (chaque génération = un seul pas d'historique).
- **Sélecteur de modèle** (Gemini / Ollama) avec vitesse et qualité estimées.
- Conversations **persistées** en base et rechargées à l'ouverture.

### Audio

Bloc « Jouer un son » : 18 effets synthétisés hors-ligne (Web Audio) - `correct`, `wrong`, `win`, `lose`, `coin`, `levelup`... avec aperçu « Écouter » dans l'éditeur. Bloc « Vibrer » pour le retour haptique tablette.

---

## Mesure colorimétrique (CS-160)

Le colorimètre **Konica Minolta CS-160** est intégré de bout en bout :

- Page `/mesure` : mesures one-shot, affichage Lvxy / XYZ, diagramme CIE.
- **Blocs éditeur** : `measure_start` (mesure réelle, écrit `meas_x`, `meas_y`, `meas_lv`, `meas_ok`), `measure_compare` (ΔE vs cible, écrit `meas_accuracy` 0-100 et ajoute des points proportionnels).
- **Widget UI `cie_diagram`** : cible aléatoire ou fixe, mesure réelle, point affiché sur le diagramme, points selon ΔE.
- **Panneau CS-160** dans l'éditeur : connexion, mesure, calibration RGB / 1 point par canal.
- Les jeux n'utilisent **jamais de simulation** : sans appareil connecté, ils affichent un message explicite.

Tout passe par le proxy serveur `/api/cs160` (URL du bridge configurable via `CS160_API_URL` ou la page `/configuration`).

---

## Base de données

### Chemin du fichier (résolution dans l'ordre)

1. Variable d'environnement `COLOR_ROOM_DB_PATH`
2. `/data/ColorRoomDB.db` (volume Docker)
3. `../SupervisionAPI/data/ColorRoomDB.db` (si présent)
4. `docker_javascript/app/data/ColorRoomDB.db` (repli local)

### Tables principales

| Table | Description |
|---|---|
| `crg_games` | Jeux créés dans l'éditeur (métadonnées + config JSON) |
| `crg_users` | Utilisateurs (pseudo, rôle, hash mot de passe, niveau, avatar) |
| `crg_sessions` | Sessions actives (token HTTP-only, expiration 7 jours) |
| `crg_classes` | Classes créées par les enseignants (code 6 caractères) |
| `crg_class_members` | Appartenance élève / classe |
| `crg_scores` | Historique des scores par jeu et par utilisateur |
| `crg_mp_sessions` / `crg_mp_players` | Sessions et joueurs multijoueur |
| `crg_ai_chats` | Conversations de l'assistant IA |
| `crg_app_config` | Configuration à chaud (URLs des APIs) |

Les migrations et le seeding (compte admin, jeux d'exemple) sont appliqués automatiquement au démarrage via `lib/db/index.ts`.

---

## Authentification et rôles

| Rôle | Création | Accès |
|---|---|---|
| `admin` | Via `.env` (seeding automatique) | Tout + gestion utilisateurs |
| `enseignant` | Par un admin depuis `/gestion` | Éditeur + tableau de bord |
| `apprenant` | Auto-inscription depuis `/jeux` | Jeux uniquement |

Sécurité :

- Mots de passe hashés en **PBKDF2-SHA512** (100 000 itérations, sel aléatoire 16 octets)
- Cookie `crg_session` : HTTP-only, SameSite=lax, 7 jours
- Application 100 % offline - aucun service externe requis (l'IA cloud est optionnelle)

---

## Référence API

### Authentification

```
POST /api/auth/login      - Connexion (username + password)
POST /api/auth/logout     - Déconnexion
POST /api/auth/register   - Inscription élève (+ code de classe optionnel)
GET  /api/auth/me         - Utilisateur courant (cookie session)
```

### Jeux

```
GET    /api/games          - Liste des jeux
POST   /api/games          - Création
GET    /api/games/:id      - Lecture
PATCH  /api/games/:id      - Mise à jour partielle (nom / kind / config)
DELETE /api/games/:id      - Suppression
```

### IA

```
POST /api/ai/generate-game       - Génère ou modifie un jeu (body: prompt, model?, currentGame?, history?)
GET  /api/ai/status              - Fournisseur actif + disponibilité du modèle
GET  /api/ai/models              - Catalogue des modèles (vitesse, qualité, taille, dispo)
GET/POST/DELETE /api/ai/conversations[/:id] - Conversations persistées
```

### Multijoueur

```
POST /api/p4/create | join | move      GET /api/p4/state          - Puissance 4 en ligne
POST /api/spectre/start | join | guess | advance | stop
GET  /api/spectre/state                                            - Spectre Chromatique
POST /api/multiplayer/join | submit | start | stop | ready
GET  /api/multiplayer/state | rooms                                - 1 joueur / plaque
```

### Gestion

```
GET/POST       /api/admin/users        - Utilisateurs (admin : tous ; prof : ses élèves)
PATCH/DELETE   /api/admin/users/:id    - Reset mot de passe / niveau / suppression
GET/POST       /api/classes            - Classes
GET/DELETE     /api/classes/:id        - Détail + membres / suppression
POST           /api/classes/join       - Rejoindre par code
GET/POST       /api/scores             - Scores (all=1 pour admin/prof)
```

### Matériel

```
POST /api/cs160              - Proxy colorimètre (action: connect / measure / calibrate...)
*    /api/supervision/...    - Proxy dalles LED (batch couleurs, état)
GET  /api/health?full=1      - Diagnostic complet (DB, APIs matérielles)
GET/POST /api/config         - URLs des APIs, modifiables à chaud
```

---

## Structure du projet

```
docker_javascript/           # racine du module
├── app/                     # projet Next.js
│   ├── app/
│   │   ├── _components/     # Composants partagés (Room3D, CS160Panel, GamePuissance4...)
│   │   ├── _games/          # Jeux embarqués (maitre-du-blanc, chromaticity-diagram...)
│   │   ├── api/             # Routes API Next.js
│   │   │   ├── auth/        # login / logout / register / me
│   │   │   ├── admin/       # Gestion utilisateurs
│   │   │   ├── classes/     # Gestion classes
│   │   │   ├── scores/      # Historique scores
│   │   │   ├── games/       # CRUD jeux
│   │   │   ├── ai/          # Génération IA (Gemini/Ollama) + modèles + conversations
│   │   │   ├── p4/          # Puissance 4 en ligne
│   │   │   ├── spectre/     # Spectre Chromatique multijoueur
│   │   │   ├── multiplayer/ # 1 joueur / plaque
│   │   │   ├── cs160/       # Proxy colorimètre
│   │   │   ├── supervision/ # Proxy dalles LED
│   │   │   ├── config/      # Config à chaud
│   │   │   └── health/      # Santé / diagnostic
│   │   ├── jeux/            # Catalogue + moteur d'exécution des jeux
│   │   ├── editeur/         # Éditeur visuel (blocs + UI designer + IA)
│   │   ├── jouer/           # Manette téléphone (multijoueur plaques)
│   │   ├── p4/              # Manette téléphone (Puissance 4)
│   │   ├── gestion/         # Tableau de bord admin/prof
│   │   ├── spectre/         # Spectre chromatique
│   │   ├── salles/          # Plan des salles
│   │   ├── chromaticite/    # Diagramme CIE 1931
│   │   ├── configuration/   # URLs APIs à chaud
│   │   ├── mesure/          # Mesures CS-160
│   │   └── aide/            # Guide d'utilisation
│   └── lib/
│       ├── db/              # Connexion SQLite + migrations + seeds
│       ├── audio/           # Moteur SFX hors-ligne (sfx.ts)
│       ├── multiplayer.ts   # Sessions multijoueur plaques
│       ├── spectre.ts       # Sessions Spectre
│       └── auth.ts          # PBKDF2, sessions, getSessionUser
├── rpi/                     # Scripts d'installation Raspberry Pi
├── docker-compose.yml       # app + ollama + ollama-pull
└── README.md
```

---

## Notes matérielles

- La base est partagée avec `SupervisionAPI` via le volume Docker : conservez le même fichier entre redémarrages pour garder utilisateurs et sessions.
- Canaux LED : **1-18** = LEDs spectrales (404-780 nm), **19-32** = LEDs phosphore blanc chaud.
- Le plateau des jeux sur dalles a l'index 0 **en haut** côté logique mais la dalle 0 est **en bas** de la salle : le rendu est retourné verticalement pour que la gravité (Puissance 4, Tetris) aille vers le bas.
- Sans matériel branché, tout est visualisable à l'écran (grille des 42 dalles en direct + salle 3D).

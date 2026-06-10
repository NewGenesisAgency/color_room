# Color Room — Déploiement & fonctionnalités (de A à Z)

Guide complet : déployer l'application, lancer le **modèle IA local (Ollama)**,
et utiliser toutes les fonctionnalités. Pensé pour un **Raspberry Pi** (ARM64)
mais valable sur PC Linux/Mac.

---

## 0. Vue d'ensemble

L'app tourne en **Docker Compose** avec 4 services :

| Service | Rôle | Port |
|---|---|---|
| `color-room` | L'application Next.js (UI + API) | **8080** |
| `ollama` | Serveur d'IA locale (modèle hors-ligne) | 11434 |
| `ollama-pull` | Conteneur jetable qui télécharge le modèle puis s'arrête | — |
| `portainer` | (optionnel) interface Docker | 9000 / 9443 |

**Démarrage en 2 temps :**
1. **Phase 1** — `color-room` démarre **tout de suite** : on peut jouer et créer
   des jeux **sans IA**.
2. **Phase 2** — `ollama-pull` télécharge le modèle **en arrière-plan**. Dès
   qu'il est prêt, l'assistant IA de l'éditeur devient utilisable.

---

## 1. Prérequis

- **Docker** + **Docker Compose v2** installés (`docker compose version`).
- Sur Raspberry Pi : Pi 4/5, **8 Go de RAM recommandés** pour le modèle local
  (4 Go → utiliser un petit modèle, voir §4).
- Réseau : le Pi doit pouvoir joindre **registry.npmjs.org** et **github.com**
  au build, et **Ollama** télécharge le modèle depuis le réseau **la 1re fois**
  (ensuite tout est en cache → 100 % hors-ligne).

---

## 2. Récupérer le code

```bash
git clone https://github.com/NewGenesisAgency/color_room.git
cd color_room
git checkout ux-last        # branche à jour
```

---

## 3. Configurer les variables (`app/.env`)

Crée `app/.env` à partir du modèle (ce fichier n'est **jamais** committé) :

```bash
cp app/.env.example app/.env
nano app/.env
```

### 3.a. Compte administrateur
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMoi2026!
```

### 3.b. Choix de l'IA — deux options

**Option A — IA dans le cloud (Google Gemini)** *(plus puissant, nécessite Internet)*
```env
GEMINI_API_KEY=ta_cle_gemini   # https://aistudio.google.com/apikey
```

**Option B — IA locale (Ollama, 100 % hors-ligne)** *(recommandé pour la salle)*
```env
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:1.5b      # ~1 Go, RAPIDE sur un Pi 4 Go (défaut)
```

> Si tu mets les deux, `AI_PROVIDER` décide. Vide = auto (Gemini si clé, sinon Ollama).

---

## 4. Choisir le modèle local (vitesse vs qualité)

Sur un Pi en CPU, plus le modèle est gros, plus c'est lent. Le défaut privilégie la **vitesse** :

| Modèle | Taille | Vitesse (Pi 4) | Qualité |
|---|---|---|---|
| `qwen2.5:1.5b` | ~1 Go | **rapide (~1 min, défaut)** | correcte |
| `qwen2.5:3b` | ~1.9 Go | moyenne (~2-3 min) | bonne |
| `qwen2.5:0.5b` | ~0.4 Go | très rapide | basique |
| `qwen2.5:7b` | ~4.7 Go | ⚠ TUÉ (OOM) sur Pi 4 Go | — |

Change le modèle via `OLLAMA_MODEL` dans `app/.env` (rien d'autre à modifier).

---

## 5. Déployer

```bash
docker compose up -d --build
```

- L'app est disponible sur **http://IP_DU_PI:8080/**
- Vérifier l'état app : `http://IP_DU_PI:8080/api/health` (ou la page `/health`).

### Suivre le téléchargement du modèle (phase 2)
```bash
docker logs -f color-room-ollama-pull     # progression du téléchargement
docker exec color-room-ollama ollama list # modèles installés
curl http://localhost:8080/api/ai/status  # {"ready":true} quand l'IA est prête
```

### Installer en service au démarrage (Raspberry Pi)
Depuis la racine du dépôt cloné :
```bash
sudo bash rpi/install.sh
```
Le service `color-room.service` lance `docker compose up -d` au boot, **depuis
le dépôt** (donc `app/.env` est conservé). Commandes utiles :
```bash
sudo systemctl status color-room.service --no-pager
sudo systemctl restart color-room.service
```

---

## 6. Utiliser l'IA (créer un jeu)

1. Ouvre **`/editeur`** → bouton **« Créer avec l'IA »** (panneau de chat à droite).
2. Si le modèle local n'est pas encore prêt, le panneau affiche
   **« 🧠 modèle en démarrage… »** : attends, ou joue/crée sans IA en attendant.
3. Décris ton jeu, ex. : *« Un jeu de réflexe : une dalle s'allume, le joueur la
   clique avant 2 s, +10 points, fin après 60 s »*.
4. Les **blocs apparaissent en direct** (surlignés en violet), avec l'interface.
5. **Multi-tours** : enchaîne *« ajoute un timer de 60 s »*, *« mets un son quand
   on gagne »*… Boutons **Annuler / Réessayer** par réponse. Historique des
   conversations via l'icône horloge.
6. **Sauvegarde** le jeu (bouton disquette) → il apparaît dans **`/jeux`**.

> L'IA a le droit au réseau (Gemini) ou tourne en local (Ollama). **L'audio et
> les jeux fonctionnent toujours hors-ligne.**

---

## 7. Les fonctionnalités principales

### Jeux (`/jeux`)
- Jeux natifs : Color Speed, Snake, Tetris, Puissance 4, Maître du Blanc,
  Métamérie, Mix de Canaux, L'Intrus (CS-160), Chromaticité…
- **On joue sur les DALLES** : l'écran ne montre pas le plateau (anti-triche) —
  regarde la Color Room. (Réactivable en dev via `SHOW_SCREEN_BOARD` dans
  `app/lib/game/displayMode.ts`.)
- **Sons + vibrations** (tablette Android) pour tous les jeux, hors-ligne.

### Multijoueur (concept téléphone + dalles)
- **1 joueur = 1 plaque** : lance le mode sur la tablette → QR ; chaque joueur
  ouvre **`/jouer`** sur son téléphone et choisit une couleur → **sa plaque**
  s'allume en temps réel.
- **Puissance 4 — 2 téléphones** : QR → **`/p4`** ; 2 joueurs jouent à tour de
  rôle, le **plateau s'affiche sur les dalles**.
- **Écran scindé** (ex-coop) : 2 à 8 joueurs règlent chacun une teinte.

### Éditeur (`/editeur`)
- Blueprint (blocs logiques) + UI Designer + mode Python.
- Blocs fonctionnels : `Si`, maths/logique/comparaison, variables, tableaux,
  grilles, `for_range`/`while`, **animations** (`anim_*`), **sons**, **icônes**
  (Lucide + SVG), multijoueur (`mp_*`)…
- **Assistant IA** (voir §6).

### Diagnostic (`/health`)
- État de connexion des APIs (Supervision + CS-160), **test des plaques**
  (balayage), **contrôle des 32 canaux**.

---

## 8. Dépannage

| Symptôme | Cause / solution |
|---|---|
| L'IA répond « modèle indisponible » | Le modèle n'est pas encore téléchargé : `docker logs -f color-room-ollama-pull`. Vérifie `curl localhost:8080/api/ai/status`. |
| « Aucune IA configurée » | Ni `GEMINI_API_KEY`, ni `AI_PROVIDER=ollama` dans `app/.env`. Rebuild après modif. |
| Build échoue sur `apt-get` / `deb.debian.org` | Réseau Debian bloqué : déjà contourné (le Dockerfile n'utilise plus apt-get). |
| CS-160 « introuvable » dans un jeu | Corrigé (auto-connexion). Vérifie que `/mesure` voit bien l'appareil. |
| Le modèle rame | Normal sur Pi (CPU). Prends un modèle plus petit (`llama3.2:3b`). |
| Changement de `.env` non pris en compte | `docker compose up -d --build` (les variables sont injectées au démarrage). |

---

## 9. Ports à retenir
- **8080** : application (UI). `8080/api/health`, `8080/health`.
- **11434** : Ollama (interne, pas besoin de l'exposer publiquement).
- **9000 / 9443** : Portainer (optionnel).

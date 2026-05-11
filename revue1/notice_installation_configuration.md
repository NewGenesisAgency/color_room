/**
 * @page notice_installation_configuration Notice — Installation & configuration
 *
 * @section notice_intro Objectif
 * Cette notice décrit la procédure permettant d’installer, configurer et lancer le projet
 * **Color Room Games** (application web + API Next.js), ainsi que les points de dépannage
 * les plus fréquents.
 *
 * @section notice_prerequis Pré-requis
 * @subsection notice_prerequis_outils Outils
 * - Git
 * - Node.js + npm (version compatible avec le projet)
 * - Navigateur moderne (Chrome/Edge)
 * - (Optionnel) Docker si une orchestration est utilisée dans votre contexte
 * - Autoriser l’exécution de scripts PowerShell (si scripts de setup)
 *
 * @subsection notice_prerequis_reseau Réseau (si pilotage matériel)
 * - Accès au PC/serveur exécutant SupervisionAPI.
 * - SupervisionAPI écoute sur le port `8080`.
 *
 * @section notice_recuperation Récupération du projet
 * - Dépôt: https://github.com/BON-CIEL/color-room-games
 * - Cloner le dépôt puis ouvrir le dossier projet.
 *
 * @section notice_install Installation
 * @subsection notice_install_deps Dépendances
 * Depuis le dossier `docker_javascript`:
 * - `npm install`
 *
 * @subsection notice_install_env Variables d’environnement
 * La webapp proxifie les appels vers SupervisionAPI via `/api/supervision`.
 * Configurer la cible par variable d’environnement:
 * - `SUPERVISION_API_URL=http://<IP_SUPERVISION>:8080`
 *
 * @section notice_run Lancement
 * @subsection notice_run_dev Mode développement
 * - Lancer le serveur de dev Next.js.
 * - Accéder à: `http://localhost:3000`
 *
 * @subsection notice_run_pages Pages principales
 * - `/jeux` : interface utilisateur + lancement des jeux + pilotage (selon profil)
 * - `/editeur` : éditeur de jeux (réservé aux enseignants)
 *
 * @section notice_db Base de données (projet)
 * @subsection notice_db_type Type
 * - SQLite (stockage local)
 *
 * @subsection notice_db_role Rôle
 * - Stockage des jeux (table `crg_games`)
 * - Stockage des utilisateurs/sessions (authentification)
 *
 * @section notice_acces Accès éditeur (authentification)
 * L’accès à `/editeur` est restreint :
 * - se connecter avec un utilisateur `userType = enseignant` via `/jeux`.
 * - la session est gérée côté serveur (cookie de session), et l’API `/api/me` permet de vérifier le profil courant.
 *
 * @section notice_troubleshooting Dépannage
 * @subsection notice_troubleshooting_editeur L’éditeur ne charge pas
 * - Vérifier que l’utilisateur courant est bien `enseignant` (`GET /api/me`).
 * - Vérifier la console navigateur (erreurs réseau / JS).
 *
 * @subsection notice_troubleshooting_supervision Problèmes de pilotage matériel
 * - Vérifier que SupervisionAPI est lancée et accessible sur `http://<IP>:8080`.
 * - Vérifier la variable `SUPERVISION_API_URL`.
 * - Vérifier que les routes suivantes répondent:
 *   - `GET /api/supervision/state`
 *   - `PUT /api/supervision/state/plaque/1/canal/0/10`
 *
 * @section notice_todo Améliorations à documenter (TODO)
 * - Procédure de build (production)
 * - Procédure de déploiement
 * - Procédure Docker/CI (si applicable)
 */

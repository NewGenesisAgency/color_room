/**
 * @page logiciels_et_solutions Logiciels mis en œuvre — Choix, justifications et validations
 *
 * @section les_objectif Objectif
 * Ce document formalise les **choix techniques** effectués pour le projet, ainsi que leurs
 * **justifications**, les **tests** réalisés et les **alternatives** envisagées.
 *
 * L’objectif n’est pas de “lister des outils”, mais d’expliquer :
 * - pourquoi ces technologies sont adaptées au besoin,
 * - quels compromis elles impliquent,
 * - comment on a validé que le choix fonctionne réellement.
 *
 * @section les_stack Stack logicielle retenue
 * @subsection les_stack_web Next.js (Web + API)
 * - Rôle: framework qui unifie la partie **frontend** (pages React) et la partie **backend léger**
 *   (routes API dans `/api/*`).
 * - Bénéfices attendus:
 *   - architecture centralisée (un seul projet à déployer pour le web),
 *   - routage intégré (`/jeux`, `/editeur`),
 *   - API server-side disponible pour gérer DB, sessions et proxy matériel.
 * - Points d’attention:
 *   - nécessite une discipline de structuration (séparation UI / API / lib),
 *   - attention aux effets de bord si on mélange runtime client et logique serveur.
 *
 * @subsection les_stack_ui React (UI)
 * - Rôle: construction de l’interface, composants interactifs, gestion d’état.
 * - Bénéfices:
 *   - composantisation, réutilisabilité,
 *   - rendu dynamique (viewport, sliders, outliner, details).
 * - Risques:
 *   - complexité de l’état si l’éditeur grandit (d’où l’importance de patterns clairs).
 *
 * @subsection les_stack_typage TypeScript (qualité / maintenabilité)
 * - Rôle: typage statique du code.
 * - Pourquoi:
 *   - réduit les erreurs (ex: structure de config des jeux, payload API),
 *   - facilite l’évolution (refactor) en sécurisant les appels.
 * - Risques:
 *   - coût initial de typage,
 *   - nécessité de définir des types “document” stables (versioning).
 *
 * @subsection les_stack_db SQLite (persistance)
 * - Rôle: stockage local persistant des jeux, utilisateurs et sessions.
 * - Pourquoi:
 *   - très simple à déployer (pas de serveur DB externe),
 *   - suffisant pour un projet scolaire et/ou mono-instance.
 * - Risques:
 *   - concurrence limitée si multi‑process,
 *   - nécessité de versionner/structurer les documents JSON dans la DB.
 *
 * @section les_solutions Solutions d’architecture retenues
 * @subsection les_solutions_game_doc Document de jeu (config)
 * - Principe: stocker un document de configuration (JSON) versionné (`version: 1`),
 *   avec `tileCount`, `nodes`, `edges`, et un bloc `ui` (HUD).
 * - Bénéfices:
 *   - flexibilité (ajout de champs sans migration lourde),
 *   - compatibilité ascendante par versioning.
 *
 * @subsection les_solutions_proxy Proxy SupervisionAPI
 * - Principe: le front appelle `/api/supervision/...` et le serveur Next.js forwarde
 *   vers SupervisionAPI (`SUPERVISION_API_URL`).
 * - Bénéfices:
 *   - CORS simplifié,
 *   - centralisation des timeouts / erreurs réseau,
 *   - changement de base URL sans modifier tout le front.
 *
 * @section les_validations Tests / validations réalisés
 * @subsection les_validations_games_api API `/api/games`
 * - Listing des jeux (GET)
 * - Création (POST)
 * - Mise à jour (PATCH)
 * - Suppression (DELETE)
 *
 * @subsection les_validations_editor Editeur
 * - Création/édition/sauvegarde d’un jeu enseignant.
 * - Vérification de persistance après rechargement.
 *
 * @subsection les_validations_runtime Exécution
 * - Lancement d’un jeu `editor` depuis `/jeux`.
 * - Calcul d’un rendu (couleur/intensité) et envoi vers l’API de supervision.
 *
 * @section les_alternatives Alternatives envisagées
 * @subsection les_alt_storage Stockage
 * - JSON local (localStorage)
 *   - Avantage: rapide à prototyper.
 *   - Limite: pas partageable, fragile, pas adapté à des sessions multi‑utilisateurs.
 * - PostgreSQL
 *   - Avantage: robuste, multi‑utilisateur.
 *   - Limite: nécessite un serveur DB, administration.
 * - MongoDB
 *   - Avantage: stockage document.
 *   - Limite: ajoute une dépendance serveur, nécessite modélisation.
 *
 * @section les_conclusion Conclusion
 * Les choix retenus sont adaptés à une V1 : déploiement simple, persistance suffisante,
 * itération rapide sur l’UI et le runtime.
 * Les évolutions futures pourront introduire une DB plus robuste et/ou un runtime plus avancé
 * si le besoin devient multi‑instance et/ou plus complexe.
 */

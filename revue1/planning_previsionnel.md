/**
 * @page planning_previsionnel Planning prévisionnel — Projet 16
 *
 * @section pp_objectif Objectif
 * Établir un planning prévisionnel permettant :
 * - de séquencer les livraisons,
 * - de répartir les tâches,
 * - d’identifier les dépendances,
 * - et de suivre l’avancement (statuts).
 *
 * @section pp_jalons Jalons (proposition)
 * Les jalons structurent le projet en livraisons vérifiables.
 *
 * - **J1 — Démarrage & cadrage (Revue 1)**
 *   - Lecture CDC + clarification vocabulaire (plaque / scène / curseur / canal)
 *   - Mise en place dépôt, conventions, structure des pages
 *   - 1er jet : CDC préliminaire + début recette + début notice install
 *   - Livrable : documents Revue 1 versionnés
 *
 * - **J2 — Socle applicatif & authentification**
 *   - UI minimale (accueil, navigation)
 *   - Auth DB (login/logout/me) + cookie session HTTP-only
 *   - Règles d’accès (éditeur réservé enseignant)
 *   - Livrable : parcours connexion fonctionnel + preuves (tests manuels)
 *
 * - **J3 — Base de données & CRUD jeux (SQLite)**
 *   - Schéma tables (users/sessions/games)
 *   - Endpoints `GET/POST/PATCH/DELETE /api/games`
 *   - Stockage `config_json` (versionné) + validations d’entrée
 *   - Livrable : création/édition/suppression en DB + vérification persistante
 *
 * - **J4 — Intégration supervision (proxy API) + faisabilité matériel**
 *   - Proxy `/api/supervision/*` (GET/PUT/POST/PATCH/DELETE)
 *   - Tests de faisabilité : atteindre l’API supervision depuis l’app
 *   - Point critique : chemin d’API (`cursor` vs `canal`) + exemple d’appel validé
 *   - Livrable : appel supervision validé + capture/trace de requêtes
 *
 * - **J5 — Éditeur : base du workflow & prévisualisation**
 *   - Vue de travail (liste jeux, sélection, zones principales)
 *   - Prévisualisation dalles (simulation) + structure nodes/edges (minimum)
 *   - Sauvegarde locale de brouillon (pour éviter pertes)
 *   - Livrable : ouvrir un jeu, modifier, visualiser l’état simulé
 *
 * - **J6 — HUD : persistance en base (fin du local-only)**
 *   - Rendre le HUD sauvegardable en DB via `PATCH /api/games/:id`
 *   - Charger la config HUD depuis la DB (fallback local optionnel)
 *   - Clarifier “source de vérité” (DB) + gestion des versions de config
 *   - Livrable : modifier HUD, recharger page, retrouver identique
 *
 * - **J7 — Événements UI → logique (liaisons)**
 *   - Définir les événements (click/hover/change) côté UI
 *   - Lier événements à des nœuds (IDs) dans la config
 *   - Vérifier cohérence des IDs et sérialisation
 *   - Livrable : un événement déclenche une action logique simple en simulation
 *
 * - **J8 — Exécution runtime : première boucle (mode “jeu custom”)**
 *   - Charger un jeu `kind: editor` depuis DB
 *   - Exécuter un graphe minimal (début → action → transition)
 *   - Rendu : mise à jour des dalles simulées + HUD réactif
 *   - Livrable : un jeu créé depuis l’éditeur est jouable (MVP)
 *
 * - **J9 — Mode Live : tests sur une plaque (sécurité incluse)**
 *   - Ajout d’un mode “Live ON/OFF” + “Blackout”
 *   - Paramètre d’ID plaque configurable (défaut matériel disponible)
 *   - Limitation débit / anti-spam (timers) + gestion erreurs réseau
 *   - Livrable : validation sur plaque réelle + procédure arrêt sécurisé
 *
 * - **J10 — Déploiement Raspberry Pi (service) + validation exécution**
 *   - Docker Compose stable (DB montée, healthcheck)
 *   - Installation `/opt/...` + service systemd + redémarrage automatique
 *   - Test : reboot RPi → service up → app accessible
 *   - Livrable : notice install mise à jour + preuve (status systemctl)
 *
 * - **J11 — Qualité / CI-CD / recette d’intégration**
 *   - Pipeline CI (build/lint/tests) + règles merge (si utilisées)
 *   - Cahier de recette complet (UC ↔ tests) + 1 test détaillé “pas à pas”
 *   - Corrections issues des tests d’intégration
 *   - Livrable : exécution recette + résultats + tickets correctifs
 *
 * - **J12 — Stabilisation & préparation soutenance (Revue 2)**
 *   - Fixes finaux + validation end-to-end (DB + runtime + supervision)
 *   - Documents : planning prévisionnel/avancement, recettes, schémas/diagrammes
 *   - Préparation démo (scénario) + captures + éléments PPT
 *   - Livrable : dossier prêt Revue 2 + démo répétable
 *
 * @section pp_suivi Méthode de suivi
 * - Chaque tâche possède :
 *   - un responsable,
 *   - une date début/fin,
 *   - des dépendances,
 *   - un statut.
 * - Statuts recommandés: `TODO`, `En cours`, `Bloqué`, `En revue`, `Terminé`.
 * - Une tâche “Terminé” doit être associée à une preuve (commit, capture, test).
 *
 * @section pp_table Tableau des tâches (à compléter)
 * | Tâche | Responsable | Début | Fin | Dépendances | Statut |
 * |---|---|---:|---:|---|---|
 * | Collecte des informations + vocabulaire | <Nom> | J1 | J1 | - | TODO |
 * | Analyse / interprétation CDC (UC + scénarios) | <Nom> | J1 | J2 | Collecte | TODO |
 * | Rédaction CDC préliminaire (versionnée) | <Nom> | J1 | J2 | Analyse | TODO |
 * | Cahier de recette (liste complète UC↔tests) | <Nom> | J1 | J11 | Analyse | TODO |
 * | Notice install/config (PC + Raspberry) | <Nom> | J1 | J12 | Docker | TODO |
 * | Auth DB + sessions + rôles | <Nom> | J2 | J2 | DB | TODO |
 * | Implémentation DB + CRUD jeux | <Nom> | J3 | J3 | Auth | TODO |
 * | Proxy SupervisionAPI + tests faisabilité | <Nom> | J4 | J4 | Réseau/API | TODO |
 * | Éditeur (workflow + preview) — base | <Nom> | J5 | J5 | CRUD jeux | TODO |
 * | HUD : sauvegarde/chargement en DB | <Nom> | J6 | J6 | CRUD jeux | TODO |
 * | Événements UI ↔ logique (liaisons) | <Nom> | J7 | J7 | HUD | TODO |
 * | Runtime : exécution MVP jeu custom | <Nom> | J8 | J8 | Événements | TODO |
 * | Live hardware + blackout + anti-spam | <Nom> | J9 | J9 | Proxy supervision | TODO |
 * | Docker Compose stable + healthcheck | <Nom> | J10 | J10 | App stable | TODO |
 * | Service Raspberry (systemd) + validation reboot | <Nom> | J10 | J10 | Docker | TODO |
 * | CI/CD (build/lint/tests) | <Nom> | J11 | J11 | Repo stable | TODO |
 * | Stabilisation + corrections issues recette | <Nom> | J11 | J12 | Recette | TODO |
 * | Préparation Revue 2 (docs + démo) | <Nom> | J12 | J12 | Stabilisation | TODO |
 *
 * @section pp_repartition Répartition des tâches (à compléter)
 * - <Nom 1>: ...
 * - <Nom 2>: ...
 *
 * @section pp_risques Risques planning
 * - Sous-estimation du temps UX.
 * - Blocages techniques runtime.
 * - Dépendance au matériel/API (SupervisionAPI indisponible).
 *
 * @section pp_mitigation Mesures de mitigation
 * - Découper en livraisons courtes (jalons) avec validation rapide.
 * - Prévoir un mode simulation (sans matériel) pour avancer en parallèle.
 * - Prioriser la stabilité DB + UX avant le runtime avancé.
 */

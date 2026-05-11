/**
 * @page cahier_des_charges_preliminaire Cahier des charges préliminaire — Projet 16 (Color Room Games)
 *
 * @section cdc_pre_intro Finalité du document
 * Ce cahier des charges préliminaire fixe une **compréhension commune** du besoin et des objectifs.
 * Il sert de référence pour :
 * - cadrer le périmètre et éviter la dérive fonctionnelle,
 * - prioriser les fonctionnalités,
 * - définir des critères d’acceptation vérifiables,
 * - identifier les risques et contraintes dès le début.
 *
 * @section cdc_pre_contexte Contexte
 * - **Établissement / formation**: BTS CIEL
 * - **Revue**: Revue 1 — 07/01/2026
 * - **Projet**: Color Room Games
 *
 * @subsection cdc_pre_contexte_probleme Problématique
 * La salle “Color Room” est un dispositif lumineux (plaques/dalles) pouvant être contrôlé par logiciel.
 * L’enjeu du projet est de proposer une plateforme web permettant de créer et exécuter des **mini‑jeux pédagogiques**
 * s’appuyant sur ces dalles, avec une logique paramétrable par l’enseignant.
 *
 * @section cdc_pre_besoin Expression du besoin
 * @subsection cdc_pre_besoin_principal Besoin principal
 * Concevoir une plateforme permettant de **concevoir**, **configurer**, **sauvegarder** et **exécuter**
 * des mini‑jeux basés sur :
 * - une grille de dalles (`tileCount` et index de dalle),
 * - une logique de jeu décrite sous forme de **nœuds** (évènements, logique, rendu),
 * - une intégration avec une API de supervision pour piloter l’éclairage réel.
 *
 * @subsection cdc_pre_objectifs Objectifs
 * - Fournir un **éditeur enseignant** ergonomique (workflow “Unreal-like”: Explorateur/Outliner + Détails).
 * - Assurer la **persistance** des jeux (base de données).
 * - Garantir une **restriction d’accès** à l’éditeur (enseignants uniquement).
 * - Permettre l’**exécution** du jeu côté utilisateur (page /jeux) avec visualisation et contrôle matériel.
 *
 * @section cdc_pre_perimetre Périmètre
 * @subsection cdc_pre_inclus Inclus (V1)
 * - CRUD jeux: création, édition, sauvegarde, suppression.
 * - Paramétrage du nombre de dalles (`tileCount`) et cohérence des indices.
 * - Gestion de nœuds de base: évènement de départ, rendu (fill/pulse/tile), temporisation.
 * - Persistance en DB (métadonnées + document de configuration).
 * - Lancement de jeux stockés en DB dans `/jeux`.
 *
 * @subsection cdc_pre_exclus Exclus / hors périmètre (V1)
 * - Runtime avancé (boucles complexes, variables typées complètes, moteur d’évènements V2).
 * - Scoring complet et compétitions avancées.
 * - Partage public / marketplace.
 *
 * @section cdc_pre_partiesprenantes Parties prenantes
 * - **Enseignant** (créateur): construit la logique et les paramètres.
 * - **Apprenant / utilisateur**: lance et joue, interagit via l’UI.
 * - **Équipe projet**: implémentation, tests, documentation.
 * - **Référent**: validation et arbitrage pédagogique.
 *
 * @section cdc_pre_exigences Exigences
 * @subsection cdc_pre_fonctionnelles Exigences fonctionnelles (F)
 * - **F1**: Un enseignant peut créer un jeu.
 * - **F2**: Un enseignant peut renommer un jeu.
 * - **F3**: Un jeu est sauvegardé en base (métadonnées + document de config).
 * - **F4**: Un enseignant peut rouvrir un jeu existant.
 * - **F5**: Un enseignant peut supprimer un jeu.
 * - **F6**: Un jeu est paramétrable (nœuds, paramètres, dalles, visuel HUD/accents).
 * - **F7**: Un utilisateur peut lancer un jeu issu de la DB dans `/jeux`.
 *
 * @subsection cdc_pre_nonfonctionnelles Exigences non fonctionnelles (NF)
 * - **NF1 Sécurité**: accès éditeur restreint (enseignant).
 * - **NF2 Performance**: interface réactive (graph/viewport), limitation des appels matériel (throttling).
 * - **NF3 Robustesse**: aucune perte silencieuse (indicateur “modifié/sauvegardé”, messages d’erreur).
 * - **NF4 Maintenabilité**: TypeScript, architecture claire, code lisible.
 *
 * @section cdc_pre_contraintes Contraintes
 * - Stack: Next.js / React / TypeScript.
 * - Stockage: SQLite.
 * - Contexte: Windows, avec Docker éventuel.
 * - Dépendance: SupervisionAPI (pilotage matériel) et disponibilité réseau.
 *
 * @section cdc_pre_acceptation Critères d’acceptation (exemples vérifiables)
 * - Un enseignant crée un jeu et le retrouve après rechargement (persistance OK).
 * - Un renommage est conservé après rechargement.
 * - Une modification de configuration met l’état “Modifié”, puis “Sauvegardé” après sauvegarde.
 * - Un jeu “editor” lancé dans `/jeux` produit un rendu (couleur/intensité) et envoie les commandes aux plaques.
 *
 * @section cdc_pre_risques Hypothèses et risques
 * - Dérive du périmètre (trop de fonctionnalités): mitigation par priorisation Must/Should/Could.
 * - Complexité du runtime: commencer par un moteur minimal, itérer.
 * - UX trop dense: privilégier un workflow simple (Explorateur → Détails → Aperçu).
 * - Dépendances matérielles/réseau: prévoir des modes “simulation” et du logging.
 *
 * @section cdc_pre_tracabilite Traçabilité (recommandation)
 * Pour chaque exigence (F/NF), associer :
 * - un ou plusieurs cas de tests dans le @ref cahier_de_recette,
 * - un jalon dans le @ref planning_previsionnel,
 * - une décision technique dans le @ref logiciels_et_solutions.
 */

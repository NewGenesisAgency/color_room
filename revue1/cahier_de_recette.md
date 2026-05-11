/**
 * @page cahier_de_recette Cahier de recette — Projet 16 (Color Room Games)
 *
 * @section recette_objet Objet
 * Le cahier de recette décrit des **cas de tests** permettant de valider que le produit répond au besoin
 * défini dans le @ref cahier_des_charges_preliminaire.
 *
 * Les tests de V1 couvrent prioritairement :
 * - la sécurité d’accès à l’éditeur,
 * - la persistance en base (CRUD),
 * - l’édition minimale de nœuds,
 * - l’exécution d’un jeu “editor” dans `/jeux` (rendu + commande matériel).
 *
 * @section recette_prerequis Environnement de test
 * - OS: Windows
 * - Navigateur: Chrome / Edge (mode normal)
 * - Application: `docker_javascript` (Next.js / React / TypeScript)
 * - Base de données: SQLite (fichier local du projet)
 * - Dépendance optionnelle: SupervisionAPI (pilotage matériel) via proxy `/api/supervision`
 *
 * @section recette_donnees Données de test
 * @subsection recette_donnees_comptes Comptes
 * - Compte enseignant: `userType = enseignant`
 * - Compte apprenant: `userType = apprenant`
 *
 * @subsection recette_donnees_jeux Jeux
 * - `Jeu1` et `Jeu2` créés depuis `/editeur`.
 * - Un jeu `kind=editor` contient au minimum :
 *   - un nœud `event_begin` activé,
 *   - un nœud de rendu (`fill` ou `pulse`) activé.
 *
 * @section recette_regles Règles de preuve / traçabilité
 * Pour qu’un test soit considéré comme validé, fournir au minimum :
 * - un screenshot, ou
 * - un enregistrement de console (network / logs), ou
 * - une trace DB (avant/après) si pertinent.
 *
 * Chaque cas de test est identifié par un ID stable (ex: `CT-DB-01`).
 *
 * @section recette_cas Cas de tests
 *
 * @subsection recette_sec Accès éditeur (sécurité)
 * @par CT-SEC-01 — Accès refusé si non enseignant
 * - **Exigences**: NF1, F1 (pré-condition d’accès)
 * - **Préconditions**: session active avec `userType != enseignant`
 * - **Procédure**:
 *   1. Ouvrir `/editeur`
 * - **Résultat attendu**:
 *   - affichage d’un message “réservé aux enseignants” (ou équivalent)
 *   - accès aux fonctions de création/édition indisponible
 * - **Preuves attendues**: capture écran de la page et/ou du statut renvoyé par `/api/me`.
 *
 * @subsection recette_db CRUD jeux (DB)
 * @par CT-DB-01 — Création d’un jeu en base
 * - **Exigences**: F1, F3
 * - **Préconditions**: session `enseignant`
 * - **Procédure**:
 *   1. Ouvrir `/editeur`
 *   2. Cliquer `Nouveau`
 * - **Résultat attendu**:
 *   - un jeu apparaît dans la liste
 *   - après rechargement, le jeu est toujours présent
 * - **Preuves**: screenshot avant/après + rechargement.
 *
 * @par CT-DB-02 — Renommage persistant
 * - **Exigences**: F2, F3
 * - **Procédure**:
 *   1. Sélectionner un jeu
 *   2. Modifier le champ "Nom du jeu"
 *   3. Quitter le champ (blur)
 *   4. Recharger la page
 * - **Résultat attendu**:
 *   - le nom est conservé
 * - **Preuves**: screenshot après modification, puis après reload.
 *
 * @par CT-DB-03 — Sauvegarde manuelle
 * - **Exigences**: F3, NF3
 * - **Procédure**:
 *   1. Modifier un paramètre (ex: intensité d’un nœud `fill`)
 *   2. Cliquer `Sauvegarder`
 * - **Résultat attendu**:
 *   - l’indicateur passe à "Sauvegardé"
 *   - la modification est persistante après reload
 * - **Preuves**: screenshot “modifié/sauvegardé” + reload.
 *
 * @par CT-DB-04 — Suppression
 * - **Exigences**: F5
 * - **Procédure**:
 *   1. Sélectionner un jeu
 *   2. Cliquer `Supprimer`
 *   3. Recharger la page
 * - **Résultat attendu**:
 *   - le jeu n’apparaît plus
 * - **Preuves**: screenshot liste vide (ou sans le jeu).
 *
 * @subsection recette_editeur Éditeur de nœuds
 * @par CT-ED-01 — Ajout d’un nœud
 * - **Exigences**: F6
 * - **Procédure**:
 *   1. Sélectionner un jeu
 *   2. Cliquer `Ajouter` dans la section Nœuds
 * - **Résultat attendu**:
 *   - nœud ajouté, sélectionné, visible dans la liste
 *
 * @par CT-ED-02 — Suppression d’un nœud
 * - **Exigences**: F6
 * - **Procédure**:
 *   1. Sélectionner un nœud
 *   2. Appuyer `Suppr`
 * - **Résultat attendu**:
 *   - nœud supprimé
 *
 * @subsection recette_exec Exécution d’un jeu “editor” dans /jeux
 * @par CT-RUN-01 — Lancement d’un jeu editor depuis la DB
 * - **Exigences**: F7, NF2
 * - **Préconditions**:
 *   - un jeu existe en DB avec `kind=editor`
 *   - SupervisionAPI accessible (si test matériel)
 * - **Procédure**:
 *   1. Ouvrir `/jeux`
 *   2. Dans “Jeux (base de données)”, cliquer ▶ sur un jeu `editor`
 * - **Résultat attendu**:
 *   - affichage d’un HUD (titre/couleur d’accent si configurés)
 *   - évolution visible des dalles (couleur/intensité)
 *   - appels réseau vers `/api/supervision/state/plaque/...` (si pilotage actif)
 * - **Preuves**: screenshot + onglet Network (ou log).
 *
 * @section recette_bilan Bilan de recette
 * - Date:
 * - Testeur:
 * - Résultat global (OK/NOK):
 * - Remarques / anomalies (ID, sévérité, contournement):
 */

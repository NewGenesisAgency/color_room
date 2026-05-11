/**
 * @page difficultes_et_bilan Difficultés rencontrées & bilan — Revue 1
 *
 * @section deb_intro Objectif
 * Ce document sert à capitaliser sur les difficultés rencontrées lors de la phase Revue 1,
 * à décrire les solutions appliquées, et à définir les prochaines étapes.
 *
 * L’objectif est double :
 * - éviter de reproduire les mêmes erreurs,
 * - rendre visible la maîtrise du projet (gestion des risques et décisions).
 *
 * @section deb_difficultes Difficultés rencontrées
 * @subsection deb_ux Complexité de l’éditeur (UX)
 * - Symptôme: interface potentiellement dense (Explorateur / Graphe / Détails / Aperçu).
 * - Causes probables:
 *   - trop d’actions disponibles en même temps,
 *   - manque de hiérarchie visuelle,
 *   - risque de confusion entre sélection d’un jeu, sélection d’un nœud, sélection d’une dalle.
 * - Impact:
 *   - prise en main plus lente,
 *   - erreurs utilisateur.
 *
 * @subsection deb_ts Gestion du typage TypeScript
 * - Symptôme: erreurs de compilation lors de refactors (ex: config JSON, runtime, helpers).
 * - Causes:
 *   - types de documents pas toujours explicités,
 *   - duplication de fonctions utilitaires,
 *   - mélange de logique client/server.
 * - Impact:
 *   - ralentissement lors des itérations.
 *
 * @subsection deb_db Persistance DB / format de config
 * - Symptôme: difficulté à garantir la persistance et la compatibilité dans le temps.
 * - Causes:
 *   - nécessité de définir un document versionné,
 *   - gestion du “dirty state” (modifié/sauvegardé),
 *   - contraintes SQLite (simplicité vs évolution).
 * - Impact:
 *   - risque de perte de données si mal géré.
 *
 * @section deb_solutions Solutions / contournements
 * @subsection deb_workflow Simplification du workflow
 * - Clarifier l’entrée: `/jeux` (utilisation) vs `/editeur` (création).
 * - Stabiliser les actions principales: créer/sauvegarder/supprimer.
 *
 * @subsection deb_unification Unification création/édition
 * - Eviter les workflows parallèles (ex: “modal custom”) qui dupliquent les états.
 * - Centraliser l’édition dans l’éditeur (Explorateur → Détails).
 *
 * @subsection deb_apiunique API unique `/api/games`
 * - Centraliser le CRUD DB (création/lecture/MAJ/suppression).
 * - Simplifier les appels front et le test (recette).
 *
 * @section deb_bilan Bilan
 * @subsection deb_pret Ce qui est prêt
 * - Livrables Revue 1 (documents structurants).
 * - Première version fonctionnelle de l’éditeur (création + liste + édition minimale).
 *
 * @subsection deb_restant Ce qui reste / points à renforcer
 * - Configuration avancée du visuel de jeu (HUD/widgets plus riches).
 * - Runtime plus complet (évènements, variables, conditions) et robustesse.
 * - Indicateur “Modifié / Sauvegardé” plus explicite et tests plus exhaustifs.
 *
 * @section deb_next Prochaines étapes (proposition)
 * - Finaliser le CRUD complet et la gestion d’erreurs.
 * - Ajouter un statut sauvegardé/modifié clair + logique anti-perte.
 * - Etendre la configuration du visuel (UI/HUD) et la rendre visible dans `/jeux`.
 * - Stabiliser l’intégration SupervisionAPI (proxy, timeouts, compat).
 *
 * @section deb_risques Suivi des risques
 * - **R1**: dérive du périmètre → mitigation: backlog priorisé.
 * - **R2**: complexité runtime → mitigation: versionning et tests progressifs.
 * - **R3**: dépendance matériel → mitigation: mode simulation + logs.
 */

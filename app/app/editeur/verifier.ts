/**
 * @file verifier.ts
 * @brief Vérification statique du graphe de blocs de l'éditeur.
 *
 * Analyse les nœuds et les câbles du jeu actif et renvoie une liste de
 * problèmes (erreurs ou avertissements) avec des messages en français
 * simple, orientés solution. Aucune exécution : analyse purement statique.
 */

import { LOGIC_OP_KINDS } from '@/lib/game/logicOps';

/**
 * @brief Un problème détecté dans le graphe.
 */
export type Probleme = {
  /** Identifiant du nœud concerné (absent pour un problème global). */
  nodeId?: string;
  /** Gravité : `erreur` bloque le jeu, `avertissement` est un conseil. */
  niveau: 'erreur' | 'avertissement';
  /** Message en français simple, orienté solution. */
  message: string;
};

/**
 * @brief Forme minimale d'un nœud du graphe (compatible EditorNode).
 */
export type NoeudVerifiable = {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  params: Record<string, unknown>;
};

/**
 * @brief Forme minimale d'un câble du graphe (compatible GraphEdge).
 */
export type CableVerifiable = {
  id: string;
  from: string;
  to: string;
  /** Nature du câble : 'exec' (flux d'exécution, défaut) ou 'data' (fil de valeur). */
  kind?: 'exec' | 'data';
  /** Pour un fil 'data' : nom de l'opérande cible (ex. 'a', 'b', 't'). */
  toPort?: string;
};

/**
 * @brief Indique si un nœud est un évènement (point d'entrée du graphe).
 *
 * Convention du projet : `event_begin` ou kind commençant par `on_`.
 * Les blocs d'évènements spécifiques aux jeux (ex. `tetris_on_game_over`,
 * `measure_on_result`) contiennent `_on_` et sont aussi des points d'entrée.
 * @param kind Le type du nœud.
 * @return `true` si le nœud démarre un flux d'exécution.
 */
function estEvenement(kind: string): boolean {
  return kind === 'event_begin' || kind.startsWith('on_') || kind.includes('_on_');
}

/**
 * @brief Vérifie le graphe de blocs et liste les problèmes trouvés.
 *
 * Règles appliquées :
 *  - bloc isolé (aucun câble entrant ni sortant) ;
 *  - bloc jamais atteint depuis un évènement ;
 *  - évènement sans aucune sortie ;
 *  - `wait` avec une durée nulle ou négative ;
 *  - `while` / `for_range` sans corps de boucle ;
 *  - `script_python` sans code ;
 *  - `on_ui_click` sans identifiant de bouton.
 *
 * @param nodes Les nœuds du jeu actif.
 * @param edges Les câbles reliant ces nœuds.
 * @return La liste des problèmes (vide si tout est prêt).
 */
export function verifierGraphe(nodes: NoeudVerifiable[], edges: CableVerifiable[]): Probleme[] {
  const problemes: Probleme[] = [];

  // Index des connexions : qui reçoit, qui envoie.
  // Les FILS DE VALEUR (kind 'data') comptent comme des liens valides (un bloc
  // const_number relié par un fil data n'est PAS isolé), mais le parcours
  // d'atteignabilité ne suit que les câbles d'EXÉCUTION.
  const sortants = new Map<string, string[]>();
  const aEntrant = new Set<string>();
  const aSortant = new Set<string>();
  const aLienData = new Set<string>();
  for (const e of edges) {
    aSortant.add(e.from);
    aEntrant.add(e.to);
    if (e.kind === 'data') {
      aLienData.add(e.from);
      aLienData.add(e.to);
      continue; // jamais suivi comme flux d'exécution
    }
    const liste = sortants.get(e.from);
    if (liste) liste.push(e.to);
    else sortants.set(e.from, [e.to]);
  }

  // Parcours en largeur depuis tous les évènements → ensemble des nœuds atteignables.
  const atteignables = new Set<string>();
  const file: string[] = [];
  for (const n of nodes) {
    if (estEvenement(n.kind)) {
      atteignables.add(n.id);
      file.push(n.id);
    }
  }
  let tete = 0;
  while (tete < file.length) {
    const courant = file[tete++];
    for (const suivant of sortants.get(courant) ?? []) {
      if (!atteignables.has(suivant)) {
        atteignables.add(suivant);
        file.push(suivant);
      }
    }
  }

  for (const n of nodes) {
    const isole = !aEntrant.has(n.id) && !aSortant.has(n.id);

    if (estEvenement(n.kind)) {
      // Règle c : un évènement doit déclencher quelque chose.
      if (!aSortant.has(n.id)) {
        problemes.push({
          nodeId: n.id,
          niveau: 'avertissement',
          message: "Cet évènement ne déclenche rien : relie sa sortie à un bloc d'action.",
        });
      }
    } else if (n.kind !== 'define_sub') {
      if (isole) {
        // Règle a : bloc complètement isolé.
        problemes.push({
          nodeId: n.id,
          niveau: 'avertissement',
          message: "Ce bloc n'est relié à rien : ajoute un câble vers ou depuis un autre bloc.",
        });
      } else if (!atteignables.has(n.id) && !(LOGIC_OP_KINDS.has(n.kind) && aLienData.has(n.id))) {
        // Règle b : relié, mais aucun évènement ne mène jusqu'à lui.
        // Exception : un bloc calcul/logique relié par un FIL DE VALEUR est
        // évalué à la demande — il n'a pas besoin d'être déclenché par un évènement.
        problemes.push({
          nodeId: n.id,
          niveau: 'avertissement',
          message: "Jamais déclenché : aucun évènement n'y mène. Relie-le à une chaîne qui part d'un évènement.",
        });
      }
    }

    // Règles d/e/f : paramètres incomplets ou incohérents.
    switch (n.kind) {
      case 'wait': {
        const secondes = Number(n.params.seconds ?? 0);
        if (!Number.isFinite(secondes) || secondes <= 0) {
          problemes.push({
            nodeId: n.id,
            niveau: 'avertissement',
            message: "Le bloc Attendre a une durée de 0 seconde ou moins : mets une durée positive.",
          });
        }
        break;
      }
      case 'while': {
        if (!String(n.params.bodyNodeId ?? '').trim()) {
          problemes.push({
            nodeId: n.id,
            niveau: 'erreur',
            message: "Le bloc Tant que n'a pas de corps : choisis le bloc à répéter dans ses paramètres.",
          });
        }
        break;
      }
      case 'for_range': {
        if (!String(n.params.bodyNodeId ?? '').trim()) {
          problemes.push({
            nodeId: n.id,
            niveau: 'erreur',
            message: "La boucle Pour n'a pas de corps : choisis le bloc à répéter dans ses paramètres.",
          });
        }
        break;
      }
      case 'script_python': {
        if (!String(n.params.code ?? '').trim()) {
          problemes.push({
            nodeId: n.id,
            niveau: 'avertissement',
            message: "Le bloc Python est vide : écris du code ou supprime le bloc.",
          });
        }
        break;
      }
      case 'on_ui_click': {
        if (!String(n.params.buttonId ?? '').trim()) {
          problemes.push({
            nodeId: n.id,
            niveau: 'avertissement',
            message: "Aucun bouton choisi : indique l'identifiant du bouton à écouter.",
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return problemes;
}

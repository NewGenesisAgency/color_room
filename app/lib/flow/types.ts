import type { Edge, Node } from 'reactflow';

/**
 * @file Types de flow.
 * @brief Représentation JSON d'un flow (noeuds + liens).
 */

/**
 * @brief Document de flow sauvegardé.
 * @details V1: on stocke un seul flow dans un fichier JSON côté serveur.
 */
export type FlowDocument = {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
};

export type SaveFlowRequest = {
  flow: FlowDocument;
};

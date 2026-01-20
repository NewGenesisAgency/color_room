import type { FlowDocument } from './types';

/**
 * @file Flow par défaut.
 * @brief Flow minimal chargé au premier démarrage.
 */

export function defaultFlow(): FlowDocument {
  return {
    id: 'default',
    name: 'Flow par défaut',
    nodes: [
      {
        id: 'node_1',
        position: { x: 80, y: 80 },
        type: 'default',
        data: { label: 'Noeud 1' },
      },
    ],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

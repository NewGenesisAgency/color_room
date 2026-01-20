'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
} from 'reactflow';

import type { FlowDocument } from '@lib/flow/types';

/**
 * @file Page d'édition des flows.
 * @brief Éditeur drag & drop (style Node-RED) basé sur React Flow.
 */

type ApiFlowResponse = { flow: FlowDocument };

export default function EditorPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [status, setStatus] = useState<string>('Chargement...');

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const currentFlow: FlowDocument = useMemo(
    () => ({
      id: 'default',
      name: 'Flow par défaut',
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    }),
    [nodes, edges],
  );

  const load = useCallback(async () => {
    setStatus('Chargement...');
    const res = await fetch('/api/flows', { method: 'GET' });
    if (!res.ok) {
      setStatus(`Erreur chargement: ${res.status}`);
      return;
    }
    const data = (await res.json()) as ApiFlowResponse;
    setNodes(data.flow.nodes);
    setEdges(data.flow.edges);
    setStatus('OK');
  }, []);

  const save = useCallback(async () => {
    setStatus('Sauvegarde...');
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flow: currentFlow }),
    });
    setStatus(res.ok ? 'Sauvegardé' : `Erreur sauvegarde: ${res.status}`);
  }, [currentFlow]);

  const addNode = useCallback(() => {
    setNodes((prev) => [
      ...prev,
      {
        id: `node_${prev.length + 1}`,
        position: { x: 50 + prev.length * 30, y: 50 + prev.length * 30 },
        data: { label: `Noeud ${prev.length + 1}` },
        type: 'default',
      },
    ]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: 12,
          borderBottom: '1px solid #ddd',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <strong>Éditeur de noeuds</strong>
        <button onClick={addNode}>+ Ajouter un noeud</button>
        <button onClick={save}>Sauvegarder</button>
        <button onClick={load}>Recharger</button>
        <span style={{ marginLeft: 'auto', color: '#555' }}>{status}</span>
      </header>

      <section style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </section>
    </main>
  );
}

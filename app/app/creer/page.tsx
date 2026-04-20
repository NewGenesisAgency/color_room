'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  Play, Pause, Save, Trash2, FolderPlus, Settings, Zap, 
  Box, Type, Sliders, Image as ImageIcon, Circle, Square,
  ChevronRight, Grid, Eye, EyeOff, Maximize2, Layers,
  Plus, X, Check, MousePointer2, Move, Palette, Clock
} from 'lucide-react';
import './creer.css';

type Vec2 = { x: number; y: number };

type NodeKind = 
  | 'event_start' 
  | 'action_fill' 
  | 'action_pulse' 
  | 'action_tile'
  | 'wait'
  | 'loop'
  | 'condition';

type UIComponentKind = 
  | 'button' 
  | 'slider' 
  | 'text' 
  | 'image'
  | 'color-picker'
  | 'progress-bar';

type GameNode = {
  id: string;
  kind: NodeKind;
  name: string;
  pos: Vec2;
  params: Record<string, unknown>;
  enabled: boolean;
};

type Connection = {
  id: string;
  from: string;
  to: string;
};

type UIComponent = {
  id: string;
  kind: UIComponentKind;
  name: string;
  pos: Vec2;
  size: Vec2;
  props: Record<string, unknown>;
  linkedNodeId?: string;
};

type GameProject = {
  id: string;
  name: string;
  nodes: GameNode[];
  connections: Connection[];
  uiComponents: UIComponent[];
  tileCount: number;
};

const NODE_TEMPLATES: Array<{ kind: NodeKind; title: string; icon: any; category: string; color: string }> = [
  { kind: 'event_start', title: 'Démarrer', icon: Play, category: 'Événements', color: '#00d4ff' },
  { kind: 'action_fill', title: 'Remplir', icon: Box, category: 'Actions', color: '#b829dd' },
  { kind: 'action_pulse', title: 'Pulser', icon: Zap, category: 'Actions', color: '#ff3d71' },
  { kind: 'action_tile', title: 'Dalle', icon: Square, category: 'Actions', color: '#ffc700' },
  { kind: 'wait', title: 'Attendre', icon: Clock, category: 'Flux', color: '#00ff88' },
  { kind: 'loop', title: 'Boucle', icon: Circle, category: 'Flux', color: '#4facfe' },
  { kind: 'condition', title: 'Condition', icon: ChevronRight, category: 'Flux', color: '#ff5e3a' },
];

const UI_TEMPLATES: Array<{ kind: UIComponentKind; title: string; icon: any; color: string }> = [
  { kind: 'button', title: 'Bouton', icon: MousePointer2, color: '#00d4ff' },
  { kind: 'slider', title: 'Curseur', icon: Sliders, color: '#b829dd' },
  { kind: 'text', title: 'Texte', icon: Type, color: '#ffc700' },
  { kind: 'image', title: 'Image', icon: ImageIcon, color: '#00ff88' },
  { kind: 'color-picker', title: 'Palette', icon: Palette, color: '#ff3d71' },
  { kind: 'progress-bar', title: 'Progression', icon: Grid, color: '#4facfe' },
];

export default function CreateurPage() {
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'split' | 'nodes' | 'ui'>('split');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Vec2>({ x: 0, y: 0 });
  
  const [draggedNode, setDraggedNode] = useState<{ id: string; offset: Vec2 } | null>(null);
  const [draggedComponent, setDraggedComponent] = useState<{ id: string; offset: Vec2 } | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<{ fromId: string; pos: Vec2 } | null>(null);
  
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showUIPalette, setShowUIPalette] = useState(false);
  const [palettePos, setPalettePos] = useState<Vec2>({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const uiCanvasRef = useRef<HTMLDivElement>(null);
  
  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId), 
    [projects, activeProjectId]
  );

  const selectedNode = useMemo(() => 
    activeProject?.nodes.find(n => n.id === selectedNodeId), 
    [activeProject, selectedNodeId]
  );

  const selectedComponent = useMemo(() => 
    activeProject?.uiComponents.find(c => c.id === selectedComponentId), 
    [activeProject, selectedComponentId]
  );

  const createProject = useCallback((name: string) => {
    const id = Date.now().toString(36);
    const startNode: GameNode = {
      id: `node_${Date.now()}`,
      kind: 'event_start',
      name: 'Démarrer',
      pos: { x: 100, y: 100 },
      params: {},
      enabled: true,
    };
    
    const newProject: GameProject = {
      id,
      name,
      nodes: [startNode],
      connections: [],
      uiComponents: [],
      tileCount: 42,
    };
    
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(id);
    setSelectedNodeId(startNode.id);
  }, []);

  const addNode = useCallback((kind: NodeKind, position?: Vec2) => {
    if (!activeProject) return;
    
    const template = NODE_TEMPLATES.find(t => t.kind === kind);
    const pos = position || { 
      x: 100 + activeProject.nodes.length * 50, 
      y: 100 + activeProject.nodes.length * 30 
    };
    
    const newNode: GameNode = {
      id: `node_${Date.now()}`,
      kind,
      name: template?.title || kind,
      pos,
      params: kind === 'action_fill' ? { color: '#00d4ff', intensity: 0.8, duration: 1 } :
             kind === 'action_pulse' ? { color: '#ff3d71', speed: 1, intensity: 0.8 } :
             kind === 'wait' ? { duration: 1 } : {},
      enabled: true,
    };
    
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { ...p, nodes: [...p.nodes, newNode] }
        : p
    ));
    
    setSelectedNodeId(newNode.id);
    setShowNodePalette(false);
  }, [activeProject, activeProjectId]);

  const addUIComponent = useCallback((kind: UIComponentKind, position?: Vec2) => {
    if (!activeProject) return;
    
    const template = UI_TEMPLATES.find(t => t.kind === kind);
    const pos = position || { x: 50, y: 50 + activeProject.uiComponents.length * 80 };
    
    const newComponent: UIComponent = {
      id: `ui_${Date.now()}`,
      kind,
      name: template?.title || kind,
      pos,
      size: { x: 200, y: kind === 'slider' ? 60 : kind === 'button' ? 80 : 120 },
      props: kind === 'button' ? { label: 'Bouton', color: '#00d4ff' } :
             kind === 'slider' ? { min: 0, max: 100, value: 50, label: 'Intensité' } :
             kind === 'text' ? { content: 'Texte', size: 16, color: '#ffffff' } : {},
    };
    
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { ...p, uiComponents: [...p.uiComponents, newComponent] }
        : p
    ));
    
    setSelectedComponentId(newComponent.id);
    setShowUIPalette(false);
  }, [activeProject, activeProjectId]);

  const connectNodes = useCallback((fromId: string, toId: string) => {
    if (!activeProject) return;
    if (activeProject.connections.some(c => c.from === fromId && c.to === toId)) return;
    
    const newConnection: Connection = {
      id: `conn_${Date.now()}`,
      from: fromId,
      to: toId,
    };
    
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { ...p, connections: [...p.connections, newConnection] }
        : p
    ));
  }, [activeProject, activeProjectId]);

  const updateNodePosition = useCallback((nodeId: string, pos: Vec2) => {
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { 
            ...p, 
            nodes: p.nodes.map(n => n.id === nodeId ? { ...n, pos } : n) 
          }
        : p
    ));
  }, [activeProjectId]);

  const updateComponentPosition = useCallback((componentId: string, pos: Vec2) => {
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { 
            ...p, 
            uiComponents: p.uiComponents.map(c => c.id === componentId ? { ...c, pos } : c) 
          }
        : p
    ));
  }, [activeProjectId]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setPalettePos({ 
          x: (e.clientX - rect.left - pan.x) / zoom, 
          y: (e.clientY - rect.top - pan.y) / zoom 
        });
        setShowNodePalette(true);
      }
      return;
    }
    
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
    }
  }, [pan, zoom]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    
    if (draggedNode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newPos = {
          x: (e.clientX - rect.left - pan.x) / zoom - draggedNode.offset.x,
          y: (e.clientY - rect.top - pan.y) / zoom - draggedNode.offset.y,
        };
        updateNodePosition(draggedNode.id, newPos);
      }
    }
    
    if (connectionDrag) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnectionDrag({
          ...connectionDrag,
          pos: {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom,
          }
        });
      }
    }
  }, [isPanning, panStart, draggedNode, connectionDrag, pan, zoom, updateNodePosition]);

  const handleCanvasPointerUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNode(null);
    setConnectionDrag(null);
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      createProject('Mon Premier Jeu');
    }
  }, []);

  return (
    <div className="creator">
      <div className="creator__header glass-card">
        <div className="header-left">
          <h1 className="creator__title">Créateur de Jeux</h1>
          <div className="project-selector">
            {projects.map(p => (
              <button
                key={p.id}
                className={`project-tab ${p.id === activeProjectId ? 'active' : ''}`}
                onClick={() => setActiveProjectId(p.id)}
              >
                {p.name}
              </button>
            ))}
            <button 
              className="project-tab new-project"
              onClick={() => {
                const name = prompt('Nom du projet', 'Nouveau Jeu');
                if (name) createProject(name);
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        <div className="header-right">
          <button className={`btn-glass ${isPlaying ? 'active' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            <span>{isPlaying ? 'Pause' : 'Test'}</span>
          </button>
          <button className="btn-glass" onClick={() => alert('Sauvegarde...')}>
            <Save size={18} />
            <span>Sauvegarder</span>
          </button>
          <button className="btn-glass">
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="creator__main">
        <aside className="creator__sidebar glass-card">
          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Layers size={16} />
              <span>Nœuds</span>
            </h3>
            <div className="node-list">
              {NODE_TEMPLATES.map(template => (
                <button
                  key={template.kind}
                  className="node-template"
                  style={{ '--node-color': template.color } as React.CSSProperties}
                  onClick={() => addNode(template.kind)}
                >
                  <template.icon size={18} />
                  <span>{template.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Box size={16} />
              <span>Composants UI</span>
            </h3>
            <div className="node-list">
              {UI_TEMPLATES.map(template => (
                <button
                  key={template.kind}
                  className="node-template"
                  style={{ '--node-color': template.color } as React.CSSProperties}
                  onClick={() => addUIComponent(template.kind)}
                >
                  <template.icon size={18} />
                  <span>{template.title}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="creator__canvas-container">
          <div className="canvas-toolbar glass-card">
            <div className="toolbar-group">
              <button className={`btn-icon ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')}>
                <Grid size={18} />
              </button>
              <button className={`btn-icon ${viewMode === 'nodes' ? 'active' : ''}`} onClick={() => setViewMode('nodes')}>
                <Circle size={18} />
              </button>
              <button className={`btn-icon ${viewMode === 'ui' ? 'active' : ''}`} onClick={() => setViewMode('ui')}>
                <Type size={18} />
              </button>
            </div>
            
            <div className="toolbar-divider" />
            
            <div className="toolbar-group">
              <button className={`btn-icon ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <div className="zoom-control">
                <button className="btn-icon" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>-</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button className="btn-icon" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>+</button>
              </div>
            </div>
          </div>

          <div 
            className={`creator__canvas ${viewMode}`}
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onContextMenu={e => e.preventDefault()}
          >
            <div 
              className="canvas-bg"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                backgroundSize: showGrid ? '20px 20px' : '0',
              }}
            />

            {viewMode !== 'ui' && (
              <svg className="connections-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                {activeProject?.connections.map(conn => {
                  const fromNode = activeProject.nodes.find(n => n.id === conn.from);
                  const toNode = activeProject.nodes.find(n => n.id === conn.to);
                  if (!fromNode || !toNode) return null;

                  const x1 = fromNode.pos.x + 140;
                  const y1 = fromNode.pos.y + 50;
                  const x2 = toNode.pos.x;
                  const y2 = toNode.pos.y + 50;
                  const midX = (x1 + x2) / 2;

                  return (
                    <g key={conn.id}>
                      <path
                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                        className="connection-path"
                        strokeWidth="3"
                      />
                      <circle cx={x2} cy={y2} r="6" className="connection-endpoint" />
                    </g>
                  );
                })}

                {connectionDrag && (() => {
                  const fromNode = activeProject?.nodes.find(n => n.id === connectionDrag.fromId);
                  if (!fromNode) return null;
                  
                  const x1 = fromNode.pos.x + 140;
                  const y1 = fromNode.pos.y + 50;
                  const x2 = connectionDrag.pos.x;
                  const y2 = connectionDrag.pos.y;
                  const midX = (x1 + x2) / 2;

                  return (
                    <path
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                      className="connection-path preview"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                    />
                  );
                })()}
              </svg>
            )}

            {viewMode !== 'ui' && (
              <div 
                className="nodes-layer"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              >
                {activeProject?.nodes.map(node => {
                  const template = NODE_TEMPLATES.find(t => t.kind === node.kind);
                  const isSelected = node.id === selectedNodeId;
                  
                  return (
                    <div
                      key={node.id}
                      className={`node-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        left: node.pos.x,
                        top: node.pos.y,
                        '--node-color': template?.color,
                      } as React.CSSProperties}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('node-header')) {
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if (rect) {
                            setDraggedNode({
                              id: node.id,
                              offset: {
                                x: (e.clientX - rect.left - pan.x) / zoom - node.pos.x,
                                y: (e.clientY - rect.top - pan.y) / zoom - node.pos.y,
                              }
                            });
                          }
                        }
                      }}
                    >
                      <div className="node-header">
                        {template && <template.icon size={16} />}
                        <span className="node-name">{node.name}</span>
                      </div>
                      <div className="node-body">
                        {node.kind === 'action_fill' && (
                          <>
                            <div className="node-param">
                              <label>Couleur</label>
                              <input 
                                type="color" 
                                value={node.params.color as string || '#00d4ff'}
                                onChange={(e) => {
                                  setProjects(prev => prev.map(p => 
                                    p.id === activeProjectId 
                                      ? { 
                                          ...p, 
                                          nodes: p.nodes.map(n => 
                                            n.id === node.id 
                                              ? { ...n, params: { ...n.params, color: e.target.value } }
                                              : n
                                          ) 
                                        }
                                      : p
                                  ));
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="node-param">
                              <label>Intensité: {Math.round((node.params.intensity as number || 0.8) * 100)}%</label>
                              <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01"
                                value={node.params.intensity as number || 0.8}
                                onChange={(e) => {
                                  setProjects(prev => prev.map(p => 
                                    p.id === activeProjectId 
                                      ? { 
                                          ...p, 
                                          nodes: p.nodes.map(n => 
                                            n.id === node.id 
                                              ? { ...n, params: { ...n.params, intensity: parseFloat(e.target.value) } }
                                              : n
                                          ) 
                                        }
                                      : p
                                  ));
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </>
                        )}
                        {node.kind === 'wait' && (
                          <div className="node-param">
                            <label>Durée: {String(node.params.duration || 1)}s</label>
                            <input 
                              type="number" 
                              min="0.1" 
                              step="0.1"
                              value={node.params.duration as number || 1}
                              onChange={(e) => {
                                setProjects(prev => prev.map(p => 
                                  p.id === activeProjectId 
                                    ? { 
                                        ...p, 
                                        nodes: p.nodes.map(n => 
                                          n.id === node.id 
                                            ? { ...n, params: { ...n.params, duration: parseFloat(e.target.value) } }
                                            : n
                                        ) 
                                      }
                                    : p
                                ));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </div>
                      <div className="node-connectors">
                        {node.kind !== 'event_start' && (
                          <div className="connector input" title="Entrée" />
                        )}
                        <div 
                          className="connector output" 
                          title="Sortie"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setConnectionDrag({ fromId: node.id, pos: node.pos });
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            if (connectionDrag && connectionDrag.fromId !== node.id) {
                              connectNodes(connectionDrag.fromId, node.id);
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode !== 'nodes' && (
              <div 
                className="ui-layer"
                ref={uiCanvasRef}
              >
                {activeProject?.uiComponents.map(component => {
                  const template = UI_TEMPLATES.find(t => t.kind === component.kind);
                  const isSelected = component.id === selectedComponentId;
                  
                  return (
                    <div
                      key={component.id}
                      className={`ui-component ${isSelected ? 'selected' : ''}`}
                      style={{
                        left: component.pos.x,
                        top: component.pos.y,
                        width: component.size.x,
                        minHeight: component.size.y,
                        '--comp-color': template?.color,
                      } as React.CSSProperties}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedComponentId(component.id);
                        const rect = uiCanvasRef.current?.getBoundingClientRect();
                        if (rect) {
                          setDraggedComponent({
                            id: component.id,
                            offset: {
                              x: e.clientX - rect.left - component.pos.x,
                              y: e.clientY - rect.top - component.pos.y,
                            }
                          });
                        }
                      }}
                    >
                      {component.kind === 'button' && (
                        <button className="preview-button" style={{ background: component.props.color as string }}>
                          {component.props.label as string || 'Bouton'}
                        </button>
                      )}
                      {component.kind === 'slider' && (
                        <div className="preview-slider">
                          <label>{component.props.label as string || 'Valeur'}</label>
                          <input type="range" min={component.props.min as number} max={component.props.max as number} value={component.props.value as number} readOnly />
                          <span>{String(component.props.value)}</span>
                        </div>
                      )}
                      {component.kind === 'text' && (
                        <div className="preview-text" style={{ fontSize: component.props.size as number, color: component.props.color as string }}>
                          {component.props.content as string || 'Texte'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {showNodePalette && (
              <div 
                className="node-palette glass-card"
                style={{
                  left: pan.x + palettePos.x * zoom,
                  top: pan.y + palettePos.y * zoom,
                }}
              >
                <div className="palette-header">
                  <span>Ajouter un nœud</span>
                  <button onClick={() => setShowNodePalette(false)}>
                    <X size={16} />
                  </button>
                </div>
                <div className="palette-list">
                  {NODE_TEMPLATES.map(template => (
                    <button
                      key={template.kind}
                      className="palette-item"
                      onClick={() => {
                        addNode(template.kind, palettePos);
                        setShowNodePalette(false);
                      }}
                    >
                      <template.icon size={16} style={{ color: template.color }} />
                      <span>{template.title}</span>
                      <span className="palette-category">{template.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="creator__properties glass-card">
          {selectedNode && (
            <div className="properties-panel">
              <h3 className="properties-title">Propriétés du nœud</h3>
              <div className="property-group">
                <label>Nom</label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(e) => {
                    setProjects(prev => prev.map(p => 
                      p.id === activeProjectId 
                        ? { 
                            ...p, 
                            nodes: p.nodes.map(n => 
                              n.id === selectedNodeId 
                                ? { ...n, name: e.target.value }
                                : n
                            ) 
                          }
                        : p
                    ));
                  }}
                  className="property-input"
                />
              </div>
              <div className="property-group">
                <label>Type</label>
                <div className="property-value">{selectedNode.kind}</div>
              </div>
              <div className="property-group">
                <label>Actif</label>
                <input
                  type="checkbox"
                  checked={selectedNode.enabled}
                  onChange={(e) => {
                    setProjects(prev => prev.map(p => 
                      p.id === activeProjectId 
                        ? { 
                            ...p, 
                            nodes: p.nodes.map(n => 
                              n.id === selectedNodeId 
                                ? { ...n, enabled: e.target.checked }
                                : n
                            ) 
                          }
                        : p
                    ));
                  }}
                  className="property-checkbox"
                />
              </div>
            </div>
          )}
          
          {selectedComponent && (
            <div className="properties-panel">
              <h3 className="properties-title">Propriétés du composant</h3>
              <div className="property-group">
                <label>Nom</label>
                <input
                  type="text"
                  value={selectedComponent.name}
                  onChange={(e) => {
                    setProjects(prev => prev.map(p => 
                      p.id === activeProjectId 
                        ? { 
                            ...p, 
                            uiComponents: p.uiComponents.map(c => 
                              c.id === selectedComponentId 
                                ? { ...c, name: e.target.value }
                                : c
                            ) 
                          }
                        : p
                    ));
                  }}
                  className="property-input"
                />
              </div>
            </div>
          )}

          {!selectedNode && !selectedComponent && (
            <div className="properties-empty">
              <Maximize2 size={48} opacity={0.2} />
              <p>Sélectionnez un élément pour voir ses propriétés</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MousePointerClick, Type, SlidersHorizontal, Trophy, Timer, Flag, Palette, Gauge, Crosshair, Gamepad2, LayoutGrid, Plus, ZoomIn, ZoomOut, Maximize, Trash2, Layers, Square, Circle, Image as ImageIcon, Minus, Heart, Users, CircleDot, Award, MessageSquare, Smile, Activity, Copy, type LucideIcon } from 'lucide-react';

export type UICompKind = 'button' | 'label' | 'slider' | 'score_display' | 'timer_display' | 'round_badge' | 'color_swatch' | 'progress_bar' | 'cie_diagram' | 'dpad' | 'shape_rect' | 'shape_circle' | 'image' | 'divider' | 'plate_grid' | 'heart_life'
  | 'gauge_ring' | 'players_list' | 'turn_indicator' | 'leaderboard' | 'button_grid' | 'rgb_sliders' | 'sprite' | 'message_box' | 'title_banner';

/** Préréglages de touches pour le D-pad tactile (converties en KeyboardEvent). */
export type UIDpadPreset = 'arrows_space' | 'lr_space' | 'arrows' | 'lr';

export type UILayoutComponent = {
  id: string;
  kind: UICompKind;
  x: number; y: number;
  width: number; height: number;
  text?: string;
  varBind?: string;
  colorBind?: string;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  eventId?: string;
  min?: number; max?: number;
  // Diagramme CIE (cie_diagram)
  cieTargetX?: number;
  cieTargetY?: number;
  cieTolerance?: number;
  cieRandom?: boolean;
  points?: number;
  // Contrôles tactiles (dpad)
  dpadPreset?: UIDpadPreset;
  // Jeu Snake (snake_game)
  snakeSpeed?: number;
  // Image
  src?: string;
  // Sprite : nom d'icône Lucide
  icon?: string;
  // button_grid : nb de colonnes ; gauge/leaderboard : valeur indicative
  gridCols?: number;
  value?: number;
};

type Props = {
  components: UILayoutComponent[];
  onChange: (comps: UILayoutComponent[]) => void;
  gameVariables?: string[];
};

const CW = 860;
const CH = 500;
const SNAP = 8;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const uid  = () => Math.random().toString(36).slice(2, 10);

// Anti-superposition des composants UI : séparation AABB avec padding minimal.
// Le composant "ancré" (déposé/déplacé) reste, les autres s'écartent.
const UI_GAP = 12;
function resolveUiOverlaps(comps: UILayoutComponent[], anchorId?: string): UILayoutComponent[] {
  const items = comps.map(c => ({ ...c }));
  for (let iter = 0; iter < 18; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const dx = (a.x + a.width / 2) - (b.x + b.width / 2);
        const dy = (a.y + a.height / 2) - (b.y + b.height / 2);
        const penX = (a.width / 2 + b.width / 2 + UI_GAP) - Math.abs(dx);
        const penY = (a.height / 2 + b.height / 2 + UI_GAP) - Math.abs(dy);
        if (penX <= 0 || penY <= 0) continue;
        moved = true;
        if (penX < penY) {
          const push = (dx >= 0 ? 1 : -1) * penX;
          if (a.id === anchorId) b.x -= push; else if (b.id === anchorId) a.x += push; else { a.x += push / 2; b.x -= push / 2; }
        } else {
          const push = (dy >= 0 ? 1 : -1) * penY;
          if (a.id === anchorId) b.y -= push; else if (b.id === anchorId) a.y += push; else { a.y += push / 2; b.y -= push / 2; }
        }
      }
    }
    if (!moved) break;
  }
  return items.map(it => ({ ...it, x: Math.max(0, snap(it.x)), y: Math.max(0, snap(it.y)) }));
}

const PALETTE: { kind: UICompKind; label: string; Icon: LucideIcon; color: string; w: number; h: number }[] = [
  { kind: 'button',        label: 'Bouton',       Icon: MousePointerClick, color: '#4361ee', w: 160, h: 48 },
  { kind: 'label',         label: 'Texte',        Icon: Type,              color: '#64748b', w: 200, h: 36 },
  { kind: 'slider',        label: 'Slider',       Icon: SlidersHorizontal, color: '#0ea5e9', w: 240, h: 52 },
  { kind: 'score_display', label: 'Score',        Icon: Trophy,            color: '#f59e0b', w: 140, h: 64 },
  { kind: 'timer_display', label: 'Minuteur',     Icon: Timer,             color: '#ef4444', w: 140, h: 64 },
  { kind: 'round_badge',   label: 'Manche',       Icon: Flag,              color: '#8b5cf6', w: 160, h: 48 },
  { kind: 'color_swatch',  label: 'Couleur',      Icon: Palette,           color: '#ec4899', w: 80,  h: 80 },
  { kind: 'progress_bar',  label: 'Progression',  Icon: Gauge,             color: '#10b981', w: 280, h: 32 },
  { kind: 'cie_diagram',   label: 'Diagramme CIE', Icon: Crosshair,        color: '#06b6d4', w: 320, h: 300 },
  { kind: 'dpad',          label: 'Contrôles tactiles', Icon: Gamepad2,    color: '#6366f1', w: 300, h: 150 },
  { kind: 'plate_grid',    label: 'Plaques (42)', Icon: LayoutGrid,       color: '#06b6d4', w: 260, h: 300 },
  { kind: 'shape_rect',    label: 'Rectangle',    Icon: Square,           color: '#94a3b8', w: 160, h: 90 },
  { kind: 'shape_circle',  label: 'Cercle',       Icon: Circle,           color: '#94a3b8', w: 90,  h: 90 },
  { kind: 'image',         label: 'Image',        Icon: ImageIcon,        color: '#f59e0b', w: 160, h: 120 },
  { kind: 'divider',       label: 'Séparateur',   Icon: Minus,            color: '#cbd5e1', w: 240, h: 12 },
  { kind: 'heart_life',    label: 'Vies (cœurs)', Icon: Heart,            color: '#ef4444', w: 140, h: 40 },
  { kind: 'gauge_ring',    label: 'Jauge ronde',  Icon: Activity,         color: '#22d3ee', w: 120, h: 120 },
  { kind: 'players_list',  label: 'Joueurs',      Icon: Users,            color: '#818cf8', w: 200, h: 180 },
  { kind: 'turn_indicator',label: 'Tour de jeu',  Icon: CircleDot,        color: '#06d6a0', w: 220, h: 56 },
  { kind: 'leaderboard',   label: 'Classement',   Icon: Award,            color: '#f59e0b', w: 220, h: 200 },
  { kind: 'button_grid',   label: 'Grille boutons', Icon: LayoutGrid,     color: '#a855f7', w: 200, h: 200 },
  { kind: 'rgb_sliders',   label: 'Sliders RGB',  Icon: SlidersHorizontal, color: '#ec4899', w: 240, h: 130 },
  { kind: 'sprite',        label: 'Sprite (icône)', Icon: Smile,          color: '#f97316', w: 80,  h: 80 },
  { kind: 'message_box',   label: 'Message',      Icon: MessageSquare,    color: '#38bdf8', w: 280, h: 90 },
  { kind: 'title_banner',  label: 'Bandeau titre', Icon: Type,            color: '#94a3b8', w: 320, h: 60 },
];

export const SPRITE_ICONS: Record<string, LucideIcon> = {
  Smile, Heart, Trophy, Award, Flag, Crosshair, Gamepad2, Users, CircleDot, Activity, Palette, Timer, Gauge,
};

function defaultText(k: UICompKind) {
  return k === 'button' ? 'Soumettre' : k === 'label' ? 'Texte' : k === 'score_display' ? 'Score' : k === 'timer_display' ? 'Temps' : k === 'round_badge' ? 'Manche' : '';
}

function Preview({ c }: { c: UILayoutComponent }) {
  // Le wrapper positionne et dimensionne déjà l'élément ; l'aperçu doit le REMPLIR
  // (inset:0), pas se repositionner à (x,y) — sinon il se décale de son contour.
  const base: React.CSSProperties = { position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box', overflow:'hidden', pointerEvents:'none', userSelect:'none', fontSize: c.fontSize ?? 14, color: c.textColor ?? '#1a1d2e' };
  switch (c.kind) {
    case 'button':        return <div style={{ ...base, background: c.bgColor ?? '#4361ee', color: c.textColor ?? '#fff', borderRadius: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(67,97,238,0.28)' }}>{c.text || 'Bouton'}</div>;
    case 'label':         return <div style={{ ...base, justifyContent: 'flex-start', paddingLeft: 4, fontWeight: 600 }}>{c.text || 'Texte'}</div>;
    case 'slider':        return <div style={{ ...base, flexDirection:'column', gap:4, padding:'0 10px' }}><span style={{ fontSize:11, fontWeight:700, alignSelf:'flex-start' }}>{c.text||'Slider'}</span><input type="range" style={{ width:'100%', pointerEvents:'none' }} readOnly /></div>;
    case 'score_display': return <div style={{ ...base, flexDirection:'column', background:'rgba(255,255,255,0.85)', borderRadius:14, border:'1px solid rgba(67,97,238,0.2)' }}><span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.text||'Score'}</span><span style={{ fontSize:26, fontWeight:900, color:'#4361ee', lineHeight:1 }}>0</span></div>;
    case 'timer_display': return <div style={{ ...base, flexDirection:'column', background:'rgba(255,255,255,0.85)', borderRadius:14, border:'1px solid rgba(239,68,68,0.2)' }}><span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>Temps</span><span style={{ fontSize:26, fontWeight:900, color:'#ef4444', lineHeight:1 }}>30s</span></div>;
    case 'round_badge':   return <div style={{ ...base, background:'rgba(67,97,238,0.09)', borderRadius:12, fontWeight:800, color:'#4361ee', fontSize:14 }}>Manche 1/5</div>;
    case 'color_swatch':  return <div style={{ ...base, borderRadius:12, background: c.bgColor ?? '#ff2aa6', boxShadow: '0 0 20px ' + (c.bgColor ?? '#ff2aa6') }} />;
    case 'progress_bar':  return <div style={{ ...base, background:'rgba(0,0,0,0.07)', borderRadius:999, overflow:'hidden', padding:0 }}><div style={{ width:'55%', height:'100%', background:'linear-gradient(90deg,#059669,#06d6a0)', borderRadius:999 }} /></div>;
    case 'shape_rect':    return <div style={{ ...base, background: c.bgColor ?? '#334155', borderRadius: 12 }} />;
    case 'shape_circle':  return <div style={{ ...base, background: c.bgColor ?? '#334155', borderRadius: '50%' }} />;
    case 'divider':       return <div style={{ ...base, padding:0 }}><div style={{ width:'100%', height:2, borderRadius:2, background: c.bgColor ?? 'rgba(255,255,255,0.4)' }} /></div>;
    case 'image':         return <div style={{ ...base, borderRadius:12, overflow:'hidden', background:'#11151f', border:'1px dashed rgba(255,255,255,0.18)' }}>{c.src ? <img src={c.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, color:'rgba(255,255,255,0.35)', fontSize:10 }}><ImageIcon size={20} />Image</span>}</div>;
    case 'heart_life':    return <div style={{ ...base, gap:4, color:'#ef4444' }}>{[0,1,2].map(i => <Heart key={i} size={Math.min(22, c.height-12)} fill={i<2?'#ef4444':'none'} />)}</div>;
    case 'gauge_ring': { const v = Math.max(0, Math.min(100, c.value ?? 70)); const acc = c.bgColor ?? '#22d3ee'; const d = Math.max(28, Math.min(c.width, c.height) - 8); return <div style={{ ...base }}><div style={{ width:d, height:d, borderRadius:'50%', background:`conic-gradient(${acc} ${v*3.6}deg, rgba(255,255,255,0.08) 0)`, display:'grid', placeItems:'center' }}><div style={{ width:'66%', height:'66%', borderRadius:'50%', background:'#0d1119', display:'grid', placeItems:'center', fontSize:14, fontWeight:800, color:acc }}>{v}%</div></div></div>; }
    case 'turn_indicator': return <div style={{ ...base, justifyContent:'flex-start', gap:8, padding:'0 12px', background:'#141a26', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', color:'#e8eaf0' }}><span style={{ width:10, height:10, borderRadius:'50%', background: c.bgColor ?? '#06d6a0', boxShadow:`0 0 8px ${c.bgColor ?? '#06d6a0'}` }} /><span style={{ fontSize:13, fontWeight:700 }}>{c.text || 'À ton tour'}</span></div>;
    case 'players_list': return <div style={{ ...base, flexDirection:'column', alignItems:'stretch', justifyContent:'flex-start', gap:6, padding:9, background:'#141a26', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)' }}>{['Joueur 1','Joueur 2','Joueur 3'].map((p,i)=><div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#cdd3e0' }}><span style={{ width:8, height:8, borderRadius:'50%', background:`hsl(${i*100} 70% 55%)` }} />{p}</div>)}</div>;
    case 'leaderboard': return <div style={{ ...base, flexDirection:'column', alignItems:'stretch', justifyContent:'flex-start', gap:5, padding:9, background:'#141a26', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)' }}>{[['1','Lea','120'],['2','Tom','95'],['3','Sam','80']].map((r,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: i===0?'#f59e0b':'#cdd3e0', fontWeight: i===0?800:600 }}><span>{r[0]}. {r[1]}</span><span>{r[2]}</span></div>)}</div>;
    case 'button_grid': return <div style={{ ...base, padding:6, background:'#0d1119', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)' }}><div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gridTemplateRows:'repeat(4,1fr)', gap:5, width:'100%', height:'100%' }}>{Array.from({length:16},(_,i)=><span key={i} style={{ borderRadius:7, background:['#ef4444','#22c55e','#3b82f6','#eab308'][i%4], opacity:0.9 }} />)}</div></div>;
    case 'rgb_sliders': return <div style={{ ...base, flexDirection:'column', justifyContent:'center', gap:8, padding:'8px 12px', background:'#141a26', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)' }}>{['#ef4444','#22c55e','#3b82f6'].map((col,i)=><div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ width:14, height:14, borderRadius:4, background:col, flexShrink:0 }} /><div style={{ flex:1, height:5, borderRadius:3, background:'rgba(255,255,255,0.1)' }}><div style={{ width:`${[70,40,90][i]}%`, height:'100%', borderRadius:3, background:col }} /></div></div>)}</div>;
    case 'sprite': { const Ico = SPRITE_ICONS[c.icon ?? 'Smile'] ?? Smile; return <div style={{ ...base }}><Ico size={Math.max(16, Math.min(c.width, c.height) - 14)} color={c.bgColor ?? '#f97316'} /></div>; }
    case 'message_box': return <div style={{ ...base, flexDirection:'column', alignItems:'flex-start', justifyContent:'center', gap:4, padding:'10px 13px', background:'#141a26', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', color:'#cdd3e0' }}><span style={{ fontSize:11, fontWeight:800, color: c.bgColor ?? '#38bdf8' }}>Message</span><span style={{ fontSize:12.5, lineHeight:1.4 }}>{c.text || 'Bravo, niveau réussi !'}</span></div>;
    case 'title_banner': return <div style={{ ...base, background:'linear-gradient(135deg,#1a2030,#0d1119)', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:900, fontSize:Math.min(20, c.height/3), letterSpacing:'-0.02em' }}>{c.text || 'TITRE DU JEU'}</div>;
    case 'plate_grid':    return <div style={{ ...base, padding:6, background:'#0d1119', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gridTemplateRows:'repeat(7,1fr)', gap:3, width:'100%', height:'100%' }}>
        {Array.from({length:42},(_,i)=><span key={i} style={{ borderRadius:3, background:`hsl(${(i*8.5)%360} 70% 55%)`, opacity:0.85 }} />)}
      </div>
    </div>;
    case 'cie_diagram':   return <div style={{ ...base, flexDirection:'column', gap:5, background:'#fbfbfd', borderRadius:12, border:'1px solid rgba(0,0,0,0.1)', color:'#5a6072' }}>
      <svg viewBox="0 0 60 52" width={Math.max(28, Math.min(c.width-16, c.height-30))} height={Math.max(24, Math.min(c.width-16, c.height-30))} style={{ maxWidth:'78%' }}>
        <path d="M9,47 C2,30 13,7 30,5 C47,8 57,30 51,47 Z" fill="rgba(120,140,220,0.14)" stroke="rgba(40,46,70,0.5)" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="33" cy="22" r="3.2" fill="#ff3b6e" stroke="#fff" strokeWidth="1" />
      </svg>
      <span style={{ fontSize:10, fontWeight:700 }}>Diagramme CIE 1931</span>
    </div>;
    case 'dpad': {
      const k: React.CSSProperties = { background:'rgba(28,33,46,0.9)', borderRadius:5, border:'1px solid rgba(255,255,255,0.15)' };
      return <div style={{ ...base, gap:12, background:'rgba(20,24,34,0.06)', borderRadius:12, border:'1px dashed rgba(0,0,0,0.12)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,18px)', gridTemplateRows:'repeat(3,18px)', gap:3 }}>
          <span /><span style={k} /><span />
          <span style={k} /><span /><span style={k} />
          <span /><span style={k} /><span />
        </div>
        <div style={{ ...k, width:46, height:30, borderRadius:7, background:'#4361ee' }} />
      </div>;
    }
  }
}

export default function UIDesigner({ components, onChange, gameVariables = [] }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ id:string; ox:number; oy:number; cx:number; cy:number } | null>(null);
  const componentsRef = useRef(components); componentsRef.current = components;
  const selRef = useRef(sel); selRef.current = sel;
  const selComp = components.find(c => c.id === sel) ?? null;

  const add = useCallback((p: typeof PALETTE[0]) => {
    const c: UILayoutComponent = { id: uid(), kind: p.kind, x: snap(CW/2 - p.w/2), y: snap(CH/2 - p.h/2), width: p.w, height: p.h, text: defaultText(p.kind), bgColor: p.kind === 'button' ? '#4361ee' : undefined, textColor: p.kind === 'button' ? '#ffffff' : '#1a1d2e', fontSize: 14,
      ...(p.kind === 'cie_diagram' ? { cieRandom: true, cieTargetX: 0.3127, cieTargetY: 0.3290, cieTolerance: 8, points: 1000 } : {}),
      ...(p.kind === 'dpad' ? { dpadPreset: 'arrows_space' as UIDpadPreset } : {}) };
    onChange(resolveUiOverlaps([...components, c], c.id)); setSel(c.id);
  }, [components, onChange]);

  const upd = useCallback((id: string, patch: Partial<UILayoutComponent>) => onChange(components.map(c => c.id === id ? { ...c, ...patch } : c)), [components, onChange]);
  const del = useCallback((id: string) => { onChange(components.filter(c => c.id !== id)); if (sel === id) setSel(null); }, [components, onChange, sel]);
  const dup = useCallback((id: string) => {
    const src = componentsRef.current.find(c => c.id === id);
    if (!src) return;
    const clone: UILayoutComponent = { ...src, id: uid(), x: snap(Math.min(CW - src.width, src.x + 16)), y: snap(Math.min(CH - src.height, src.y + 16)) };
    onChange(resolveUiOverlaps([...componentsRef.current, clone], clone.id));
    setSel(clone.id);
  }, [onChange]);

  // Raccourcis clavier : Suppr = supprimer, Ctrl+D = dupliquer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const id = selRef.current;
      if (!id) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(id); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); dup(id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [del, dup]);

  function onDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setSel(id);
    const comp = components.find(c => c.id === id)!;
    dragRef.current = { id, ox: e.clientX, oy: e.clientY, cx: comp.x, cy: comp.y };
    const mv = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.ox) / zoom;
      const dy = (ev.clientY - dragRef.current.oy) / zoom;
      onChange(components.map(c => c.id === id ? { ...c, x: snap(Math.max(0, Math.min(CW-20, dragRef.current!.cx+dx))), y: snap(Math.max(0, Math.min(CH-16, dragRef.current!.cy+dy))) } : c));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); onChange(resolveUiOverlaps(componentsRef.current, id)); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  }

  const lbl: React.CSSProperties = { fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#888', marginBottom:4, display:'block' };
  const inp: React.CSSProperties = { width:'100%', padding:'6px 9px', borderRadius:8, border:'1px solid rgba(0,0,0,0.1)', background:'rgba(255,255,255,0.9)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const };

  return (
    <div style={{ display:'flex', height:'100%', minHeight:0, fontFamily:'inherit' }}>
      {/* Palette */}
      <div style={{ width:158, background:'linear-gradient(180deg,#fbfbfe,#f4f5fa)', borderRight:'1px solid rgba(0,0,0,0.07)', padding:'12px 9px', display:'flex', flexDirection:'column', gap:6, overflowY:'auto', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:800, color:'#9aa0ad', textTransform:'uppercase', letterSpacing:'0.08em', paddingBottom:8, borderBottom:'1px solid rgba(0,0,0,0.06)', marginBottom:2 }}>
          <Layers size={12} /> Composants
        </div>
        {PALETTE.map(p => (
          <button key={p.kind} onClick={() => add(p)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${p.color}66`; e.currentTarget.style.background = `${p.color}0d`; e.currentTarget.style.transform = 'translateX(2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.transform = 'none'; }}
            style={{ padding:'7px 8px', borderRadius:11, border:'1px solid rgba(0,0,0,0.08)', background:'rgba(255,255,255,0.85)', cursor:'pointer', textAlign:'left', fontSize:12, fontWeight:600, fontFamily:'inherit', color:'#3a3f4b', display:'flex', alignItems:'center', gap:8, transition:'all 130ms' }}>
            <span style={{ width:26, height:26, borderRadius:8, flexShrink:0, display:'grid', placeItems:'center', background:`${p.color}1a`, color:p.color }}><p.Icon size={15} /></span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex:1, background:'repeating-linear-gradient(0deg,transparent,transparent 31px,rgba(67,97,238,0.05) 32px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(67,97,238,0.05) 32px)', overflow:'hidden', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setSel(null)}>
        <div style={{ width:CW, height:CH, background:'rgba(255,255,255,0.94)', borderRadius:16, border:'1px solid rgba(0,0,0,0.09)', boxShadow:'0 8px 40px rgba(0,0,0,0.09)', position:'relative', transform:`scale(${zoom})`, transformOrigin:'center', flexShrink:0 }}>
          {components.map(c => (
            <div key={c.id} style={{ position:'absolute', left:c.x, top:c.y, width:c.width, height:c.height, cursor:'move', outline: sel===c.id ? '2.5px solid #4361ee' : 'none', outlineOffset:2, borderRadius:4, zIndex: sel===c.id ? 10 : 1 }} onMouseDown={e => onDown(e, c.id)} onClick={e => { e.stopPropagation(); setSel(c.id); }}>
              <Preview c={c} />
              {sel===c.id && <>
                <button onClick={e => { e.stopPropagation(); dup(c.id); }} title="Dupliquer" style={{ position:'absolute', top:-26, right:26, width:22, height:22, borderRadius:7, border:'none', background:'#4361ee', color:'#fff', cursor:'pointer', display:'grid', placeItems:'center', boxShadow:'0 2px 8px rgba(67,97,238,0.4)' }}><Copy size={11} /></button>
                <button onClick={e => { e.stopPropagation(); del(c.id); }} title="Supprimer" style={{ position:'absolute', top:-26, right:0, width:22, height:22, borderRadius:7, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', display:'grid', placeItems:'center', boxShadow:'0 2px 8px rgba(220,38,38,0.4)' }}><Trash2 size={12} /></button>
              </>}
            </div>
          ))}
          {components.length === 0 && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'rgba(0,0,0,0.22)', pointerEvents:'none' }}><Plus size={42} strokeWidth={1.5} /><span style={{ fontSize:13, fontWeight:600 }}>Ajoutez des composants depuis la palette</span></div>}
        </div>
        {/* Zoom */}
        <div style={{ position:'absolute', bottom:14, right:14, display:'flex', alignItems:'center', gap:3, background:'rgba(255,255,255,0.92)', backdropFilter:'blur(10px)', borderRadius:11, padding:'4px 5px', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', border:'1px solid rgba(0,0,0,0.05)' }}>
          {[
            { Icon: ZoomOut, fn: () => setZoom(z => Math.max(0.4, +(z-0.1).toFixed(2))), title: 'Dézoomer' },
            null,
            { Icon: ZoomIn, fn: () => setZoom(z => Math.min(1.5, +(z+0.1).toFixed(2))), title: 'Zoomer' },
            { Icon: Maximize, fn: () => setZoom(1), title: '100%' },
          ].map((b, i) => b === null
            ? <span key={i} style={{ fontSize:11, fontWeight:800, color:'#555', minWidth:38, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
            : <button key={i} title={b.title} onClick={b.fn} style={{ width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'grid', placeItems:'center', color:'#475569' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}><b.Icon size={15} /></button>
          )}
        </div>
      </div>

      {/* Props panel */}
      <div style={{ width:210, background:'rgba(255,255,255,0.7)', borderLeft:'1px solid rgba(0,0,0,0.08)', padding:'12px 11px', display:'flex', flexDirection:'column', gap:11, overflowY:'auto', flexShrink:0 }}>
        {!selComp ? <div style={{ color:'#ccc', fontSize:13, paddingTop:24, textAlign:'center' }}>Sélectionnez<br/>un composant</div> : <>
          <div style={{ fontWeight:800, fontSize:13, color:'#1a1d2e' }}>Propriétés</div>
          {['button','label','score_display','timer_display','round_badge','title_banner','message_box','turn_indicator'].includes(selComp.kind) && <label><span style={lbl}>Texte</span><input style={inp} value={selComp.text??''} onChange={e=>upd(selComp.id,{text:e.target.value})} /></label>}
          {selComp.kind==='sprite' && <label><span style={lbl}>Icône</span>
            <select style={inp} value={selComp.icon ?? 'Smile'} onChange={e=>upd(selComp.id,{icon:e.target.value})}>
              {Object.keys(SPRITE_ICONS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>}
          {(selComp.kind==='gauge_ring' || selComp.kind==='leaderboard') && <label><span style={lbl}>Valeur (aperçu)</span><input type="number" style={inp} value={selComp.value ?? 70} onChange={e=>upd(selComp.id,{value:Number(e.target.value)})} /></label>}
          {selComp.kind==='button_grid' && <label><span style={lbl}>Colonnes</span><input type="number" min="2" max="6" style={inp} value={selComp.gridCols ?? 4} onChange={e=>upd(selComp.id,{gridCols:Math.max(2,Math.min(6,Number(e.target.value)))})} /></label>}
          <label><span style={lbl}>Variable liée</span>
            <input style={inp} list="vl" value={selComp.varBind??''} onChange={e=>upd(selComp.id,{varBind:e.target.value})} placeholder="ex: score" />
            <datalist id="vl">{gameVariables.map(v=><option key={v} value={v}/>)}</datalist>
          </label>
          {selComp.kind==='color_swatch' && <label><span style={lbl}>Variable couleur</span><input style={inp} value={selComp.colorBind??''} onChange={e=>upd(selComp.id,{colorBind:e.target.value})} placeholder="ex: target" /></label>}
          {['button','button_grid','sprite','color_swatch'].includes(selComp.kind) && <label><span style={lbl}>Événement (au clic)</span><input style={inp} value={selComp.eventId??''} onChange={e=>upd(selComp.id,{eventId:e.target.value})} placeholder="ex: submit" /></label>}
          {selComp.kind==='cie_diagram' && <>
            <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
              <input type="checkbox" checked={!!selComp.cieRandom} onChange={e=>upd(selComp.id,{cieRandom:e.target.checked})} />
              <span style={{ fontSize:12, fontWeight:600, color:'#1a1d2e' }}>Cible aléatoire (+ bouton)</span>
            </label>
            {!selComp.cieRandom && <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              <label><span style={lbl}>Cible x</span><input type="number" step="0.001" style={inp} value={selComp.cieTargetX ?? 0.3127} onChange={e=>upd(selComp.id,{cieTargetX:Number(e.target.value)})} /></label>
              <label><span style={lbl}>Cible y</span><input type="number" step="0.001" style={inp} value={selComp.cieTargetY ?? 0.3290} onChange={e=>upd(selComp.id,{cieTargetY:Number(e.target.value)})} /></label>
            </div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              <label><span style={lbl}>Tolérance ΔE</span><input type="number" step="0.5" style={inp} value={selComp.cieTolerance ?? 8} onChange={e=>upd(selComp.id,{cieTolerance:Number(e.target.value)})} /></label>
              <label><span style={lbl}>Points</span><input type="number" style={inp} value={selComp.points ?? 1000} onChange={e=>upd(selComp.id,{points:Number(e.target.value)})} /></label>
            </div>
          </>}
          {selComp.kind==='dpad' && <label><span style={lbl}>Touches émises</span>
            <select style={inp} value={selComp.dpadPreset ?? 'arrows_space'} onChange={e=>upd(selComp.id,{dpadPreset:e.target.value as UIDpadPreset})}>
              <option value="arrows_space">Flèches + Espace</option>
              <option value="arrows">Flèches seules</option>
              <option value="lr_space">Gauche / Droite + Espace</option>
              <option value="lr">Gauche / Droite</option>
            </select>
          </label>}
          {selComp.kind==='image' && <label><span style={lbl}>Source (URL)</span><input style={inp} value={selComp.src??''} onChange={e=>upd(selComp.id,{src:e.target.value})} placeholder="https://..." /></label>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            <label><span style={lbl}>L</span><input type="number" style={inp} value={selComp.x} onChange={e=>upd(selComp.id,{x:snap(Number(e.target.value))})} /></label>
            <label><span style={lbl}>T</span><input type="number" style={inp} value={selComp.y} onChange={e=>upd(selComp.id,{y:snap(Number(e.target.value))})} /></label>
            <label><span style={lbl}>Larg.</span><input type="number" style={inp} value={selComp.width} onChange={e=>upd(selComp.id,{width:Math.max(20,Number(e.target.value))})} /></label>
            <label><span style={lbl}>Haut.</span><input type="number" style={inp} value={selComp.height} onChange={e=>upd(selComp.id,{height:Math.max(14,Number(e.target.value))})} /></label>
          </div>
          <label><span style={lbl}>Fond</span><input type="color" style={{ ...inp, padding:2, height:34, cursor:'pointer' }} value={selComp.bgColor??'#4361ee'} onChange={e=>upd(selComp.id,{bgColor:e.target.value})} /></label>
          <label><span style={lbl}>Texte</span><input type="color" style={{ ...inp, padding:2, height:34, cursor:'pointer' }} value={selComp.textColor??'#1a1d2e'} onChange={e=>upd(selComp.id,{textColor:e.target.value})} /></label>
          <div style={{ display:'flex', gap:6, marginTop:4 }}>
            <button style={{ flex:1, padding:'7px 8px', borderRadius:9, border:'1px solid rgba(67,97,238,0.22)', background:'rgba(67,97,238,0.06)', color:'#4361ee', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }} onClick={()=>dup(selComp.id)}><Copy size={12}/> Dupliquer</button>
            <button style={{ flex:1, padding:'7px 8px', borderRadius:9, border:'1px solid rgba(220,38,38,0.22)', background:'rgba(220,38,38,0.06)', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }} onClick={()=>del(selComp.id)}><Trash2 size={12}/> Supprimer</button>
          </div>
        </>}
      </div>
    </div>
  );
}

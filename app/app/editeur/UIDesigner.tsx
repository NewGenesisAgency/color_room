'use client';
import { useCallback, useRef, useState } from 'react';

export type UICompKind = 'button' | 'label' | 'slider' | 'score_display' | 'timer_display' | 'round_badge' | 'color_swatch' | 'progress_bar' | 'cie_diagram' | 'dpad';

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

const PALETTE = [
  { kind: 'button'       as UICompKind, label: 'Bouton',      icon: '', w: 160, h: 48 },
  { kind: 'label'        as UICompKind, label: 'Texte',        icon: '',  w: 200, h: 36 },
  { kind: 'slider'       as UICompKind, label: 'Slider',       icon: '',  w: 240, h: 52 },
  { kind: 'score_display'as UICompKind, label: 'Score',        icon: '', w: 140, h: 64 },
  { kind: 'timer_display'as UICompKind, label: 'Minuteur',     icon: '',  w: 140, h: 64 },
  { kind: 'round_badge'  as UICompKind, label: 'Manche',       icon: '', w: 160, h: 48 },
  { kind: 'color_swatch' as UICompKind, label: 'Couleur',      icon: '', w: 80,  h: 80 },
  { kind: 'progress_bar' as UICompKind, label: 'Progression',  icon: '', w: 280, h: 32 },
  { kind: 'cie_diagram'  as UICompKind, label: 'Diagramme CIE', icon: '', w: 320, h: 300 },
  { kind: 'dpad'         as UICompKind, label: 'Contrôles tactiles', icon: '', w: 300, h: 150 },
];

function defaultText(k: UICompKind) {
  return k === 'button' ? 'Soumettre' : k === 'label' ? 'Texte' : k === 'score_display' ? 'Score' : k === 'timer_display' ? 'Temps' : k === 'round_badge' ? 'Manche' : '';
}

function Preview({ c }: { c: UILayoutComponent }) {
  const base: React.CSSProperties = { position:'absolute', left:c.x, top:c.y, width:c.width, height:c.height, display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box', overflow:'hidden', pointerEvents:'none', userSelect:'none', fontSize: c.fontSize ?? 14, color: c.textColor ?? '#1a1d2e' };
  switch (c.kind) {
    case 'button':        return <div style={{ ...base, background: c.bgColor ?? '#4361ee', color: c.textColor ?? '#fff', borderRadius: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(67,97,238,0.28)' }}>{c.text || 'Bouton'}</div>;
    case 'label':         return <div style={{ ...base, justifyContent: 'flex-start', paddingLeft: 4, fontWeight: 600 }}>{c.text || 'Texte'}</div>;
    case 'slider':        return <div style={{ ...base, flexDirection:'column', gap:4, padding:'0 10px' }}><span style={{ fontSize:11, fontWeight:700, alignSelf:'flex-start' }}>{c.text||'Slider'}</span><input type="range" style={{ width:'100%', pointerEvents:'none' }} readOnly /></div>;
    case 'score_display': return <div style={{ ...base, flexDirection:'column', background:'rgba(255,255,255,0.85)', borderRadius:14, border:'1px solid rgba(67,97,238,0.2)' }}><span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.text||'Score'}</span><span style={{ fontSize:26, fontWeight:900, color:'#4361ee', lineHeight:1 }}>0</span></div>;
    case 'timer_display': return <div style={{ ...base, flexDirection:'column', background:'rgba(255,255,255,0.85)', borderRadius:14, border:'1px solid rgba(239,68,68,0.2)' }}><span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>Temps</span><span style={{ fontSize:26, fontWeight:900, color:'#ef4444', lineHeight:1 }}>30s</span></div>;
    case 'round_badge':   return <div style={{ ...base, background:'rgba(67,97,238,0.09)', borderRadius:12, fontWeight:800, color:'#4361ee', fontSize:14 }}>Manche 1/5</div>;
    case 'color_swatch':  return <div style={{ ...base, borderRadius:12, background: c.bgColor ?? '#ff2aa6', boxShadow: '0 0 20px ' + (c.bgColor ?? '#ff2aa6') }} />;
    case 'progress_bar':  return <div style={{ ...base, background:'rgba(0,0,0,0.07)', borderRadius:999, overflow:'hidden', padding:0 }}><div style={{ width:'55%', height:'100%', background:'linear-gradient(90deg,#059669,#06d6a0)', borderRadius:999 }} /></div>;
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
  const selComp = components.find(c => c.id === sel) ?? null;

  const add = useCallback((p: typeof PALETTE[0]) => {
    const c: UILayoutComponent = { id: uid(), kind: p.kind, x: snap(CW/2 - p.w/2), y: snap(CH/2 - p.h/2), width: p.w, height: p.h, text: defaultText(p.kind), bgColor: p.kind === 'button' ? '#4361ee' : undefined, textColor: p.kind === 'button' ? '#ffffff' : '#1a1d2e', fontSize: 14,
      ...(p.kind === 'cie_diagram' ? { cieRandom: true, cieTargetX: 0.3127, cieTargetY: 0.3290, cieTolerance: 8, points: 1000 } : {}),
      ...(p.kind === 'dpad' ? { dpadPreset: 'arrows_space' as UIDpadPreset } : {}) };
    onChange([...components, c]); setSel(c.id);
  }, [components, onChange]);

  const upd = useCallback((id: string, patch: Partial<UILayoutComponent>) => onChange(components.map(c => c.id === id ? { ...c, ...patch } : c)), [components, onChange]);
  const del = useCallback((id: string) => { onChange(components.filter(c => c.id !== id)); if (sel === id) setSel(null); }, [components, onChange, sel]);

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
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  }

  const lbl: React.CSSProperties = { fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#888', marginBottom:4, display:'block' };
  const inp: React.CSSProperties = { width:'100%', padding:'6px 9px', borderRadius:8, border:'1px solid rgba(0,0,0,0.1)', background:'rgba(255,255,255,0.9)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const };

  return (
    <div style={{ display:'flex', height:'100%', minHeight:0, fontFamily:'inherit' }}>
      {/* Palette */}
      <div style={{ width:128, background:'rgba(255,255,255,0.6)', borderRight:'1px solid rgba(0,0,0,0.08)', padding:'10px 7px', display:'flex', flexDirection:'column', gap:5, overflowY:'auto', flexShrink:0 }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.07em', paddingBottom:6, borderBottom:'1px solid rgba(0,0,0,0.06)', marginBottom:2 }}>Composants</div>
        {PALETTE.map(p => <button key={p.kind} onClick={() => add(p)} style={{ padding:'7px 9px', borderRadius:9, border:'1px solid rgba(0,0,0,0.08)', background:'rgba(255,255,255,0.75)', cursor:'pointer', textAlign:'left', fontSize:12, fontWeight:600, fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, transition:'all 120ms' }}>{p.icon} {p.label}</button>)}
      </div>

      {/* Canvas */}
      <div style={{ flex:1, background:'repeating-linear-gradient(0deg,transparent,transparent 31px,rgba(67,97,238,0.05) 32px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(67,97,238,0.05) 32px)', overflow:'hidden', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setSel(null)}>
        <div style={{ width:CW, height:CH, background:'rgba(255,255,255,0.94)', borderRadius:16, border:'1px solid rgba(0,0,0,0.09)', boxShadow:'0 8px 40px rgba(0,0,0,0.09)', position:'relative', transform:`scale(${zoom})`, transformOrigin:'center', flexShrink:0 }}>
          {components.map(c => (
            <div key={c.id} style={{ position:'absolute', left:c.x, top:c.y, width:c.width, height:c.height, cursor:'move', outline: sel===c.id ? '2.5px solid #4361ee' : 'none', outlineOffset:2, borderRadius:4, zIndex: sel===c.id ? 10 : 1 }} onMouseDown={e => onDown(e, c.id)}>
              <Preview c={c} />
              {sel===c.id && <button onClick={e => { e.stopPropagation(); del(c.id); }} style={{ position:'absolute', top:-20, right:0, padding:'1px 6px', borderRadius:5, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>✕</button>}
            </div>
          ))}
          {components.length === 0 && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'rgba(0,0,0,0.2)', pointerEvents:'none' }}><span style={{ fontSize:40 }}></span><span style={{ fontSize:13, fontWeight:600 }}>Ajoutez des composants depuis la palette</span></div>}
        </div>
        {/* Zoom */}
        <div style={{ position:'absolute', bottom:12, right:12, display:'flex', gap:5, background:'rgba(255,255,255,0.9)', borderRadius:9, padding:'3px 7px', boxShadow:'0 2px 8px rgba(0,0,0,0.09)' }}>
          <button style={{ padding:'4px 9px', borderRadius:7, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:11, fontWeight:700 }} onClick={() => setZoom(z => Math.max(0.4, z-0.1))}>−</button>
          <span style={{ fontSize:11, fontWeight:700, display:'flex', alignItems:'center', minWidth:38, justifyContent:'center' }}>{Math.round(zoom*100)}%</span>
          <button style={{ padding:'4px 9px', borderRadius:7, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:11, fontWeight:700 }} onClick={() => setZoom(z => Math.min(1.5, z+0.1))}>+</button>
          <button style={{ padding:'4px 9px', borderRadius:7, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:11, fontWeight:700 }} onClick={() => setZoom(1)}>1:1</button>
        </div>
      </div>

      {/* Props panel */}
      <div style={{ width:210, background:'rgba(255,255,255,0.7)', borderLeft:'1px solid rgba(0,0,0,0.08)', padding:'12px 11px', display:'flex', flexDirection:'column', gap:11, overflowY:'auto', flexShrink:0 }}>
        {!selComp ? <div style={{ color:'#ccc', fontSize:13, paddingTop:24, textAlign:'center' }}>Sélectionnez<br/>un composant</div> : <>
          <div style={{ fontWeight:800, fontSize:13, color:'#1a1d2e' }}>Propriétés</div>
          {['button','label','score_display','timer_display','round_badge'].includes(selComp.kind) && <label><span style={lbl}>Texte</span><input style={inp} value={selComp.text??''} onChange={e=>upd(selComp.id,{text:e.target.value})} /></label>}
          <label><span style={lbl}>Variable liée</span>
            <input style={inp} list="vl" value={selComp.varBind??''} onChange={e=>upd(selComp.id,{varBind:e.target.value})} placeholder="ex: score" />
            <datalist id="vl">{gameVariables.map(v=><option key={v} value={v}/>)}</datalist>
          </label>
          {selComp.kind==='color_swatch' && <label><span style={lbl}>Variable couleur</span><input style={inp} value={selComp.colorBind??''} onChange={e=>upd(selComp.id,{colorBind:e.target.value})} placeholder="ex: target" /></label>}
          {selComp.kind==='button' && <label><span style={lbl}>Événement (onClick)</span><input style={inp} value={selComp.eventId??''} onChange={e=>upd(selComp.id,{eventId:e.target.value})} placeholder="ex: submit" /></label>}
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            <label><span style={lbl}>L</span><input type="number" style={inp} value={selComp.x} onChange={e=>upd(selComp.id,{x:snap(Number(e.target.value))})} /></label>
            <label><span style={lbl}>T</span><input type="number" style={inp} value={selComp.y} onChange={e=>upd(selComp.id,{y:snap(Number(e.target.value))})} /></label>
            <label><span style={lbl}>Larg.</span><input type="number" style={inp} value={selComp.width} onChange={e=>upd(selComp.id,{width:Math.max(20,Number(e.target.value))})} /></label>
            <label><span style={lbl}>Haut.</span><input type="number" style={inp} value={selComp.height} onChange={e=>upd(selComp.id,{height:Math.max(14,Number(e.target.value))})} /></label>
          </div>
          <label><span style={lbl}>Fond</span><input type="color" style={{ ...inp, padding:2, height:34, cursor:'pointer' }} value={selComp.bgColor??'#4361ee'} onChange={e=>upd(selComp.id,{bgColor:e.target.value})} /></label>
          <label><span style={lbl}>Texte</span><input type="color" style={{ ...inp, padding:2, height:34, cursor:'pointer' }} value={selComp.textColor??'#1a1d2e'} onChange={e=>upd(selComp.id,{textColor:e.target.value})} /></label>
          <button style={{ marginTop:4, padding:'7px 10px', borderRadius:9, border:'1px solid rgba(220,38,38,0.22)', background:'rgba(220,38,38,0.06)', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }} onClick={()=>del(selComp.id)}>Supprimer</button>
        </>}
      </div>
    </div>
  );
}

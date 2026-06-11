'use client';

/**
 * @file app/_components/Room3D.tsx
 * @brief Rendu 3D (Three.js) ultra-réaliste de l'installation à deux salles de dalles.
 *
 * Affiche en WebGL les deux salles (gauche/droite) de dalles lumineuses de
 * ColorRoom : architecture blanche, shader GLSL personnalisé par dalle (lueur
 * interne, bords quasi invisibles, halos additifs), environnement HDR. Les couleurs
 * et l'état allumé/éteint de chaque dalle sont pilotés par les props `plateColors`
 * et `plateActive` (indexées comme le matériel) ; un clic sur une dalle remonte son
 * index via `onPlateClick`. Gère plusieurs vues de caméra (vue d'ensemble, salle
 * gauche, salle droite) animées avec GSAP. Props : voir {@link Room3DProps}.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import gsap from 'gsap';
import { LogIn, ArrowLeft } from 'lucide-react';

/*
 * ColorRoom — ultra-realistic two-room installation.
 * Custom GLSL panel shader (inner glow + near-invisible edge, no bezel).
 * Additive glow halos per plate. HDR env map. Pure-white architecture.
 *
 * Hardware:  rows 0-3 → ceiling    |  rows 4-6 → back wall
 *            cols 0-2 → left room  |  cols 3-5 → right room
 */

// ── Layout ────────────────────────────────────────────────────────
const PITCH   = 1.0;
const PS      = 0.93;   // plate face — wide fill, thin gap
const PT      = 0.05;   // plate thickness

const W_ROWS  = 3;
const C_ROWS  = 4;
const COLS    = 3;
const ROOM_W  = COLS  * PITCH;   // 3.0
const ROOM_H  = W_ROWS * PITCH;  // 3.0
const ROOM_D  = C_ROWS * PITCH;  // 4.0 (ceiling plate span)

const CEIL_Y  = ROOM_H + 0.35;  // 3.35 — ceiling just above top plates
const FLOOR_Y = -0.25;           // slightly below bottom plate edge

const PILLAR_W = 0.022;          // very thin
const HALF_GAP = 0.22;
const GAP      = PILLAR_W + HALF_GAP * 2;   // 0.49
const MARGIN_X = 0.30;           // narrow — like reference

const L_OX = MARGIN_X;
const R_OX = L_OX + ROOM_W + GAP;

// Pillar exactly centred between the two inner plate edges
const L_LAST_CTR = L_OX + (COLS - 1) * PITCH;
const R_FRST_CTR = R_OX;
const PILLAR_X   = (L_LAST_CTR + R_FRST_CTR) / 2;

const L_CX     = L_OX + (COLS - 1) * PITCH / 2;
const R_CX     = R_OX + (COLS - 1) * PITCH / 2;
const TOT_W    = R_OX + ROOM_W + MARGIN_X;
const SCENE_CX = (L_CX + R_CX) / 2;
const SCENE_CY = (CEIL_Y + FLOOR_Y) / 2;
const SCENE_CZ = ROOM_D / 2;

// ── Camera ────────────────────────────────────────────────────────
const CAM_FOV  = 66;
const OV_CAM_Z = 5.0;
const CAM_Y    = -0.05;
const CAM_TGT  = new THREE.Vector3(0, 0.2, 0);

const PIV_Z  = -1.5;
const OV_PIV = new THREE.Vector3(-SCENE_CX, -SCENE_CY, PIV_Z);
const LR_PIV = new THREE.Vector3(-L_CX,     -SCENE_CY, PIV_Z);
const RR_PIV = new THREE.Vector3(-R_CX,     -SCENE_CY, PIV_Z);

// ── Room shell extents ────────────────────────────────────────────
const SHELL_BACK   = -0.3;
const SHELL_FRONT  = 5.5;   // reduced — less empty depth
const SHELL_CZ     = (SHELL_BACK + SHELL_FRONT) / 2;
const SHELL_D      = SHELL_FRONT - SHELL_BACK;
// Pillar stops well before camera (ends at z=4)
const PILLAR_FRONT = 4.0;
const PILLAR_D     = PILLAR_FRONT - SHELL_BACK;
const PILLAR_CZ    = (SHELL_BACK + PILLAR_FRONT) / 2;

// ── Plate positions ───────────────────────────────────────────────
type PM = { pos: THREE.Vector3; rot: THREE.Euler; isWall: boolean };

function buildMeta(): PM[] {
  const out: PM[] = [];
  for (let i = 0; i < 42; i++) {
    const row  = Math.floor(i / 6);
    const col  = i % 6;
    const room = col < 3 ? 0 : 1;
    const lc   = col % 3;
    const ox   = room === 0 ? L_OX : R_OX;
    if (row < C_ROWS) {
      // Ceiling first (rows 0-3) — row 0 = closest to user, row 3 = near back wall
      const cr = C_ROWS - 1 - row;
      out.push({ pos: new THREE.Vector3(ox + lc * PITCH, CEIL_Y, (cr + 0.5) * PITCH), rot: new THREE.Euler(Math.PI / 2, 0, 0), isWall: false });
    } else {
      // Back wall (rows 4-6) — row 4 = top, row 6 = bottom
      const wr = row - C_ROWS;
      const y  = (W_ROWS - 1 - wr) * PITCH + PITCH / 2;
      out.push({ pos: new THREE.Vector3(ox + lc * PITCH, y, 0), rot: new THREE.Euler(0, 0, 0), isWall: true });
    }
  }
  return out;
}
const META = buildMeta();

function css3(s: string) {
  const c = new THREE.Color();
  try { c.setStyle(s); } catch { c.setHex(0xffffff); }
  return c;
}

// ── Panel GLSL shader ─────────────────────────────────────────────
// No visible dark border — bevel only at extreme last 6% of edge, 10% max.
// Inner glow brightens centre when lit.
const PANEL_VERT_INJECT_DECL = `varying vec2 vPanelUV;`;
const PANEL_VERT_INJECT_BODY = `vPanelUV = uv;`;
const PANEL_FRAG_INJECT_DECL = `varying vec2 vPanelUV;`;
const PANEL_FRAG_COLOR = `
  vec2  _puv  = abs(vPanelUV - 0.5) * 2.0;
  float _rim  = max(_puv.x, _puv.y);
  float _bev  = 1.0 - smoothstep(0.94, 1.00, _rim) * 0.10;
  float _iglo = pow(1.0 - smoothstep(0.0, 0.95, _rim), 0.45);
  vec3  _col  = diffuse * _bev * (0.88 + 0.12 * _iglo);
  vec4 diffuseColor = vec4(_col, opacity);
`;
const PANEL_FRAG_EMISSIVE = `
  #include <emissivemap_fragment>
  {
    vec2  _pe   = abs(vPanelUV - 0.5) * 2.0;
    float _pr   = max(_pe.x, _pe.y);
    float _cg   = pow(1.0 - smoothstep(0.0, 0.9, _pr), 0.5);
    totalEmissiveRadiance *= (0.55 + 0.45 * _cg);
  }
`;

function injectPanelShader(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = PANEL_VERT_INJECT_DECL + '\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>\n${PANEL_VERT_INJECT_BODY}`,
    );
    shader.fragmentShader = PANEL_FRAG_INJECT_DECL + '\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      PANEL_FRAG_COLOR,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      PANEL_FRAG_EMISSIVE,
    );
  };
  mat.needsUpdate = true;
}

type RV = 'overview' | 'left' | 'right';

/** Props du rendu 3D de l'installation à deux salles. */
export interface Room3DProps {
  /** Couleur CSS de chaque dalle, indexée comme le matériel. */
  plateColors:  string[];
  /** État allumé (true) / éteint (false) de chaque dalle. */
  plateActive:  boolean[];
  /** Callback de clic sur une dalle ; reçoit son index. */
  onPlateClick?: (idx: number) => void;
  /** Hauteur du canvas en pixels (défaut : 420). */
  height?: number;
}

// ─────────────────────────────────────────────────────────────────
/**
 * Rendu 3D des deux salles de dalles lumineuses.
 *
 * @param props Voir {@link Room3DProps}.
 * @returns Le conteneur du rendu WebGL avec les contrôles de vue.
 */
export default function Room3D({ plateColors, plateActive, onPlateClick, height = 420 }: Room3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const colorsRef = useRef(plateColors);
  const activeRef = useRef(plateActive);
  const clickRef  = useRef(onPlateClick);
  colorsRef.current = plateColors;
  activeRef.current = plateActive;
  clickRef.current  = onPlateClick;

  /**
   * Rendu WebGL À LA DEMANDE : la boucle rAF ne dessine que si quelque chose a
   * changé (couleurs des dalles, tween caméra en cours, resize). Avant, la
   * scène était re-rendue à CHAQUE frame (~30-40 ms/frame en continu), ce qui
   * saturait le main thread de l'éditeur même au repos.
   */
  const dirtyRef = useRef(true);
  const lastPropsKeyRef = useRef('');
  const propsKey = plateColors.join('|') + '#' + plateActive.join('|');
  if (propsKey !== lastPropsKeyRef.current) {
    lastPropsKeyRef.current = propsKey;
    dirtyRef.current = true;
  }

  const [view, setView] = useState<RV>('overview');
  const viewRef  = useRef<RV>('overview');
  const pivotRef = useRef<THREE.Group | null>(null);
  const camRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const tweening = useRef(false);

  function goRoom(room: 'left' | 'right') {
    if (tweening.current || !pivotRef.current) return;
    tweening.current = true;
    const tp = room === 'left' ? LR_PIV : RR_PIV;
    gsap.killTweensOf(pivotRef.current.rotation);
    gsap.killTweensOf(pivotRef.current.position);
    gsap.to(pivotRef.current.rotation, { y: 0, x: 0, duration: 0.5, ease: 'power2.out' });
    gsap.to(pivotRef.current.position, {
      x: tp.x, y: tp.y, z: tp.z, duration: 1.4, ease: 'power3.inOut',
      onComplete: () => { tweening.current = false; },
    });
    viewRef.current = room; setView(room);
  }

  function goOverview() {
    if (tweening.current || !pivotRef.current) return;
    tweening.current = true;
    gsap.killTweensOf(pivotRef.current.rotation);
    gsap.killTweensOf(pivotRef.current.position);
    gsap.to(pivotRef.current.rotation, { y: 0, x: 0, duration: 0.6, ease: 'power2.out' });
    gsap.to(pivotRef.current.position, {
      x: OV_PIV.x, y: OV_PIV.y, z: OV_PIV.z, duration: 1.4, ease: 'power3.inOut',
      onComplete: () => { tweening.current = false; },
    });
    viewRef.current = 'overview'; setView('overview');
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const W = mount.clientWidth || 700;
    const H = height;

    // ── Renderer ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0xffffff);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(CAM_FOV, W / H, 0.05, 80);
    camera.position.set(0, CAM_Y, OV_CAM_Z);
    camRef.current = camera;

    const pivot = new THREE.Group();
    pivot.position.copy(OV_PIV);
    scene.add(pivot);
    pivotRef.current = pivot;

    // ── HDR environment — async, doesn't block first frame ────────
    let hdrTex: THREE.Texture | null = null;
    new RGBELoader().load('/env.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = tex;
      hdrTex = tex;
    });

    // ── Textures ──────────────────────────────────────────────────
    const tl = new THREE.TextureLoader();
    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

    function loadTex(url: string, repeatU: number, repeatV: number) {
      const t = tl.load(url);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatU, repeatV);
      t.anisotropy = maxAniso;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    // Wall texture repeated ~2×2 per room panel
    const wallTex = loadTex('/textures/wall.jpg', 4, 3);
    // Floor texture — 4×4 repeat as requested
    const floorTex = loadTex('/textures/floor.png', 4, 4);

    // ── Glow halo texture ─────────────────────────────────────────
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const gx = gc.getContext('2d')!;
    const gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0,    'rgba(255,255,255,1.0)');
    gg.addColorStop(0.22, 'rgba(255,255,255,0.80)');
    gg.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    gg.addColorStop(1,    'rgba(255,255,255,0.0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(gc);

    // ── Lighting ──────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const dir = new THREE.DirectionalLight(0xfff8f0, 0.35);
    dir.position.set(SCENE_CX, 10, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.setScalar(1024);
    dir.shadow.bias   = -0.0004;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far  = 30;
    scene.add(dir);

    // ── Materials ─────────────────────────────────────────────────
    const wMat = new THREE.MeshStandardMaterial({
      map: wallTex, roughness: 0.88, metalness: 0.0,
      envMapIntensity: 0.15, side: THREE.DoubleSide,
    });
    const fMat = new THREE.MeshStandardMaterial({
      map: floorTex, roughness: 0.55, metalness: 0.0,
      envMapIntensity: 0.30,
    });
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x080808, roughness: 0.08, metalness: 0.85,
    });

    const wallH = CEIL_Y - FLOOR_Y + 0.5;
    // Shell geometry centered at SCENE_CX (same reference as camera pivot)
    // so left/right margins appear equal in the viewport
    const shellW = TOT_W + 0.4;

    // Back wall
    const bw = new THREE.Mesh(new THREE.BoxGeometry(shellW, wallH, 0.22), wMat);
    bw.position.set(SCENE_CX, (CEIL_Y + FLOOR_Y) / 2, SHELL_BACK + 0.11);
    bw.receiveShadow = true;
    pivot.add(bw);

    // Ceiling slab
    const cs = new THREE.Mesh(new THREE.BoxGeometry(shellW, 0.22, SHELL_D + 0.2), wMat);
    cs.position.set(SCENE_CX, CEIL_Y + 0.11, SHELL_CZ);
    pivot.add(cs);

    // Floor — wide, glossy white
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(shellW + 1.2, SHELL_D + 0.4), fMat);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(SCENE_CX, FLOOR_Y, SHELL_CZ);
    fl.receiveShadow = true;
    pivot.add(fl);

    // Side walls — symmetric around SCENE_CX
    const swGeo = new THREE.BoxGeometry(0.22, wallH, SHELL_D + 0.2);
    [SCENE_CX - shellW / 2 - 0.11, SCENE_CX + shellW / 2 + 0.11].forEach((wx) => {
      const sw = new THREE.Mesh(swGeo, wMat);
      sw.position.set(wx, (CEIL_Y + FLOOR_Y) / 2, SHELL_CZ);
      sw.receiveShadow = true;
      pivot.add(sw);
    });

    // Thin black pillar — stops before camera
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(PILLAR_W, CEIL_Y - FLOOR_Y + 0.5, PILLAR_D),
      pMat,
    );
    pillar.position.set(PILLAR_X, (CEIL_Y + FLOOR_Y) / 2, PILLAR_CZ);
    pillar.castShadow = true;
    pivot.add(pillar);

    // ── Plates + glow halos — NO bezels ───────────────────────────
    const platGeo = new THREE.BoxGeometry(PS, PS, PT);
    const gGeoS   = new THREE.PlaneGeometry(PS * 1.35, PS * 1.35);
    const gGeoL   = new THREE.PlaneGeometry(PS * 2.60, PS * 2.60);

    const plateMats: THREE.MeshStandardMaterial[] = [];
    const glowMats:  Array<[THREE.MeshBasicMaterial, THREE.MeshBasicMaterial]> = [];
    const clickMeshes: THREE.Mesh[] = [];
    const WHITE = new THREE.Color(1, 1, 1);

    META.forEach((m, i) => {
      const pm = new THREE.MeshStandardMaterial({
        color: 0xf5f2ee, emissive: new THREE.Color(0), emissiveIntensity: 0,
        roughness: 0.55, metalness: 0.0, envMapIntensity: 0.4,
      });
      injectPanelShader(pm);

      const plate = new THREE.Mesh(platGeo, pm);
      plate.position.copy(m.pos);
      plate.rotation.copy(m.rot);
      plate.userData.idx = i;
      plate.receiveShadow = true;
      pivot.add(plate);
      plateMats.push(pm);
      clickMeshes.push(plate);

      // Glow halo — tight
      const gm1 = new THREE.MeshBasicMaterial({
        map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const gh1 = new THREE.Mesh(gGeoS, gm1);
      gh1.position.copy(m.pos);
      gh1.rotation.copy(m.rot);
      if (m.isWall) gh1.position.z += 0.07; else gh1.position.y -= 0.07;
      pivot.add(gh1);

      // Glow halo — wide
      const gm2 = new THREE.MeshBasicMaterial({
        map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const gh2 = new THREE.Mesh(gGeoL, gm2);
      gh2.position.copy(m.pos);
      gh2.rotation.copy(m.rot);
      if (m.isWall) gh2.position.z += 0.08; else gh2.position.y -= 0.08;
      pivot.add(gh2);

      glowMats.push([gm1, gm2]);
    });

    // ── Raycaster ─────────────────────────────────────────────────
    const rc = new THREE.Raycaster();
    const mv = new THREE.Vector2();
    renderer.domElement.addEventListener('click', (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(mv, camera);
      const hit = rc.intersectObjects(clickMeshes)[0];
      if (hit) clickRef.current?.(hit.object.userData.idx as number);
    });

    // ── Mouse-follow rotation (inside room only) ──────────────────
    mount.addEventListener('mousemove', (e) => {
      if (tweening.current || viewRef.current === 'overview') return;
      const r = mount.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  - 0.5;
      const ny = (e.clientY - r.top)  / r.height - 0.5;
      gsap.to(pivot.rotation, { y: nx * 0.055, x: -ny * 0.030, duration: 2.4, ease: 'power3.out', overwrite: 'auto' });
    });
    mount.addEventListener('mouseleave', () => {
      if (viewRef.current === 'overview') return;
      gsap.to(pivot.rotation, { y: 0, x: 0, duration: 3.2, ease: 'power3.out', overwrite: 'auto' });
    });

    // ── Floor icon projection ──────────────────────────────────────
    const tv = new THREE.Vector3();
    function proj(lx: number, lz: number, el: HTMLDivElement | null) {
      if (!el) return;
      tv.set(lx, FLOOR_Y + 0.08, lz);
      pivot.localToWorld(tv);
      tv.project(camera);
      const px = (tv.x + 1) / 2 * renderer.domElement.clientWidth;
      const py = (-tv.y + 1) / 2 * renderer.domElement.clientHeight;
      const ok = tv.z < 1 && px > 30 && px < W - 30 && py > 20 && py < H - 20;
      el.style.left    = `${px}px`;
      el.style.top     = `${py}px`;
      el.style.display = ok && !tweening.current && viewRef.current === 'overview' ? 'block' : 'none';
    }

    // ── Render loop (à la demande : skip si rien n'a changé) ──────
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const animating = tweening.current
        || gsap.isTweening(pivot.rotation)
        || gsap.isTweening(pivot.position);
      if (!animating && !dirtyRef.current) return;
      dirtyRef.current = false;
      camera.lookAt(CAM_TGT);

      plateMats.forEach((pm, i) => {
        const [gm1, gm2] = glowMats[i];
        // Force-off plates belonging to the other room
        const plateRoom = (i % 6) < 3 ? 'left' : 'right';
        const forcedOff = viewRef.current !== 'overview' && viewRef.current !== plateRoom;
        const on  = !forcedOff && (activeRef.current[i] ?? false);
        const col = colorsRef.current[i] ?? '#000000';
        if (on && col !== '#000000') {
          const c = css3(col);
          pm.color.copy(c.clone().lerp(WHITE, 0.40));
          pm.emissive.copy(c);
          pm.emissiveIntensity = 2.6;
          pm.roughness = 0.03;
          gm1.color.copy(c); gm1.opacity = 0.55;
          gm2.color.copy(c); gm2.opacity = 0.22;
        } else {
          pm.color.setHex(0xf5f2ee);
          pm.emissive.setHex(0);
          pm.emissiveIntensity = 0;
          pm.roughness = 0.55;
          gm1.opacity = 0;
          gm2.opacity = 0;
        }
      });

      scene.updateMatrixWorld(true);
      proj(L_CX, ROOM_D * 0.65, leftRef.current);
      proj(R_CX, ROOM_D * 0.65, rightRef.current);

      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth;
      camera.aspect = nw / H;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, H);
      dirtyRef.current = true;
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gsap.killTweensOf(pivot.rotation);
      gsap.killTweensOf(pivot.position);
      glowTex.dispose();
      wallTex.dispose();
      floorTex.dispose();
      hdrTex?.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [height]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div ref={leftRef} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', display: 'none', pointerEvents: 'auto', zIndex: 10 }}>
        <button onClick={() => goRoom('left')} title="Salle gauche" style={ICON_BTN}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.16)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}>
          <LogIn size={17} />
        </button>
      </div>

      <div ref={rightRef} style={{ position: 'absolute', transform: 'translate(-50%,-50%)', display: 'none', pointerEvents: 'auto', zIndex: 10 }}>
        <button onClick={() => goRoom('right')} title="Salle droite" style={ICON_BTN}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.16)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}>
          <LogIn size={17} />
        </button>
      </div>

      {/* Vue d'ensemble — top-left in left room, top-right in right room */}
      {view === 'left' && (
        <button onClick={goOverview} style={BACK_BTN}>
          <ArrowLeft size={14} /> Vue d&apos;ensemble
        </button>
      )}
      {view === 'right' && (
        <button onClick={goOverview} style={{ ...BACK_BTN, left: 'auto', right: 14 }}>
          Vue d&apos;ensemble <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}

      {/* Switch room button — opposite corner */}
      {view === 'left' && (
        <button onClick={() => goRoom('right')} style={{ ...BACK_BTN, left: 'auto', right: 14 }}>
          Salle droite <LogIn size={14} />
        </button>
      )}
      {view === 'right' && (
        <button onClick={() => goRoom('left')} style={BACK_BTN}>
          <LogIn size={14} style={{ transform: 'rotate(180deg)' }} /> Salle gauche
        </button>
      )}
    </div>
  );
}

const ICON_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, borderRadius: '50%',
  border: '1px solid rgba(0,0,0,0.13)',
  background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
  boxShadow: '0 2px 14px rgba(0,0,0,0.15)', cursor: 'pointer', color: '#111',
  transition: 'transform 0.15s',
};
const BACK_BTN: React.CSSProperties = {
  display: 'flex', position: 'absolute', top: 14, left: 14,
  alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.12)',
  background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
  boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
  color: '#111', fontWeight: 700, fontSize: 11, cursor: 'pointer',
};

'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type TileState = {
  color: string;
  intensity: number; // 0..1
};

export default function EditorTilesViewport({
  tiles,
  selectedTileIndex,
  onTileClick,
}: {
  tiles: TileState[];
  selectedTileIndex?: number | null;
  onTileClick?: (tileIndex: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const safeTiles = useMemo(() => {
    const count = Array.isArray(tiles) ? Math.max(1, tiles.length) : 9;
    const fallback: TileState[] = Array.from({ length: count }, () => ({ color: '#000000', intensity: 0 }));
    const src = Array.isArray(tiles) ? tiles : fallback;
    const out = fallback.map((t, i) => {
      const v = src[i];
      if (!v) return t;
      return {
        color: typeof v.color === 'string' ? v.color : '#000000',
        intensity: Number.isFinite(v.intensity) ? Math.max(0, Math.min(1, Number(v.intensity))) : 0,
      };
    });
    return out;
  }, [tiles]);

  useEffect(() => {
    const mountEl = containerRef.current;
    if (!mountEl) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(0, 0.25, 10.5);

    const root = new THREE.Group();
    scene.add(root);

    const tilesGroup = new THREE.Group();
    tilesGroup.position.y = 1.05;
    root.add(tilesGroup);

    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.y = -1.95;
    mirrorGroup.scale.y = -1;
    mirrorGroup.scale.x = 0.98;
    mirrorGroup.scale.z = 0.98;
    root.add(mirrorGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(4, 6, 8);
    scene.add(key);

    const tileGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const edgeGeo = new THREE.EdgesGeometry(tileGeo);

    const materials: THREE.MeshStandardMaterial[] = [];
    const mirrorMaterials: THREE.MeshStandardMaterial[] = [];
    const meshes: THREE.Mesh[] = [];
    const mirrorMeshes: THREE.Mesh[] = [];
    const edges: THREE.LineSegments[] = [];

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const gap = 0.08;
    const size = 1;
    const step = size + gap;
    const count = Math.max(1, safeTiles.length);
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const halfW = ((cols - 1) * step) / 2;
    const halfH = ((rows - 1) * step) / 2;

    for (let idx = 0; idx < count; idx++) {
      const r = Math.floor(idx / cols);
      const c = idx % cols;

      const base = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0f1116'),
        emissive: new THREE.Color('#000000'),
        emissiveIntensity: 2.1,
        roughness: 0.18,
        metalness: 0.02,
      });
      materials.push(base);

      const mesh = new THREE.Mesh(tileGeo, base);
      mesh.position.x = c * step - halfW;
      mesh.position.y = halfH - r * step;
      mesh.userData.tileIndex = idx;
      tilesGroup.add(mesh);
      meshes.push(mesh);

      const line = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
      );
      line.position.copy(mesh.position);
      line.position.z += 0.001;
      tilesGroup.add(line);
      edges.push(line);

      const mMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0f1116'),
        emissive: new THREE.Color('#000000'),
        emissiveIntensity: 1.45,
        roughness: 0.28,
        metalness: 0.02,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
      mirrorMaterials.push(mMat);

      const m = new THREE.Mesh(tileGeo, mMat);
      m.position.x = mesh.position.x;
      m.position.y = mesh.position.y;
      mirrorGroup.add(m);
      mirrorMeshes.push(m);

      const initial = safeTiles[idx] ?? { color: '#000000', intensity: 0 };
      const c0 = new THREE.Color(initial.color);
      base.emissive.copy(c0);
      base.emissiveIntensity = 2.1 * initial.intensity;
      mMat.emissive.copy(c0);
      mMat.emissiveIntensity = 1.45 * (0.75 * initial.intensity);
    }

    const frame = Math.max(cols, rows) * step;
    camera.position.set(0, 0.25, 6 + frame * 1.6);

    const clock = new THREE.Clock();

    const mouseTarget = new THREE.Vector2(0, 0);
    const mouseCurrent = new THREE.Vector2(0, 0);

    let yaw = 0;
    let pitch = 0;
    let yawVel = 0;
    let pitchVel = 0;
    let camZ = 10.5;

    let isDown = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;

    const toNdc = (clientX: number, clientY: number) => {
      const rect = mountEl.getBoundingClientRect();
      const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const y = ((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      return { x, y };
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = mountEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return;
      const idx = meshes.indexOf(hit.object as any);
      if (idx < 0) return;
      onTileClick?.(idx);
      isDown = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      mountEl.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = toNdc(e.clientX, e.clientY);
      mouseTarget.set(p.x, p.y);

      if (!isDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      lastX = e.clientX;
      lastY = e.clientY;

      yawVel += dx * 0.003;
      pitchVel += dy * 0.003;
    };

    const pick = (clientX: number, clientY: number) => {
      const p = toNdc(clientX, clientY);
      ndc.set(p.x, p.y);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(meshes, false);
      const first = hits[0]?.object;
      const tileIndex = typeof first?.userData?.tileIndex === 'number' ? (first.userData.tileIndex as number) : null;
      if (tileIndex === null) return;
      onTileClick?.(tileIndex);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDown && !moved) pick(e.clientX, e.clientY);
      isDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      camZ = Math.max(7.5, Math.min(15, camZ + e.deltaY * 0.01));
    };

    mountEl.addEventListener('pointerdown', onPointerDown);
    mountEl.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    mountEl.addEventListener('wheel', onWheel, { passive: true });

    function resize() {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }

    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const colors = Array.from({ length: count }, () => new THREE.Color('#000000'));

    const animate = () => {
      const t = clock.getElapsedTime();

      mouseCurrent.lerp(mouseTarget, 0.05);
      yawVel *= 0.9;
      pitchVel *= 0.9;
      yaw += yawVel;
      pitch += pitchVel;
      pitch = Math.max(-0.9, Math.min(0.9, pitch));

      camera.position.z += (camZ - camera.position.z) * 0.08;

      root.rotation.y = yaw + mouseCurrent.x * 0.12;
      root.rotation.x = -pitch + -mouseCurrent.y * 0.08;
      root.position.y = Math.sin(t * 0.35) * 0.05;

      for (let i = 0; i < count; i++) {
        const tile = safeTiles[i] ?? { color: '#000000', intensity: 0 };
        colors[i].set(tile.color);

        const pulse = 0.92 + Math.sin(t * 0.8 + i * 0.35) * 0.08;
        const k = Math.max(0, Math.min(1, tile.intensity));
        const intensity = k * pulse;

        materials[i].emissive.copy(colors[i]);
        materials[i].emissiveIntensity = 2.1 * intensity;

        mirrorMaterials[i].emissive.copy(colors[i]);
        mirrorMaterials[i].emissiveIntensity = 1.45 * (0.75 * intensity);

        const mat = edges[i]?.material as THREE.LineBasicMaterial | undefined;
        if (mat) {
          const selected = typeof selectedTileIndex === 'number' && selectedTileIndex === i;
          mat.opacity = selected ? 0.95 : 0.55;
          mat.color.set(selected ? 0xffffff : 0x000000);
        }
      }

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    let raf = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', onResize);
      mountEl.removeEventListener('pointerdown', onPointerDown);
      mountEl.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      mountEl.removeEventListener('wheel', onWheel);
      window.cancelAnimationFrame(raf);

      tileGeo.dispose();
      edgeGeo.dispose();
      for (const m of materials) m.dispose();
      for (const m of mirrorMaterials) m.dispose();
      for (const e of edges) (e.material as THREE.Material).dispose();

      for (const mesh of meshes) tilesGroup.remove(mesh);
      for (const mesh of mirrorMeshes) mirrorGroup.remove(mesh);

      renderer.dispose();
      const canvas = renderer.domElement;
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, [onTileClick, safeTiles, selectedTileIndex]);

  return <div ref={containerRef} className="editeur-viewport" aria-hidden />;
}

'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const BASE_PALETTE_HEX = [
  '#00e5ff',
  '#2dff57',
  '#b4ff00',
  '#6d28ff',
  '#2f6bff',
  '#00d7ff',
  '#ff00d6',
  '#7a2bff',
  '#ff2a2a',
];

function paletteColor(idx: number): THREE.Color {
  const base = new THREE.Color(BASE_PALETTE_HEX[idx % BASE_PALETTE_HEX.length]);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  base.setHSL(
    (hsl.h + rand(-0.015, 0.015) + 1) % 1,
    Math.max(0, Math.min(1, hsl.s + rand(-0.05, 0.05))),
    Math.max(0, Math.min(1, hsl.l + rand(-0.03, 0.03))),
  );
  return base;
}

export default function HeroTiles() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mountEl = containerRef.current;
    if (!mountEl) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(0, 0.3, 11);

    const root = new THREE.Group();
    scene.add(root);

    const tilesGroup = new THREE.Group();
    tilesGroup.position.y = 1.25;
    root.add(tilesGroup);

    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.y = -1.85;
    mirrorGroup.scale.y = -1;
    mirrorGroup.scale.x = 0.98;
    mirrorGroup.scale.z = 0.98;
    root.add(mirrorGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 8);
    scene.add(key);

    const tileGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const edgeGeo = new THREE.EdgesGeometry(tileGeo);

    const materials: THREE.MeshStandardMaterial[] = [];
    const mirrorMaterials: THREE.MeshStandardMaterial[] = [];
    const emissiveCurr: THREE.Color[] = [];
    const emissiveTarget: THREE.Color[] = [];
    const emissiveBase: THREE.Color[] = [];
    const flickerSeed: number[] = [];
    const nextBlinkAt: number[] = [];
    const blinkStart: number[] = [];
    const blinkDur: number[] = [];
    const blinkAmp: number[] = [];
    const meshes: THREE.Mesh[] = [];
    const mirrorMeshes: THREE.Mesh[] = [];
    const edges: THREE.LineSegments[] = [];

    const gap = 0.08;
    const size = 1;
    const step = size + gap;
    const gridW = size * 3 + gap * 2;
    const gridH = size * 3 + gap * 2;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;

        const base = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#0f1116'),
          emissive: new THREE.Color('#000000'),
          emissiveIntensity: 2.1,
          roughness: 0.18,
          metalness: 0.02,
        });
        materials.push(base);

        const mesh = new THREE.Mesh(tileGeo, base);
        mesh.position.x = (c - 1) * step;
        mesh.position.y = (1 - r) * step;
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

        const c0 = paletteColor(idx);
        emissiveBase[idx] = c0.clone();
        emissiveCurr[idx] = c0.clone();
        emissiveTarget[idx] = c0.clone();

        flickerSeed[idx] = Math.random() * 1000;
        nextBlinkAt[idx] = rand(0.6, 3.0);
        blinkStart[idx] = -10;
        blinkDur[idx] = 0.15;
        blinkAmp[idx] = 0;

        base.emissive.copy(emissiveCurr[idx]);
        mMat.emissive.copy(emissiveCurr[idx]);
      }
    }

    

    const clock = new THREE.Clock();

    const mouseTarget = new THREE.Vector2(0, 0);
    const mouseCurrent = new THREE.Vector2(0, 0);

    const onMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mouseTarget.set(x, y);
    };

    window.addEventListener('mousemove', onMouseMove);

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

    let colorTimer = 0;

    const animate = () => {
      const t = clock.getElapsedTime();

      // heavy, smooth mouse parallax
      mouseCurrent.lerp(mouseTarget, 0.035);
      root.rotation.y = mouseCurrent.x * 0.28;
      root.rotation.x = -mouseCurrent.y * 0.18;

      // subtle drift
      root.position.y = Math.sin(t * 0.35) * 0.06;

      if (t - colorTimer > 4) {
        colorTimer = t;
        const shift = Math.floor(rand(1, 9));
        for (let i = 0; i < 9; i++) {
          emissiveTarget[i] = paletteColor(i + shift);
        }
      }

      for (let i = 0; i < 9; i++) {
        if (t >= nextBlinkAt[i]) {
          blinkStart[i] = t;
          blinkDur[i] = rand(0.08, 0.22);
          blinkAmp[i] = rand(0.55, 1.25);
          nextBlinkAt[i] = t + rand(0.7, 3.2);
        }

        emissiveCurr[i].lerp(emissiveTarget[i], 0.035);

        const breathe = 0.92 + Math.sin(t * 0.65 + flickerSeed[i]) * 0.08;
        const x = (t - blinkStart[i]) / Math.max(1e-6, blinkDur[i]);
        const pulse = x >= 0 && x <= 1 ? blinkAmp[i] * (1 - x) : 0;
        const intensity = Math.max(0.25, breathe + pulse);

        materials[i].emissive.copy(emissiveCurr[i]);
        materials[i].emissiveIntensity = 2.1 * intensity;

        mirrorMaterials[i].emissive.copy(emissiveCurr[i]);
        mirrorMaterials[i].emissiveIntensity = 1.45 * (0.75 * intensity);
      }

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    let raf = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
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
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} aria-hidden />;
}

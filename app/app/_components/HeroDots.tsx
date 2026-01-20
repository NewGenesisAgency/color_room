'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroDots() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mountEl = containerRef.current;
    if (!mountEl) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0, 0, 22);

    const group = new THREE.Group();
    scene.add(group);

    const dotColor = new THREE.Color('#2d3142');
    const material = new THREE.PointsMaterial({
      color: dotColor,
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    const geometries: THREE.BufferGeometry[] = [];
    const pointsMeshes: THREE.Points[] = [];

    function makeRing(opts: { radius: number; y: number; count: number; jitter: number }) {
      const { radius, y, count, jitter } = opts;
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const r = radius + (Math.random() - 0.5) * jitter;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = y + (Math.random() - 0.5) * jitter * 0.5;
        positions[i * 3 + 2] = z;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometries.push(geo);

      const pts = new THREE.Points(geo, material);
      pointsMeshes.push(pts);
      group.add(pts);
    }

    // 3 "couches" comme sur la capture (anneaux / nuages de points)
    makeRing({ radius: 9.5, y: 5.6, count: 600, jitter: 0.45 });
    makeRing({ radius: 7.2, y: 1.6, count: 520, jitter: 0.42 });
    makeRing({ radius: 5.0, y: -2.6, count: 460, jitter: 0.38 });

    // Petits anneaux internes
    makeRing({ radius: 2.2, y: 5.6, count: 220, jitter: 0.25 });
    makeRing({ radius: 1.8, y: 1.6, count: 200, jitter: 0.22 });
    makeRing({ radius: 1.4, y: -2.6, count: 180, jitter: 0.20 });

    const clock = new THREE.Clock();

    const mouseTarget = new THREE.Vector2(0, 0);
    const mouseCurrent = new THREE.Vector2(0, 0);

    const onMouseMove = (e: MouseEvent) => {
      // -1..1
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

    let raf = 0;
    const animate = () => {
      raf = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // easing lourd & doux
      mouseCurrent.lerp(mouseTarget, 0.05);

      const tiltX = mouseCurrent.y * 0.22;
      const tiltY = mouseCurrent.x * 0.30;

      group.rotation.y = t * 0.08 + tiltY;
      group.rotation.x = Math.sin(t * 0.25) * 0.08 + tiltX;

      // micro-variation d'opacité (respiration)
      material.opacity = 0.45 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.cancelAnimationFrame(raf);

      for (const m of pointsMeshes) group.remove(m);
      for (const g of geometries) g.dispose();
      material.dispose();

      renderer.dispose();
      const canvas = renderer.domElement;
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} aria-hidden />;
}

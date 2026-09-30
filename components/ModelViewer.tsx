"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { cn } from "@/lib/utils";

// Renders an STL or 3MF from a URL, centred and slowly rotating. Pass a
// colour name/hex to tint STLs (3MF keeps its own materials when present).
export default function ModelViewer({
  url,
  kind,
  colour = "#467bf7",
  autoRotate = true,
  className,
}: {
  url: string;
  kind: "stl" | "3mf";
  colour?: string;
  autoRotate?: boolean;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(1, 2, 3);
    scene.add(key);
    const pivot = new THREE.Group();
    scene.add(pivot);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const frameObject = (object: THREE.Object3D) => {
      // Printers use Z-up; rotate so the model stands upright in Y-up three.js.
      object.rotation.x = -Math.PI / 2;
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      pivot.add(object);
      const radius = Math.max(size.x, size.y, size.z) || 1;
      camera.position.set(0, radius * 0.6, radius * 2.2);
      camera.lookAt(0, 0, 0);
    };

    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (disposed) return;
        if (kind === "stl") {
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setStyle(colour),
            roughness: 0.55,
            metalness: 0.05,
          });
          frameObject(new THREE.Mesh(geometry, material));
        } else {
          frameObject(new ThreeMFLoader().parse(buffer));
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Couldn't load model");
      }
    };
    void load();

    const tick = () => {
      if (autoRotate) pivot.rotation.y += 0.006;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, kind, colour, autoRotate]);

  return (
    <div ref={mountRef} className={cn("relative aspect-square w-full", className)}>
      {error ? (
        <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Preview unavailable
        </p>
      ) : null}
    </div>
  );
}

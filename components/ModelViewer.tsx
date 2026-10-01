"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { createModelScene, disposeScene, frameModel, parseModel } from "@/components/model-scene";

// Renders an STL or 3MF from a URL, centred and slowly rotating. Pass a
// colour name/hex to tint STLs (3MF keeps its own materials when present).
// `fallback` replaces the "Preview unavailable" note when WebGL or loading fails.
export default function ModelViewer({
  url,
  kind,
  colour = "#467bf7",
  autoRotate = true,
  boostLighting = false,
  fallback = (
    <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Preview unavailable</p>
  ),
  className,
}: {
  url: string;
  kind: "stl" | "3mf";
  colour?: string;
  autoRotate?: boolean;
  boostLighting?: boolean;
  fallback?: ReactNode;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let frame = 0;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() => {
        if (!disposed) setError("WebGL unavailable");
      });
      return () => {
        disposed = true;
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const { scene, camera, pivot } = createModelScene({ boostLighting });

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

    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (disposed) return;
        frameModel(parseModel(buffer, kind, colour), pivot, camera);
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
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, kind, colour, autoRotate, boostLighting]);

  return (
    <div ref={mountRef} className={cn("relative aspect-square w-full", className)}>
      {error ? fallback : null}
    </div>
  );
}

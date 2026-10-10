"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { createModelScene, disposeScene, frameModel, parseModel } from "@/components/model-scene";

export type ModelRotation = { x: number; y: number; z: number };

// Renders an STL or 3MF from a URL, centred and slowly rotating. Pass a
// colour name/hex to tint STLs (3MF keeps its own materials when present).
// `fallback` replaces the "Preview unavailable" note when WebGL or loading fails.
export default function ModelViewer({
  url,
  kind,
  colour = "#467bf7",
  autoRotate = true,
  boostLighting = false,
  interactive = false,
  rotation,
  zoom,
  onRotationChange,
  onZoomChange,
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
  interactive?: boolean;
  rotation?: ModelRotation;
  zoom?: number;
  onRotationChange?: (rotation: ModelRotation) => void;
  onZoomChange?: (zoom: number) => void;
  fallback?: ReactNode;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pivotRef = useRef<THREE.Object3D | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const baseDistanceRef = useRef(0);
  const rotationRef = useRef<ModelRotation>(rotation ?? { x: 0, y: 0, z: 0 });
  const zoomRef = useRef(zoom ?? 1);
  const interactedRef = useRef(false);
  const rotationChangeRef = useRef(onRotationChange);
  const zoomChangeRef = useRef(onZoomChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rotationChangeRef.current = onRotationChange;
    zoomChangeRef.current = onZoomChange;
  }, [onRotationChange, onZoomChange]);

  useEffect(() => {
    if (!rotation) return;
    if (
      rotation.x !== rotationRef.current.x ||
      rotation.y !== rotationRef.current.y ||
      rotation.z !== rotationRef.current.z
    ) {
      interactedRef.current = true;
    }
    rotationRef.current = rotation;
    if (pivotRef.current) {
      pivotRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  }, [rotation]);

  useEffect(() => {
    if (zoom === undefined) return;
    if (zoom !== zoomRef.current) interactedRef.current = true;
    zoomRef.current = zoom;
    if (cameraRef.current && baseDistanceRef.current) {
      cameraRef.current.position.z = baseDistanceRef.current / zoom;
    }
  }, [zoom]);

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
    pivotRef.current = pivot;
    cameraRef.current = camera;
    if (rotation) pivot.rotation.set(rotation.x, rotation.y, rotation.z);
    interactedRef.current = false;

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
        baseDistanceRef.current = camera.position.z;
        camera.position.z = baseDistanceRef.current / zoomRef.current;
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Couldn't load model");
      }
    };
    void load();

    const canvas = renderer.domElement;
    canvas.style.touchAction = interactive ? "none" : "";
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const updateRotation = (next: ModelRotation) => {
      rotationRef.current = next;
      pivot.rotation.set(next.x, next.y, next.z);
      rotationChangeRef.current?.(next);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!interactive) return;
      dragging = true;
      interactedRef.current = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = (event.clientX - lastX) / 140;
      const dy = (event.clientY - lastY) / 140;
      lastX = event.clientX;
      lastY = event.clientY;
      const current = rotationRef.current;
      updateRotation(event.shiftKey
        ? { ...current, z: current.z + dx }
        : { x: current.x + dy, y: current.y + dx, z: current.z });
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      if (!interactive) return;
      event.preventDefault();
      interactedRef.current = true;
      const next = Math.min(3, Math.max(0.5, zoomRef.current * Math.exp(event.deltaY * 0.001)));
      zoomRef.current = next;
      if (baseDistanceRef.current) camera.position.z = baseDistanceRef.current / next;
      zoomChangeRef.current?.(next);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const tick = () => {
      if (autoRotate && (!interactive || !interactedRef.current)) pivot.rotation.y += 0.006;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      observer.disconnect();
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
      pivotRef.current = null;
      cameraRef.current = null;
      baseDistanceRef.current = 0;
    };
  }, [url, kind, colour, autoRotate, boostLighting, interactive]);

  return (
    <div ref={mountRef} className={cn("relative aspect-square w-full", interactive && "cursor-grab active:cursor-grabbing", className)}>
      {error ? fallback : null}
    </div>
  );
}

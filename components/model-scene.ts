import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import type { FileKind } from "@/lib/files";

export function createModelScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 2, 3);
  scene.add(key);
  const pivot = new THREE.Group();
  scene.add(pivot);
  return { scene, camera, pivot };
}

export function parseModel(buffer: ArrayBuffer, kind: FileKind, colour: string): THREE.Object3D {
  if (kind === "stl") {
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setStyle(colour),
      roughness: 0.55,
      metalness: 0.05,
    });
    return new THREE.Mesh(geometry, material);
  }
  return new ThreeMFLoader().parse(buffer);
}

export function frameModel(object: THREE.Object3D, pivot: THREE.Group, camera: THREE.PerspectiveCamera) {
  object.rotation.x = -Math.PI / 2;
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  pivot.add(object);
  const radius = Math.max(size.x, size.y, size.z) || 1;
  camera.position.set(0, radius * 0.6, radius * 2.2);
  camera.lookAt(0, 0, 0);
}

export function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

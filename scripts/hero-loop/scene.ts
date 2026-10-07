import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createModelScene, disposeScene, frameModel, parseModel } from "@/components/model-scene";
import { swatchFor } from "@/lib/colours";

export type HeroVariant = "mascot" | "cognition";

const VARIANTS: Record<
  HeroVariant,
  { modelUrl: string; colour: string; chrome: boolean }
> = {
  mascot: {
    modelUrl: "/models/devin-mascot-keychain.stl",
    colour: swatchFor("orange"),
    chrome: false,
  },
  cognition: {
    modelUrl: "/models/cognition-keychain.stl",
    colour: swatchFor("black"),
    chrome: true,
  },
};

export async function createHeroScene(canvas: HTMLCanvasElement, variant: HeroVariant) {
  const settings = VARIANTS[variant];
  const { scene, camera, pivot } = createModelScene();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  const width = canvas.width || 512;
  const height = canvas.height || width;
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const response = await fetch(settings.modelUrl);
  if (!response.ok) {
    renderer.dispose();
    throw new Error(`Couldn't load ${settings.modelUrl}: HTTP ${response.status}`);
  }
  const object = parseModel(await response.arrayBuffer(), "stl", settings.colour);
  let pmrem: THREE.PMREMGenerator | null = null;
  let environmentTarget: THREE.WebGLRenderTarget | null = null;

  if (settings.chrome) {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const originalMaterial = child.material;
      const createChromeMaterial = (material: THREE.Material) => {
        const chromeMaterial = new THREE.MeshStandardMaterial();
        chromeMaterial.copy(material);
        chromeMaterial.color.set("#d4d8dd");
        chromeMaterial.metalness = 1;
        chromeMaterial.roughness = 0.22;
        material.dispose();
        return chromeMaterial;
      };
      child.material = Array.isArray(originalMaterial)
        ? originalMaterial.map(createChromeMaterial)
        : createChromeMaterial(originalMaterial);
    });

    pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    try {
      environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    } finally {
      roomEnvironment.dispose();
    }
    scene.environment = environmentTarget.texture;
  }

  frameModel(object, pivot, camera);

  return {
    draw(frame: number, frameCount: number) {
      pivot.rotation.y = (2 * Math.PI * frame) / frameCount;
      renderer.render(scene, camera);
    },
    dispose() {
      scene.environment = null;
      environmentTarget?.dispose();
      pmrem?.dispose();
      disposeScene(scene);
      renderer.dispose();
    },
  };
}

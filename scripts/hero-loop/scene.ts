import * as THREE from "three";
import { createModelScene, disposeScene, frameModel, parseModel } from "@/components/model-scene";
import { swatchFor } from "@/lib/colours";

export type HeroVariant = "mascot" | "cognition-light" | "cognition-dark";

const VARIANTS: Record<
  HeroVariant,
  { modelUrl: string; colour: string; boostLighting: boolean }
> = {
  mascot: {
    modelUrl: "/models/devin-mascot-keychain.stl",
    colour: swatchFor("orange"),
    boostLighting: false,
  },
  "cognition-light": {
    modelUrl: "/models/cognition-keychain.stl",
    colour: swatchFor("black"),
    boostLighting: false,
  },
  "cognition-dark": {
    modelUrl: "/models/cognition-keychain.stl",
    colour: swatchFor("black"),
    boostLighting: true,
  },
};

export async function createHeroScene(canvas: HTMLCanvasElement, variant: HeroVariant) {
  const settings = VARIANTS[variant];
  const { scene, camera, pivot } = createModelScene({
    boostLighting: settings.boostLighting,
  });
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
  frameModel(object, pivot, camera);

  return {
    draw(frame: number, frameCount: number) {
      pivot.rotation.y = (2 * Math.PI * frame) / frameCount;
      renderer.render(scene, camera);
    },
    dispose() {
      disposeScene(scene);
      renderer.dispose();
    },
  };
}

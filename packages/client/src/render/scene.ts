import {
  type AbstractMesh,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  WebGPUEngine,
} from "@babylonjs/core";
import { GAME_CONFIG, MAP, type ObstacleKind } from "@udc/shared";

export type AnyEngine = Engine | WebGPUEngine;

/** WebGPU si el navegador lo soporta; WebGL2 si no (NFR-05). */
export async function createEngine(canvas: HTMLCanvasElement): Promise<AnyEngine> {
  if (await WebGPUEngine.IsSupportedAsync) {
    const engine = new WebGPUEngine(canvas, { antialias: true });
    await engine.initAsync();
    return engine;
  }
  return new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
}

const color = (hex: string) => Color3.FromHexString(hex);

function material(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color(hex);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  return m;
}

export interface GameScene {
  scene: Scene;
  camera: ArcRotateCamera;
  /** Mallas que tapan la cámara (obstáculos del mapa). */
  cameraBlockers: AbstractMesh[];
  createSoldier(id: number, isLocal: boolean): TransformNode;
  createDummy(id: number): TransformNode;
  disposeEntity(id: number): void;
  /** Entidad hostil bajo el puntero (los obstáculos tapan), o `null`. */
  pickHostile(x: number, y: number): number | null;
  /**
   * Coloca el anillo de objetivo bajo el nodo, o lo oculta con `null`.
   * Rojo si se le puede disparar; gris si no (fuera de alcance o tapado).
   */
  showTargetMarker(node: TransformNode | null, canFire: boolean): void;
}

/** Datos que llevan las mallas que se pueden seleccionar con clic. */
interface HostileMetadata {
  hostileId: number;
}

const hostileIdOf = (mesh: AbstractMesh): number | null =>
  (mesh.metadata as Partial<HostileMetadata> | null)?.hostileId ?? null;

export function createGameScene(engine: AnyEngine): GameScene {
  const scene = new Scene(engine);
  // Cielo de polvo rojizo: un planeta colonia en las últimas.
  scene.clearColor = Color4.FromHexString("#5a3a2eff");
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.006;
  scene.fogColor = color("#5a3a2e");

  const camera = new ArcRotateCamera("camera", -Math.PI / 2, 1.1, 9, Vector3.Zero(), scene);
  camera.minZ = 0.1;
  camera.maxZ = 500;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  hemi.groundColor = color("#3b2a22");

  const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene);
  sun.position = new Vector3(40, 80, -30);
  sun.intensity = 0.9;
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;

  // Suelo.
  const ground = MeshBuilder.CreateGround("ground", { width: MAP.size, height: MAP.size }, scene);
  ground.material = material(scene, "ground", "#7d6a55");
  ground.receiveShadows = true;

  // Plataforma de lanzaderas.
  const pad = MeshBuilder.CreateCylinder(
    "pad",
    { diameter: MAP.landingPad.radius * 2, height: 0.3, tessellation: 48 },
    scene,
  );
  pad.position.set(MAP.landingPad.x, 0.15, MAP.landingPad.z);
  pad.material = material(scene, "pad", "#4a4f55");
  pad.receiveShadows = true;
  const padMark = MeshBuilder.CreateTorus(
    "pad-mark",
    { diameter: MAP.landingPad.radius * 1.4, thickness: 0.5, tessellation: 48 },
    scene,
  );
  padMark.position.set(MAP.landingPad.x, 0.31, MAP.landingPad.z);
  padMark.scaling.y = 0.05;
  padMark.material = material(scene, "pad-mark", "#c9a227");

  // Obstáculos.
  const cameraBlockers: AbstractMesh[] = [];
  const obstacleColors: Record<ObstacleKind, string> = {
    building: "#8a8d8f",
    wall: "#6b6157",
    crate: "#8c1c13",
  };
  for (const o of MAP.obstacles) {
    const box = MeshBuilder.CreateBox(o.id, { width: o.w, depth: o.d, height: o.h }, scene);
    box.position.set(o.x, o.h / 2, o.z);
    // Babylon es levógiro: ver la convención en shared/sim/collision.ts.
    box.rotation.y = -o.rot;
    box.material = material(scene, `m-${o.id}`, obstacleColors[o.kind]);
    box.receiveShadows = true;
    shadows.addShadowCaster(box);
    cameraBlockers.push(box);
  }

  // Madrigueras de centollos (todavía vacías).
  const burrowMat = material(scene, "burrow", "#2b1d18");
  MAP.burrows.forEach((b, i) => {
    const burrow = MeshBuilder.CreateDisc(`burrow-${i}`, { radius: 4, tessellation: 24 }, scene);
    burrow.rotation.x = Math.PI / 2;
    burrow.position.set(b.x, 0.02, b.z);
    burrow.material = burrowMat;
  });

  // Soldados: cápsula con un visor que indica hacia dónde miran.
  const localMat = material(scene, "soldier-local", "#c9a227");
  const otherMat = material(scene, "soldier-other", "#4f6b8a");
  const visorMat = material(scene, "visor", "#1d1a16");
  const entities = new Map<number, TransformNode>();
  const { radius, height } = GAME_CONFIG.soldier;

  function createSoldier(id: number, isLocal: boolean): TransformNode {
    const root = new TransformNode(`soldier-${id}`, scene);
    const body: Mesh = MeshBuilder.CreateCapsule(
      `soldier-body-${id}`,
      { radius, height, tessellation: 12 },
      scene,
    );
    body.position.y = height / 2;
    body.material = isLocal ? localMat : otherMat;
    body.parent = root;
    shadows.addShadowCaster(body);

    const visor = MeshBuilder.CreateBox(
      `soldier-visor-${id}`,
      { width: radius * 1.2, height: 0.18, depth: 0.2 },
      scene,
    );
    visor.position.set(0, height * 0.82, radius * 0.9);
    visor.material = visorMat;
    visor.parent = root;

    entities.set(id, root);
    return root;
  }

  // Muñecos de prueba: centollos de cartón naranjas, cuerpo y cabeza.
  const dummyMat = material(scene, "dummy", "#d2691e");
  const dummy = GAME_CONFIG.dummy;

  function createDummy(id: number): TransformNode {
    const root = new TransformNode(`dummy-${id}`, scene);
    const metadata: HostileMetadata = { hostileId: id };
    const bodyHeight = dummy.height * 0.7;
    const body = MeshBuilder.CreateCylinder(
      `dummy-body-${id}`,
      { diameter: dummy.radius * 2, height: bodyHeight, tessellation: 16 },
      scene,
    );
    body.position.y = bodyHeight / 2;
    const headDiameter = dummy.height - bodyHeight;
    const head = MeshBuilder.CreateSphere(
      `dummy-head-${id}`,
      { diameter: headDiameter, segments: 8 },
      scene,
    );
    head.position.y = bodyHeight + headDiameter / 2;
    for (const mesh of [body, head]) {
      mesh.material = dummyMat;
      mesh.metadata = metadata;
      mesh.parent = root;
      shadows.addShadowCaster(mesh);
    }
    entities.set(id, root);
    return root;
  }

  function disposeEntity(id: number): void {
    entities.get(id)?.dispose(false, false);
    entities.delete(id);
  }

  const blockers = new Set(cameraBlockers);
  function pickHostile(x: number, y: number): number | null {
    const pick = scene.pick(x, y, (m) => hostileIdOf(m) !== null || blockers.has(m));
    return pick?.pickedMesh ? hostileIdOf(pick.pickedMesh) : null;
  }

  // Anillo rojo en el suelo bajo el objetivo, al estilo WoW.
  const marker = MeshBuilder.CreateTorus(
    "target-marker",
    { diameter: dummy.radius * 2 + 0.8, thickness: 0.25, tessellation: 32 },
    scene,
  );
  marker.scaling.y = 0.2;
  const markerActive = material(scene, "target-marker", "#e0301e");
  const markerIdle = material(scene, "target-marker-idle", "#8a8d8f");
  marker.material = markerActive;
  marker.isPickable = false;
  marker.setEnabled(false);

  function showTargetMarker(node: TransformNode | null, canFire: boolean): void {
    marker.setEnabled(node !== null);
    if (!node) return;
    marker.position.set(node.position.x, 0.06, node.position.z);
    marker.material = canFire ? markerActive : markerIdle;
  }

  return {
    scene,
    camera,
    cameraBlockers,
    createSoldier,
    createDummy,
    disposeEntity,
    pickHostile,
    showTargetMarker,
  };
}

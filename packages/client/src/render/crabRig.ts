import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import type { Material } from "@babylonjs/core/Materials/material.js";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { material } from "./look.js";
import {
  bodyToWorld,
  CrabGait,
  fanLegs,
  reachableFoot,
  solveKnee,
  type GaitSpec,
  type Vec3,
} from "./crabGait.js";

/**
 * Centollos con patas (E8-2): cuerpos de cangrejo araña (*Maja squinado*) generados en código y
 * patas largas que andan solas (`crabGait.ts`). Los cuerpos siguen siendo instancias
 * seleccionables; las patas de todos se pintan con thin instances, una malla por segmento y
 * tipo: cuatro llamadas de dibujo para todas. Medidas en metros; son visuales, no de juego (la
 * colisión sigue siendo la de la configuración).
 */

/**
 * Raso: cuerpo bajo en forma de pera, 8 patas largas; rápido (6 m/s), pasos cortos y vivos.
 * Con pasos de 0,09 s, a 6 m/s las zancadas eran más largas que las patas: medido a 60, 30 y
 * 20 fps, con 0,05 s ningún pie pasa del 93 % de lo que da la pata.
 */
export const RASO_GAIT: GaitSpec = {
  legs: fanLegs({
    perSide: 4,
    hipX: 0.26,
    hipFront: 0.18,
    hipBack: -0.24,
    hipY: 0.42,
    reach: 0.95,
    frontAngle: 0.7,
    backAngle: 2.4,
  }),
  femur: 0.55,
  tibia: 0.72,
  bodyHeight: 0.42,
  stepThreshold: 0.25,
  stepSeconds: 0.05,
  stepHeight: 0.16,
  lead: 0.075,
  bob: 0.04,
  snapDistance: 2.5,
};

/** Escupidor: más alto, 6 patas más largas; lento (3,5 m/s), pasos largos. */
export const SPITTER_GAIT: GaitSpec = {
  legs: fanLegs({
    perSide: 3,
    hipX: 0.3,
    hipFront: 0.15,
    hipBack: -0.25,
    hipY: 0.68,
    reach: 1.15,
    frontAngle: 0.75,
    backAngle: 2.3,
  }),
  femur: 0.75,
  tibia: 0.95,
  bodyHeight: 0.68,
  stepThreshold: 0.3,
  stepSeconds: 0.13,
  stepHeight: 0.22,
  lead: 0.2,
  bob: 0.05,
  snapDistance: 2.5,
};

const UP = Vector3.Up();

/** Un cilindro de `from` a `to` (para piezas del cuerpo, que se fusionan). */
function limb(scene: Scene, from: Vec3, to: Vec3, bottom: number, top: number): Mesh {
  const dir = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
  const length = dir.length();
  const mesh = MeshBuilder.CreateCylinder(
    "limb",
    { height: length, diameterBottom: bottom, diameterTop: top, tessellation: 6 },
    scene,
  );
  mesh.rotationQuaternion = new Quaternion();
  Quaternion.FromUnitVectorsToRef(UP, dir.normalize(), mesh.rotationQuaternion);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return mesh;
}

/** Una púa (cono) en `at`, apuntando hacia `dir`. */
function spike(scene: Scene, at: Vec3, dir: Vec3, length: number, width: number): Mesh {
  const n = Math.hypot(dir.x, dir.y, dir.z);
  return limb(
    scene,
    at,
    {
      x: at.x + (dir.x / n) * length,
      y: at.y + (dir.y / n) * length,
      z: at.z + (dir.z / n) * length,
    },
    width,
    0,
  );
}

function ellipsoid(scene: Scene, at: Vec3, x: number, y: number, z: number): Mesh {
  const mesh = MeshBuilder.CreateSphere(
    "shell",
    { diameterX: x, diameterY: y, diameterZ: z, segments: 6 },
    scene,
  );
  mesh.position.set(at.x, at.y, at.z);
  return mesh;
}

/** Las dos pinzas (quelípedos), delante: brazo y pinza. */
function claws(scene: Scene, h: number, reach: number): Mesh[] {
  return [-1, 1].flatMap((side) => {
    const shoulder = { x: side * 0.16, y: h, z: 0.22 };
    const elbow = { x: side * 0.3, y: h - 0.06, z: 0.22 + reach * 0.5 };
    const wrist = { x: side * 0.22, y: h - 0.12, z: 0.22 + reach };
    const pincer = ellipsoid(scene, { x: wrist.x, y: wrist.y, z: wrist.z + 0.08 }, 0.1, 0.08, 0.2);
    return [
      limb(scene, shoulder, elbow, 0.07, 0.06),
      limb(scene, elbow, wrist, 0.06, 0.05),
      pincer,
    ];
  });
}

function merge(name: string, parts: Mesh[], material: Material): Mesh {
  const merged = Mesh.MergeMeshes(parts, true)!;
  merged.name = name;
  merged.material = material;
  merged.isVisible = false; // Solo se ven sus instancias.
  merged.isPickable = false;
  return merged;
}

/**
 * Cuerpo del raso: caparazón en forma de pera (estrecho delante), dos cuernos en la frente,
 * púas encima y las pinzas. El origen, en el suelo bajo el centro; delante, +Z.
 */
export function buildCrabBody(scene: Scene, material: Material): Mesh {
  const h = RASO_GAIT.bodyHeight;
  const parts = [
    ellipsoid(scene, { x: 0, y: h, z: -0.06 }, 0.62, 0.3, 0.66),
    ellipsoid(scene, { x: 0, y: h + 0.02, z: 0.22 }, 0.38, 0.22, 0.4),
    // Los cuernos (el rostro), separándose hacia delante.
    ...[-1, 1].map((side) =>
      spike(
        scene,
        { x: side * 0.05, y: h + 0.06, z: 0.36 },
        { x: side * 0.25, y: 0.15, z: 1 },
        0.22,
        0.06,
      ),
    ),
    // Púas sobre el caparazón.
    ...[
      { x: 0, z: -0.05 },
      { x: -0.15, z: -0.15 },
      { x: 0.15, z: -0.15 },
      { x: -0.12, z: 0.1 },
      { x: 0.12, z: 0.1 },
      { x: 0, z: -0.25 },
    ].map((p) => spike(scene, { x: p.x, y: h + 0.1, z: p.z }, { x: p.x, y: 1, z: p.z }, 0.1, 0.05)),
    ...claws(scene, h - 0.02, 0.38),
  ];
  return merge("crab", parts, material);
}

/** Cuerpo del escupidor: más alto y redondo, con el saco de ácido a la espalda. */
export function buildSpitterBody(scene: Scene, material: Material): Mesh {
  const h = SPITTER_GAIT.bodyHeight;
  const parts = [
    ellipsoid(scene, { x: 0, y: h, z: 0 }, 0.7, 0.45, 0.75),
    // El saco, detrás y arriba.
    ellipsoid(scene, { x: 0, y: h + 0.3, z: -0.25 }, 0.6, 0.55, 0.6),
    // La boca, delante: un hocico corto por el que escupe.
    limb(scene, { x: 0, y: h + 0.02, z: 0.3 }, { x: 0, y: h + 0.08, z: 0.52 }, 0.18, 0.12),
    ...claws(scene, h - 0.05, 0.3),
  ];
  return merge("spitter", parts, material);
}

/** Todos los segmentos de un tipo (fémur o tibia de rasos o de escupidores), en thin instances. */
class SegmentBatch {
  readonly mesh: Mesh;
  private buffer = new Float32Array(16 * 64);
  private count = 0;
  private bufferSet = false;
  private readonly matrix = new Matrix();
  private readonly rotation = new Quaternion();
  private readonly dir = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly origin = new Vector3();

  constructor(scene: Scene, name: string, bottom: number, top: number, material: Material) {
    // Cilindro de altura 1 con la base en el origen: se escala a lo largo de cada segmento.
    this.mesh = MeshBuilder.CreateCylinder(
      name,
      { height: 1, diameterBottom: bottom, diameterTop: top, tessellation: 5 },
      scene,
    );
    this.mesh.position.y = 0.5;
    this.mesh.bakeCurrentTransformIntoVertices();
    this.mesh.material = material;
    this.mesh.isPickable = false;
    // Las thin instances se mueven cada frame: sin recalcular su caja, que no lo descarte.
    this.mesh.alwaysSelectAsActiveMesh = true;
    // Con el búfer desde el principio: sin él, Babylon pinta la malla base (una varilla de 1 m
    // en el origen) hasta que aparece el primer centollo de su tipo.
    this.mesh.thinInstanceSetBuffer("matrix", this.buffer, 16, false);
    this.bufferSet = true;
    this.mesh.thinInstanceCount = 0;
    this.mesh.isVisible = false;
  }

  begin(): void {
    this.count = 0;
  }

  push(from: Vec3, to: Vec3): void {
    this.dir.set(to.x - from.x, to.y - from.y, to.z - from.z);
    const length = this.dir.length();
    if (length < 1e-5) return;
    this.dir.scaleInPlace(1 / length);
    Quaternion.FromUnitVectorsToRef(UP, this.dir, this.rotation);
    this.scale.y = length;
    this.origin.set(from.x, from.y, from.z);
    Matrix.ComposeToRef(this.scale, this.rotation, this.origin, this.matrix);
    if ((this.count + 1) * 16 > this.buffer.length) {
      const bigger = new Float32Array(this.buffer.length * 2);
      bigger.set(this.buffer);
      this.buffer = bigger;
      this.bufferSet = false;
    }
    this.matrix.copyToArray(this.buffer, this.count * 16);
    this.count++;
  }

  end(): void {
    if (!this.bufferSet) {
      this.mesh.thinInstanceSetBuffer("matrix", this.buffer, 16, false);
      this.bufferSet = true;
    } else {
      this.mesh.thinInstanceBufferUpdated("matrix");
    }
    this.mesh.thinInstanceCount = this.count;
    this.mesh.isVisible = this.count > 0;
  }
}

interface RiggedCrab {
  node: TransformNode;
  gait: CrabGait;
  femurs: SegmentBatch;
  tibias: SegmentBatch;
}

/** Las patas de todos los centollos: se añaden al crearlos y se quitan al retirarlos. */
export class CrabRig {
  private readonly crabs = new Map<number, RiggedCrab>();
  private readonly batches: SegmentBatch[];
  private readonly raso: { femurs: SegmentBatch; tibias: SegmentBatch };
  private readonly spitter: { femurs: SegmentBatch; tibias: SegmentBatch };
  private readonly hip: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly knee: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly foot: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(scene: Scene, rasoMaterial: Material, spitterMaterial: Material) {
    this.raso = {
      femurs: new SegmentBatch(scene, "crab-femurs", 0.07, 0.05, rasoMaterial),
      tibias: new SegmentBatch(scene, "crab-tibias", 0.05, 0.015, rasoMaterial),
    };
    this.spitter = {
      femurs: new SegmentBatch(scene, "spitter-femurs", 0.08, 0.06, spitterMaterial),
      tibias: new SegmentBatch(scene, "spitter-tibias", 0.06, 0.02, spitterMaterial),
    };
    this.batches = [this.raso.femurs, this.raso.tibias, this.spitter.femurs, this.spitter.tibias];
  }

  /** Las mallas de las patas (para las sombras). */
  get meshes(): Mesh[] {
    return this.batches.map((b) => b.mesh);
  }

  /** Triángulos de una pata (fémur y tibia). */
  get trianglesPerLeg(): number {
    return (this.raso.femurs.mesh.getTotalIndices() + this.raso.tibias.mesh.getTotalIndices()) / 3;
  }

  add(id: number, node: TransformNode, kind: "raso" | "spitter"): void {
    const spec = kind === "raso" ? RASO_GAIT : SPITTER_GAIT;
    const batches = kind === "raso" ? this.raso : this.spitter;
    const pose = { x: node.position.x, z: node.position.z, yaw: node.rotation.y };
    this.crabs.set(id, { node, gait: new CrabGait(spec, pose), ...batches });
  }

  remove(id: number): void {
    this.crabs.delete(id);
  }

  /** Cada frame, con los cuerpos ya colocados: pasos, IK y matrices de las patas. */
  update(dt: number): void {
    for (const batch of this.batches) batch.begin();
    for (const crab of this.crabs.values()) {
      const { node, gait } = crab;
      if (!node.isEnabled()) continue;
      const pose = { x: node.position.x, z: node.position.z, yaw: node.rotation.y };
      gait.update(pose, dt);
      // El cuerpo baja un poco con las patas en el aire.
      node.position.y = gait.lift;
      const { legs, femur, tibia } = gait.spec;
      for (let i = 0; i < legs.length; i++) {
        bodyToWorld(pose, legs[i]!.hip, this.hip);
        this.hip.y += gait.lift;
        const foot = reachableFoot(this.hip, gait.feet[i]!, femur + tibia, this.foot);
        solveKnee(this.hip, foot, femur, tibia, this.knee);
        crab.femurs.push(this.hip, this.knee);
        crab.tibias.push(this.knee, foot);
      }
    }
    for (const batch of this.batches) batch.end();
  }
}

export type CrabKind = "raso" | "spitter";

/** Colores de los centollos: el raso, rojo de centollo; el escupidor, verdoso. */
const CRAB_COLORS: Record<CrabKind, string> = { raso: "#b8432f", spitter: "#6f8f3a" };

/**
 * Todo lo que hace falta para pintar centollos (E8-2): los cuerpos (una malla fuente oculta por
 * tipo, con sombra) y las patas. Lo usan la escena del juego y la vitrina (E7-9), igual.
 */
export class CrabKit {
  private readonly sources: Record<CrabKind, Mesh>;
  private readonly rig: CrabRig;

  constructor(scene: Scene, shadows: ShadowGenerator) {
    const raso = material(scene, "crab", CRAB_COLORS.raso);
    const spitter = material(scene, "spitter", CRAB_COLORS.spitter);
    this.sources = { raso: buildCrabBody(scene, raso), spitter: buildSpitterBody(scene, spitter) };
    this.rig = new CrabRig(scene, raso, spitter);
    for (const mesh of [this.sources.raso, this.sources.spitter, ...this.rig.meshes]) {
      shadows.addShadowCaster(mesh);
    }
  }

  /** Un centollo nuevo: una instancia del cuerpo, con sus patas. */
  spawn(id: number, kind: CrabKind): InstancedMesh {
    const body = this.sources[kind].createInstance(`${kind}-${id}`);
    body.isVisible = true;
    this.rig.add(id, body, kind);
    return body;
  }

  /** Quita sus patas (el cuerpo lo retira quien lo creó). */
  remove(id: number): void {
    this.rig.remove(id);
  }

  /** Cada frame, con los cuerpos ya colocados. */
  update(dt: number): void {
    this.rig.update(dt);
  }

  /** Triángulos de un centollo entero (cuerpo y patas). */
  triangles(kind: CrabKind): number {
    const legs = kind === "raso" ? RASO_GAIT.legs.length : SPITTER_GAIT.legs.length;
    return this.sources[kind].getTotalIndices() / 3 + legs * this.rig.trianglesPerLeg;
  }
}

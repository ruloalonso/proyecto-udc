import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { color, material } from "./look.js";

/**
 * Marine (E8-1): soldado con armadura de combate pesada, generado en código. Hombreras enormes,
 * casco cerrado con visor, mochila con toberas y un fusil grande a dos manos. Piezas rígidas
 * colgadas de articulaciones (cadera, rodillas, tobillos, hombros, codos, cuello), para
 * animarlo sin esqueleto. Cada parte del cuerpo es una sola malla con colores de vértice: una
 * llamada de dibujo por articulación. El origen, en el suelo entre los pies; delante, +Z.
 */

/** Colores: la armadura es del jugador (dorada la propia, azul acero las demás). */
export interface MarinePalette {
  armor: string;
}

const TRIM = "#2b2f33";
const UNDERSUIT = "#1b1d20";
const GUN = "#34373b";
const GUN_DARK = "#1c1e21";
const STRIPE = "#8c1c13";
const VISOR = "#ff4a2a";

/** Las articulaciones, para animarlo. Todas giran sobre su origen. */
export interface MarineJoints {
  pelvis: TransformNode;
  torso: TransformNode;
  head: TransformNode;
  hipL: TransformNode;
  kneeL: TransformNode;
  ankleL: TransformNode;
  hipR: TransformNode;
  kneeR: TransformNode;
  ankleR: TransformNode;
  shoulderL: TransformNode;
  elbowL: TransformNode;
  shoulderR: TransformNode;
  elbowR: TransformNode;
}

export interface Marine {
  root: TransformNode;
  joints: MarineJoints;
  meshes: Mesh[];
}

type P = [number, number, number];
const v = (p: P) => new Vector3(p[0], p[1], p[2]);

/** Materiales compartidos por todos los marines de la escena. */
export interface MarineMaterials {
  body: StandardMaterial;
  visor: StandardMaterial;
}

export function marineMaterials(scene: Scene): MarineMaterials {
  // Blanco: el color lo ponen los vértices.
  const body = material(scene, "marine", "#ffffff");
  const visor = material(scene, "marine-visor", VISOR);
  visor.emissiveColor = color(VISOR);
  visor.disableLighting = true;
  return { body, visor };
}

/** Pinta todos los vértices de una pieza de un color. */
function paint(mesh: Mesh, hex: string): Mesh {
  // Sin pasar a espacio lineal, como los demás colores del juego.
  const c = Color3.FromHexString(hex);
  const n = mesh.getTotalVertices();
  const colors = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

/**
 * Construye un marine. `parts` se van creando en coordenadas del modelo (de pie, mirando a
 * +Z) y al final se funden por articulación.
 */
export function buildMarine(
  scene: Scene,
  palette: MarinePalette,
  materials: MarineMaterials,
  shadows?: ShadowGenerator,
  name = "marine",
): Marine {
  const A = palette.armor;
  const groups = new Map<TransformNode, Mesh[]>();
  const root = new TransformNode(name, scene);

  const joint = (jname: string, at: P, parent: TransformNode): TransformNode => {
    const node = new TransformNode(`${name}-${jname}`, scene);
    node.parent = parent;
    // Posición relativa al padre (todas sin girar: la absoluta menos la del padre).
    const parentAbs = parent === root ? Vector3.Zero() : parent.getAbsolutePosition();
    node.position = v(at).subtract(parentAbs);
    node.computeWorldMatrix(true);
    groups.set(node, []);
    return node;
  };
  const add = (node: TransformNode, mesh: Mesh, hex: string) => {
    groups.get(node)!.push(paint(mesh, hex));
  };
  const box = (at: P, size: P, rot: P = [0, 0, 0]) => {
    const m = MeshBuilder.CreateBox(
      "p",
      { width: size[0], height: size[1], depth: size[2] },
      scene,
    );
    m.position = v(at);
    m.rotation = v(rot);
    return m;
  };
  const ellipsoid = (at: P, size: P, rot: P = [0, 0, 0]) => {
    const m = MeshBuilder.CreateSphere(
      "p",
      { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: 6 },
      scene,
    );
    m.position = v(at);
    m.rotation = v(rot);
    return m;
  };
  /** Cilindro de `from` a `to`. */
  const rod = (from: P, to: P, d: number, dTop = d, tessellation = 8) => {
    const a = v(from);
    const b = v(to);
    const dir = b.subtract(a);
    const m = MeshBuilder.CreateCylinder(
      "p",
      { height: dir.length(), diameterBottom: d, diameterTop: dTop, tessellation },
      scene,
    );
    m.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir.normalize(), m.rotationQuaternion);
    m.position = a.add(b).scale(0.5);
    return m;
  };
  /** Caja alargada de `from` a `to` (brazos y piernas), de sección `w` × `d`. */
  const slab = (from: P, to: P, w: number, d: number) => {
    const a = v(from);
    const b = v(to);
    const dir = b.subtract(a);
    const m = MeshBuilder.CreateBox("p", { width: w, height: dir.length(), depth: d }, scene);
    m.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir.normalize(), m.rotationQuaternion);
    m.position = a.add(b).scale(0.5);
    return m;
  };

  // ---- Articulaciones ----
  const pelvis = joint("pelvis", [0, 1.0, 0], root);
  const torso = joint("torso", [0, 1.12, 0], pelvis);
  const head = joint("head", [0, 1.8, 0.02], torso);
  const legs = ([-1, 1] as const).map((s) => {
    const hip = joint(s < 0 ? "hipL" : "hipR", [s * 0.15, 0.98, 0], pelvis);
    const knee = joint(s < 0 ? "kneeL" : "kneeR", [s * 0.16, 0.56, 0.02], hip);
    const ankle = joint(s < 0 ? "ankleL" : "ankleR", [s * 0.16, 0.14, 0], knee);
    return { s, hip, knee, ankle };
  });
  const shoulderL = joint("shoulderL", [-0.42, 1.56, 0], torso);
  const shoulderR = joint("shoulderR", [0.42, 1.56, 0], torso);
  // Codos en la postura de apuntar: el derecho atrás y abajo, el izquierdo adelantado.
  const elbowR = joint("elbowR", [0.38, 1.22, 0.04], shoulderR);
  const elbowL = joint("elbowL", [-0.2, 1.2, 0.3], shoulderL);

  // ---- Piernas ----
  for (const { s, hip, knee, ankle } of legs) {
    // Muslo: funda oscura y placa de armadura delante.
    add(hip, slab([s * 0.15, 0.98, 0], [s * 0.16, 0.58, 0.02], 0.22, 0.25), UNDERSUIT);
    add(hip, box([s * 0.16, 0.8, 0.1], [0.24, 0.36, 0.1], [-0.05, 0, 0]), A);
    add(hip, box([s * 0.16, 0.8, -0.09], [0.22, 0.32, 0.08], [0.05, 0, 0]), A);
    add(hip, box([s * 0.27, 0.8, 0.0], [0.05, 0.3, 0.2]), A);
    // Rodillera y espinillera.
    add(knee, box([s * 0.16, 0.56, 0.13], [0.2, 0.18, 0.1]), A);
    add(knee, slab([s * 0.16, 0.56, 0.02], [s * 0.16, 0.16, 0], 0.2, 0.22), A);
    add(knee, box([s * 0.16, 0.36, 0.09], [0.21, 0.3, 0.08]), TRIM);
    // Bota.
    add(ankle, box([s * 0.16, 0.08, 0.05], [0.25, 0.16, 0.38]), TRIM);
    add(ankle, box([s * 0.16, 0.12, 0.2], [0.23, 0.1, 0.1], [0.4, 0, 0]), A);
  }

  // ---- Cadera ----
  add(pelvis, box([0, 1.02, 0], [0.5, 0.22, 0.32]), UNDERSUIT);
  add(pelvis, box([0, 1.08, 0.02], [0.54, 0.08, 0.36]), TRIM); // Cinturón.
  for (const s of [-1, 1]) {
    // Escarcelas: placas que cuelgan sobre los muslos.
    add(pelvis, box([s * 0.15, 0.94, 0.18], [0.2, 0.22, 0.05], [-0.15, 0, 0]), A);
    add(pelvis, box([s * 0.28, 0.95, 0], [0.05, 0.22, 0.24], [0, 0, s * 0.15]), A);
  }

  // ---- Torso ----
  add(torso, box([0, 1.22, 0], [0.44, 0.2, 0.3]), UNDERSUIT); // Abdomen.
  add(torso, box([0, 1.5, 0], [0.68, 0.48, 0.44]), A); // Pecho.
  add(torso, box([0, 1.56, 0.24], [0.5, 0.26, 0.06], [-0.12, 0, 0]), A); // Peto.
  add(torso, box([0, 1.6, 0.27], [0.5, 0.05, 0.03], [-0.12, 0, 0]), STRIPE);
  add(torso, box([0, 1.3, 0.2], [0.4, 0.12, 0.06]), TRIM);
  add(torso, box([0, 1.77, -0.02], [0.46, 0.12, 0.38]), A); // Gorjal alto.
  // Mochila y toberas.
  add(torso, box([0, 1.55, -0.34], [0.54, 0.5, 0.26]), TRIM);
  add(torso, box([0, 1.55, -0.48], [0.4, 0.36, 0.04]), A);
  for (const y of [1.47, 1.55, 1.63]) add(torso, box([0, y, -0.505], [0.3, 0.025, 0.02]), TRIM);
  for (const s of [-1, 1]) {
    add(torso, rod([s * 0.16, 1.72, -0.38], [s * 0.18, 1.98, -0.5], 0.12, 0.1), TRIM);
    add(torso, rod([s * 0.18, 1.98, -0.5], [s * 0.185, 2.02, -0.52], 0.08, 0.08), UNDERSUIT);
  }

  // ---- Hombreras (de la caja del pecho, no del brazo: no se mueven con él) ----
  for (const s of [-1, 1]) {
    const tilt = -s * 0.28;
    add(torso, ellipsoid([s * 0.47, 1.66, 0], [0.5, 0.4, 0.56], [0, 0, tilt]), A);
    // Reborde con la franja del Estado.
    const rim = rod([0, -0.03, 0], [0, 0.03, 0], 0.56, 0.54, 14);
    rim.rotationQuaternion = null;
    rim.rotation = v([0, 0, tilt]);
    rim.position = v([s * 0.49, 1.55, 0]);
    add(torso, rim, STRIPE);
  }

  // ---- Cabeza ----
  add(head, ellipsoid([0, 1.95, 0.0], [0.36, 0.36, 0.4]), A); // Casco.
  add(head, box([0, 1.89, 0.17], [0.26, 0.18, 0.1], [0.15, 0, 0]), TRIM); // Frontal.
  add(head, box([0, 1.82, 0.19], [0.14, 0.09, 0.09], [0.3, 0, 0]), UNDERSUIT); // Rejilla.
  add(head, box([0, 2.11, -0.01], [0.06, 0.07, 0.34]), STRIPE); // Cresta.

  // ---- Brazos (postura de apuntar: el fusil, a dos manos delante del pecho) ----
  const arms: [TransformNode, TransformNode, P, P, P][] = [
    [shoulderR, elbowR, [0.42, 1.56, 0], [0.38, 1.22, 0.04], [0.16, 1.3, 0.28]],
    [shoulderL, elbowL, [-0.42, 1.56, 0], [-0.2, 1.2, 0.3], [0.04, 1.33, 0.56]],
  ];
  for (const [shoulder, elbow, s, e, hand] of arms) {
    add(shoulder, slab(s, e, 0.17, 0.18), UNDERSUIT);
    add(shoulder, ellipsoid(e, [0.2, 0.2, 0.2]), TRIM); // Codo.
    add(elbow, slab(e, hand, 0.17, 0.17), A); // Antebrazo blindado.
    add(elbow, box(hand, [0.14, 0.14, 0.14]), TRIM); // Guante.
  }

  // ---- Fusil (en la mano derecha, que lo empuña) ----
  add(elbowR, box([0.12, 1.37, 0.45], [0.13, 0.2, 0.62]), GUN);
  add(elbowR, box([0.12, 1.2, 0.42], [0.08, 0.2, 0.12], [0.2, 0, 0]), GUN_DARK); // Cargador.
  add(elbowR, rod([0.12, 1.4, 0.76], [0.12, 1.4, 1.08], 0.08), GUN_DARK); // Cañón.
  add(elbowR, box([0.12, 1.5, 0.4], [0.06, 0.06, 0.2]), GUN_DARK); // Mira.
  add(elbowR, box([0.12, 1.38, 0.08], [0.1, 0.14, 0.18]), GUN); // Culata.
  add(elbowR, box([0.12, 1.43, 0.45], [0.135, 0.03, 0.5]), STRIPE);

  // ---- Fundir cada grupo en una malla, colgada de su articulación ----
  const meshes: Mesh[] = [];
  for (const [node, parts] of groups) {
    if (parts.length === 0) continue;
    const merged = Mesh.MergeMeshes(parts, true, true)!;
    merged.name = `${node.name}-mesh`;
    merged.material = materials.body;
    merged.setParent(node);
    merged.isPickable = false;
    shadows?.addShadowCaster(merged);
    meshes.push(merged);
  }

  // El visor, aparte: brilla (material emisivo).
  const visor = MeshBuilder.CreateBox("visor", { width: 0.26, height: 0.05, depth: 0.04 }, scene);
  visor.position = v([0, 1.965, 0.2]);
  visor.material = materials.visor;
  visor.setParent(head);
  visor.isPickable = false;
  meshes.push(visor);

  return {
    root,
    joints: {
      pelvis,
      torso,
      head,
      hipL: legs[0]!.hip,
      kneeL: legs[0]!.knee,
      ankleL: legs[0]!.ankle,
      hipR: legs[1]!.hip,
      kneeR: legs[1]!.knee,
      ankleR: legs[1]!.ankle,
      shoulderL,
      elbowL,
      shoulderR,
      elbowR,
    },
    meshes,
  };
}

/** Triángulos de un marine. */
export const marineTriangles = (marine: Marine): number =>
  marine.meshes.reduce((sum, m) => sum + m.getTotalIndices() / 3, 0);

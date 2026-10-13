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

/** Colores: la armadura y los remates (rebordes, costillas del peto, remaches). */
export interface MarinePalette {
  armor: string;
  trim: string;
}

/**
 * Todos los marines iguales (decidido así): azul acero con remates de latón. El propio se
 * reconoce por la cámara, que va detrás, y los demás llevan su apodo encima.
 */
export const MARINE_PALETTE: MarinePalette = { armor: "#4f6b8a", trim: "#b08d3c" };

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
  /** Elipsoide; 4 segmentos bastan para las piezas pequeñas (6, para las cúpulas grandes). */
  const ellipsoid = (at: P, size: P, rot: P = [0, 0, 0], segments = 4) => {
    const m = MeshBuilder.CreateSphere(
      "p",
      { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments },
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

  /** Anillo (toro) horizontal en `at`, girado `rot` y aplastado en Z por `squashZ`. */
  const ring = (at: P, diameter: number, thickness: number, rot: P = [0, 0, 0], squashZ = 1) => {
    const m = MeshBuilder.CreateTorus("p", { diameter, thickness, tessellation: 10 }, scene);
    m.position = v(at);
    m.rotation = v(rot);
    m.scaling = new Vector3(1, 1, squashZ);
    return m;
  };

  // ---- Articulaciones ----
  const pelvis = joint("pelvis", [0, 1.02, 0], root);
  const torso = joint("torso", [0, 1.14, 0], pelvis);
  const head = joint("head", [0, 1.8, 0.03], torso);
  const legs = ([-1, 1] as const).map((s) => {
    const hip = joint(s < 0 ? "hipL" : "hipR", [s * 0.16, 1.0, 0], pelvis);
    const knee = joint(s < 0 ? "kneeL" : "kneeR", [s * 0.17, 0.62, 0.02], hip);
    const ankle = joint(s < 0 ? "ankleL" : "ankleR", [s * 0.17, 0.13, 0], knee);
    return { s, hip, knee, ankle };
  });
  const shoulderL = joint("shoulderL", [-0.42, 1.56, 0], torso);
  const shoulderR = joint("shoulderR", [0.42, 1.56, 0], torso);
  // Codos en la postura de apuntar: el derecho atrás y abajo, el izquierdo adelantado.
  const elbowR = joint("elbowR", [0.38, 1.22, 0.04], shoulderR);
  const elbowL = joint("elbowL", [-0.2, 1.2, 0.3], shoulderL);

  const T = palette.trim;

  // ---- Piernas: muslos gruesos, rodilleras grandes y espinilleras que se ensanchan abajo ----
  for (const { s, hip, knee, ankle } of legs) {
    add(hip, rod([s * 0.16, 1.0, 0], [s * 0.17, 0.66, 0.02], 0.3, 0.27, 10), A);
    add(hip, ellipsoid([s * 0.17, 0.82, 0.08], [0.26, 0.3, 0.14]), A); // Placa del muslo.
    add(knee, ellipsoid([s * 0.17, 0.63, 0.1], [0.27, 0.27, 0.2], [0, 0, 0], 6), A); // Rodillera.
    add(knee, ellipsoid([s * 0.17, 0.63, 0.19], [0.12, 0.12, 0.04]), T);
    // Espinillera: más ancha abajo, como una campana sobre la bota.
    add(knee, rod([s * 0.17, 0.6, 0.02], [s * 0.17, 0.12, 0.02], 0.25, 0.34, 10), A);
    add(knee, ring([s * 0.17, 0.42, 0.02], 0.27, 0.035), T);
    add(ankle, box([s * 0.17, 0.065, 0.06], [0.3, 0.13, 0.44]), UNDERSUIT); // Bota.
    add(ankle, ellipsoid([s * 0.17, 0.08, 0.24], [0.28, 0.14, 0.16]), T); // Puntera.
  }

  // ---- Cadera: faldón delantero, cinturón con hebilla redonda y cartucheras ----
  add(pelvis, ellipsoid([0, 1.0, 0], [0.54, 0.3, 0.36]), UNDERSUIT);
  add(pelvis, ring([0, 1.1, 0.01], 0.46, 0.07, [0, 0, 0], 0.75), T); // Cinturón.
  add(pelvis, rod([0, 1.1, 0.17], [0, 1.1, 0.22], 0.14, 0.13, 12), T); // Hebilla.
  for (const s of [-1, 1]) {
    add(pelvis, box([s * 0.15, 1.1, 0.19], [0.1, 0.11, 0.07]), UNDERSUIT); // Cartuchera.
    add(pelvis, box([s * 0.15, 0.96, 0.19], [0.17, 0.2, 0.05], [-0.15, 0, 0]), A); // Faldón.
    add(pelvis, box([s * 0.3, 0.98, 0], [0.05, 0.24, 0.28], [0, 0, s * 0.18]), A);
  }

  // ---- Torso: abdomen de cables anillados, pecho ancho con placa, gorjal alto ----
  for (const [i, y] of [1.15, 1.2, 1.25, 1.3].entries()) {
    add(torso, ring([0, y, 0], 0.32, 0.055, [0, 0, 0], 0.8), i % 2 ? T : UNDERSUIT);
  }
  add(torso, ellipsoid([0, 1.22, 0], [0.38, 0.22, 0.28]), UNDERSUIT);
  add(torso, ellipsoid([0, 1.54, -0.01], [0.74, 0.52, 0.5], [0, 0, 0], 6), A); // Pecho.
  add(torso, ellipsoid([0, 1.6, 0.13], [0.6, 0.34, 0.3], [-0.1, 0, 0], 6), A); // Placa.
  add(torso, box([0, 1.62, 0.27], [0.36, 0.05, 0.04], [-0.12, 0, 0]), T); // Franja del peto.
  add(torso, box([0, 1.55, 0.27], [0.24, 0.04, 0.04], [-0.12, 0, 0]), T);
  add(torso, ring([0, 1.78, -0.01], 0.36, 0.14, [0, 0, 0], 0.95), A); // Gorjal.
  // Mochila con toberas anilladas y rejillas.
  add(torso, box([0, 1.55, -0.33], [0.5, 0.46, 0.24]), UNDERSUIT);
  add(torso, ellipsoid([0, 1.77, -0.34], [0.52, 0.24, 0.28]), A);
  add(torso, ellipsoid([0, 1.55, -0.45], [0.42, 0.4, 0.08]), A);
  for (const y of [1.47, 1.55, 1.63]) add(torso, box([0, y, -0.495], [0.26, 0.025, 0.02]), T);
  for (const s of [-1, 1]) {
    add(torso, rod([s * 0.16, 1.72, -0.38], [s * 0.18, 1.96, -0.48], 0.12, 0.1, 10), UNDERSUIT);
    add(torso, ring([s * 0.17, 1.84, -0.43], 0.12, 0.03, [0.4, 0, 0]), T);
  }

  // ---- Hombreras: conchas altas pegadas al cuerpo, que caen sobre el brazo ----
  for (const s of [-1, 1]) {
    add(torso, ellipsoid([s * 0.47, 1.63, 0], [0.34, 0.5, 0.56], [0, 0, -s * 0.1], 6), A);
    // Reborde en la cara exterior.
    const rim = ring([s * 0.6, 1.6, 0], 0.42, 0.05, [0, 0, Math.PI / 2], 1.15);
    add(torso, rim, T);
  }

  // ---- Cabeza: casco pequeño y hundido, hocico de rejilla y tubos de respiración ----
  add(head, ellipsoid([0, 1.95, -0.01], [0.3, 0.32, 0.34], [0, 0, 0], 6), A);
  add(head, box([0, 1.85, 0.14], [0.17, 0.15, 0.12], [0.45, 0, 0]), A); // Hocico.
  for (const y of [1.82, 1.85, 1.88]) {
    add(head, box([0, y, 0.2 - (y - 1.82) * 0.45], [0.1, 0.012, 0.02], [0.45, 0, 0]), UNDERSUIT);
  }
  add(head, ellipsoid([0, 1.94, 0.13], [0.24, 0.08, 0.08]), UNDERSUIT); // Hueco de los ojos.
  for (const s of [-1, 1]) {
    add(head, rod([s * 0.08, 1.85, 0.14], [s * 0.13, 1.8, 0.05], 0.05, 0.045, 8), T);
  }
  add(head, box([0, 2.1, -0.01], [0.06, 0.05, 0.32]), STRIPE); // Cresta.

  // ---- Brazos (postura de apuntar: el fusil, a dos manos delante del pecho) ----
  const arms: [TransformNode, TransformNode, P, P, P][] = [
    [shoulderR, elbowR, [0.42, 1.56, 0], [0.38, 1.22, 0.04], [0.16, 1.3, 0.28]],
    [shoulderL, elbowL, [-0.42, 1.56, 0], [-0.2, 1.2, 0.3], [0.04, 1.33, 0.56]],
  ];
  for (const [shoulder, elbow, sh, e, hand] of arms) {
    add(shoulder, rod(sh, e, 0.19, 0.17, 8), UNDERSUIT);
    add(shoulder, ellipsoid(e, [0.21, 0.21, 0.21]), T); // Codo.
    add(elbow, rod(e, hand, 0.21, 0.18, 10), A); // Brazal.
    const wrist = v(e).scale(0.15).add(v(hand).scale(0.85));
    add(elbow, rod([wrist.x, wrist.y, wrist.z], hand, 0.2, 0.2, 10), T);
    add(elbow, ellipsoid(hand, [0.16, 0.15, 0.17]), UNDERSUIT); // Guante.
  }

  // ---- Fusil (en la mano derecha, que lo empuña): grueso, con boca ancha ----
  add(elbowR, box([0.12, 1.37, 0.45], [0.15, 0.22, 0.62]), GUN);
  add(elbowR, box([0.12, 1.2, 0.43], [0.09, 0.22, 0.13], [0.25, 0, 0]), GUN_DARK); // Cargador.
  add(elbowR, rod([0.12, 1.41, 0.76], [0.12, 1.41, 1.0], 0.1, 0.1, 10), GUN_DARK); // Cañón.
  add(elbowR, rod([0.12, 1.41, 1.0], [0.12, 1.41, 1.06], 0.13, 0.13, 10), GUN); // Boca.
  add(elbowR, box([0.12, 1.52, 0.38], [0.07, 0.07, 0.22]), GUN_DARK); // Mira.
  add(elbowR, box([0.12, 1.38, 0.08], [0.11, 0.15, 0.18]), GUN); // Culata.
  add(elbowR, box([0.2, 1.4, 0.45], [0.012, 0.06, 0.44]), STRIPE);

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

  // Los ojos, aparte: brillan (material emisivo).
  const eyes = Mesh.MergeMeshes(
    [-1, 1].map((s) => {
      const eye = MeshBuilder.CreateSphere(
        "eye",
        { diameterX: 0.075, diameterY: 0.05, diameterZ: 0.04, segments: 6 },
        scene,
      );
      eye.position = v([s * 0.058, 1.945, 0.165]);
      eye.rotation = v([0, 0, s * 0.25]);
      return eye;
    }),
    true,
  )!;
  eyes.name = `${name}-eyes`;
  eyes.material = materials.visor;
  eyes.setParent(head);
  eyes.isPickable = false;
  meshes.push(eyes);

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

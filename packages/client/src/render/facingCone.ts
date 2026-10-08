import {
  Color3,
  type LinesMesh,
  Mesh,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  type TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import { GAME_CONFIG } from "@udc/shared";

/** Puntos de un arco de `radius` metros entre −`halfAngle` y +`halfAngle`, hacia +Z local. */
export function arcPoints(halfAngle: number, radius: number, segments: number): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    // Adelante = (sin a, cos a): yaw = 0 mira hacia +Z (convención de la simulación).
    points.push(new Vector3(Math.sin(a) * radius, 0, Math.cos(a) * radius));
  }
  return points;
}

/** Segmentos de cada arco (bastan para que se vea curvo). */
const SEGMENTS = 24;
/** Distancia a la que empieza el abanico (fuera del cuerpo del soldado). */
const INNER = 0.8;
/** Altura sobre el suelo (para que no parpadee con él). */
const LIFT = 0.04;

const IDLE = Color3.FromHexString("#d8d2c4");
const ACTIVE = Color3.FromHexString("#ffd36b");

export interface FacingCone {
  /** Más vivo cuando el objetivo está dentro y se le puede disparar. */
  setActive(active: boolean): void;
}

/**
 * Cono de disparo del soldado propio en el suelo (prueba de H3): el abanico de ±20° hasta el
 * alcance del fuego automático, y un arco discontinuo al alcance del disparo apuntado. Cuelga
 * del nodo del soldado, así que gira con el cuerpo (no con la cámara), como el cono de verdad.
 * Se dibuja encima de todo (grupo 1), tenue, para que se vea también sobre la plataforma.
 */
export function createFacingCone(scene: Scene, parent: TransformNode): FacingCone {
  const { facingHalfAngle, autoFire } = GAME_CONFIG.combat;
  const aimedRange = GAME_CONFIG.abilities.aimedShot.range;

  // Abanico relleno, muy transparente.
  const inner = arcPoints(facingHalfAngle, INNER, SEGMENTS);
  const outer = arcPoints(facingHalfAngle, autoFire.range, SEGMENTS);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    positions.push(inner[i]!.x, 0, inner[i]!.z, outer[i]!.x, 0, outer[i]!.z);
    if (i === SEGMENTS) continue;
    const a = i * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const fill = new Mesh("facing-cone-fill", scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(fill);
  const fillMat = new StandardMaterial("facing-cone-fill", scene);
  fillMat.disableLighting = true;
  fillMat.backFaceCulling = false;
  fillMat.alpha = 0.05;
  fill.material = fillMat;

  // Contorno hasta el fuego automático y arco discontinuo del disparo apuntado.
  const edge = MeshBuilder.CreateLines(
    "facing-cone-edge",
    { points: [inner[0]!, outer[0]!, ...outer.slice(1), inner[SEGMENTS]!] },
    scene,
  );
  const aimedArc = arcPoints(facingHalfAngle, aimedRange, SEGMENTS);
  const aimed = MeshBuilder.CreateDashedLines(
    "facing-cone-aimed",
    {
      points: [outer[0]!, aimedArc[0]!, ...aimedArc.slice(1), outer[SEGMENTS]!],
      dashNb: 60,
      dashSize: 2,
      gapSize: 2,
    },
    scene,
  );

  const lines: LinesMesh[] = [edge, aimed];
  for (const mesh of [fill, ...lines]) {
    mesh.parent = parent;
    mesh.position.y = LIFT;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
  }

  function setActive(active: boolean): void {
    const color = active ? ACTIVE : IDLE;
    fillMat.emissiveColor = color;
    fillMat.alpha = active ? 0.09 : 0.05;
    edge.color = color;
    edge.alpha = active ? 0.7 : 0.35;
    aimed.color = color;
    aimed.alpha = active ? 0.45 : 0.25;
  }
  setActive(false);
  return { setActive };
}

import { floodFillPruneNavMesh, init, NavMeshQuery, type NavMesh } from "recast-navigation";
import { generateSoloNavMesh } from "recast-navigation/generators";
import { GAME_CONFIG, MAP, type MapData, type Point } from "@udc/shared";

/*
 * Navmesh de los centollos y los colonos (E4-1, spec §4.6 y §7.5).
 *
 * El mundo es plano: la geometría de entrada es un suelo del tamaño del mapa y cada obstáculo
 * levantado como una caja. Recast deja islas caminables encima de los tejados y dentro de los
 * edificios (bajo el tejado hay altura de sobra), así que después de generar se desactiva todo
 * lo que no está conectado con la plataforma.
 */

/** Altura de las cajas en la geometría de entrada, en metros: basta con que supere el escalón. */
const OBSTACLE_HEIGHT = 2;
/** Altura de celda de Recast, en metros. En un mundo plano solo importa frente a los escalones. */
const CELL_HEIGHT = 0.2;
/** Escalón máximo que se puede subir, en metros (el suelo es plano: solo sirve para no subir a las cajas). */
const WALKABLE_CLIMB = 0.4;
/** Altura libre necesaria, en metros. Centollos y colonos caben en 1 m. */
const WALKABLE_HEIGHT = 1;
/** Distancia de búsqueda por eje al situar un punto sobre la navmesh, en metros. */
const QUERY_HALF_EXTENTS = { x: 2, y: 1, z: 2 };
/** Tolerancia para dar un punto por "sobre la navmesh" (los del borde cuentan), en metros. */
const ON_MESH_TOLERANCE = 0.05;

/** Geometría de entrada para Recast: posiciones (x, y, z) e índices de triángulos. */
export interface NavGeometry {
  positions: number[];
  indices: number[];
}

/**
 * Convierte el mapa en triángulos: el suelo y una caja por obstáculo, con la convención de
 * rotación de `shared/src/sim/collision.ts`. Los triángulos horizontales miran hacia arriba.
 */
export function mapToGeometry(map: MapData): NavGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  /** Añade un cuadrilátero (a, b, c, d en orden antihorario visto desde arriba). */
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): void => {
    const i = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
  };

  const half = map.size / 2;
  quad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half]);

  for (const box of map.obstacles) {
    const cos = Math.cos(box.rot);
    const sin = Math.sin(box.rot);
    const toWorld = (lx: number, lz: number, y: number): Vec3 => [
      box.x + lx * cos - lz * sin,
      y,
      box.z + lx * sin + lz * cos,
    ];
    const hw = box.w / 2;
    const hd = box.d / 2;
    const corners: [number, number][] = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
    const top = corners.map(([lx, lz]) => toWorld(lx, lz, OBSTACLE_HEIGHT)) as [
      Vec3,
      Vec3,
      Vec3,
      Vec3,
    ];
    quad(...top);
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k]!;
      const [bx, bz] = corners[(k + 1) % 4]!;
      quad(
        toWorld(ax, az, 0),
        toWorld(bx, bz, 0),
        toWorld(bx, bz, OBSTACLE_HEIGHT),
        toWorld(ax, az, OBSTACLE_HEIGHT),
      );
    }
  }

  return { positions, indices };
}

type Vec3 = [number, number, number];

/** Navmesh generada y lista para consultar. */
export class NavMap {
  private readonly query: NavMeshQuery;

  constructor(
    /** Para el `Crowd` de los centollos (E4-2). */
    readonly navMesh: NavMesh,
  ) {
    this.query = new NavMeshQuery(navMesh);
    this.query.defaultQueryHalfExtents = { ...QUERY_HALF_EXTENTS };
  }

  /** Número de polígonos caminables (los podados no cuentan). */
  get polyCount(): number {
    let count = 0;
    for (let t = 0; t < this.navMesh.getMaxTiles(); t++) {
      const tile = this.navMesh.getTile(t);
      const header = tile.header();
      if (!header) continue;
      const base = this.navMesh.getPolyRefBase(tile);
      for (let p = 0; p < header.polyCount(); p++) {
        if (this.navMesh.getPolyFlags(base | p).flags !== 0) count++;
      }
    }
    return count;
  }

  /**
   * Camino de `from` a `to` como puntos de giro (incluidos los extremos), o `null` si alguno de
   * los dos está a más de 2 m de la navmesh. Si `to` está en otra zona sin conexión, Detour
   * devuelve el camino hasta el punto alcanzable más cercano.
   */
  findPath(from: Point, to: Point): Point[] | null {
    // Detour da por buena la búsqueda aunque no encuentre polígono (ref 0): se comprueba aquí.
    if (this.closestPoint(from) === null || this.closestPoint(to) === null) return null;
    const result = this.query.computePath(toVec3(from), toVec3(to));
    if (!result.success || result.path.length === 0) return null;
    return result.path.map((p) => ({ x: p.x, z: p.z }));
  }

  /** Punto de la navmesh más cercano a `p`, buscando hasta `searchRadius` metros; `null` si no hay. */
  closestPoint(p: Point, searchRadius = QUERY_HALF_EXTENTS.x): Point | null {
    const result = this.query.findClosestPoint(toVec3(p), {
      halfExtents: { x: searchRadius, y: QUERY_HALF_EXTENTS.y, z: searchRadius },
    });
    if (!result.success || result.polyRef === 0) return null;
    // Detour busca entre los polígonos cuya caja envolvente toca la zona de búsqueda: el punto
    // devuelto puede quedar mucho más lejos (un polígono grande que rodea un hueco).
    if (
      Math.abs(result.point.x - p.x) > searchRadius ||
      Math.abs(result.point.z - p.z) > searchRadius
    ) {
      return null;
    }
    return { x: result.point.x, z: result.point.z };
  }

  /** ¿Está `p` sobre un polígono caminable (o en su borde)? */
  isOnNavMesh(p: Point): boolean {
    return this.closestPoint(p, ON_MESH_TOLERANCE) !== null;
  }

  destroy(): void {
    this.query.destroy();
    this.navMesh.destroy();
  }
}

function toVec3(p: Point): { x: number; y: number; z: number } {
  return { x: p.x, y: 0, z: p.z };
}

let wasmReady: Promise<void> | null = null;

/**
 * Genera la navmesh del mapa: carga el WASM de Recast (una vez), genera y poda las islas que no
 * están conectadas con la plataforma.
 */
export async function buildNavMesh(map: MapData = MAP): Promise<NavMap> {
  wasmReady ??= init();
  await wasmReady;

  const { cellSize, agentRadius } = GAME_CONFIG.navmesh;
  const { positions, indices } = mapToGeometry(map);
  const result = generateSoloNavMesh(positions, indices, {
    cs: cellSize,
    ch: CELL_HEIGHT,
    walkableRadius: Math.ceil(agentRadius / cellSize),
    walkableHeight: Math.ceil(WALKABLE_HEIGHT / CELL_HEIGHT),
    walkableClimb: Math.floor(WALKABLE_CLIMB / CELL_HEIGHT),
    walkableSlopeAngle: 45,
    // Las unidades de Recast son celdas (vóxeles): bordes de hasta 10 m.
    maxEdgeLen: Math.round(10 / cellSize),
    maxSimplificationError: 1.3,
    minRegionArea: 8,
    mergeRegionArea: 20,
    maxVertsPerPoly: 6,
    detailSampleDist: 6,
    detailSampleMaxError: 1,
  });
  if (!result.success) throw new Error(`No se pudo generar la navmesh: ${result.error}`);

  // Poda: se queda solo lo conectado con la plataforma.
  const query = new NavMeshQuery(result.navMesh);
  const start = query.findNearestPoly(toVec3(map.landingPad), { halfExtents: QUERY_HALF_EXTENTS });
  query.destroy();
  if (!start.success || start.nearestRef === 0) {
    result.navMesh.destroy();
    throw new Error("La plataforma no está sobre la navmesh");
  }
  floodFillPruneNavMesh(result.navMesh, [start.nearestRef]);
  return new NavMap(result.navMesh);
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GAME_CONFIG,
  MAP,
  pushCircleOutOfBox,
  segmentCrossesBox,
  type MapData,
  type Obstacle,
  type Point,
} from "@udc/shared";
import { buildNavMesh, mapToGeometry, type NavMap } from "./navmesh.js";

const p = (x: number, z: number): Point => ({ x, z });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Margen mínimo que se exige a los puntos del camino: el de la config menos una celda de redondeo. */
const MIN_MARGIN = GAME_CONFIG.navmesh.agentRadius - GAME_CONFIG.navmesh.cellSize;

/** ¿Está `q` a menos de `radius` de la caja (o dentro)? */
const tooClose = (q: Point, box: Obstacle, radius: number) => {
  const out = pushCircleOutOfBox(q.x, q.z, radius, box);
  return out.x !== q.x || out.z !== q.z;
};

const box = (id: string, x: number, z: number, w: number, d: number, rot = 0): Obstacle => ({
  id,
  kind: "wall",
  x,
  z,
  w,
  d,
  h: 3,
  rot,
});

describe("mapToGeometry", () => {
  const map: MapData = { ...MAP, obstacles: [box("b", 10, 20, 4, 2, Math.PI / 2)] };
  const { positions, indices } = mapToGeometry(map);
  const vertex = (i: number) => positions.slice(i * 3, i * 3 + 3);

  it("genera el suelo y una caja de 5 caras por obstáculo", () => {
    expect(positions.length / 3).toBe(4 + 5 * 4);
    expect(indices.length / 3).toBe(2 + 5 * 2);
  });

  it("el suelo cubre todo el mapa", () => {
    const half = MAP.size / 2;
    expect(vertex(0)).toEqual([-half, 0, -half]);
    expect(vertex(2)).toEqual([half, 0, half]);
  });

  it("gira las cajas con la convención de collision.ts", () => {
    // Esquina local (w/2, −d/2) = (2, −1) girada 90°: x = 10 + 2·cos − (−1)·sin = 11; z = 20 + 2·sin + (−1)·cos = 22.
    const [x, , z] = vertex(5)!;
    expect(x).toBeCloseTo(11);
    expect(z).toBeCloseTo(22);
  });

  it("los triángulos horizontales miran hacia arriba (si no, Recast no los considera suelo)", () => {
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!].map(vertex);
      const ux = b![0]! - a![0]!;
      const uy = b![1]! - a![1]!;
      const uz = b![2]! - a![2]!;
      const vx = c![0]! - a![0]!;
      const vy = c![1]! - a![1]!;
      const vz = c![2]! - a![2]!;
      const ny = uz * vx - ux * vz;
      const horizontal = uy === 0 && vy === 0;
      if (horizontal) expect(ny).toBeGreaterThan(0);
    }
  });
});

describe("buildNavMesh con el mapa de la colonia", () => {
  let nav: NavMap;
  beforeAll(async () => {
    nav = await buildNavMesh(MAP);
  });
  afterAll(() => nav.destroy());

  it("tiene polígonos caminables", () => {
    expect(nav.polyCount).toBeGreaterThan(0);
  });

  it("la plataforma es alcanzable desde las 6 madrigueras", () => {
    expect(MAP.burrows).toHaveLength(6);
    for (const burrow of MAP.burrows) {
      const path = nav.findPath(burrow, MAP.landingPad);
      expect(path, `madriguera (${burrow.x}, ${burrow.z})`).not.toBeNull();
      expect(dist(path!.at(-1)!, MAP.landingPad)).toBeLessThan(0.5);
    }
  });

  it("los caminos rodean los obstáculos con margen", () => {
    const starts = [...MAP.burrows, p(-20, 10), p(20, 10), p(-10, -15), p(-55, 50), p(60, -55)];
    for (const start of starts) {
      const path = nav.findPath(start, MAP.landingPad)!;
      for (let i = 1; i < path.length; i++) {
        for (const obstacle of MAP.obstacles) {
          expect(segmentCrossesBox(path[i - 1]!, path[i]!, obstacle), obstacle.id).toBe(false);
        }
      }
      for (const point of path) {
        for (const obstacle of MAP.obstacles) {
          expect(
            tooClose(point, obstacle, MIN_MARGIN),
            `${obstacle.id} en (${point.x}, ${point.z})`,
          ).toBe(false);
        }
      }
    }
  });

  it("para cruzar un muro hay que rodearlo", () => {
    // muro-1: de x = −29 a −11 en z = 20.
    const path = nav.findPath(p(-20, 10), p(-20, 30))!;
    expect(path.length).toBeGreaterThan(2);
    expect(path.some((q) => q.x < -29 || q.x > -11)).toBe(true);
  });

  it("el interior de los edificios no es caminable y closestPoint lo saca fuera", () => {
    for (const building of MAP.obstacles.filter((o) => o.kind === "building")) {
      expect(nav.isOnNavMesh(building), building.id).toBe(false);
      const out = nav.closestPoint(building, 12);
      expect(out, building.id).not.toBeNull();
      expect(tooClose(out!, building, MIN_MARGIN), building.id).toBe(false);
      expect(nav.isOnNavMesh(out!)).toBe(true);
    }
  });
});

describe("buildNavMesh poda lo que no está conectado con la plataforma", () => {
  // Un recinto cerrado de 10 × 10 m en (−50, −50), lejos de la plataforma.
  const ring = [
    box("n", -50, -55, 11, 1),
    box("s", -50, -45, 11, 1),
    box("o", -55, -50, 1, 11),
    box("e", -45, -50, 1, 11),
  ];
  const map: MapData = { ...MAP, obstacles: ring };
  let nav: NavMap;
  beforeAll(async () => {
    nav = await buildNavMesh(map);
  });
  afterAll(() => nav.destroy());

  it("dentro del recinto no hay navmesh", () => {
    expect(nav.isOnNavMesh(p(-50, -50))).toBe(false);
    expect(nav.findPath(p(-50, -50), map.landingPad)).toBeNull();
  });

  it("fuera del recinto sí", () => {
    expect(nav.isOnNavMesh(p(-50, -40))).toBe(true);
  });
});

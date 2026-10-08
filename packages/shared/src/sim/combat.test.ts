import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/game.config.js";
import { MAP, type MapData } from "../map/index.js";
import { canAutoFireAt, clampToRange, isFacing, nearestShootable, shotBlocker } from "./combat.js";

const { range } = GAME_CONFIG.combat.autoFire;
const open: MapData = { ...MAP, obstacles: [] };
const walled: MapData = {
  ...MAP,
  obstacles: [{ id: "m", kind: "wall", x: 0, z: 5, w: 4, d: 1, h: 3, rot: 0 }],
};

describe("canAutoFireAt", () => {
  it("a alcance y con visión, sí", () => {
    expect(canAutoFireAt({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 10 }, open)).toBe(true);
  });

  it("fuera de alcance, no", () => {
    expect(canAutoFireAt({ x: 0, z: 0, yaw: 0 }, { x: 0, z: range + 0.01 }, open)).toBe(false);
  });

  it("con un muro en medio, no", () => {
    expect(canAutoFireAt({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 10 }, walled)).toBe(false);
  });
});

describe("clampToRange", () => {
  it("no toca un punto a alcance", () => {
    expect(clampToRange({ x: 0, z: 0 }, { x: 3, z: 4 }, 10)).toEqual({ x: 3, z: 4 });
  });

  it("acerca un punto lejano en la misma dirección", () => {
    const p = clampToRange({ x: 1, z: 1 }, { x: 1, z: 41 }, 20);
    expect(p.x).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(21);
  });
});

describe("isFacing", () => {
  const facingNorth = { x: 0, z: 0, yaw: 0 }; // mira hacia +Z
  const half = Math.PI / 2;

  it("lo que está delante, sí", () => {
    expect(isFacing(facingNorth, { x: 0, z: 10 }, half)).toBe(true);
    expect(isFacing(facingNorth, { x: 8, z: 1 }, half)).toBe(true);
  });

  it("justo a un lado (90°), sí; detrás, no", () => {
    expect(isFacing(facingNorth, { x: 10, z: 0 }, half)).toBe(true);
    expect(isFacing(facingNorth, { x: 0, z: -10 }, half)).toBe(false);
    expect(isFacing(facingNorth, { x: 10, z: -1 }, half)).toBe(false);
  });

  it("respeta la orientación", () => {
    expect(isFacing({ x: 0, z: 0, yaw: Math.PI }, { x: 0, z: -10 }, half)).toBe(true);
  });

  it("un cono más estrecho deja fuera los laterales", () => {
    expect(isFacing(facingNorth, { x: 10, z: 1 }, Math.PI / 3)).toBe(false);
  });
});

describe("shotBlocker", () => {
  it("da el motivo: alcance, luego orientación, luego visión", () => {
    const me = { x: 0, z: 0, yaw: 0 };
    expect(shotBlocker(me, { x: 0, z: 10 }, 30, open)).toBeNull();
    expect(shotBlocker(me, { x: 0, z: 31 }, 30, open)).toBe("outOfRange");
    expect(shotBlocker(me, { x: 0, z: -10 }, 30, open)).toBe("notFacing");
    expect(shotBlocker(me, { x: 0, z: 10 }, 30, walled)).toBe("noLineOfSight");
  });
});

describe("cono de disparo de la configuración", () => {
  it("es de ±20°: un objetivo a 25° del frente queda fuera", () => {
    const me = { x: 0, z: 0, yaw: 0 };
    const at = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return { x: Math.sin(a) * 10, z: Math.cos(a) * 10 };
    };
    expect(shotBlocker(me, at(15), 30, open)).toBeNull();
    expect(shotBlocker(me, at(25), 30, open)).toBe("notFacing");
  });
});

describe("nearestShootable", () => {
  // Mirando hacia +Z desde el origen.
  const me = { x: 0, z: 0, yaw: 0 };
  const c = (id: number, x: number, z: number) => ({ id, x, z });

  it("elige el más cercano de los que tiene delante", () => {
    const pick = nearestShootable(me, [c(1, 0, 20), c(2, 0.5, 8), c(3, -1, 12)], open);
    expect(pick?.id).toBe(2);
  });

  it("ignora a los que quedan fuera del cono, aunque estén más cerca", () => {
    // A 2 m, pero a 90°: fuera del cono de ±20°.
    const pick = nearestShootable(me, [c(1, 2, 0), c(2, 0, 15)], open);
    expect(pick?.id).toBe(2);
  });

  it("ignora a los que están fuera de alcance", () => {
    expect(nearestShootable(me, [c(1, 0, range + 1)], open)).toBeNull();
  });

  it("ignora a los que tapa un obstáculo", () => {
    // Un poste de 1 m en (0, 5) tapa (0, 10); (2.5, 10.5) se ve por el lado y sigue en el cono.
    const post: MapData = {
      ...MAP,
      obstacles: [{ id: "p", kind: "wall", x: 0, z: 5, w: 1, d: 1, h: 3, rot: 0 }],
    };
    const pick = nearestShootable(me, [c(1, 0, 10), c(2, 2.5, 10.5)], post);
    expect(pick?.id).toBe(2);
  });

  it("sin candidatos válidos, null", () => {
    expect(nearestShootable(me, [], open)).toBeNull();
    expect(nearestShootable(me, [c(1, 0, -5)], open)).toBeNull();
  });
});

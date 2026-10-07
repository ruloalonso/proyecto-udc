import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/game.config.js";
import { MAP, type MapData } from "../map/index.js";
import { canAutoFireAt, clampToRange, isFacing, shotBlocker } from "./combat.js";

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

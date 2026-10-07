import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/game.config.js";
import { MAP, type MapData } from "../map/index.js";
import { canAutoFireAt } from "./combat.js";

const { range } = GAME_CONFIG.combat.autoFire;
const open: MapData = { ...MAP, obstacles: [] };
const walled: MapData = {
  ...MAP,
  obstacles: [{ id: "m", kind: "wall", x: 0, z: 5, w: 4, d: 1, h: 3, rot: 0 }],
};

describe("canAutoFireAt", () => {
  it("a alcance y con visión, sí", () => {
    expect(canAutoFireAt({ x: 0, z: 0 }, { x: 0, z: 10 }, open)).toBe(true);
  });

  it("fuera de alcance, no", () => {
    expect(canAutoFireAt({ x: 0, z: 0 }, { x: 0, z: range + 0.01 }, open)).toBe(false);
  });

  it("con un muro en medio, no", () => {
    expect(canAutoFireAt({ x: 0, z: 0 }, { x: 0, z: 10 }, walled)).toBe(false);
  });
});

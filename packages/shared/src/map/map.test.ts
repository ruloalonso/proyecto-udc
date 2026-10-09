import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/game.config.js";
import { distanceToBox, pushCircleOutOfBox } from "../sim/collision.js";
import { MAP } from "./index.js";

describe("mapa: rutas de colonos (E6-2)", () => {
  for (const route of MAP.routes) {
    it(`${route.id}: la puerta está fuera de los obstáculos, junto a su edificio y de cara a la plataforma`, () => {
      const building = MAP.obstacles.find((o) => o.id === route.building)!;
      expect(building.kind).toBe("building");
      const { exit } = route;
      for (const box of MAP.obstacles) {
        expect(pushCircleOutOfBox(exit.x, exit.z, GAME_CONFIG.colonists.radius, box)).toEqual(exit);
      }
      expect(distanceToBox(exit.x, exit.z, building)).toBeLessThan(3);
      const pad = MAP.landingPad;
      const toPad = (p: { x: number; z: number }) => Math.hypot(pad.x - p.x, pad.z - p.z);
      expect(toPad(exit)).toBeLessThan(toPad(building));
    });
  }
});

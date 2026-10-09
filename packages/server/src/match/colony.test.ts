import { describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS } from "@udc/shared";
import { Colony } from "./colony.js";

const { perBuilding, activationRange, group } = GAME_CONFIG.colonists;
const GROUP_TICKS = Math.round(group.interval / TICK_SECONDS);
/** Junto a la puerta del primer edificio. */
const door = MAP.routes[0]!.exit;
const soldierAt = (x: number, z: number) => [{ id: 7, x, z }];

describe("Colony: edificios de colonos (E6-2)", () => {
  it(`se activa con un soldado a ${activationRange} m o menos, una sola vez`, () => {
    const c = new Colony(MAP);
    const building = MAP.obstacles.find((o) => o.id === MAP.routes[0]!.building)!;
    // Lejos (a 20 m del borde de enfrente): nada.
    expect(c.activate(1, soldierAt(building.x, building.z + building.d / 2 + 20))).toEqual([]);
    expect(c.activate(2, soldierAt(door.x, door.z))).toEqual([{ building: 0, by: 7 }]);
    expect(c.isActive(0)).toBe(true);
    // Es un interruptor: no vuelve a activarse.
    expect(c.activate(3, soldierAt(door.x, door.z))).toEqual([]);
  });

  it("de lejos no se sabe cuántos hay dentro; activado, se ve el contador", () => {
    const c = new Colony(MAP);
    expect(c.status().buildings).toEqual([null, null, null, null]);
    c.activate(1, soldierAt(door.x, door.z));
    expect(c.status().buildings).toEqual([perBuilding, null, null, null]);
  });

  it(`suelta un grupo de ${group.min}–${group.max} al momento y otro cada ${group.interval} s hasta vaciarse`, () => {
    const c = new Colony(MAP);
    c.activate(10, soldierAt(door.x, door.z));
    const sizes: number[] = [];
    const ticks: number[] = [];
    for (let t = 10; t < 10 + GROUP_TICKS * 10; t++) {
      for (const r of c.releases(t)) {
        sizes.push(r.count);
        ticks.push(t);
      }
    }
    expect(ticks[0]).toBe(10);
    expect(ticks[1]).toBe(10 + GROUP_TICKS);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(perBuilding);
    // Todos los grupos dentro del rango, menos quizá el último (lo que quede).
    for (const n of sizes.slice(0, -1)) {
      expect(n).toBeGreaterThanOrEqual(group.min);
      expect(n).toBeLessThanOrEqual(group.max);
    }
    expect(c.remainingIn(0)).toBe(0);
    expect(c.status().buildings[0]).toBe(0);
  });

  it("solo sueltan colonos los edificios activados; sus rutas son las activas", () => {
    const c = new Colony(MAP);
    expect(c.releases(1)).toEqual([]);
    expect(c.activeRoutes()).toEqual([]);
    c.activate(1, soldierAt(door.x, door.z));
    expect(c.activeRoutes()).toEqual([MAP.routes[0]!.id]);
  });

  it("al reiniciar, todos llenos y sin activar", () => {
    const c = new Colony(MAP);
    c.activateAll(1);
    c.releases(1);
    c.reset();
    expect(c.status().buildings).toEqual([null, null, null, null]);
    expect(c.remainingIn(0)).toBe(perBuilding);
  });
});

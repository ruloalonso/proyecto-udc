import { describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS } from "@udc/shared";
import { Colony } from "./colony.js";

const { perBuilding, releaseInterval } = GAME_CONFIG.colonists;
const RELEASE_TICKS = Math.round(releaseInterval / TICK_SECONDS);

/** Generador pseudoaleatorio determinista. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe("Colony: evacuación por orden del Alto Mando (E6-2)", () => {
  it("abre los edificios de uno en uno, en un orden al azar que cambia con cada partida", () => {
    const c = new Colony(MAP, seeded(3));
    const order = MAP.routes.map(() => c.openNext(0));
    expect([...order].sort()).toEqual(MAP.routes.map((_, i) => i));
    expect(c.openNext(0)).toBeNull();

    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const other = new Colony(MAP, seeded(seed));
      orders.add(MAP.routes.map(() => other.openNext(0)).join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("el que se evacua es el último abierto; su ruta es la que amenaza el director", () => {
    const c = new Colony(MAP, seeded());
    expect(c.evacuating).toBeNull();
    expect(c.activeRoutes()).toEqual([]);
    const first = c.openNext(0)!;
    const second = c.openNext(100)!;
    expect(c.evacuating).toBe(second);
    expect(c.activeRoutes()).toEqual([MAP.routes[second]!.id]);
    expect(c.isOpen(first)).toBe(true);
  });

  it(`suelta a los colonos de uno en uno, uno cada ${releaseInterval} s, hasta vaciarse`, () => {
    const c = new Colony(MAP, seeded());
    const building = c.openNext(10)!;
    const ticks: number[] = [];
    for (let t = 10; t < 10 + RELEASE_TICKS * (perBuilding + 5); t++) {
      for (const b of c.releases(t)) {
        expect(b).toBe(building);
        ticks.push(t);
      }
    }
    expect(ticks).toHaveLength(perBuilding);
    expect(ticks[0]).toBe(10);
    expect(ticks[1]! - ticks[0]!).toBe(RELEASE_TICKS);
    expect(c.remainingIn(building)).toBe(0);
  });

  it("de lejos no se sabe cuántos hay dentro; abierto, se ve el contador y cuál se evacua", () => {
    const c = new Colony(MAP, seeded());
    expect(c.status()).toEqual({
      t: "colony",
      buildings: [null, null, null, null],
      evacuating: null,
    });
    const building = c.openNext(0)!;
    c.releases(0);
    const status = c.status();
    expect(status.buildings[building]).toBe(perBuilding - 1);
    expect(status.evacuating).toBe(building);
  });

  it("al reiniciar, todos llenos y cerrados", () => {
    const c = new Colony(MAP, seeded());
    c.openAll(1);
    c.releases(1);
    c.reset();
    expect(c.status().buildings).toEqual([null, null, null, null]);
    expect(c.openedCount).toBe(0);
    expect(c.remainingIn(0)).toBe(perBuilding);
  });
});

import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { SHUTTLE_TOP, shuttlePose } from "./shuttle.js";

const { landDelay, landSeconds, liftoffSeconds } = GAME_CONFIG.shuttles;
const ticks = (s: number) => s / TICK_SECONDS;

describe("animación de las lanzaderas (E6-3)", () => {
  it("antes del primer despegue, posada en la plataforma", () => {
    expect(shuttlePose(100, { lastLaunchTick: null, moreToCome: true })).toEqual({
      visible: true,
      height: 0,
      thrust: false,
    });
  });

  it("despega acelerando con el chorro encendido y se pierde de vista", () => {
    const at = (s: number) =>
      shuttlePose(1000 + ticks(s), { lastLaunchTick: 1000, moreToCome: true });
    expect(at(0)).toMatchObject({ visible: true, height: 0, thrust: true });
    const half = at(liftoffSeconds / 2).height;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(SHUTTLE_TOP / 2); // Acelera: a mitad de tiempo, menos de media altura.
    expect(at(liftoffSeconds + 1).visible).toBe(false);
  });

  it("la siguiente baja frenando y se posa", () => {
    const at = (s: number) =>
      shuttlePose(1000 + ticks(s), { lastLaunchTick: 1000, moreToCome: true });
    expect(at(landDelay - 0.1).visible).toBe(false);
    expect(at(landDelay)).toMatchObject({ visible: true, height: SHUTTLE_TOP, thrust: true });
    expect(at(landDelay + landSeconds / 2).height).toBeLessThan(SHUTTLE_TOP / 2);
    expect(at(landDelay + landSeconds)).toEqual({ visible: true, height: 0, thrust: false });
  });

  it("tras la última no vuelve ninguna", () => {
    const at = (s: number) =>
      shuttlePose(1000 + ticks(s), { lastLaunchTick: 1000, moreToCome: false });
    expect(at(1).visible).toBe(true);
    expect(at(landDelay + landSeconds + 1).visible).toBe(false);
  });
});

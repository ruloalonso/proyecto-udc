import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { SHUTTLE_TOP, shuttlePose } from "./shuttle.js";

const { landSeconds, liftoffSeconds } = GAME_CONFIG.shuttles;
const ticks = (s: number) => s / TICK_SECONDS;

describe("animación de las lanzaderas (E6-3, #72)", () => {
  it("posada mientras el servidor diga que lo está", () => {
    expect(shuttlePose(100, { docked: true, leftAtTick: 50, arrivesAtTick: null })).toEqual({
      visible: true,
      height: 0,
      thrust: false,
    });
  });

  it("despega acelerando con el chorro encendido y se pierde de vista", () => {
    const at = (s: number) =>
      shuttlePose(1000 + ticks(s), { docked: false, leftAtTick: 1000, arrivesAtTick: null });
    expect(at(0)).toMatchObject({ visible: true, height: 0, thrust: true });
    const half = at(liftoffSeconds / 2).height;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(SHUTTLE_TOP / 2);
    expect(at(liftoffSeconds + 1).visible).toBe(false);
  });

  it("la que viene baja frenando en los últimos segundos antes de posarse", () => {
    const arrives = 2000;
    const at = (s: number) =>
      shuttlePose(arrives - ticks(s), { docked: false, leftAtTick: null, arrivesAtTick: arrives });
    expect(at(landSeconds + 1).visible).toBe(false);
    expect(at(landSeconds)).toMatchObject({ visible: true, height: SHUTTLE_TOP, thrust: true });
    expect(at(landSeconds / 2).height).toBeLessThan(SHUTTLE_TOP / 2);
  });

  it("destruida (sin despegue), no se ve hasta que baja la siguiente", () => {
    expect(shuttlePose(10, { docked: false, leftAtTick: null, arrivesAtTick: 5000 }).visible).toBe(
      false,
    );
    expect(shuttlePose(10, { docked: false, leftAtTick: null, arrivesAtTick: null }).visible).toBe(
      false,
    );
  });
});

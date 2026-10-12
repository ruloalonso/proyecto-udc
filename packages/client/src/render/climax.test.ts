import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { HISTORY_TICKS } from "../net/remoteEntities.js";
import { Climax } from "./climax.js";

const { seconds, timeScale, fadeSeconds, orbit } = GAME_CONFIG.match.climax;
const MS = seconds * 1000;

describe("clímax de la última muerte (E6-4)", () => {
  it("sin empezar, el reloj es el de siempre y el noticiario sale al momento", () => {
    const c = new Climax();
    expect(c.clock(5000)).toBe(5000);
    expect(c.isSlow(5000)).toBe(false);
    expect(c.newsreelDue(5000)).toBe(true);
  });

  it("a cámara lenta el reloj avanza a `timeScale` y al acabar vuelve al presente", () => {
    const c = new Climax();
    c.begin(1000, { x: 1, z: 2, yaw: 0.5 });
    expect(c.isSlow(1000 + MS / 2)).toBe(true);
    expect(c.clock(1000 + 1000)).toBeCloseTo(1000 + 1000 * timeScale);
    expect(c.isSlow(1000 + MS)).toBe(false);
    expect(c.clock(1000 + MS)).toBe(1000 + MS);
  });

  it("el noticiario entra con el fundido, antes de que acabe la cámara lenta", () => {
    const c = new Climax();
    c.begin(0, { x: 0, z: 0, yaw: 0 });
    expect(c.newsreelDue((seconds - fadeSeconds) * 1000 - 1)).toBe(false);
    expect(c.newsreelDue((seconds - fadeSeconds) * 1000)).toBe(true);
    expect(c.isSlow((seconds - fadeSeconds) * 1000)).toBe(true);
  });

  it("la cámara gira `orbit` alrededor del soldado y se para ahí", () => {
    const c = new Climax();
    c.begin(0, { x: 0, z: 0, yaw: 1 });
    expect(c.cameraYaw(0)).toBe(1);
    expect(c.cameraYaw(MS)).toBeCloseTo(1 + orbit);
    expect(c.cameraYaw(MS * 3)).toBeCloseTo(1 + orbit);
  });

  it("lo que se queda atrás cabe en la historia de las entidades remotas", () => {
    const lagTicks = (seconds * (1 - timeScale)) / TICK_SECONDS;
    expect(lagTicks + GAME_CONFIG.net.interpolationDelayTicks).toBeLessThan(HISTORY_TICKS);
  });

  it("parar lo devuelve todo a la normalidad", () => {
    const c = new Climax();
    c.begin(0, { x: 0, z: 0, yaw: 0 });
    c.stop();
    expect(c.clock(100)).toBe(100);
    expect(c.isSlow(100)).toBe(false);
  });
});

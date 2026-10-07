import { describe, expect, it } from "vitest";
import { nextTabTarget, type TabCandidate } from "./targeting.js";

const RANGE = 40;
const HALF_ANGLE = Math.PI / 3;
// Mirando hacia +Z desde el origen.
const viewer = { x: 0, z: 0, yaw: 0 };
const tab = (candidates: TabCandidate[], current: number | null, v = viewer) =>
  nextTabTarget(v, candidates, current, RANGE, HALF_ANGLE);

describe("nextTabTarget", () => {
  it("elige el más cercano si no hay objetivo", () => {
    const c = [
      { id: 1, x: 0, z: 20 },
      { id: 2, x: 0, z: 10 },
    ];
    expect(tab(c, null)).toBe(2);
  });

  it("cicla por distancia y vuelve al primero", () => {
    const c = [
      { id: 1, x: 0, z: 30 },
      { id: 2, x: 0, z: 10 },
      { id: 3, x: 0, z: 20 },
    ];
    expect(tab(c, 2)).toBe(3);
    expect(tab(c, 3)).toBe(1);
    expect(tab(c, 1)).toBe(2);
  });

  it("ignora los que están fuera de alcance", () => {
    expect(tab([{ id: 1, x: 0, z: RANGE + 1 }], null)).toBeNull();
  });

  it("ignora los que están fuera del cono de la cámara", () => {
    const c = [
      { id: 1, x: 0, z: -10 }, // detrás
      { id: 2, x: 10, z: 1 }, // casi a un lado
    ];
    expect(tab(c, null)).toBeNull();
  });

  it("incluye los que están dentro del cono aunque no estén delante del todo", () => {
    expect(tab([{ id: 1, x: 10, z: 10 }], null)).toBe(1);
  });

  it("usa la orientación de la cámara", () => {
    const c = [{ id: 1, x: 0, z: -10 }];
    expect(tab(c, null, { x: 0, z: 0, yaw: Math.PI })).toBe(1);
  });

  it("si el objetivo actual ya no es candidato, empieza por el más cercano", () => {
    const c = [{ id: 1, x: 0, z: 10 }];
    expect(tab(c, 99)).toBe(1);
  });

  it("sin candidatos conserva el objetivo actual", () => {
    expect(tab([], 5)).toBe(5);
  });
});

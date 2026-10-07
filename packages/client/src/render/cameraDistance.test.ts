import { describe, expect, it } from "vitest";
import { smoothCameraDistance } from "./cameraDistance.js";

describe("smoothCameraDistance", () => {
  it("sin obstáculos se mantiene en la distancia deseada", () => {
    expect(smoothCameraDistance(9, 9, null, 1 / 60, 6)).toBe(9);
  });

  it("se acerca al instante cuando un obstáculo tapa", () => {
    expect(smoothCameraDistance(9, 9, 2.5, 1 / 60, 6)).toBe(2.5);
  });

  it("no se aleja más de lo deseado aunque el obstáculo esté lejos", () => {
    expect(smoothCameraDistance(9, 9, 20, 1 / 60, 6)).toBe(9);
  });

  it("se aleja poco a poco al dejar atrás el obstáculo", () => {
    const next = smoothCameraDistance(2.5, 9, null, 1 / 60, 6);
    expect(next).toBeGreaterThan(2.5);
    expect(next).toBeLessThan(9);
  });

  it("acaba llegando a la distancia deseada", () => {
    let d = 2.5;
    for (let i = 0; i < 120; i++) d = smoothCameraDistance(d, 9, null, 1 / 60, 6);
    expect(d).toBeCloseTo(9, 1);
  });

  it("el zoom con la rueda hacia dentro es inmediato", () => {
    expect(smoothCameraDistance(9, 5, null, 1 / 60, 6)).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { MAP, type MapData, type Obstacle } from "../map/index.js";
import { hasLineOfSight, segmentCrossesBox } from "./lineOfSight.js";

// Caja de 4 × 2 en el origen.
const box = (rot = 0, x = 0, z = 0): Obstacle => ({
  id: "b",
  kind: "crate",
  x,
  z,
  w: 4,
  d: 2,
  h: 1,
  rot,
});
const p = (x: number, z: number) => ({ x, z });

describe("segmentCrossesBox", () => {
  it("un segmento que atraviesa la caja la cruza", () => {
    expect(segmentCrossesBox(p(0, -5), p(0, 5), box())).toBe(true);
  });

  it("un segmento que pasa de largo no la cruza", () => {
    expect(segmentCrossesBox(p(3, -5), p(3, 5), box())).toBe(false);
  });

  it("un segmento que se queda antes de la caja no la cruza", () => {
    expect(segmentCrossesBox(p(0, -5), p(0, -1.5), box())).toBe(false);
  });

  it("rozar un borde no cuenta", () => {
    expect(segmentCrossesBox(p(2, -5), p(2, 5), box())).toBe(false);
    expect(segmentCrossesBox(p(-5, 1), p(5, 1), box())).toBe(false);
  });

  it("rozar una esquina no cuenta", () => {
    // Pasa justo por la esquina (2, 1).
    expect(segmentCrossesBox(p(0, 3), p(4, -1), box())).toBe(false);
  });

  it("un extremo dentro de la caja cuenta como cruce", () => {
    expect(segmentCrossesBox(p(0, 0), p(0, 5), box())).toBe(true);
  });

  it("respeta la rotación de la caja", () => {
    // Girada 90°, la caja ocupa |x| ≤ 1, |z| ≤ 2.
    expect(segmentCrossesBox(p(1.5, -5), p(1.5, 5), box(Math.PI / 2))).toBe(false);
    expect(segmentCrossesBox(p(-5, 1.5), p(5, 1.5), box(Math.PI / 2))).toBe(true);
  });

  it("respeta la posición de la caja", () => {
    expect(segmentCrossesBox(p(0, -5), p(0, 5), box(0, 10, 0))).toBe(false);
    expect(segmentCrossesBox(p(10, -5), p(10, 5), box(0, 10, 0))).toBe(true);
  });
});

describe("hasLineOfSight", () => {
  const map = (obstacles: Obstacle[]): MapData => ({ ...MAP, obstacles });

  it("sin obstáculos hay visión", () => {
    expect(hasLineOfSight(p(0, -5), p(0, 5), map([]))).toBe(true);
  });

  it("cualquier obstáculo en medio la tapa", () => {
    expect(hasLineOfSight(p(0, -5), p(0, 5), map([box(0, 10, 0), box()]))).toBe(false);
  });

  it("mapa real: muro-1 tapa el muñeco de (−20, 12) desde la plataforma", () => {
    expect(hasLineOfSight(MAP.spawn, p(-20, 12), MAP)).toBe(false);
  });

  it("mapa real: el muñeco de (0, 24) se ve desde la plataforma", () => {
    expect(hasLineOfSight(MAP.spawn, p(0, 24), MAP)).toBe(true);
  });
});

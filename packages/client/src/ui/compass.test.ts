import { MAP } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { bearingOf, CARDINALS, spreadMarks, stripPosition } from "./compass.js";

describe("brújula (E2-7)", () => {
  it("el norte es +Z, donde está la madriguera «norte»; el este, +X", () => {
    const norte = MAP.burrows.find((b) => b.id === "norte")!;
    expect(bearingOf({ x: 0, z: 0 }, norte)).toBeCloseTo(0);
    const este = MAP.burrows.find((b) => b.id === "este")!;
    expect(bearingOf({ x: 0, z: 10 }, este)).toBeCloseTo(Math.PI / 2, 0);
    expect(CARDINALS.find((c) => c.label === "E")!.bearing).toBeCloseTo(Math.PI / 2);
  });

  it("mirando al norte, el este queda a la derecha y el oeste a la izquierda", () => {
    expect(stripPosition(0, 0)).toEqual({ x: 0, outside: false });
    expect(stripPosition(Math.PI / 4, 0).x).toBeCloseTo(0.5);
    expect(stripPosition(-Math.PI / 4, 0).x).toBeCloseTo(-0.5);
  });

  it("gira con la cámara: mirando al este, el norte queda a la izquierda", () => {
    expect(stripPosition(0, Math.PI / 4).x).toBeCloseTo(-0.5);
  });

  it("lo que queda detrás se pega al borde por el que hay que girar", () => {
    expect(stripPosition(Math.PI, Math.PI / 6)).toEqual({ x: 1, outside: true });
    expect(stripPosition(Math.PI, -Math.PI / 6)).toEqual({ x: -1, outside: true });
  });

  describe("marcas sin pisarse", () => {
    const W = 500;
    const overlap = (a: [number, number], b: [number, number]) =>
      a[0] < b[0] + b[1] && b[0] < a[0] + a[1];

    it("separadas, cada una donde le toca", () => {
      expect(spreadMarks([{ raw: 0, width: 100 }], W)).toEqual([200]);
      expect(
        spreadMarks(
          [
            { raw: -0.5, width: 80 },
            { raw: 0.5, width: 80 },
          ],
          W,
        ),
      ).toEqual([105, 315]);
    });

    it("dos detrás por la derecha: la más por detrás, en el borde; la otra, a su lado", () => {
      const marks = [
        { raw: 1.9, width: 100 },
        { raw: 1.3, width: 80 },
      ];
      const [behind, side] = spreadMarks(marks, W, 6);
      expect(behind).toBe(400);
      expect(side).toBe(400 - 6 - 80);
    });

    it("dos detrás por la izquierda, igual pero al revés", () => {
      const [behind, side] = spreadMarks(
        [
          { raw: -1.9, width: 100 },
          { raw: -1.3, width: 80 },
        ],
        W,
        6,
      );
      expect(behind).toBe(0);
      expect(side).toBe(106);
    });

    it("casi en el mismo rumbo, una al lado de la otra y dentro de la tira", () => {
      const marks = [
        { raw: 0.95, width: 120 },
        { raw: 0.9, width: 120 },
        { raw: 1.2, width: 90 },
      ];
      const lefts = spreadMarks(marks, W);
      const boxes = lefts.map((l, i): [number, number] => [l, marks[i]!.width]);
      for (const [l, w] of boxes) {
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l + w).toBeLessThanOrEqual(W);
      }
      expect(overlap(boxes[0]!, boxes[1]!)).toBe(false);
      expect(overlap(boxes[1]!, boxes[2]!)).toBe(false);
      expect(overlap(boxes[0]!, boxes[2]!)).toBe(false);
    });
  });
});

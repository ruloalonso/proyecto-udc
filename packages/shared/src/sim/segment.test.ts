import { describe, expect, it } from "vitest";
import { segmentCircleHit } from "./segment.js";

const p = (x: number, z: number) => ({ x, z });

describe("segmentCircleHit", () => {
  it("devuelve la fracción del tramo en la que toca el borde", () => {
    // De (0, 0) a (0, 10), círculo de radio 1 en (0, 5): toca en z = 4.
    expect(segmentCircleHit(p(0, 0), p(0, 10), p(0, 5), 1)).toBeCloseTo(0.4);
  });

  it("un tramo que pasa de largo no toca", () => {
    expect(segmentCircleHit(p(2, 0), p(2, 10), p(0, 5), 1)).toBeNull();
  });

  it("un tramo que se queda antes no toca", () => {
    expect(segmentCircleHit(p(0, 0), p(0, 3), p(0, 5), 1)).toBeNull();
  });

  it("aunque el tramo sea más largo que el círculo, no lo atraviesa sin tocarlo", () => {
    expect(segmentCircleHit(p(0, 0), p(0, 100), p(0.5, 50), 0.6)).not.toBeNull();
  });

  it("si empieza dentro, toca en 0", () => {
    expect(segmentCircleHit(p(0, 5), p(0, 10), p(0, 5), 1)).toBe(0);
  });
});

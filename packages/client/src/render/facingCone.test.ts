import { describe, expect, it } from "vitest";
import { arcPoints } from "./facingCone.js";

describe("arcPoints", () => {
  it("va de −semiángulo a +semiángulo alrededor de +Z, al radio pedido", () => {
    const half = (20 * Math.PI) / 180;
    const points = arcPoints(half, 30, 4);
    expect(points).toHaveLength(5);
    for (const p of points) expect(Math.hypot(p.x, p.z)).toBeCloseTo(30);
    // Los extremos, a ±20° de +Z; el del medio, justo delante.
    expect(Math.atan2(points[0]!.x, points[0]!.z)).toBeCloseTo(-half);
    expect(Math.atan2(points[4]!.x, points[4]!.z)).toBeCloseTo(half);
    expect(points[2]!.x).toBeCloseTo(0);
    expect(points[2]!.z).toBeCloseTo(30);
  });
});

import { MAP } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { facadeFacing } from "./facade.js";

describe("fachada de los carteles (#78)", () => {
  it("sin girar, elige la pared que da hacia el punto", () => {
    const box = { x: 0, z: 0, w: 16, d: 12, rot: 0 };
    const front = facadeFacing(box, { x: 0, z: 20 });
    expect([front.x, front.z, front.nx, front.nz, front.width]).toEqual(
      [0, 6, 0, 1, 16].map((v) => expect.closeTo(v)),
    );
    const side = facadeFacing(box, { x: -30, z: 1 });
    expect([side.x, side.z, side.nx, side.nz, side.width]).toEqual(
      [-8, 0, -1, 0, 12].map((v) => expect.closeTo(v)),
    );
  });

  it("girada, la pared sigue el giro de la caja", () => {
    const rot = 0.3;
    const f = facadeFacing({ x: 0, z: 0, w: 14, d: 14, rot }, { x: 0, z: 20 });
    // El eje Z local girado: (−sin rot, cos rot).
    expect(f.nx).toBeCloseTo(-Math.sin(rot));
    expect(f.nz).toBeCloseTo(Math.cos(rot));
    expect(Math.hypot(f.x, f.z)).toBeCloseTo(7);
  });

  it("en el mapa, el cartel de cada edificio está en la pared de su puerta", () => {
    for (const route of MAP.routes) {
      const box = MAP.obstacles.find((o) => o.id === route.building)!;
      const f = facadeFacing(box, route.exit);
      // La puerta queda delante de esa pared, cerca de su centro.
      const ahead = (route.exit.x - f.x) * f.nx + (route.exit.z - f.z) * f.nz;
      expect(ahead, route.id).toBeGreaterThan(0);
      expect(Math.hypot(route.exit.x - f.x, route.exit.z - f.z), route.id).toBeLessThan(
        f.width / 2 + 3,
      );
    }
  });
});

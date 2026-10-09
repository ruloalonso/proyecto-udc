import { describe, expect, it } from "vitest";
import { edgeMarker } from "./objective.js";

const W = 1280;
const H = 720;

describe("flecha al edificio que se evacua (E6-2)", () => {
  it("si se ve, no hay flecha", () => {
    expect(edgeMarker(640, 300, false, W, H)).toBeNull();
  });

  it("fuera de la pantalla, en el borde y apuntando hacia él", () => {
    const right = edgeMarker(3000, 360, false, W, H, 48)!;
    expect(right.x).toBeCloseTo(W - 48);
    expect(right.y).toBeCloseTo(360);
    expect(right.angle).toBeCloseTo(Math.PI / 2);
    const up = edgeMarker(640, -500, false, W, H, 48)!;
    expect(up.y).toBeCloseTo(48);
    expect(up.angle).toBeCloseTo(0);
  });

  it("detrás de la cámara, la dirección se da la vuelta (aunque la proyección caiga dentro)", () => {
    const back = edgeMarker(640, 200, true, W, H, 48)!;
    expect(back.y).toBeCloseTo(H - 48);
    expect(Math.abs(back.angle)).toBeCloseTo(Math.PI);
  });
});

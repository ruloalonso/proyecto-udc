import { describe, expect, it } from "vitest";
import { edgeMarker, separateBoxes } from "./objective.js";

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

  it("abajo deja libre la barra de habilidades (E5-8)", () => {
    const down = edgeMarker(640, 5000, false, W, H)!;
    expect(down.y).toBeCloseTo(H - 160);
    expect(down.angle).toBeCloseTo(Math.PI);
  });

  it("detrás de la cámara, la dirección se da la vuelta (aunque la proyección caiga dentro)", () => {
    const back = edgeMarker(640, 200, true, W, H, 48)!;
    expect(back.y).toBeCloseTo(H - 48);
    expect(Math.abs(back.angle)).toBeCloseTo(Math.PI);
  });
});

describe("etiquetas que se pisan (E5-8)", () => {
  it("la que se superpone sube encima de la otra; las sueltas no se mueven", () => {
    const shifts = separateBoxes([
      { x: 100, y: 500, w: 200, h: 30 },
      { x: 150, y: 505, w: 200, h: 30 },
      { x: 900, y: 500, w: 200, h: 30 },
    ]);
    expect(shifts[1]).toBe(0);
    expect(shifts[0]).toBe(505 - 30 - 2 - 500);
    expect(shifts[2]).toBe(0);
  });

  it("tres en el mismo sitio quedan apiladas", () => {
    const box = { x: 0, y: 400, w: 100, h: 20 };
    const shifts = separateBoxes([box, box, box]);
    expect([...shifts].sort((a, b) => b - a)).toEqual([0, -22, -44]);
  });
});

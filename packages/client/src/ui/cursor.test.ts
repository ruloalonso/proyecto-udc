import { describe, expect, it } from "vitest";
import { cursorFor } from "./cursor.js";

describe("cursor sobre el juego", () => {
  const base = { dragging: false, aimingGrenade: false, overClickable: false };

  it("la mano sobre lo que se puede pulsar; si no, el normal", () => {
    expect(cursorFor({ ...base, overClickable: true })).toBe("pointer");
    expect(cursorFor(base)).toBe("");
  });

  it("apuntando la granada, la mira; arrastrando la cámara, el normal", () => {
    expect(cursorFor({ ...base, aimingGrenade: true, overClickable: true })).toBe("crosshair");
    expect(cursorFor({ ...base, dragging: true, overClickable: true })).toBe("");
    expect(cursorFor({ ...base, dragging: true, aimingGrenade: true })).toBe("");
  });
});

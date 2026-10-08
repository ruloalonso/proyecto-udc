import { describe, expect, it } from "vitest";
import { adminCommandFor } from "./admin.js";

describe("adminCommandFor", () => {
  it("I, K, N, O y P son comandos; las teclas de juego no", () => {
    expect(adminCommandFor("KeyI")).toBe("invulnerable");
    expect(adminCommandFor("KeyK")).toBe("killAll");
    expect(adminCommandFor("KeyN")).toBe("nextPhase");
    expect(adminCommandFor("KeyO")).toBe("nextPush");
    expect(adminCommandFor("KeyP")).toBe("finalWave");
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyF", "Digit1"]) {
      expect(adminCommandFor(code)).toBeNull();
    }
  });
});

import { describe, expect, it } from "vitest";
import { Rematch } from "./rematch.js";

describe("Rematch: volver a filas (E6-5)", () => {
  it("la partida nueva espera a que estén listos todos los conectados", () => {
    const r = new Rematch<string>();
    const present = ["ana", "rulo", "eva"];
    expect(r.allReady(present)).toBe(false);
    r.press("rulo");
    r.press("ana");
    expect(r.count(present)).toBe(2);
    expect(r.isReady("rulo")).toBe(true);
    expect(r.allReady(present)).toBe(false);
    r.press("eva");
    expect(r.allReady(present)).toBe(true);
  });

  it("quien se va deja de contar: si el resto ya estaba listo, se empieza", () => {
    const r = new Rematch<string>();
    r.press("ana");
    r.forget("eva");
    expect(r.allReady(["ana"])).toBe(true);
    expect(r.count(["ana"])).toBe(1);
  });

  it("jugando solo, basta con pulsar; sin nadie, no hay partida", () => {
    const r = new Rematch<string>();
    expect(r.allReady([])).toBe(false);
    r.press("rulo");
    expect(r.allReady(["rulo"])).toBe(true);
  });

  it("al empezar la partida nueva, nadie está listo", () => {
    const r = new Rematch<string>();
    r.press("rulo");
    r.clear();
    expect(r.isReady("rulo")).toBe(false);
    expect(r.allReady(["rulo"])).toBe(false);
  });
});

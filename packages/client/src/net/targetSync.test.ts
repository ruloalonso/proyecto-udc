import { describe, expect, it } from "vitest";
import { TargetSync } from "./targetSync.js";

describe("TargetSync", () => {
  it("adopta el objetivo que elige el servidor", () => {
    const t = new TargetSync();
    t.fromServer(7, 0);
    expect(t.current).toBe(7);
    t.fromServer(null, 50);
    expect(t.current).toBeNull();
  });

  it("una elección a mano se ve al momento y se manda una vez", () => {
    const t = new TargetSync();
    expect(t.choose(3, 0)).toBe(true);
    expect(t.current).toBe(3);
    expect(t.choose(3, 10)).toBe(false);
  });

  it("mantiene la elección a mano hasta que el servidor la confirma", () => {
    const t = new TargetSync();
    t.fromServer(7, 0);
    t.choose(3, 100);
    // Snapshots que salieron antes de que el servidor recibiera el clic.
    t.fromServer(7, 150);
    expect(t.current).toBe(3);
    t.fromServer(3, 250);
    expect(t.current).toBe(3);
    // Confirmada: a partir de aquí vuelve a mandar el servidor.
    t.fromServer(9, 300);
    expect(t.current).toBe(9);
  });

  it("si el servidor no la confirma en un segundo, manda el servidor", () => {
    const t = new TargetSync();
    t.choose(3, 0);
    t.fromServer(7, 999);
    expect(t.current).toBe(3);
    t.fromServer(7, 1000);
    expect(t.current).toBe(7);
  });

  it("Escape también es una elección a mano", () => {
    const t = new TargetSync();
    t.fromServer(7, 0);
    expect(t.choose(null, 10)).toBe(true);
    t.fromServer(7, 60);
    expect(t.current).toBeNull();
    t.fromServer(null, 120);
    t.fromServer(8, 400); // La selección automática vuelve a elegir.
    expect(t.current).toBe(8);
  });

  it("al dejar de dibujarse el objetivo, se quita sin avisar al servidor", () => {
    const t = new TargetSync();
    t.fromServer(7, 0);
    t.removed(5);
    expect(t.current).toBe(7);
    t.removed(7);
    expect(t.current).toBeNull();
  });
});

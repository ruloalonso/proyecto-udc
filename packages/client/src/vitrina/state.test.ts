import { describe, expect, it } from "vitest";
import { COUNT_MAX, DEFAULT_STATE, parseState, SPEED_MAX, stateToSearch } from "./state.js";

const MODELS = ["raso", "escupidor"];

describe("estado de la vitrina en la dirección (E7-9)", () => {
  it("sin nada, el primer modelo y todo por defecto", () => {
    expect(parseState("", MODELS)).toEqual({ ...DEFAULT_STATE, model: "raso" });
  });

  it("lee lo que viene y descarta lo que no vale", () => {
    const s = parseState(
      "?modelo=escupidor&vista=lado&mov=circulo&vel=0.25&n=150&alambre=1&referencia=0&seguir=0",
      MODELS,
    );
    expect(s).toEqual({
      model: "escupidor",
      view: "lado",
      movement: "circulo",
      speed: 0.25,
      count: 150,
      wireframe: true,
      reference: false,
      follow: false,
    });
    const bad = parseState("?modelo=dragon&vista=dentro&mov=volar&vel=99&n=-3", MODELS);
    expect(bad.model).toBe("raso");
    expect(bad.view).toBe(DEFAULT_STATE.view);
    expect(bad.movement).toBe(DEFAULT_STATE.movement);
    expect(bad.speed).toBe(SPEED_MAX);
    expect(bad.count).toBe(1);
    expect(parseState("?n=9999", MODELS).count).toBe(COUNT_MAX);
  });

  it("ida y vuelta: lo que se escribe se lee igual; por defecto, una dirección corta", () => {
    const s = { ...DEFAULT_STATE, model: "escupidor", movement: "girar" as const, speed: 0.5 };
    expect(parseState(stateToSearch(s), MODELS)).toEqual(s);
    expect(stateToSearch({ ...DEFAULT_STATE, model: "raso" })).toBe("?modelo=raso");
  });
});

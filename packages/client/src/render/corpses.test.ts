import { GAME_CONFIG } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { corpseSink } from "./corpses.js";

const { seconds, sinkSeconds, sinkDepth } = GAME_CONFIG.colonists.corpse;

describe("colonos caídos (#74)", () => {
  it("se quedan a la vista y luego se hunden hasta desaparecer", () => {
    expect(corpseSink(0)).toBe(0);
    expect(corpseSink(seconds - 0.1)).toBe(0);
    const half = corpseSink(seconds + sinkSeconds / 2)!;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(sinkDepth);
    expect(corpseSink(seconds + sinkSeconds)).toBeNull();
  });
});

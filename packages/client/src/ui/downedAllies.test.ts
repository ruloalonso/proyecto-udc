import { describe, expect, it } from "vitest";
import { downedMarkerName } from "./downedAllies.js";

describe("flecha hacia un derribado (E5-8)", () => {
  it("su nombre y los segundos que le quedan, o que le están rescatando", () => {
    expect(downedMarkerName("Recluta nº 3 (bot)", 12.2, false)).toBe("Recluta nº 3 (bot) · 13 s");
    expect(downedMarkerName("Recluta nº 3 (bot)", 12.2, true)).toBe(
      "Recluta nº 3 (bot) · rescatando",
    );
    expect(downedMarkerName("Rulo", null, false)).toBe("Rulo");
    expect(downedMarkerName("Rulo", -1, false)).toBe("Rulo · 0 s");
  });
});

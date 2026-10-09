import { describe, expect, it } from "vitest";
import { activateText, buildingLabel } from "./colony.js";

describe("edificios de colonos (E6-2)", () => {
  it("sin activar no se sabe cuántos hay; activado, los que quedan", () => {
    expect(buildingLabel(null)).toBe("¿Colonos?");
    expect(buildingLabel(32)).toBe("32 colonos");
    expect(buildingLabel(1)).toBe("1 colono");
    expect(buildingLabel(0)).toBe("Vacío");
  });

  it("el aviso dice quién lo activa (o que ha sido uno mismo)", () => {
    expect(activateText(null, 0, 50)).toMatch(/^Ha activado el edificio 1: 50 colonos/);
    expect(activateText("Recluta nº 3", 2, 50)).toMatch(/^Recluta nº 3 activa el edificio 3/);
  });
});

import { describe, expect, it } from "vitest";
import { activateText, buildingLabel } from "./colony.js";

describe("edificios de colonos (E6-2)", () => {
  it("sin abrir no se sabe cuántos hay; abierto, los que quedan", () => {
    expect(buildingLabel(null)).toBe("¿Colonos?");
    expect(buildingLabel(32)).toBe("32 colonos");
    expect(buildingLabel(1)).toBe("1 colono");
    expect(buildingLabel(0)).toBe("Vacío");
  });

  it("el que se está evacuando lo dice", () => {
    expect(buildingLabel(37, true)).toBe("Evacuando · 37");
    expect(buildingLabel(0, true)).toBe("Evacuado");
  });

  it("el aviso es una orden del Alto Mando", () => {
    expect(activateText(2, 50)).toBe(
      "Orden del Alto Mando: evacuad el edificio 3. 50 colonos saldrán de uno en uno hacia la plataforma. Escoltadlos.",
    );
  });
});

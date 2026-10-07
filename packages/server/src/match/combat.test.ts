import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@udc/shared";
import { AUTO_FIRE_INTERVAL_TICKS, autoFire, type AutoFireShooter } from "./combat.js";

const { damage, range } = GAME_CONFIG.combat.autoFire;

const shooter = (targetId: number | null = 10): AutoFireShooter => ({
  id: 1,
  state: { x: 0, z: 0 },
  targetId,
  nextShotTick: 0,
});
const target = (id = 10, dist = 10) => ({ id, x: 0, z: dist });

describe("autoFire", () => {
  it("0,8 s entre disparos son 16 ticks", () => {
    expect(AUTO_FIRE_INTERVAL_TICKS).toBe(16);
  });

  it("dispara al objetivo a alcance con el daño de la configuración", () => {
    expect(autoFire(1, shooter(), target())).toEqual({
      k: "damage",
      src: 1,
      dst: 10,
      amount: damage,
    });
  });

  it("no dispara fuera de alcance", () => {
    expect(autoFire(1, shooter(), target(10, range + 0.01))).toBeNull();
  });

  it("dispara justo en el límite del alcance", () => {
    expect(autoFire(1, shooter(), target(10, range))).not.toBeNull();
  });

  it("no dispara sin objetivo o si el objetivo no existe", () => {
    expect(autoFire(1, shooter(null), target())).toBeNull();
    expect(autoFire(1, shooter(), undefined)).toBeNull();
  });

  it("respeta la cadencia", () => {
    const s = shooter();
    expect(autoFire(1, s, target())).not.toBeNull();
    expect(autoFire(1 + AUTO_FIRE_INTERVAL_TICKS - 1, s, target())).toBeNull();
    expect(autoFire(1 + AUTO_FIRE_INTERVAL_TICKS, s, target())).not.toBeNull();
  });

  it("cambiar de objetivo no salta el enfriamiento", () => {
    const s = shooter();
    autoFire(1, s, target(10));
    s.targetId = 11;
    expect(autoFire(2, s, target(11))).toBeNull();
    expect(autoFire(1 + AUTO_FIRE_INTERVAL_TICKS, s, target(11))).not.toBeNull();
  });
});

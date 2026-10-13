import { BurrowState, GAME_CONFIG, MAP } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { distanceGain, SoundGate, SOUNDS, soundsFor } from "./sounds.js";

const ME = 7;
const { near, far } = GAME_CONFIG.audio;

describe("sonido básico (E6-7)", () => {
  it("el disparo propio suena; recibir daño, también", () => {
    expect(soundsFor({ k: "damage", src: ME, dst: 100, amount: 12, by: "auto" }, ME)).toEqual([
      { id: "shot" },
    ]);
    expect(soundsFor({ k: "damage", src: ME, dst: 100, amount: 40, by: "aimed" }, ME)).toEqual([
      { id: "aimedShot" },
    ]);
    expect(soundsFor({ k: "damage", src: 100, dst: ME, amount: 8, by: "bite" }, ME)).toEqual([
      { id: "hurt" },
    ]);
  });

  it("los disparos de los aliados, desde donde están y más bajos; si no se les ve, nada", () => {
    const ally = { x: 5, z: 9 };
    const whereIs = (id: number) => (id === 3 ? ally : undefined);
    expect(
      soundsFor({ k: "damage", src: 3, dst: 100, amount: 10, by: "auto" }, ME, whereIs),
    ).toEqual([{ id: "allyShot", at: ally }]);
    expect(
      soundsFor({ k: "damage", src: 3, dst: 100, amount: 60, by: "aimed" }, ME, whereIs),
    ).toEqual([{ id: "aimedShot", at: ally }]);
    expect(
      soundsFor({ k: "damage", src: 4, dst: 100, amount: 10, by: "auto" }, ME, whereIs),
    ).toEqual([]);
    expect(SOUNDS.allyShot.volume).toBeLessThan(SOUNDS.shot.volume);
    expect(SOUNDS.allyShot.minGapMs).toBeGreaterThan(SOUNDS.shot.minGapMs);
    // Un centollo que muerde no dispara.
    expect(soundsFor({ k: "damage", src: 3, dst: 9, amount: 8, by: "bite" }, ME, whereIs)).toEqual(
      [],
    );
  });

  it("explosiones donde ocurren; la de la nave, la grande", () => {
    expect(soundsFor({ k: "explosion", src: ME, x: 3, z: 4 }, ME)).toEqual([
      { id: "explosion", at: { x: 3, z: 4 } },
    ]);
    const radius = GAME_CONFIG.shuttles.explosion.radius;
    expect(soundsFor({ k: "explosion", src: 1, x: 0, z: 55, radius }, ME)[0]?.id).toBe(
      "shuttleExplosion",
    );
  });

  it("aviso de madriguera, despegue y aliado derribado", () => {
    const warning = soundsFor({ k: "burrow", burrow: 0, state: BurrowState.Warning }, ME);
    expect(warning).toEqual([{ id: "burrow", at: { x: MAP.burrows[0]!.x, z: MAP.burrows[0]!.z } }]);
    expect(soundsFor({ k: "burrow", burrow: 0, state: BurrowState.Open }, ME)).toEqual([]);
    expect(soundsFor({ k: "launch", n: 1, boarded: 30 }, ME)[0]?.id).toBe("liftoff");
    expect(soundsFor({ k: "downed", src: 3, ticks: 600 }, ME)).toEqual([{ id: "allyDown" }]);
    expect(soundsFor({ k: "downed", src: ME, ticks: 600 }, ME)).toEqual([]);
  });

  it("lo de lejos se oye más bajo; los avisos, nunca del todo apagados", () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(near)).toBe(1);
    expect(distanceGain((near + far) / 2)).toBeCloseTo(0.5);
    expect(distanceGain(far)).toBe(0);
    expect(distanceGain(far * 2, 0.35)).toBe(0.35);
  });

  it("tope por sonido: no se repite antes de su separación mínima", () => {
    const gate = new SoundGate();
    const gap = SOUNDS.shot.minGapMs;
    expect(gate.allow("shot", 1000)).toBe(true);
    expect(gate.allow("shot", 1000 + gap - 1)).toBe(false);
    expect(gate.allow("explosion", 1000)).toBe(true);
    expect(gate.allow("shot", 1000 + gap)).toBe(true);
  });
});

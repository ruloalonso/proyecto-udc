import { describe, expect, it } from "vitest";
import {
  AIM_HOLD,
  AIMED_WEAPON,
  localVelocity,
  MarineAnimator,
  RECOIL_TAU,
  STRIDE,
} from "./marineAnim.js";

const DT = 1 / 60;

/** Avanza `seconds` a (forward, side) y devuelve el animador. */
function run(a: MarineAnimator, forward: number, side: number, seconds: number, dt = DT) {
  let pose = a.update(dt, forward, side);
  for (let t = dt; t < seconds - 1e-9; t += dt) pose = a.update(dt, forward, side);
  return pose;
}

describe("animación del marine (E8-1)", () => {
  it("velocidad vista desde el marine: delante es (sin yaw, cos yaw) y la derecha, +X mirando al norte", () => {
    const north = localVelocity(0, 5, 0);
    expect(north.forward).toBeCloseTo(5);
    expect(north.side).toBeCloseTo(0);
    const right = localVelocity(3, 0, 0);
    expect(right.forward).toBeCloseTo(0);
    expect(right.side).toBeCloseTo(3);
    expect(localVelocity(5, 0, Math.PI / 2).forward).toBeCloseTo(5);
  });

  it("quieto, rodilla en tierra: la cadera baja y la rodilla derecha toca el suelo", () => {
    const pose = run(new MarineAnimator(), 0, 0, 1);
    expect(pose.lift).toBeLessThan(-0.35);
    expect(pose.joints.kneeR.x).toBeGreaterThan(1.3);
    expect(pose.joints.hipL.x).toBeLessThan(-1.2);
  });

  it("al moverse, se levanta y corre; el ritmo sigue a la distancia, no al tiempo", () => {
    const a = new MarineAnimator();
    run(a, 0, 0, 1);
    const pose = run(a, 5, 0, 1);
    expect(a.kneel).toBeLessThan(0.01);
    expect(pose.lift).toBeGreaterThanOrEqual(0);
    const fast = new MarineAnimator();
    run(fast, 5, 0, 1);
    const slow = new MarineAnimator();
    run(slow, 2.5, 0, 2);
    expect(fast.phase).toBeCloseTo((5 / STRIDE) * 2 * Math.PI, 1);
    expect(slow.phase).toBeCloseTo(fast.phase, 1);
  });

  it("corriendo, piernas alternas, rodillas altas y el arma a nivel aunque se incline", () => {
    const a = new MarineAnimator();
    let maxKnee = 0;
    for (let i = 0; i < 60; i++) {
      const pose = a.update(DT, 5, 0);
      expect(pose.joints.hipL.x * pose.joints.hipR.x).toBeLessThanOrEqual(1e-9);
      maxKnee = Math.max(maxKnee, pose.joints.kneeL.x);
      expect(pose.joints.torso.x).toBeGreaterThan(0);
      expect(pose.weapon.pitch).toBeCloseTo(-pose.joints.torso.x);
    }
    expect(maxKnee).toBeGreaterThan(0.9);
  });

  it("hacia atrás, el mismo paso al revés; de lado, las piernas se abren hacia donde va", () => {
    const f = new MarineAnimator().update(0.2, 5, 0);
    const b = new MarineAnimator().update(0.2, -5, 0);
    expect(b.joints.hipL.x).toBeCloseTo(-f.joints.hipL.x);
    const side = new MarineAnimator();
    let maxRoll = 0;
    for (let i = 0; i < 40; i++) {
      const pose = side.update(DT, 0, 3.5);
      maxRoll = Math.max(maxRoll, pose.joints.hipR.z, pose.joints.hipL.z);
    }
    expect(maxRoll).toBeGreaterThan(0.2);
  });

  it("al disparar se encara el arma (por la mira) y, pasado un rato, la baja", () => {
    const a = new MarineAnimator();
    run(a, 0, 0, 0.5);
    a.fire("auto");
    const aimed = run(a, 0, 0, 0.6);
    expect(a.aim).toBeGreaterThan(0.95);
    expect(aimed.weapon.y).toBeCloseTo(AIMED_WEAPON.y, 1);
    expect(aimed.joints.head.x).toBeGreaterThan(0.1);
    run(a, 0, 0, AIM_HOLD);
    expect(a.aim).toBeLessThan(0.05);
  });

  it("el retroceso: el apuntado más fuerte que el automático, y se apaga solo", () => {
    const auto = new MarineAnimator();
    auto.fire("auto");
    const aimedShot = new MarineAnimator();
    aimedShot.fire("aimed");
    const kickAuto = auto.update(DT, 0, 0).weapon;
    const kickAimed = aimedShot.update(DT, 0, 0).weapon;
    expect(kickAimed.z).toBeLessThan(kickAuto.z);
    expect(kickAimed.pitch).toBeLessThan(kickAuto.pitch);
    for (let t = 0; t < 10 * RECOIL_TAU; t += DT) aimedShot.update(DT, 0, 0);
    expect(aimedShot.recoil).toBeLessThan(0.001);
  });

  it("encararse sin disparar (disparo apuntado): sin retroceso, el tiempo pedido", () => {
    const a = new MarineAnimator();
    a.fire("aim", 2);
    run(a, 0, 0, 1.5);
    expect(a.recoil).toBe(0);
    expect(a.aim).toBeGreaterThan(0.95);
  });

  it("derribado: el arma por delante, apuntando hacia donde va; se arrastra con las piernas", () => {
    const a = new MarineAnimator();
    const downed = { downed: true, rescuing: false, seated: false };
    const still = a.update(DT, 0, 0, downed);
    expect(still.weapon.pitch).toBeCloseTo(-Math.PI / 2);
    let maxGap = 0;
    for (let i = 0; i < 60; i++) {
      const pose = a.update(DT, 1, 0, downed);
      maxGap = Math.max(maxGap, Math.abs(pose.joints.hipL.x - pose.joints.hipR.x));
    }
    expect(maxGap).toBeGreaterThan(0.3);
  });

  it("sentado: la cadera baja, las piernas se doblan y el arma, vertical", () => {
    const seated = new MarineAnimator().update(DT, 0, 0, {
      downed: false,
      rescuing: false,
      seated: true,
    });
    expect(seated.lift).toBeLessThan(-0.3);
    expect(seated.joints.hipL.x).toBeLessThan(-1);
    expect(seated.joints.kneeL.x).toBeGreaterThan(1);
    expect(seated.weapon.pitch).toBeCloseTo(-Math.PI / 2);
  });
});

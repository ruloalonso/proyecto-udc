import { describe, expect, it } from "vitest";
import { localVelocity, MarineAnimator, RECOIL_TAU, STRIDE } from "./marineAnim.js";

const DT = 1 / 60;

/** Anda `seconds` a (forward, side) y devuelve el animador. */
function walk(forward: number, side: number, seconds: number, dt = DT): MarineAnimator {
  const a = new MarineAnimator();
  for (let t = 0; t < seconds - 1e-9; t += dt) a.update(dt, forward, side);
  return a;
}

describe("animación del marine (E8-1)", () => {
  it("velocidad vista desde el marine: delante es (sin yaw, cos yaw) y la derecha, +X mirando al norte", () => {
    const north = localVelocity(0, 5, 0);
    expect(north.forward).toBeCloseTo(5);
    expect(north.side).toBeCloseTo(0);
    const right = localVelocity(3, 0, 0);
    expect(right.forward).toBeCloseTo(0);
    expect(right.side).toBeCloseTo(3);
    const east = localVelocity(5, 0, Math.PI / 2);
    expect(east.forward).toBeCloseTo(5);
  });

  it("quieto: de pie, sin paso; solo respira", () => {
    const a = new MarineAnimator();
    let pose = a.update(DT, 0, 0);
    for (let i = 0; i < 120; i++) pose = a.update(DT, 0, 0);
    expect(pose.lift).toBe(0);
    expect(pose.joints.hipL.x).toBeCloseTo(0);
    expect(pose.joints.kneeR.x).toBeCloseTo(0);
    expect(Math.abs(pose.joints.torso.x)).toBeLessThan(0.02);
  });

  it("el ritmo sigue a la distancia, no al tiempo ni a los frames", () => {
    const fast = walk(5, 0, 1);
    const slow = walk(2.5, 0, 2);
    const choppy = walk(5, 0, 1, 1 / 20);
    expect(fast.phase).toBeCloseTo((5 / STRIDE) * 2 * Math.PI);
    expect(slow.phase).toBeCloseTo(fast.phase);
    expect(choppy.phase).toBeCloseTo(fast.phase);
  });

  it("andando hacia delante, las piernas van alternas y la rodilla se dobla al pasar", () => {
    const a = new MarineAnimator();
    let maxKnee = 0;
    for (let i = 0; i < 60; i++) {
      const pose = a.update(DT, 5, 0);
      // Alternas: nunca las dos hacia el mismo lado.
      expect(pose.joints.hipL.x * pose.joints.hipR.x).toBeLessThanOrEqual(1e-9);
      expect(pose.joints.kneeL.x).toBeGreaterThanOrEqual(0);
      maxKnee = Math.max(maxKnee, pose.joints.kneeL.x);
      expect(pose.joints.hipL.z).toBeCloseTo(0);
    }
    expect(maxKnee).toBeGreaterThan(0.5);
  });

  it("hacia atrás, el mismo paso al revés; de lado, las piernas se abren hacia donde va", () => {
    const forward = new MarineAnimator();
    const backward = new MarineAnimator();
    const f = forward.update(0.2, 5, 0);
    const b = backward.update(0.2, -5, 0);
    expect(b.joints.hipL.x).toBeCloseTo(-f.joints.hipL.x);
    const side = new MarineAnimator();
    let maxRoll = 0;
    for (let i = 0; i < 40; i++) {
      const pose = side.update(DT, 0, 3.5);
      expect(pose.joints.hipL.x).toBeCloseTo(0);
      maxRoll = Math.max(maxRoll, pose.joints.hipR.z, pose.joints.hipL.z);
    }
    expect(maxRoll).toBeGreaterThan(0.2);
  });

  it("el retroceso: el apuntado más fuerte que el automático, y se apaga solo", () => {
    const auto = new MarineAnimator();
    auto.fire("auto");
    const aimed = new MarineAnimator();
    aimed.fire("aimed");
    const kickAuto = auto.update(DT, 0, 0).joints.shoulderR.x;
    const kickAimed = aimed.update(DT, 0, 0).joints.shoulderR.x;
    expect(kickAimed).toBeLessThan(kickAuto);
    expect(kickAuto).toBeLessThan(-0.05);
    for (let t = 0; t < 10 * RECOIL_TAU; t += DT) aimed.update(DT, 0, 0);
    expect(aimed.recoil).toBeLessThan(0.001);
  });

  it("derribado: se arrastra con los brazos alternos; quieto, no", () => {
    const a = new MarineAnimator();
    const still = a.update(DT, 0, 0, { downed: true, rescuing: false, seated: false });
    expect(still.joints.shoulderL.x).toBeCloseTo(still.joints.shoulderR.x);
    let maxGap = 0;
    for (let i = 0; i < 60; i++) {
      const pose = a.update(DT, 1, 0, { downed: true, rescuing: false, seated: false });
      maxGap = Math.max(maxGap, Math.abs(pose.joints.shoulderL.x - pose.joints.shoulderR.x));
    }
    expect(maxGap).toBeGreaterThan(0.5);
  });

  it("rodilla en tierra y sentado: la cadera baja y las piernas se doblan", () => {
    const kneel = new MarineAnimator().update(DT, 0, 0, {
      downed: false,
      rescuing: true,
      seated: false,
    });
    expect(kneel.lift).toBeLessThan(-0.3);
    expect(kneel.joints.kneeR.x).toBeGreaterThan(1);
    const seated = new MarineAnimator().update(DT, 0, 0, {
      downed: false,
      rescuing: false,
      seated: true,
    });
    expect(seated.lift).toBeLessThan(-0.3);
    expect(seated.joints.hipL.x).toBeLessThan(-1);
    expect(seated.joints.kneeL.x).toBeGreaterThan(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  bodyToWorld,
  CrabGait,
  fanLegs,
  reachableFoot,
  solveKnee,
  type BodyPose,
  type GaitSpec,
  type Vec3,
} from "./crabGait.js";

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Como el raso: 8 patas, 6 m/s. */
const SPEC: GaitSpec = {
  legs: fanLegs({
    perSide: 4,
    hipX: 0.26,
    hipFront: 0.18,
    hipBack: -0.24,
    hipY: 0.42,
    reach: 0.95,
    frontAngle: 0.7,
    backAngle: 2.4,
  }),
  femur: 0.55,
  tibia: 0.72,
  bodyHeight: 0.42,
  stepThreshold: 0.25,
  stepSeconds: 0.05,
  stepHeight: 0.16,
  lead: 0.075,
  bob: 0.04,
  snapDistance: 2.5,
};
/** Aceleración de los rasos (`crab.acceleration`): de parado a 6 m/s en 0,2 s. */
const ACCEL = 30;

/** Corre a 6 m/s acelerando como un raso, a `fps`; devuelve lo peor que se estiró una pata. */
function run(gait: CrabGait, pose: BodyPose, fps: number, seconds: number): number {
  const reach = SPEC.femur + SPEC.tibia;
  let worst = 0;
  let v = 0;
  for (let i = 0; i < fps * seconds; i++) {
    v = Math.min(6, v + ACCEL / fps);
    pose.z += v / fps;
    gait.update(pose, 1 / fps);
    expect(gait.airborne(0) && gait.airborne(1)).toBe(false);
    SPEC.legs.forEach((leg, j) => {
      worst = Math.max(worst, dist(bodyToWorld(pose, leg.hip), gait.feet[j]!) / reach);
    });
  }
  return worst;
}
const DT = 1 / 60;

describe("patas de los centollos (E8-2)", () => {
  it("del cuerpo al mundo: delante es (sin yaw, cos yaw) y la derecha, +X mirando al norte", () => {
    const p = bodyToWorld({ x: 10, z: 5, yaw: Math.PI / 2 }, { x: 0, y: 0.4, z: 1 });
    expect(p.x).toBeCloseTo(11);
    expect(p.z).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(0.4);
    const right = bodyToWorld({ x: 0, z: 0, yaw: 0 }, { x: 1, y: 0, z: 0 });
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it("IK: con el pie a su alcance, fémur y tibia miden lo suyo y la rodilla queda arriba", () => {
    const hip = { x: 0, y: 0.45, z: 0 };
    const foot = { x: 1, y: 0, z: 0.3 };
    const knee = solveKnee(hip, foot, 0.6, 0.75);
    expect(dist(hip, knee)).toBeCloseTo(0.6);
    expect(dist(knee, foot)).toBeCloseTo(0.75);
    // Por encima de la recta de la cadera al pie, a mitad de camino.
    expect(knee.y).toBeGreaterThan((hip.y + foot.y) / 2);
  });

  it("IK: si el pie no llega, la pata se estira hacia él", () => {
    const hip = { x: 0, y: 0.45, z: 0 };
    const knee = solveKnee(hip, { x: 5, y: 0, z: 0 }, 0.6, 0.75);
    expect(dist(hip, knee)).toBeCloseTo(0.6);
    expect(knee.x).toBeGreaterThan(0.5);
  });

  it("dos grupos alternos, la mitad de las patas en cada uno, y a cada lado se alternan", () => {
    expect(SPEC.legs.filter((l) => l.group === 0)).toHaveLength(4);
    const left = SPEC.legs.filter((l) => l.hip.x < 0).map((l) => l.group);
    const right = SPEC.legs.filter((l) => l.hip.x > 0).map((l) => l.group);
    expect(left).toEqual([0, 1, 0, 1]);
    expect(right).toEqual([1, 0, 1, 0]);
  });

  it("quieto, los pies no se mueven", () => {
    const pose = { x: 3, z: -2, yaw: 0.7 };
    const gait = new CrabGait(SPEC, pose);
    const before = gait.feet.map((f) => ({ ...f }));
    for (let i = 0; i < 120; i++) gait.update(pose, DT);
    expect(gait.feet).toEqual(before);
    expect(gait.lift).toBe(0);
  });

  it("corriendo a 6 m/s: todas las patas avanzan, nunca los dos grupos en el aire y ninguna se estira de más", () => {
    const pose: BodyPose = { x: 0, z: 0, yaw: 0 };
    const gait = new CrabGait(SPEC, pose);
    const start = gait.feet.map((f) => ({ ...f }));
    const worst = run(gait, pose, 60, 2);
    gait.feet.forEach((f, j) => expect(f.z - start[j]!.z).toBeGreaterThan(10));
    expect(worst).toBeLessThan(1);
  });

  it("igual a 30 y a 20 fps", () => {
    for (const fps of [30, 20]) {
      const pose: BodyPose = { x: 0, z: 0, yaw: 0 };
      expect(run(new CrabGait(SPEC, pose), pose, fps, 3)).toBeLessThan(1);
    }
  });

  it("girando sin moverse, recoloca las patas", () => {
    const pose: BodyPose = { x: 0, z: 0, yaw: 0 };
    const gait = new CrabGait(SPEC, pose);
    const start = gait.feet.map((f) => ({ ...f }));
    for (let i = 0; i < 60; i++) {
      pose.yaw += (Math.PI / 2) * DT;
      gait.update(pose, DT);
    }
    for (let i = 0; i < 30; i++) gait.update(pose, DT);
    const moved = gait.feet.filter((f, j) => dist(f, start[j]!) > 0.3).length;
    expect(moved).toBe(SPEC.legs.length);
  });

  it("si aparece lejos de golpe, los pies se recolocan sin dar pasos", () => {
    const gait = new CrabGait(SPEC, { x: 0, z: 0, yaw: 0 });
    gait.update({ x: 30, z: 0, yaw: 0 }, DT);
    expect(gait.airborne(0) || gait.airborne(1)).toBe(false);
    gait.feet.forEach((f) => expect(f.x).toBeGreaterThan(28));
  });

  it("el pie se dibuja como mucho a lo que da la pata", () => {
    const hip = { x: 0, y: 0.5, z: 0 };
    const far = reachableFoot(hip, { x: 4, y: 0.5, z: 0 }, 1.3);
    expect(far).toEqual({ x: 1.3, y: 0.5, z: 0 });
    const near = { x: 0.5, y: 0, z: 0.2 };
    expect(reachableFoot(hip, near, 1.3)).toEqual(near);
  });
});

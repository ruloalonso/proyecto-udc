/**
 * Animación del marine (E8-1), procedural: sin esqueleto ni clips, ángulos de sus articulaciones
 * calculados cada frame a partir de cómo se mueve. Lógica pura (sin Babylon), para probarla.
 *
 * Ángulos en radianes, como `rotation` de Babylon en cada articulación (la pieza cuelga de ella
 * en su postura de partida: de pie, apuntando). En las piernas, `x` negativo lleva el pie hacia
 * delante y `z` positivo, hacia la derecha (+X). En el torso, `x` positivo lo inclina hacia
 * delante. En los hombros, `x` negativo sube los brazos.
 */

export const JOINTS = [
  "pelvis",
  "torso",
  "head",
  "hipL",
  "kneeL",
  "ankleL",
  "hipR",
  "kneeR",
  "ankleR",
  "shoulderL",
  "elbowL",
  "shoulderR",
  "elbowR",
] as const;
export type JointName = (typeof JOINTS)[number];

export interface Rot {
  x: number;
  y: number;
  z: number;
}

export interface MarinePose {
  /** Cuánto sube (o baja) la cadera respecto a estar de pie, en metros. */
  lift: number;
  joints: Record<JointName, Rot>;
}

export function restPose(): MarinePose {
  const joints = {} as Record<JointName, Rot>;
  for (const j of JOINTS) joints[j] = { x: 0, y: 0, z: 0 };
  return { lift: 0, joints };
}

/** Qué está haciendo el marine (además de moverse). */
export interface MarineState {
  /** Derribado: tumbado boca abajo (lo tumba quien lo pinta); se arrastra si se mueve. */
  downed: boolean;
  /** Rescatando a un compañero: rodilla en tierra. */
  rescuing: boolean;
  /** Sentado en el banco de la bodega. */
  seated: boolean;
}

export const STANDING: MarineState = { downed: false, rescuing: false, seated: false };

/** Velocidad en el suelo vista desde el marine: hacia delante y hacia su derecha, en m/s. */
export function localVelocity(
  vx: number,
  vz: number,
  yaw: number,
): { forward: number; side: number } {
  // Delante es (sin yaw, cos yaw); la derecha, (cos yaw, −sin yaw).
  return {
    forward: vx * Math.sin(yaw) + vz * Math.cos(yaw),
    side: vx * Math.cos(yaw) - vz * Math.sin(yaw),
  };
}

/** Metros de un ciclo de paso completo (dos zancadas): el ritmo sigue a la distancia. */
export const STRIDE = 1.9;
/** Metros de un ciclo de arrastre (los dos brazos). */
export const CRAWL_STRIDE = 0.9;
/** A partir de esta velocidad (m/s), el paso va entero; por debajo, se suaviza hasta quieto. */
const FULL_GAIT_SPEED = 1.5;
/** Lo que tarda en apagarse el retroceso de un disparo (constante de tiempo, en segundos). */
export const RECOIL_TAU = 0.07;

const HIP_SWING = 0.55;
const KNEE_LIFT = 0.9;
const SIDE_SWING = 0.32;
const BOB = 0.035;

/** El estado de la animación de un marine: el ritmo del paso, el retroceso y la respiración. */
export class MarineAnimator {
  /** Fase del ciclo de paso (o de arrastre), en radianes. */
  phase = 0;
  /** Retroceso del último disparo, de 0 a 1, que se apaga solo. */
  recoil = 0;
  private time = 0;
  private readonly pose = restPose();

  /** Ha disparado: el automático da un golpe pequeño; el apuntado, un culatazo. */
  fire(kind: "auto" | "aimed"): void {
    this.recoil = Math.max(this.recoil, kind === "aimed" ? 1 : 0.45);
  }

  /** Avanza `dt` segundos moviéndose a (`forward`, `side`) m/s, y devuelve la postura. */
  update(dt: number, forward: number, side: number, state: MarineState = STANDING): MarinePose {
    this.time += dt;
    this.recoil *= Math.exp(-dt / RECOIL_TAU);
    const speed = Math.hypot(forward, side);
    const p = this.pose;
    for (const j of JOINTS) {
      const r = p.joints[j];
      r.x = 0;
      r.y = 0;
      r.z = 0;
    }
    p.lift = 0;

    if (state.seated) return this.seated(p);
    if (state.downed) return this.crawl(p, dt, speed);
    if (state.rescuing) return this.kneel(p);

    this.phase += (speed * dt * 2 * Math.PI) / STRIDE;
    const w = Math.min(1, speed / FULL_GAIT_SPEED);
    const fw = speed > 1e-6 ? forward / speed : 0;
    const fs = speed > 1e-6 ? side / speed : 0;
    const legs: [Rot, Rot, number][] = [
      [p.joints.hipL, p.joints.kneeL, this.phase],
      [p.joints.hipR, p.joints.kneeR, this.phase + Math.PI],
    ];
    for (const [hip, knee, phase] of legs) {
      // Adelante y atrás (hacia atrás, el mismo paso al revés).
      hip.x = -HIP_SWING * Math.sin(phase) * fw * w;
      // De lado: la pierna se abre hacia donde va y la otra la sigue.
      hip.z = SIDE_SWING * Math.max(0, Math.sin(phase)) * fs * w;
      // La rodilla se dobla mientras la pierna pasa por el aire.
      knee.x = KNEE_LIFT * Math.max(0, Math.cos(phase)) * w;
    }
    // El cuerpo sube un poco a mitad de cada zancada, y se inclina hacia donde corre.
    p.lift = BOB * w * Math.abs(Math.sin(this.phase));
    p.joints.torso.x = 0.12 * w * fw;
    p.joints.torso.y = 0.06 * w * Math.sin(this.phase) * fw;
    p.joints.torso.z = -0.06 * w * fs;
    // Respiración en reposo y un leve vaivén del arma.
    const idle = 1 - w;
    p.joints.torso.x += 0.015 * idle * Math.sin(this.time * 1.8);
    p.joints.shoulderR.x += 0.02 * idle * Math.sin(this.time * 1.3);
    p.joints.shoulderL.x += 0.02 * idle * Math.sin(this.time * 1.3 + 0.4);
    // Retroceso: los brazos suben y el torso cede un poco hacia atrás.
    p.joints.shoulderR.x -= 0.3 * this.recoil;
    p.joints.shoulderL.x -= 0.22 * this.recoil;
    p.joints.torso.x -= 0.07 * this.recoil;
    return p;
  }

  /** Tumbado boca abajo: los brazos tiran alternos si se arrastra; las piernas, casi muertas. */
  private crawl(p: MarinePose, dt: number, speed: number): MarinePose {
    this.phase += (speed * dt * 2 * Math.PI) / CRAWL_STRIDE;
    const w = Math.min(1, speed / 0.3);
    // Boca abajo, los brazos «hacia arriba» del cuerpo apuntan hacia delante en el suelo.
    p.joints.shoulderL.x = -1.1 - 0.5 * w * Math.sin(this.phase);
    p.joints.shoulderR.x = -1.1 - 0.5 * w * Math.sin(this.phase + Math.PI);
    p.joints.elbowL.x = 0.4 + 0.4 * w * Math.max(0, Math.cos(this.phase));
    p.joints.elbowR.x = 0.4 + 0.4 * w * Math.max(0, Math.cos(this.phase + Math.PI));
    p.joints.hipL.x = 0.15 * w * Math.sin(this.phase + Math.PI);
    p.joints.hipR.x = 0.15 * w * Math.sin(this.phase);
    p.joints.kneeL.x = 0.25;
    p.joints.kneeR.x = 0.25;
    p.joints.head.x = -0.5; // Levanta la cabeza para ver hacia dónde va.
    return p;
  }

  /** Rodilla en tierra: la derecha en el suelo, la izquierda adelantada. */
  private kneel(p: MarinePose): MarinePose {
    p.lift = -0.42;
    p.joints.hipL.x = -1.35;
    p.joints.kneeL.x = 1.35;
    p.joints.hipR.x = 0.25;
    p.joints.kneeR.x = 1.55;
    p.joints.ankleR.x = -0.6;
    p.joints.torso.x = 0.2;
    // El fusil, bajado.
    p.joints.shoulderR.x = 0.35;
    p.joints.shoulderL.x = 0.35;
    return p;
  }

  /** Sentado en el banco: muslos hacia delante y espinillas abajo; el fusil, bajado. */
  private seated(p: MarinePose): MarinePose {
    p.lift = -0.48;
    p.joints.hipL.x = -1.45;
    p.joints.hipR.x = -1.45;
    p.joints.kneeL.x = 1.45;
    p.joints.kneeR.x = 1.45;
    p.joints.shoulderR.x = 0.45;
    p.joints.shoulderL.x = 0.45;
    p.joints.head.x = 0.1 * Math.sin(this.time * 0.7);
    return p;
  }
}

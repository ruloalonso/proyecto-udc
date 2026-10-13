/**
 * Animación del marine (E8-1), procedural: sin esqueleto ni clips, ángulos de sus articulaciones
 * calculados cada frame a partir de cómo se mueve. Lógica pura (sin Babylon), para probarla.
 *
 * - Moviéndose, corre (zancada larga, rodillas altas, inclinado hacia delante).
 * - Quieto, rodilla en tierra.
 * - Al disparar, se encara el arma y apunta por la mira; si no, la lleva baja, lista.
 * - Derribado, boca abajo, arrastrándose; sentado, en la bodega.
 *
 * El arma es una pieza propia: aquí se dice dónde va (respecto al torso) y los brazos la
 * siguen con IK (`soldierFigure.ts`), así que los hombros y los codos no salen de aquí.
 *
 * Ángulos en radianes, como `rotation` de Babylon en cada articulación (la pieza cuelga de ella
 * en su postura de partida: de pie, con el arma baja). En las piernas, `x` negativo lleva el pie
 * hacia delante y `z` positivo, hacia la derecha (+X). En el torso, `x` positivo lo inclina
 * hacia delante. En el arma, `pitch` negativo sube la boca.
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
] as const;
export type JointName = (typeof JOINTS)[number];

export interface Rot {
  x: number;
  y: number;
  z: number;
}

/** Dónde va el arma respecto a su sitio de partida (en el torso), y su cabeceo. */
export interface WeaponPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
}

export interface MarinePose {
  /** Cuánto sube (o baja) la cadera respecto a estar de pie, en metros. */
  lift: number;
  joints: Record<JointName, Rot>;
  weapon: WeaponPose;
}

export function restPose(): MarinePose {
  const joints = {} as Record<JointName, Rot>;
  for (const j of JOINTS) joints[j] = { x: 0, y: 0, z: 0 };
  return { lift: 0, joints, weapon: { x: 0, y: 0, z: 0, pitch: 0 } };
}

/** Qué está haciendo el marine (además de moverse). */
export interface MarineState {
  /** Derribado: tumbado boca abajo (lo tumba quien lo pinta); se arrastra si se mueve. */
  downed: boolean;
  /** Rescatando a un compañero: rodilla en tierra (también lo está quieto). */
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

/** Metros de un ciclo de carrera completo (dos zancadas): el ritmo sigue a la distancia. */
export const STRIDE = 2.4;
/** Metros de un ciclo de arrastre. */
export const CRAWL_STRIDE = 0.9;
/** A partir de esta velocidad (m/s), la carrera va entera; por debajo, se suaviza. */
const FULL_GAIT_SPEED = 2;
/** Por debajo de esta velocidad (m/s), está quieto: rodilla en tierra. */
export const STILL_SPEED = 0.4;
/** Lo que tarda en apagarse el retroceso de un disparo (constante de tiempo, en segundos). */
export const RECOIL_TAU = 0.07;
/** Tras el último disparo, sigue encarado este tiempo (segundos). */
export const AIM_HOLD = 1.2;
/** Lo que tarda en pasar de una postura a otra (constante de tiempo, en segundos). */
const BLEND_TAU = 0.12;

const HIP_SWING = 0.75;
const KNEE_LIFT = 1.25;
const SIDE_SWING = 0.35;
const BOB = 0.06;

/**
 * Arma encarada, respecto a la baja: sube hasta que la mira queda delante del ojo derecho,
 * se acerca al centro y la culata va al hombro.
 */
export const AIMED_WEAPON: WeaponPose = { x: -0.06, y: 0.38, z: -0.04, pitch: 0 };

/** La rodilla en tierra: la derecha en el suelo y la izquierda adelantada. */
const KNEEL = {
  lift: -0.42,
  hipL: -1.35,
  kneeL: 1.35,
  hipR: 0.25,
  kneeR: 1.55,
  ankleR: -0.6,
  torso: 0.12,
};

const approach = (value: number, target: number, dt: number) =>
  value + (target - value) * Math.min(1, dt / BLEND_TAU);

/** El estado de la animación de un marine: el ritmo, el retroceso, la puntería y las mezclas. */
export class MarineAnimator {
  /** Fase del ciclo de carrera (o de arrastre), en radianes. */
  phase = 0;
  /** Retroceso del último disparo, de 0 a 1, que se apaga solo. */
  recoil = 0;
  /** De 0 (de pie o corriendo) a 1 (rodilla en tierra). */
  kneel = 0;
  /** De 0 (arma baja) a 1 (encarada, por la mira). */
  aim = 0;
  private time = 0;
  private aimUntil = -1;
  private readonly pose = restPose();

  /**
   * Dispara (el automático da un golpe pequeño; el apuntado, un culatazo) o se encara el arma
   * sin disparar (`aim`, al empezar el disparo apuntado) durante `hold` segundos.
   */
  fire(kind: "auto" | "aimed" | "aim", hold = AIM_HOLD): void {
    if (kind !== "aim") this.recoil = Math.max(this.recoil, kind === "aimed" ? 1 : 0.45);
    this.aimUntil = Math.max(this.aimUntil, this.time + hold);
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
    const wp = p.weapon;
    wp.x = 0;
    wp.y = 0;
    wp.z = 0;
    wp.pitch = 0;

    if (state.seated) return this.seated(p);
    if (state.downed) return this.crawl(p, dt, speed);

    // Mezclas: rodilla en tierra si está quieto (o rescatando); encarada si dispara.
    const still = speed < STILL_SPEED || state.rescuing;
    this.kneel = approach(this.kneel, still ? 1 : 0, dt);
    this.aim = approach(this.aim, this.time < this.aimUntil ? 1 : 0, dt);

    // Carrera.
    this.phase += (speed * dt * 2 * Math.PI) / STRIDE;
    const w = Math.min(1, speed / FULL_GAIT_SPEED) * (1 - this.kneel);
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
    p.lift = BOB * w * Math.abs(Math.sin(this.phase));
    p.joints.torso.x = 0.22 * w * fw;
    p.joints.torso.y = 0.08 * w * Math.sin(this.phase) * fw;
    p.joints.torso.z = -0.08 * w * fs;

    // Rodilla en tierra, mezclada.
    const k = this.kneel;
    p.lift += KNEEL.lift * k;
    p.joints.hipL.x += KNEEL.hipL * k;
    p.joints.kneeL.x += KNEEL.kneeL * k;
    p.joints.hipR.x += KNEEL.hipR * k;
    p.joints.kneeR.x += KNEEL.kneeR * k;
    p.joints.ankleR.x += KNEEL.ankleR * k;
    p.joints.torso.x += KNEEL.torso * k;
    // Respiración, más marcada quieto.
    p.joints.torso.x += 0.015 * k * Math.sin(this.time * 1.8);

    // El arma: baja o encarada; siempre a nivel, aunque el torso se incline.
    const a = this.aim;
    wp.x = AIMED_WEAPON.x * a;
    wp.y = AIMED_WEAPON.y * a + 0.006 * Math.sin(this.time * 1.8) * (1 - a);
    wp.z = AIMED_WEAPON.z * a;
    wp.pitch = -p.joints.torso.x;
    // Encarado, la cabeza baja un poco hacia la mira.
    p.joints.head.x = 0.12 * a;
    // Retroceso: el arma retrocede y la boca sube.
    wp.z -= 0.07 * this.recoil;
    wp.pitch -= 0.15 * this.recoil;
    return p;
  }

  /** Boca abajo: el arma, por delante de la cara, apuntando hacia donde va. */
  private crawl(p: MarinePose, dt: number, speed: number): MarinePose {
    this.kneel = 0;
    this.aim = 0;
    this.phase += (speed * dt * 2 * Math.PI) / CRAWL_STRIDE;
    const w = Math.min(1, speed / 0.3);
    p.joints.hipL.x = 0.25 * w * Math.sin(this.phase + Math.PI);
    p.joints.hipR.x = 0.25 * w * Math.sin(this.phase);
    p.joints.kneeL.x = 0.3 + 0.3 * w * Math.max(0, Math.sin(this.phase));
    p.joints.kneeR.x = 0.3 + 0.3 * w * Math.max(0, Math.sin(this.phase + Math.PI));
    p.joints.head.x = -0.5; // Levanta la cabeza para ver hacia dónde va.
    // Tumbado, «delante» del torso es hacia el suelo y «arriba», hacia donde mira.
    p.weapon.x = -0.04;
    p.weapon.y = 0.3 + 0.04 * w * Math.sin(this.phase * 2);
    p.weapon.z = 0.05;
    p.weapon.pitch = -Math.PI / 2;
    return p;
  }

  /** Sentado en el banco: muslos hacia delante y espinillas abajo; el arma, vertical delante. */
  private seated(p: MarinePose): MarinePose {
    this.kneel = 0;
    this.aim = 0;
    p.lift = -0.48;
    p.joints.hipL.x = -1.45;
    p.joints.hipR.x = -1.45;
    p.joints.kneeL.x = 1.45;
    p.joints.kneeR.x = 1.45;
    p.joints.head.x = 0.1 * Math.sin(this.time * 0.7);
    p.weapon.x = -0.12;
    p.weapon.y = -0.2;
    p.weapon.z = 0.15;
    p.weapon.pitch = -Math.PI / 2;
    return p;
  }
}

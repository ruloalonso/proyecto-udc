/**
 * Patas de los centollos (E8-2): andar procedural, sin animaciones hechas a mano. Lógica pura
 * (sin Babylon), para probarla. Cada pata tiene su cadera en el cuerpo y su pie clavado en el
 * suelo (el mundo es plano: y = 0); cuando el pie se queda lejos de donde debería estar, da un
 * paso en arco hasta allí. Las patas van en dos grupos alternos, como un cangrejo de verdad:
 * mientras un grupo tiene alguna pata en el aire, el otro no levanta ninguna. La rodilla sale
 * de una IK de dos segmentos, alta, como en las arañas.
 *
 * Coordenadas como la simulación: yaw = 0 mira hacia +Z y la derecha es +X. En el cuerpo,
 * `x` a la derecha, `y` arriba y `z` hacia delante.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LegSpec {
  /** Cadera, en el cuerpo. */
  hip: Vec3;
  /** Dónde descansa el pie con el cuerpo quieto, en el cuerpo (en el suelo). */
  rest: { x: number; z: number };
  /** Grupo de paso (0 o 1): los dos grupos se alternan. */
  group: 0 | 1;
}

export interface GaitSpec {
  legs: readonly LegSpec[];
  femur: number;
  tibia: number;
  /** Altura del cuerpo sobre el suelo (las caderas van referidas a ella). */
  bodyHeight: number;
  /** Distancia del pie a su sitio a partir de la que da el paso. */
  stepThreshold: number;
  /** Lo que dura un paso, en segundos. */
  stepSeconds: number;
  /** Altura del arco del pie al dar el paso. */
  stepHeight: number;
  /**
   * El pie se adelanta lo que el cuerpo avanza en este tiempo: aterriza por delante. Con 1,5
   * veces `stepSeconds`, el apoyo queda centrado bajo el cuerpo (aterriza tanto por delante
   * como por detrás despega).
   */
  lead: number;
  /** Cuánto baja el cuerpo con las patas en el aire. */
  bob: number;
  /** Más lejos que esto (aparece, salta), los pies se recolocan de golpe. */
  snapDistance: number;
}

export interface BodyPose {
  x: number;
  z: number;
  yaw: number;
}

/** De coordenadas del cuerpo a las del mundo (Babylon gira a izquierdas: `rotation.y = yaw`). */
export function bodyToWorld(pose: BodyPose, local: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const c = Math.cos(pose.yaw);
  const s = Math.sin(pose.yaw);
  out.x = pose.x + local.x * c + local.z * s;
  out.y = local.y;
  out.z = pose.z - local.x * s + local.z * c;
  return out;
}

/**
 * IK de dos segmentos: la rodilla, con la cadera y el pie dados, en el plano vertical que los
 * contiene y doblada hacia arriba. Si el pie no llega, la pata se estira hacia él.
 */
export function solveKnee(
  hip: Vec3,
  foot: Vec3,
  femur: number,
  tibia: number,
  out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const dz = foot.z - hip.z;
  const raw = Math.hypot(dx, dy, dz);
  if (raw < 1e-6) {
    out.x = hip.x;
    out.y = hip.y + femur;
    out.z = hip.z;
    return out;
  }
  const ux = dx / raw;
  const uy = dy / raw;
  const uz = dz / raw;
  const d = Math.min(Math.max(raw, Math.abs(femur - tibia) + 1e-4), femur + tibia - 1e-4);
  // Ángulo en la cadera entre la recta al pie y el fémur (teorema del coseno).
  const cosA = Math.min(1, Math.max(-1, (femur * femur + d * d - tibia * tibia) / (2 * femur * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  // «Arriba» dentro del plano vertical de la pata: la vertical menos su parte a lo largo de u.
  let wx = -uy * ux;
  let wy = 1 - uy * uy;
  let wz = -uy * uz;
  const wl = Math.hypot(wx, wy, wz);
  if (wl < 1e-6) {
    // Pie justo debajo (o encima) de la cadera: la rodilla, hacia fuera en x.
    wx = 1;
    wy = 0;
    wz = 0;
  } else {
    wx /= wl;
    wy /= wl;
    wz /= wl;
  }
  out.x = hip.x + femur * (cosA * ux + sinA * wx);
  out.y = hip.y + femur * (cosA * uy + sinA * wy);
  out.z = hip.z + femur * (cosA * uz + sinA * wz);
  return out;
}

/**
 * El pie como se dibuja: donde está, o, si se ha quedado más lejos de lo que da la pata (con
 * pocos fps, un frame de paso deja al cuerpo muy adelantado), a todo su largo hacia él.
 */
export function reachableFoot(
  hip: Vec3,
  foot: Vec3,
  reach: number,
  out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const d = Math.hypot(foot.x - hip.x, foot.y - hip.y, foot.z - hip.z);
  const k = d > reach ? reach / d : 1;
  out.x = hip.x + (foot.x - hip.x) * k;
  out.y = hip.y + (foot.y - hip.y) * k;
  out.z = hip.z + (foot.z - hip.z) * k;
  return out;
}

/** Hasta dónde se estira la pata para pisar: con margen, para no llegar justo al límite. */
const REACH_MARGIN = 0.9;

interface Step {
  from: Vec3;
  to: Vec3;
  t: number;
}

/** El andar de un centollo: dónde está cada pie, y cada pata, en cada momento. */
export class CrabGait {
  readonly feet: Vec3[];
  private readonly steps: (Step | null)[];
  private last: BodyPose | null = null;
  /** El último grupo que pisó: si los dos lo necesitan, le toca al otro. */
  private lastGroup: 0 | 1 = 1;
  private vx = 0;
  private vz = 0;
  /** Cuánto ha bajado el cuerpo este frame (≤ 0). */
  lift = 0;
  private readonly tmp: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly hip: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(
    readonly spec: GaitSpec,
    pose: BodyPose,
  ) {
    this.feet = spec.legs.map((leg) => bodyToWorld(pose, { x: leg.rest.x, y: 0, z: leg.rest.z }));
    this.steps = spec.legs.map(() => null);
    this.last = { ...pose };
  }

  /** ¿Tiene alguna pata en el aire el grupo `group`? */
  airborne(group: 0 | 1): boolean {
    return this.spec.legs.some((leg, i) => leg.group === group && this.steps[i] !== null);
  }

  /** Avanza `dt` segundos con el cuerpo ya en `pose`. */
  update(pose: BodyPose, dt: number): void {
    const { spec } = this;
    // Un salto (aparece, se corrige de golpe): los pies, a su sitio, y sin velocidad.
    if (this.last && Math.hypot(pose.x - this.last.x, pose.z - this.last.z) > spec.snapDistance) {
      this.vx = 0;
      this.vz = 0;
      spec.legs.forEach((leg, i) => {
        bodyToWorld(pose, { x: leg.rest.x, y: 0, z: leg.rest.z }, this.feet[i]!);
        this.steps[i] = null;
      });
      this.last = { ...pose };
      this.lift = 0;
      return;
    }
    if (this.last && dt > 0) {
      // Velocidad suavizada: la interpolación de red da pasitos irregulares.
      const k = Math.min(1, dt / 0.1);
      this.vx += ((pose.x - this.last.x) / dt - this.vx) * k;
      this.vz += ((pose.z - this.last.z) / dt - this.vz) * k;
    }
    this.last = { ...pose };

    // Pasos en curso.
    let inAir = 0;
    this.steps.forEach((step, i) => {
      if (!step) return;
      step.t = Math.min(1, step.t + dt / spec.stepSeconds);
      const foot = this.feet[i]!;
      foot.x = step.from.x + (step.to.x - step.from.x) * step.t;
      foot.z = step.from.z + (step.to.z - step.from.z) * step.t;
      foot.y = Math.sin(step.t * Math.PI) * spec.stepHeight;
      if (step.t >= 1) {
        foot.y = 0;
        this.steps[i] = null;
      } else {
        inAir++;
      }
    });

    // Pasos nuevos, por grupos: cuando ninguna pata está en el aire, levanta el grupo al que le
    // toca (el que no pisó la última vez, si los dos lo necesitan), todas sus patas a la vez.
    // Si cada pata fuera por su cuenta, un grupo podría tener siempre alguna en el aire y el
    // otro no pisaría nunca: a 6 m/s se quedaba atrás.
    let need0 = false;
    let need1 = false;
    for (let i = 0; i < spec.legs.length; i++) {
      const leg = spec.legs[i]!;
      const off = this.offset(i, pose);
      if (off > spec.snapDistance) {
        const target = this.target(i, pose);
        const foot = this.feet[i]!;
        foot.x = target.x;
        foot.z = target.z;
        foot.y = 0;
        this.steps[i] = null;
        continue;
      }
      if (off > spec.stepThreshold) {
        if (leg.group === 0) need0 = true;
        else need1 = true;
      }
    }
    // Emergencia: un pie al que ya no llega su pata pisa aunque no le toque a su grupo (con
    // pocos fps, alternar frame a frame no da para seguir al cuerpo).
    const reach = spec.femur + spec.tibia;
    for (let i = 0; i < spec.legs.length; i++) {
      if (this.steps[i]) continue;
      const hip = bodyToWorld(pose, spec.legs[i]!.hip, this.hip);
      const foot = this.feet[i]!;
      if (Math.hypot(foot.x - hip.x, foot.y - hip.y, foot.z - hip.z) <= reach) continue;
      const target = this.target(i, pose);
      this.steps[i] = { from: { ...this.feet[i]! }, to: { ...target, y: 0 }, t: 0 };
      inAir++;
    }
    if (inAir === 0 && (need0 || need1)) {
      const group: 0 | 1 = need0 && need1 ? (this.lastGroup === 0 ? 1 : 0) : need0 ? 0 : 1;
      this.lastGroup = group;
      for (let i = 0; i < spec.legs.length; i++) {
        // Las del grupo que se han desviado algo, aunque no lleguen al umbral: pisan juntas.
        if (spec.legs[i]!.group !== group || this.offset(i, pose) <= spec.stepThreshold * 0.3) {
          continue;
        }
        const target = this.target(i, pose);
        this.steps[i] = { from: { ...this.feet[i]! }, to: { ...target, y: 0 }, t: 0 };
        inAir++;
      }
    }
    this.lift = inAir === 0 ? 0 : -spec.bob * (inAir / spec.legs.length);
  }

  /**
   * Dónde debería estar el pie `i`: su sitio de reposo, adelantado según la velocidad, pero
   * siempre al alcance de la pata (con margen). Si no, a toda velocidad las patas delanteras
   * apuntarían más lejos de lo que llegan y no dejarían de dar pasos.
   */
  private target(i: number, pose: BodyPose): Vec3 {
    const { spec } = this;
    const leg = spec.legs[i]!;
    const target = bodyToWorld(pose, { x: leg.rest.x, y: 0, z: leg.rest.z }, this.tmp);
    target.x += this.vx * spec.lead;
    target.z += this.vz * spec.lead;
    const hip = bodyToWorld(pose, leg.hip, this.hip);
    const reach = (spec.femur + spec.tibia) * REACH_MARGIN;
    const flat = Math.sqrt(Math.max(0, reach * reach - hip.y * hip.y));
    const dx = target.x - hip.x;
    const dz = target.z - hip.z;
    const d = Math.hypot(dx, dz);
    if (d > flat) {
      target.x = hip.x + (dx / d) * flat;
      target.z = hip.z + (dz / d) * flat;
    }
    return target;
  }

  /** Lo que se ha desviado el pie `i` de donde debería estar (en el suelo). */
  private offset(i: number, pose: BodyPose): number {
    const target = this.target(i, pose);
    const foot = this.feet[i]!;
    return Math.hypot(target.x - foot.x, target.z - foot.z);
  }
}

/**
 * Patas repartidas a los dos lados, de delante atrás, en grupos alternos (la primera izquierda
 * con la segunda derecha, y así): `perSide` por lado, con las caderas a lo largo del cuerpo y
 * los pies en abanico, de `frontAngle` (desde delante) a `backAngle`, a `reach` del centro.
 */
export function fanLegs(opts: {
  perSide: number;
  hipX: number;
  hipFront: number;
  hipBack: number;
  hipY: number;
  reach: number;
  frontAngle: number;
  backAngle: number;
}): LegSpec[] {
  const legs: LegSpec[] = [];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < opts.perSide; i++) {
      const f = opts.perSide === 1 ? 0.5 : i / (opts.perSide - 1);
      const angle = opts.frontAngle + (opts.backAngle - opts.frontAngle) * f;
      legs.push({
        hip: {
          x: side * opts.hipX,
          y: opts.hipY,
          z: opts.hipFront + (opts.hipBack - opts.hipFront) * f,
        },
        rest: { x: side * Math.sin(angle) * opts.reach, z: Math.cos(angle) * opts.reach },
        group: ((i + (side === 1 ? 1 : 0)) % 2) as 0 | 1,
      });
    }
  }
  return legs;
}

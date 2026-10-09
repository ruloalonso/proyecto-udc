import { GAME_CONFIG, TICK_SECONDS } from "../config/game.config.js";
import type { MapData, Point } from "../map/index.js";
import { AbilityId, EntityKind, isHostile, type AbilityUse } from "../protocol/messages.js";
import { normalizeAngle } from "../protocol/quantize.js";
import { pushCircleOutOfBox } from "../sim/collision.js";
import { isFacing } from "../sim/combat.js";
import { hasLineOfSight } from "../sim/lineOfSight.js";

const { bot, soldier, combat, abilities } = GAME_CONFIG;
const ticks = (seconds: number) => Math.max(1, Math.round(seconds / TICK_SECONDS));
const STRAFE_TICKS = ticks(bot.strafeSwitch);
const STUCK_TICKS = ticks(bot.stuckSeconds);
const CAST_TICKS = ticks(abilities.aimedShot.castTime);
/** Radianes que puede girar por tick (como un jugador con teclado). */
const TURN_PER_TICK = soldier.turnSpeed * TICK_SECONDS;
/** A esta distancia del punto de patrulla, se da por llegado. */
const PATROL_REACHED = 2;

/** El propio soldado, tal como lo ve el bot en el último snapshot. */
export interface BotSelf {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  /** Ticks que faltan para cada habilidad: [global, 1, 2, 3]. */
  cd: readonly [number, number, number, number];
  /** Objetivo que tiene el servidor (selección automática o a mano). */
  target: number | null;
}

/** Otra entidad que el bot conoce (posición en metros). */
export interface BotEntity {
  id: number;
  kind: EntityKind;
  x: number;
  z: number;
}

/** Lo que el bot hace este tick: la entrada que manda. */
export interface BotDecision {
  forward: number;
  strafe: number;
  yaw: number;
  ability?: AbilityUse;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Comportamiento básico de un soldado bot (E7-4, spec §4.7): se mueve, va a por el hostil más
 * cercano, lo encara para que la selección automática lo elija y el fuego automático le dé,
 * usa las habilidades con un poco de cabeza y no se suicida (no se mete en la masa, no se tira
 * granadas encima y se cura). Sin enemigos, patrulla cerca de la plataforma.
 *
 * Lógica pura, un `think` por tick: la usan los bots headless y la usarán los compañeros del
 * servidor (E5-6). El azar entra por `random`, para poder probarlo.
 */
export class BotBrain {
  private tick = 0;
  /** Quieto hasta este tick (disparo apuntado en curso). */
  private stillUntil = -1;
  private strafeDir = 1;
  private nextStrafeSwitch = 0;
  private patrol: Point | null = null;
  private progress: { at: Point; tick: number } | null = null;

  constructor(
    private readonly map: MapData,
    private readonly random: () => number = Math.random,
  ) {}

  think(self: BotSelf, entities: readonly BotEntity[]): BotDecision {
    this.tick++;
    if (this.tick < this.stillUntil) return { forward: 0, strafe: 0, yaw: self.yaw };

    const hostiles = entities.filter((e) => isHostile(e.kind));
    // Aliados para la granada: soldados y colonos (también les hiere, E6-2).
    const allies = entities.filter(
      (e) => e.kind === EntityKind.Soldier || e.kind === EntityKind.Colonist,
    );
    const nearest = nearestOf(self, hostiles, bot.engageRange);

    // Derribado (E5-1): quieto, de cara al más cercano, con fuego lento. Sin habilidades.
    if (self.hp <= 0) {
      const yaw = nearest ? turnToward(self.yaw, angleTo(self, nearest)) : self.yaw;
      return { forward: 0, strafe: 0, yaw };
    }

    const ability = this.chooseAbility(self, hostiles, allies, nearest);
    if (ability?.id === AbilityId.AimedShot) {
      // Moverse lo interrumpe: se queda quieto mientras apunta.
      this.stillUntil = this.tick + CAST_TICKS + 1;
      return { forward: 0, strafe: 0, yaw: self.yaw, ability };
    }

    const decision = nearest ? this.fight(self, nearest, hostiles) : this.wander(self);
    if (ability) decision.ability = ability;
    return decision;
  }

  /** Combate: encarar al más cercano y mantener la distancia. */
  private fight(self: BotSelf, enemy: BotEntity, hostiles: readonly BotEntity[]): BotDecision {
    this.patrol = null;
    const d = dist(self, enemy);
    const forward = d < bot.keepAway ? -1 : d > bot.approachRange ? 1 : 0;
    // Con escupidores cerca, de lado a lado para esquivar los escupitajos.
    const spitters = hostiles.some(
      (h) => h.kind === EntityKind.Spitter && dist(self, h) <= bot.engageRange,
    );
    let strafe = 0;
    if (spitters) {
      if (this.tick >= this.nextStrafeSwitch) {
        this.strafeDir = -this.strafeDir;
        this.nextStrafeSwitch = this.tick + STRAFE_TICKS;
      }
      strafe = this.strafeDir;
    }
    if (this.isStuck(self, forward !== 0 || strafe !== 0)) this.strafeDir = -this.strafeDir;
    return { forward, strafe, yaw: turnToward(self.yaw, angleTo(self, enemy)) };
  }

  /** Sin enemigos: patrulla puntos al azar cerca de la plataforma. */
  private wander(self: BotSelf): BotDecision {
    if (!this.patrol || dist(self, this.patrol) < PATROL_REACHED || this.isStuck(self, true)) {
      this.patrol = this.patrolPoint();
    }
    return { forward: 1, strafe: 0, yaw: turnToward(self.yaw, angleTo(self, this.patrol)) };
  }

  /** Un punto libre de obstáculos cerca de la plataforma. */
  private patrolPoint(): Point {
    const { landingPad } = this.map;
    for (let i = 0; i < 8; i++) {
      const angle = this.random() * Math.PI * 2;
      const r = this.random() * bot.patrolRadius;
      const p = { x: landingPad.x + Math.cos(angle) * r, z: landingPad.z + Math.sin(angle) * r };
      const free = this.map.obstacles.every((box) => {
        const out = pushCircleOutOfBox(p.x, p.z, soldier.radius, box);
        return out.x === p.x && out.z === p.z;
      });
      if (free) return p;
    }
    return { x: landingPad.x, z: landingPad.z };
  }

  /** ¿Lleva un rato queriendo moverse sin avanzar? (Contra un muro o atrapado.) */
  private isStuck(self: BotSelf, moving: boolean): boolean {
    if (!moving) {
      this.progress = null;
      return false;
    }
    if (!this.progress) {
      this.progress = { at: { x: self.x, z: self.z }, tick: this.tick };
      return false;
    }
    if (this.tick - this.progress.tick < STUCK_TICKS) return false;
    const stuck = dist(self, this.progress.at) < bot.stuckDistance;
    this.progress = { at: { x: self.x, z: self.z }, tick: this.tick };
    return stuck;
  }

  /** Estimulante si está herido; granada a un grupo lejos de sí y de aliados; disparo apuntado a un escupidor si está tranquilo. */
  private chooseAbility(
    self: BotSelf,
    hostiles: readonly BotEntity[],
    allies: readonly BotEntity[],
    nearest: BotEntity | undefined,
  ): AbilityUse | undefined {
    const ready = (id: AbilityId) => self.cd[0] === 0 && self.cd[id] === 0;

    if (self.hp <= bot.stimHp && ready(AbilityId.Stim)) return { id: AbilityId.Stim };

    if (nearest && ready(AbilityId.Grenade)) {
      const { radius, range } = abilities.grenade;
      const safe = radius + bot.grenadeSafety;
      const d = dist(self, nearest);
      const clustered =
        hostiles.filter((h) => dist(h, nearest) <= radius).length >= bot.grenadeCluster;
      const alliesClear = allies.every((a) => dist(a, nearest) > safe);
      if (d <= range && d > safe && clustered && alliesClear) {
        return { id: AbilityId.Grenade, x: nearest.x, z: nearest.z };
      }
    }

    const target = hostiles.find((h) => h.id === self.target);
    if (target && target.kind === EntityKind.Spitter && ready(AbilityId.AimedShot)) {
      const calm = hostiles.every((h) => dist(self, h) > bot.aimedShotSafeRange);
      const inShot =
        dist(self, target) <= abilities.aimedShot.range &&
        isFacing(self, target, combat.facingHalfAngle) &&
        hasLineOfSight(self, target, this.map);
      if (calm && inShot) return { id: AbilityId.AimedShot, target: target.id };
    }
    return undefined;
  }
}

/** El hostil más cercano a `range` metros como mucho. */
function nearestOf(self: Point, hostiles: readonly BotEntity[], range: number) {
  let best: BotEntity | undefined;
  let bestDist = range;
  for (const h of hostiles) {
    const d = dist(self, h);
    if (d <= bestDist) {
      best = h;
      bestDist = d;
    }
  }
  return best;
}

/** Orientación (yaw = 0 mira hacia +Z) para mirar de `from` a `to`. */
const angleTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.z - from.z);

/** Gira de `yaw` hacia `target`, como mucho lo que da un tick. */
function turnToward(yaw: number, target: number): number {
  const delta = normalizeAngle(target - yaw);
  return yaw + Math.max(-TURN_PER_TICK, Math.min(TURN_PER_TICK, delta));
}

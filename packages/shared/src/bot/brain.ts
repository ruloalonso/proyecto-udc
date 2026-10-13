import { GAME_CONFIG, TICK_SECONDS } from "../config/game.config.js";
import type { MapData, Point } from "../map/index.js";
import { AbilityId, EntityKind, isHostile, type AbilityUse } from "../protocol/messages.js";
import { normalizeAngle } from "../protocol/quantize.js";
import { pushCircleOutOfBox } from "../sim/collision.js";
import { isFacing } from "../sim/combat.js";
import { hasLineOfSight } from "../sim/lineOfSight.js";
import { GUARD, type BotOrder } from "./squad.js";

const { bot, soldier, combat, abilities, shuttles } = GAME_CONFIG;
const ticks = (seconds: number) => Math.max(1, Math.round(seconds / TICK_SECONDS));
const STRAFE_TICKS = ticks(bot.strafeSwitch);
const STUCK_TICKS = ticks(bot.stuckSeconds);
const CAST_TICKS = ticks(abilities.aimedShot.castTime);
/** Radianes que puede girar por tick (como un jugador con teclado). */
const TURN_PER_TICK = soldier.turnSpeed * TICK_SECONDS;
/** A esta distancia del punto de patrulla, se da por llegado. */
const PATROL_REACHED = 2;
/** A esta distancia de un punto del camino o de su puesto, se da por llegado. */
const WAYPOINT_REACHED = 1.5;
/** Para rescatar se acerca algo más de lo justo (el alcance del rescate). */
const REVIVE_REACH = soldier.rescue.range * 0.75;
/** Con un giro mayor que este hacia el siguiente punto, gira antes de avanzar. */
const TURN_BEFORE_MOVING = Math.PI / 3;

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
  /** Está rescatando a un compañero (E5-7): quieto y sin habilidades hasta que acabe. */
  rescuing?: boolean;
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
  /** Rescatar a este compañero derribado (E5-7), como al pulsar F. */
  revive?: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Comportamiento básico de un soldado bot (E7-4, spec §4.7): se mueve, va a por el hostil más
 * cercano, lo encara para que la selección automática lo elija y el fuego automático le dé,
 * usa las habilidades con un poco de cabeza y no se suicida (no se mete en la masa, no se tira
 * granadas encima y se cura). Sin enemigos, patrulla cerca de la plataforma.
 *
 * Los compañeros del servidor (E5-6) reciben además una orden del coordinador del pelotón
 * (E5-7): rescatar a un derribado, escoltar la fila desde un puesto o defender (lo de siempre),
 * con el camino de la navmesh hasta su destino. Los bots headless no tienen órdenes.
 *
 * Lógica pura, un `think` por tick. El azar entra por `random`, para poder probarlo.
 */
export class BotBrain {
  private tick = 0;
  /** Disparo apuntado en curso: a quién y hasta qué tick. */
  private aiming = { target: -1, until: -1 };
  private strafeDir = 1;
  private nextStrafeSwitch = 0;
  private patrol: Point | null = null;
  private progress: { at: Point; tick: number } | null = null;
  /** Camino que sigue y el punto al que va. */
  private path: readonly Point[] = [];
  private waypoint = 0;
  /** Hasta este tick se mueve de lado para despegarse de un obstáculo. */
  private unstickUntil = 0;

  constructor(
    private readonly map: MapData,
    private readonly random: () => number = Math.random,
  ) {}

  think(
    self: BotSelf,
    entities: readonly BotEntity[],
    order: BotOrder = GUARD,
    path: readonly Point[] = [],
  ): BotDecision {
    this.tick++;

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

    // Rescatando (E5-7): quieto y sin habilidades, de cara al más cercano (girar no lo corta).
    if (self.rescuing) {
      const yaw = nearest ? turnToward(self.yaw, angleTo(self, nearest)) : self.yaw;
      return { forward: 0, strafe: 0, yaw };
    }
    // Junto al derribado y sin peligro (o sin tiempo que perder): a rescatar.
    if (order.kind === "rescue") {
      const target = entities.find((e) => e.id === order.target) ?? order.at;
      const safe = hostiles.every((h) => dist(target, h) > bot.reviveSafeRange);
      if (dist(self, target) <= REVIVE_REACH && (safe || order.urgent)) {
        return { forward: 0, strafe: 0, yaw: self.yaw, revive: order.target };
      }
    }

    let ability = this.chooseAbility(self, hostiles, allies, nearest);
    // Camino de un rescate no apunta: mira hacia donde va, y el disparo fallaría.
    if (ability?.id === AbilityId.AimedShot && order.kind === "rescue") ability = undefined;
    if (ability?.id === AbilityId.AimedShot && ability.target !== undefined) {
      this.aiming = { target: ability.target, until: this.tick + CAST_TICKS + 1 };
    }
    // Mientras apunta, combate contra su objetivo: de cara a él (si no, el disparo falla al
    // acabar) y moviéndose de lado si hay escupidores.
    const aimed =
      this.tick < this.aiming.until ? hostiles.find((h) => h.id === this.aiming.target) : undefined;
    const decision = aimed
      ? this.fight(self, aimed, hostiles)
      : this.obey(self, entities, hostiles, nearest, order, path);
    if (ability) decision.ability = ability;
    return decision;
  }

  /** Movimiento según la orden. */
  private obey(
    self: BotSelf,
    entities: readonly BotEntity[],
    hostiles: readonly BotEntity[],
    nearest: BotEntity | undefined,
    order: BotOrder,
    path: readonly Point[],
  ): BotDecision {
    const threat = nearest && dist(self, nearest) < bot.keepAway ? nearest : undefined;
    switch (order.kind) {
      case "guard":
        return nearest ? this.fight(self, nearest, hostiles) : this.wander(self);
      case "rescue": {
        const target = entities.find((e) => e.id === order.target) ?? order.at;
        // Con peligro y margen, no se planta junto al derribado (le derribarían a él también):
        // combate como siempre hasta que se despeje o se acabe el margen.
        const safe = hostiles.every((h) => dist(target, h) > bot.reviveSafeRange);
        if (!safe && !order.urgent) {
          return nearest ? this.fight(self, nearest, hostiles) : this.wander(self);
        }
        // De camino: si tiene un hostil encima, se defiende; si no, sigue andando.
        return threat ? this.fight(self, threat, hostiles) : this.follow(self, target, path);
      }
      case "escort": {
        const fromPost = dist(self, order.post);
        if (nearest && fromPost <= bot.escortLeash) {
          // Combate sin alejarse de su puesto más que la correa.
          const decision = this.fight(self, nearest, hostiles);
          const ahead = { x: Math.sin(self.yaw), z: Math.cos(self.yaw) };
          const away = (self.x - order.post.x) * ahead.x + (self.z - order.post.z) * ahead.z;
          if (decision.forward > 0 && away > 0 && fromPost >= bot.escortLeash * 0.8) {
            decision.forward = 0;
          }
          return decision;
        }
        if (fromPost > WAYPOINT_REACHED) {
          return threat ? this.fight(self, threat, hostiles) : this.follow(self, order.post, path);
        }
        // En su puesto y sin nadie a la vista: mirando hacia donde vendrán.
        return { forward: 0, strafe: 0, yaw: turnToward(self.yaw, order.facing) };
      }
    }
  }

  /**
   * Sigue el camino que le da el servidor hasta `goal`: el primer punto es donde estaba al
   * pedirlo. Si se atasca, se mueve de lado un momento.
   */
  private follow(self: BotSelf, goal: Point, path: readonly Point[]): BotDecision {
    this.patrol = null;
    if (path !== this.path) {
      this.path = path;
      this.waypoint = path.length > 1 ? 1 : 0;
    }
    while (this.waypoint < path.length && dist(self, path[this.waypoint]!) < WAYPOINT_REACHED) {
      this.waypoint++;
    }
    const next = path[this.waypoint] ?? goal;
    const desired = angleTo(self, next);
    const forward = Math.abs(normalizeAngle(desired - self.yaw)) < TURN_BEFORE_MOVING ? 1 : 0;
    if (this.isStuck(self, forward !== 0)) {
      this.strafeDir = -this.strafeDir;
      this.unstickUntil = this.tick + STRAFE_TICKS;
    }
    const strafe = this.tick < this.unstickUntil ? this.strafeDir : 0;
    return { forward, strafe, yaw: turnToward(self.yaw, desired) };
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
      // Ni aliados ni la nave de la plataforma (la granada también la daña, #72).
      const alliesClear =
        allies.every((a) => dist(a, nearest) > safe) &&
        dist(this.map.landingPad, nearest) > safe + shuttles.hullRadius;
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

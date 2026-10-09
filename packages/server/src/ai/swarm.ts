import { addComponent, addEntity, query, removeComponent, removeEntity } from "bitecs";
import { Crowd, type CrowdAgent } from "recast-navigation";
import {
  EntityKind,
  GAME_CONFIG,
  hasLineOfSight,
  segmentCircleHit,
  segmentCrossesBox,
  TICK_SECONDS,
  type DamageEvent,
  type MapData,
  type Point,
} from "@udc/shared";
import { CrabMode, createEcsWorld, NO_TARGET, type EcsWorld } from "../ecs/components.js";
import type { NavMap } from "./navmesh.js";

const { crab, spitter, soldier, colonists } = GAME_CONFIG;
const BITE_TICKS = Math.round(crab.bite.interval / TICK_SECONDS);
const SPIT_TICKS = Math.round(spitter.spit.interval / TICK_SECONDS);
/** Metros que avanza un escupitajo por tick. */
const SPIT_STEP = spitter.spit.speed * TICK_SECONDS;
/** Distancia entre centros a la que un escupitajo toca a un soldado. */
const SPIT_HIT = soldier.radius + spitter.spit.radius;

/** Capacidad del crowd: 150 centollos, 8 soldados y hasta 200 colonos, con margen. */
const MAX_AGENTS = 512;
/** Metros que tiene que moverse el objetivo para volver a pedir camino al crowd. */
const REPLAN_DISTANCE = 0.5;
/** Por debajo de esta velocidad (m/s), el centollo mira a su objetivo y no hacia donde va. */
const FACE_MOVE_MIN_SPEED = 0.5;
/** Distancia a la que se busca la navmesh al hacer aparecer un centollo. */
const SPAWN_SEARCH = 4;

/** Tipos de centollo que simula el enjambre. */
export type CrabKind = typeof EntityKind.Crab | typeof EntityKind.Spitter;

/** Parámetros de Detour de cada tipo. Los rangos siguen las proporciones de su demo. */
const AGENT_PARAMS: Record<CrabKind, object> = {
  [EntityKind.Crab]: {
    radius: crab.radius,
    height: crab.height,
    maxSpeed: crab.speed,
    maxAcceleration: crab.acceleration,
    collisionQueryRange: crab.radius * 12,
    pathOptimizationRange: crab.radius * 30,
    separationWeight: 2,
  },
  [EntityKind.Spitter]: {
    radius: spitter.radius,
    height: spitter.height,
    maxSpeed: spitter.speed,
    maxAcceleration: spitter.acceleration,
    collisionQueryRange: spitter.radius * 12,
    pathOptimizationRange: spitter.radius * 30,
    separationWeight: 2,
  },
};

/** Banderas de dirección de Detour (`DT_CROWD_*`). */
const ANTICIPATE_TURNS = 1;
const SEPARATION = 4;
/**
 * Colono (E6-2): más pequeño y más lento que un centollo. Sin la evitación de obstáculos de
 * Detour (lo más caro del crowd): se separan entre sí y nada más.
 */
const COLONIST_PARAMS = {
  radius: colonists.radius,
  height: colonists.height,
  maxSpeed: colonists.speed,
  maxAcceleration: colonists.acceleration,
  collisionQueryRange: colonists.radius * 12,
  pathOptimizationRange: colonists.radius * 30,
  separationWeight: 2,
  updateFlags: ANTICIPATE_TURNS | SEPARATION,
};
/** A esta distancia de su sitio en la plataforma, el colono ha llegado y espera quieto. */
const COLONIST_ARRIVED = 1;
/** Dentro de la plataforma y casi parado (atascado entre otros), también ha llegado. */
const COLONIST_STALLED_SPEED = 0.3;
const PANIC_TICKS = Math.round(colonists.panic.seconds / TICK_SECONDS);

const HEALTH: Record<CrabKind, number> = {
  [EntityKind.Crab]: crab.health,
  [EntityKind.Spitter]: spitter.health,
};

const RADIUS: Record<CrabKind, number> = {
  [EntityKind.Crab]: crab.radius,
  [EntityKind.Spitter]: spitter.radius,
};

/**
 * Un soldado dentro del crowd: un agente quieto que el servidor recoloca en cada tick, para
 * que los centollos lo esquiven y se paren contra él (§7.5).
 */
const SOLDIER_AGENT = {
  radius: soldier.radius,
  height: soldier.height,
  maxSpeed: 0,
  maxAcceleration: 0,
  separationWeight: 0,
  updateFlags: 0,
};

/** Soldado vivo, tal como lo necesita el enjambre. */
export interface SoldierBody {
  id: number;
  x: number;
  z: number;
  /**
   * Derribado (E5-1): sigue cortando el paso; el raso va a rematarlo (E5-3), el escupidor no lo
   * elige y los escupitajos le pasan por encima.
   */
  downed?: boolean;
  /** Derribado al que están rescatando: los centollos van a por su rescatador (E5-2). */
  rescuer?: number;
}

/** Vista de solo lectura de un centollo, para el combate y los snapshots. */
export interface CrabView {
  id: number;
  kind: CrabKind;
  x: number;
  z: number;
  yaw: number;
  hp: number;
}

/** Vista de solo lectura de un colono. */
export interface ColonistView {
  id: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
}

/** Presa de un raso (soldado o colono), con lo que hace falta para perseguirla. */
type Prey = Point & { id: number };

/** Vista de solo lectura de un escupitajo. */
export interface SpitView {
  id: number;
  x: number;
  z: number;
  yaw: number;
}

/**
 * Centollos (E4-2, E4-3): estado en bitECS, movimiento con DetourCrowd sobre la navmesh e IA de
 * §4.3. El raso persigue y muerde; el escupidor se para a distancia y escupe proyectiles que
 * también viven aquí. Los colonos (E6-2) comparten crowd y mundo: así los rasos los ven como
 * presas y se esquivan unos a otros. Solo los simula el servidor.
 */
export class CrabSwarm {
  private readonly world: EcsWorld = createEcsWorld();
  private readonly crowd: Crowd;
  /** Id de red → id de bitECS, de los centollos. */
  private readonly eids = new Map<number, number>();
  /** Id de red → id de bitECS, de los escupitajos. */
  private readonly spits = new Map<number, number>();
  /** Id de red → id de bitECS, de los colonos. */
  private readonly colonists = new Map<number, number>();
  private readonly agents = new Map<number, CrowdAgent>();
  private readonly soldierAgents = new Map<number, CrowdAgent>();
  private readonly colony: Point & { radius: number };
  /**
   * Remates de este tick (E5-3): derribado → raso pegado a él que lo tiene de objetivo. El mundo
   * lleva la cuenta del tiempo y decide cuándo muere.
   */
  readonly finishing = new Map<number, number>();

  constructor(
    private readonly nav: NavMap,
    private readonly map: MapData,
    /** Reparte ids de red (los escupitajos son entidades). */
    private readonly nextId: () => number,
  ) {
    this.crowd = new Crowd(nav.navMesh, {
      maxAgents: MAX_AGENTS,
      maxAgentRadius: Math.max(crab.radius, spitter.radius, soldier.radius),
    });
    // Calidad de la evitación (la configuración 0, la que usan todos los agentes).
    const { divs, rings, depth } = GAME_CONFIG.navmesh.avoidance;
    const avoidance = this.crowd.raw.getObstacleAvoidanceParams(0);
    avoidance.set_adaptiveDivs(divs);
    avoidance.set_adaptiveRings(rings);
    avoidance.set_adaptiveDepth(depth);
    this.crowd.raw.setObstacleAvoidanceParams(0, avoidance);
    this.colony = map.landingPad;
  }

  /** Cambia con cada modificación (aparecer, daño, quitar, avanzar): para cachear lecturas. */
  private revision = 0;

  get version(): number {
    return this.revision;
  }

  /** Centollos vivos (de todos los tipos). */
  get count(): number {
    return this.eids.size;
  }

  /** Centollos vivos de un tipo. */
  countOf(kind: CrabKind): number {
    const { Enemy } = this.world.components;
    let n = 0;
    for (const eid of this.eids.values()) if (Enemy.kind[eid] === kind) n++;
    return n;
  }

  /** ¿Es `id` un centollo vivo? (Los escupitajos no cuentan.) */
  has(id: number): boolean {
    return this.eids.has(id);
  }

  /** Tipo de una entidad del enjambre (centollo, escupitajo o colono), o `null` si no es suya. */
  kindOf(id: number): EntityKind | null {
    const eid = this.eids.get(id);
    if (eid !== undefined) return this.world.components.Enemy.kind[eid]!;
    if (this.colonists.has(id)) return EntityKind.Colonist;
    return this.spits.has(id) ? EntityKind.Spit : null;
  }

  /** Colonos vivos. */
  get colonistCount(): number {
    return this.colonists.size;
  }

  /** ¿Es `id` un colono vivo? */
  isColonist(id: number): boolean {
    return this.colonists.has(id);
  }

  /** Recorre los colonos vivos. */
  forEachColonist(fn: (colonist: ColonistView) => void): void {
    const { Position, Health } = this.world.components;
    for (const [id, eid] of this.colonists) {
      fn({
        id,
        x: Position.x[eid]!,
        z: Position.z[eid]!,
        yaw: Position.yaw[eid]!,
        hp: Health.hp[eid]!,
      });
    }
  }

  /**
   * Hace aparecer un colono (E6-2) con el id de red `id` en la puerta `at`, camino de `goal` (su
   * sitio en la plataforma). `false` si no hay sitio.
   */
  spawnColonist(id: number, at: Point, goal: Point): boolean {
    this.revision++;
    const p = this.nav.closestPoint(at, SPAWN_SEARCH);
    if (!p) return false;
    const agent = this.crowd.addAgent({ x: p.x, y: 0, z: p.z }, COLONIST_PARAMS);
    if (agent.agentIndex < 0) return false;

    const { NetId, Position, Health, Agent, Colonist } = this.world.components;
    const eid = addEntity(this.world);
    for (const c of [NetId, Position, Health, Agent, Colonist]) addComponent(this.world, eid, c);
    NetId.id[eid] = id;
    Position.x[eid] = p.x;
    Position.z[eid] = p.z;
    Position.yaw[eid] = Math.atan2(goal.x - p.x, goal.z - p.z);
    Health.hp[eid] = colonists.health;
    Agent.index[eid] = agent.agentIndex;
    Colonist.panicUntil[eid] = 0;
    Colonist.running[eid] = 0;
    Colonist.goalX[eid] = goal.x;
    Colonist.goalZ[eid] = goal.z;
    agent.requestMoveTarget({ x: goal.x, y: 0, z: goal.z });

    this.colonists.set(id, eid);
    this.agents.set(eid, agent);
    return true;
  }

  /** Posición de un centollo, o `undefined` si no existe. */
  pose(id: number): Point | undefined {
    const eid = this.eids.get(id);
    if (eid === undefined) return undefined;
    const { Position } = this.world.components;
    return { x: Position.x[eid]!, z: Position.z[eid]! };
  }

  /** Recorre los centollos vivos. */
  forEach(fn: (crab: CrabView) => void): void {
    const { Position, Health, Enemy } = this.world.components;
    for (const [id, eid] of this.eids) {
      fn({
        id,
        kind: Enemy.kind[eid] as CrabKind,
        x: Position.x[eid]!,
        z: Position.z[eid]!,
        yaw: Position.yaw[eid]!,
        hp: Health.hp[eid]!,
      });
    }
  }

  /** Recorre los escupitajos en vuelo. */
  forEachSpit(fn: (spit: SpitView) => void): void {
    const { Position } = this.world.components;
    for (const [id, eid] of this.spits) {
      fn({ id, x: Position.x[eid]!, z: Position.z[eid]!, yaw: Position.yaw[eid]! });
    }
  }

  /** Hace aparecer un centollo con el id de red `id` cerca de `at`. `false` si no hay sitio. */
  spawn(id: number, at: Point, kind: CrabKind = EntityKind.Crab): boolean {
    this.revision++;
    const p = this.nav.closestPoint(at, SPAWN_SEARCH);
    if (!p) return false;
    const agent = this.crowd.addAgent({ x: p.x, y: 0, z: p.z }, AGENT_PARAMS[kind]);
    if (agent.agentIndex < 0) return false;

    const { NetId, Position, Health, Agent, Enemy, Crab } = this.world.components;
    const eid = addEntity(this.world);
    for (const c of [NetId, Position, Health, Agent, Enemy, Crab]) addComponent(this.world, eid, c);
    NetId.id[eid] = id;
    Position.x[eid] = p.x;
    Position.z[eid] = p.z;
    Position.yaw[eid] = Math.atan2(this.colony.x - p.x, this.colony.z - p.z);
    Health.hp[eid] = HEALTH[kind];
    Agent.index[eid] = agent.agentIndex;
    Enemy.kind[eid] = kind;
    Crab.mode[eid] = CrabMode.Advance;
    Crab.target[eid] = NO_TARGET;
    Crab.nextAttackTick[eid] = 0;
    Crab.goalX[eid] = Number.NaN;
    Crab.goalZ[eid] = Number.NaN;

    this.eids.set(id, eid);
    this.agents.set(eid, agent);
    return true;
  }

  /** Aplica daño a un centollo o a un colono. Devuelve `true` si muere (y lo quita). */
  damage(id: number, amount: number): boolean {
    const eid = this.eids.get(id) ?? this.colonists.get(id);
    if (eid === undefined) return false;
    this.revision++;
    const { Health } = this.world.components;
    Health.hp[eid] = Health.hp[eid]! - amount;
    if (Health.hp[eid]! > 0) return false;
    this.remove(id);
    return true;
  }

  /** Quita todos los centollos, escupitajos y colonos (al reiniciar la partida). */
  clear(): void {
    this.revision++;
    for (const id of [...this.eids.keys(), ...this.colonists.keys()]) this.remove(id);
    for (const eid of this.spits.values()) removeEntity(this.world, eid);
    this.spits.clear();
  }

  /** Quita un centollo o un colono. */
  remove(id: number): void {
    const eid = this.eids.get(id) ?? this.colonists.get(id);
    if (eid === undefined) return;
    this.revision++;
    const agent = this.agents.get(eid);
    if (agent) this.crowd.removeAgent(agent);
    this.agents.delete(eid);
    this.eids.delete(id);
    this.colonists.delete(id);
    removeEntity(this.world, eid);
  }

  /**
   * Avanza un tick: escupitajos, IA, movimiento del crowd y separación con los soldados.
   * Devuelve el daño que hacen los centollos este tick (mordiscos y escupitajos).
   */
  step(tick: number, soldiers: readonly SoldierBody[]): DamageEvent[] {
    this.revision++;
    this.finishing.clear();
    this.syncSoldiers(soldiers);
    // Los escupitajos se mueven antes de lanzar los nuevos: un escupitajo recién lanzado
    // está en la boca del escupidor en el snapshot de este tick.
    const damage = this.moveSpits(soldiers);
    this.thinkColonists(tick);
    damage.push(...this.think(tick, soldiers));
    this.crowd.update(TICK_SECONDS);
    this.separateFromSoldiers(soldiers);
    this.readPositions(soldiers);
    return damage;
  }

  /** Los soldados entran en el crowd como obstáculos que se recolocan en cada tick. */
  private syncSoldiers(soldiers: readonly SoldierBody[]): void {
    const alive = new Set<number>();
    for (const s of soldiers) {
      alive.add(s.id);
      const at = { x: s.x, y: 0, z: s.z };
      const agent = this.soldierAgents.get(s.id);
      if (agent) agent.teleport(at);
      else this.soldierAgents.set(s.id, this.crowd.addAgent(at, SOLDIER_AGENT));
    }
    for (const [id, agent] of this.soldierAgents) {
      if (alive.has(id)) continue;
      this.crowd.removeAgent(agent);
      this.soldierAgents.delete(id);
    }
  }

  /**
   * Colonos (E6-2): con un centollo cerca entran en pánico y corren un rato. El camino a la
   * plataforma ya lo lleva el crowd. Al llegar salen del crowd y esperan quietos a la lanzadera:
   * así no cuestan nada mientras esperan (siguen siendo presa de los rasos).
   */
  private thinkColonists(tick: number): void {
    if (this.colonists.size === 0) return;
    const { Position, Colonist, Agent } = this.world.components;
    const panicSq = colonists.panic.range * colonists.panic.range;
    for (const eid of this.colonists.values()) {
      const agent = this.agents.get(eid);
      if (!agent) continue; // Ya ha llegado.
      const x = Position.x[eid]!;
      const z = Position.z[eid]!;
      const arrived =
        dist(x, z, { x: Colonist.goalX[eid]!, z: Colonist.goalZ[eid]! }) <= COLONIST_ARRIVED ||
        (dist(x, z, this.colony) <= this.colony.radius && speedOf(agent) < COLONIST_STALLED_SPEED);
      if (arrived) {
        this.crowd.removeAgent(agent);
        this.agents.delete(eid);
        removeComponent(this.world, eid, Agent);
        continue;
      }
      // Recorre los almacenes directamente: es el bucle más largo (colonos × centollos).
      for (const crabEid of this.eids.values()) {
        const dx = Position.x[crabEid]! - x;
        const dz = Position.z[crabEid]! - z;
        if (dx * dx + dz * dz > panicSq) continue;
        Colonist.panicUntil[eid] = tick + PANIC_TICKS;
        break;
      }
      const running = tick < Colonist.panicUntil[eid]! ? 1 : 0;
      if (running === Colonist.running[eid]) continue;
      Colonist.running[eid] = running;
      agent.maxSpeed = running ? colonists.panic.speed : colonists.speed;
    }
  }

  /** Colonos como presas de los rasos. */
  private colonistPrey(): Prey[] {
    const { Position } = this.world.components;
    const prey: Prey[] = [];
    for (const [id, eid] of this.colonists) {
      prey.push({ id, x: Position.x[eid]!, z: Position.z[eid]! });
    }
    return prey;
  }

  /** IA de cada centollo según su tipo. */
  private think(tick: number, soldiers: readonly SoldierBody[]): DamageEvent[] {
    const { Position, Crab, Enemy } = this.world.components;
    const byId = new Map(soldiers.map((s) => [s.id, s]));
    const prey = this.colonistPrey();
    const preyById = new Map(prey.map((p) => [p.id, p]));
    const entities = query(this.world, [Crab, Position]);

    // Cuántos rasos van ya a por cada soldado o colono (tope de atacantes cuerpo a cuerpo).
    const attackers = new Map<number, number>();
    for (const eid of entities) {
      const t = Crab.target[eid]!;
      if (Enemy.kind[eid] !== EntityKind.Crab || t === NO_TARGET) continue;
      if (byId.has(t) || preyById.has(t)) attackers.set(t, (attackers.get(t) ?? 0) + 1);
    }

    const damage: DamageEvent[] = [];
    for (const eid of entities) {
      if (Enemy.kind[eid] === EntityKind.Spitter) this.thinkSpitter(eid, tick, soldiers, byId);
      else if (!this.huntColonist(eid, tick, prey, preyById, soldiers, attackers, damage)) {
        this.thinkCrab(eid, tick, soldiers, byId, attackers, damage);
      }
    }
    return damage;
  }

  /**
   * Raso: los colonos van primero (spec §4.3, presa fácil). Sigue al que ya persigue mientras lo
   * tenga a la vista; si no, el más cercano con hueco. Si un soldado le tapa el paso (lo tiene al
   * alcance y al colono no), le muerde sin cambiar de presa: una línea de soldados frena de
   * verdad. Devuelve `false` si no hay ningún colono a su alcance (entonces, a por soldados).
   */
  private huntColonist(
    eid: number,
    tick: number,
    prey: readonly Prey[],
    preyById: ReadonlyMap<number, Prey>,
    soldiers: readonly SoldierBody[],
    attackers: Map<number, number>,
    damage: DamageEvent[],
  ): boolean {
    if (prey.length === 0) return false;
    const { NetId, Position, Crab } = this.world.components;
    const x = Position.x[eid]!;
    const z = Position.z[eid]!;
    const current = preyById.get(Crab.target[eid]!);
    let target = current && dist(x, z, current) <= crab.aggroRange ? current : undefined;
    target ??= nearestOf(x, z, prey, crab.aggroRange, (p) => {
      return (attackers.get(p.id) ?? 0) < crab.maxMeleeAttackers;
    });
    if (!target) return false;

    const old = Crab.target[eid]!;
    if (old !== target.id) {
      if (attackers.has(old)) attackers.set(old, attackers.get(old)! - 1);
      attackers.set(target.id, (attackers.get(target.id) ?? 0) + 1);
      Crab.target[eid] = target.id;
      Crab.nextAttackTick[eid] = Math.max(Crab.nextAttackTick[eid]!, tick);
    }
    Crab.mode[eid] = CrabMode.Chase;
    this.moveTo(eid, target);
    if (tick < Crab.nextAttackTick[eid]!) return true;

    const bitten =
      dist(x, z, target) <= crab.bite.range
        ? target
        : nearestOf(x, z, soldiers, crab.bite.range, (s) => !s.downed);
    if (bitten) {
      damage.push({
        k: "damage",
        src: NetId.id[eid]!,
        dst: bitten.id,
        amount: crab.bite.damage,
        by: "bite",
      });
      Crab.nextAttackTick[eid] = tick + BITE_TICKS;
    }
    return true;
  }

  /** Raso: avanzar → seleccionar objetivo (con hueco) → perseguir → morder. */
  private thinkCrab(
    eid: number,
    tick: number,
    soldiers: readonly SoldierBody[],
    byId: ReadonlyMap<number, SoldierBody>,
    attackers: Map<number, number>,
    damage: DamageEvent[],
  ): void {
    const { NetId, Position, Crab } = this.world.components;
    const x = Position.x[eid]!;
    const z = Position.z[eid]!;

    // El raso también va a por los derribados: presa fácil (E5-3). Si le están rescatando, va a
    // por el rescatador, que está quieto y expuesto (E5-2).
    let target = this.redirectToRescuer(this.validTarget(eid, byId, crab.aggroRange, true), byId);
    if (target && target.id !== Crab.target[eid]) {
      const old = Crab.target[eid]!;
      if (attackers.has(old)) attackers.set(old, attackers.get(old)! - 1);
      attackers.set(target.id, (attackers.get(target.id) ?? 0) + 1);
      Crab.target[eid] = target.id;
    }
    if (!target && Crab.target[eid] !== NO_TARGET) {
      const lost = Crab.target[eid]!;
      if (attackers.has(lost)) attackers.set(lost, attackers.get(lost)! - 1);
      Crab.target[eid] = NO_TARGET;
    }

    if (!target) {
      // Prioridad: colonos (H5); después, el soldado más cercano que tenga hueco.
      target = this.redirectToRescuer(
        nearestOf(x, z, soldiers, crab.aggroRange, (s) => {
          return (attackers.get(s.id) ?? 0) < crab.maxMeleeAttackers;
        }),
        byId,
      );
      if (target) {
        Crab.target[eid] = target.id;
        attackers.set(target.id, (attackers.get(target.id) ?? 0) + 1);
        // El primer mordisco, en cuanto llegue.
        Crab.nextAttackTick[eid] = Math.max(Crab.nextAttackTick[eid]!, tick);
      }
    }

    if (!target) {
      Crab.mode[eid] = CrabMode.Advance;
      this.moveTo(eid, this.colony);
      return;
    }
    Crab.mode[eid] = CrabMode.Chase;
    this.moveTo(eid, target);
    if (target.downed) {
      // Pegado a un derribado: lo remata (el tiempo lo cuenta el mundo).
      if (dist(x, z, target) <= crab.bite.range && !this.finishing.has(target.id)) {
        this.finishing.set(target.id, NetId.id[eid]!);
      }
      return;
    }
    if (dist(x, z, target) <= crab.bite.range && tick >= Crab.nextAttackTick[eid]!) {
      damage.push({
        k: "damage",
        src: NetId.id[eid]!,
        dst: target.id,
        amount: crab.bite.damage,
        by: "bite",
      });
      Crab.nextAttackTick[eid] = tick + BITE_TICKS;
    }
  }

  /**
   * Escupidor: avanzar → seleccionar objetivo (siempre soldados, sin tope) → acercarse hasta su
   * distancia preferida con línea de visión → pararse y escupir.
   */
  private thinkSpitter(
    eid: number,
    tick: number,
    soldiers: readonly SoldierBody[],
    byId: ReadonlyMap<number, SoldierBody>,
  ): void {
    const { NetId, Position, Crab } = this.world.components;
    const here = { x: Position.x[eid]!, z: Position.z[eid]! };

    let target = this.validTarget(eid, byId, spitter.aggroRange);
    if (!target) {
      target = nearestOf(here.x, here.z, soldiers, spitter.aggroRange, (s) => !s.downed);
      Crab.target[eid] = target?.id ?? NO_TARGET;
      if (target) Crab.nextAttackTick[eid] = Math.max(Crab.nextAttackTick[eid]!, tick);
    }

    if (!target) {
      Crab.mode[eid] = CrabMode.Advance;
      this.moveTo(eid, this.colony);
      return;
    }

    const d = dist(here.x, here.z, target);
    const sees = hasLineOfSight(here, target, this.map);
    if (Crab.mode[eid] === CrabMode.Hold && (d > spitter.spit.range || !sees)) {
      Crab.mode[eid] = CrabMode.Chase;
    } else if (Crab.mode[eid] !== CrabMode.Hold && d <= spitter.preferredRange && sees) {
      Crab.mode[eid] = CrabMode.Hold;
      this.stop(eid);
    }

    if (Crab.mode[eid] !== CrabMode.Hold) {
      Crab.mode[eid] = CrabMode.Chase;
      this.moveTo(eid, target);
      return;
    }
    if (tick < Crab.nextAttackTick[eid]!) return;
    this.launchSpit(NetId.id[eid]!, here, target);
    Crab.nextAttackTick[eid] = tick + SPIT_TICKS;
  }

  /** Un derribado al que están rescatando se cambia por su rescatador (E5-2). */
  private redirectToRescuer(
    target: SoldierBody | undefined,
    byId: ReadonlyMap<number, SoldierBody>,
  ): SoldierBody | undefined {
    if (target?.downed && target.rescuer !== undefined) return byId.get(target.rescuer) ?? target;
    return target;
  }

  /**
   * El objetivo actual, si sigue existiendo y a la vista (a `range` metros como mucho). Los
   * derribados solo valen si `allowDowned` (el raso remata; el escupidor no).
   */
  private validTarget(
    eid: number,
    byId: ReadonlyMap<number, SoldierBody>,
    range: number,
    allowDowned = false,
  ): SoldierBody | undefined {
    const { Position, Crab } = this.world.components;
    const target = byId.get(Crab.target[eid]!);
    if (!target || (target.downed && !allowDowned)) return undefined;
    return dist(Position.x[eid]!, Position.z[eid]!, target) <= range ? target : undefined;
  }

  /** Lanza un escupitajo hacia donde está ahora el objetivo (sin adelantarse: se esquiva). */
  private launchSpit(src: number, from: Point, at: Point): void {
    const len = Math.hypot(at.x - from.x, at.z - from.z) || 1;
    const dx = (at.x - from.x) / len;
    const dz = (at.z - from.z) / len;
    const { NetId, Position, Spit } = this.world.components;
    const id = this.nextId();
    const eid = addEntity(this.world);
    for (const c of [NetId, Position, Spit]) addComponent(this.world, eid, c);
    NetId.id[eid] = id;
    // Sale del borde del escupidor, no de su centro.
    Position.x[eid] = from.x + dx * spitter.radius;
    Position.z[eid] = from.z + dz * spitter.radius;
    Position.yaw[eid] = Math.atan2(dx, dz);
    Spit.dx[eid] = dx;
    Spit.dz[eid] = dz;
    Spit.travelled[eid] = 0;
    Spit.src[eid] = src;
    this.spits.set(id, eid);
  }

  /**
   * Escupitajos en vuelo: avanzan en línea recta. El tramo de cada tick se mira contra los
   * soldados (el primero que toca recibe el daño) y contra los obstáculos; se pierden al agotar
   * su alcance. Atraviesan a los centollos.
   */
  private moveSpits(soldiers: readonly SoldierBody[]): DamageEvent[] {
    const { Position, Spit } = this.world.components;
    const damage: DamageEvent[] = [];
    for (const [id, eid] of this.spits) {
      const from = { x: Position.x[eid]!, z: Position.z[eid]! };
      const step = Math.min(SPIT_STEP, spitter.spit.range - Spit.travelled[eid]!);
      const to = { x: from.x + Spit.dx[eid]! * step, z: from.z + Spit.dz[eid]! * step };

      let hit: SoldierBody | undefined;
      let hitAt = Number.POSITIVE_INFINITY;
      for (const s of soldiers) {
        if (s.downed) continue; // Tumbado: le pasa por encima.
        const t = segmentCircleHit(from, to, s, SPIT_HIT);
        if (t !== null && t < hitAt) {
          hit = s;
          hitAt = t;
        }
      }
      // Lo que tapa un obstáculo antes de llegar al soldado no cuenta.
      const reach = hit
        ? { x: from.x + (to.x - from.x) * hitAt, z: from.z + (to.z - from.z) * hitAt }
        : to;
      const blocked = this.map.obstacles.some((box) => segmentCrossesBox(from, reach, box));

      if (hit && !blocked) {
        damage.push({
          k: "damage",
          src: Spit.src[eid]!,
          dst: hit.id,
          amount: spitter.spit.damage,
          by: "spit",
        });
      }
      Spit.travelled[eid] = Spit.travelled[eid]! + step;
      if (hit || blocked || Spit.travelled[eid]! >= spitter.spit.range) {
        this.spits.delete(id);
        removeEntity(this.world, eid);
        continue;
      }
      Position.x[eid] = to.x;
      Position.z[eid] = to.z;
    }
    return damage;
  }

  /** Pide camino al crowd si el destino ha cambiado lo bastante. */
  private moveTo(eid: number, goal: Point): void {
    const { Crab } = this.world.components;
    const gx = Crab.goalX[eid]!;
    const gz = Crab.goalZ[eid]!;
    if (!Number.isNaN(gx) && Math.hypot(goal.x - gx, goal.z - gz) < REPLAN_DISTANCE) return;
    this.agents.get(eid)?.requestMoveTarget({ x: goal.x, y: 0, z: goal.z });
    Crab.goalX[eid] = goal.x;
    Crab.goalZ[eid] = goal.z;
  }

  /** Para al centollo donde está (el siguiente `moveTo` vuelve a pedir camino). */
  private stop(eid: number): void {
    const { Crab } = this.world.components;
    this.agents.get(eid)?.requestMoveVelocity({ x: 0, y: 0, z: 0 });
    Crab.goalX[eid] = Number.NaN;
    Crab.goalZ[eid] = Number.NaN;
  }

  /**
   * DetourCrowd separa a los agentes a medias (empuja a los dos), y el soldado vuelve a su
   * sitio en cada tick: sin esto, los centollos se le meten dentro. Se empujan fuera.
   */
  private separateFromSoldiers(soldiers: readonly SoldierBody[]): void {
    if (soldiers.length === 0) return;
    const { Enemy } = this.world.components;
    // Solo los centollos: a los colonos los atraviesan los soldados (no frenan la predicción).
    for (const eid of this.eids.values()) {
      const agent = this.agents.get(eid);
      if (!agent) continue;
      const contact = RADIUS[Enemy.kind[eid] as CrabKind] + soldier.radius;
      const p = agent.position();
      let { x, z } = p;
      for (const s of soldiers) {
        const dx = x - s.x;
        const dz = z - s.z;
        const d = Math.hypot(dx, dz);
        if (d >= contact) continue;
        // Encima del todo: se le saca hacia cualquier lado.
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        x = s.x + nx * contact;
        z = s.z + nz * contact;
      }
      if (x === p.x && z === p.z) continue;
      agent.raw.set_npos(0, x);
      agent.raw.set_npos(2, z);
    }
  }

  /** Copia al ECS la posición del crowd y orienta a cada centollo. */
  private readPositions(soldiers: readonly SoldierBody[]): void {
    const { Position, Agent, Crab } = this.world.components;
    const byId = new Map(soldiers.map((s) => [s.id, s]));
    for (const eid of query(this.world, [Agent, Position])) {
      const agent = this.agents.get(eid);
      if (!agent) continue;
      const p = agent.position();
      const v = agent.velocity();
      Position.x[eid] = p.x;
      Position.z[eid] = p.z;
      // Mira hacia donde va; parado, a su objetivo.
      if (Math.hypot(v.x, v.z) >= FACE_MOVE_MIN_SPEED) {
        Position.yaw[eid] = Math.atan2(v.x, v.z);
      } else {
        const target = byId.get(Crab.target[eid]!);
        if (target) Position.yaw[eid] = Math.atan2(target.x - p.x, target.z - p.z);
      }
    }
  }

  destroy(): void {
    this.crowd.destroy();
  }
}

// `Math.sqrt` y no `Math.hypot`, que en V8 es bastante más lento (y aquí se llama mucho).
const dist = (x: number, z: number, p: Point) => {
  const dx = p.x - x;
  const dz = p.z - z;
  return Math.sqrt(dx * dx + dz * dz);
};

/** Velocidad de un agente del crowd, en m/s. */
function speedOf(agent: CrowdAgent): number {
  const v = agent.velocity();
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

/** El más cercano (soldado o colono) a `range` metros como mucho que cumple `ok`. */
function nearestOf<T extends Point>(
  x: number,
  z: number,
  candidates: readonly T[],
  range: number,
  ok: (c: T) => boolean,
): T | undefined {
  let best: T | undefined;
  let bestSq = range * range;
  for (const s of candidates) {
    const dx = s.x - x;
    const dz = s.z - z;
    const sq = dx * dx + dz * dz;
    if (sq > bestSq || !ok(s)) continue;
    best = s;
    bestSq = sq;
  }
  return best;
}

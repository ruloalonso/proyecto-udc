import { addComponent, addEntity, query, removeEntity } from "bitecs";
import { Crowd, type CrowdAgent } from "recast-navigation";
import { GAME_CONFIG, TICK_SECONDS, type MapData, type Point } from "@udc/shared";
import { CrabMode, createEcsWorld, NO_TARGET, type EcsWorld } from "../ecs/components.js";
import type { NavMap } from "./navmesh.js";

const { crab, soldier } = GAME_CONFIG;
const BITE_TICKS = Math.round(crab.bite.interval / TICK_SECONDS);
/** Distancia mínima entre los centros de un centollo y un soldado (se tocan). */
const CONTACT = crab.radius + soldier.radius;

/** Capacidad del crowd: 150 centollos y 8 soldados, con margen para colonos (H5). */
const MAX_AGENTS = 512;
/** Metros que tiene que moverse el objetivo para volver a pedir camino al crowd. */
const REPLAN_DISTANCE = 0.5;
/** Por debajo de esta velocidad (m/s), el centollo mira a su objetivo y no hacia donde va. */
const FACE_MOVE_MIN_SPEED = 0.5;
/** Distancia a la que se busca la navmesh al hacer aparecer un centollo. */
const SPAWN_SEARCH = 4;

/** Parámetros de Detour de un centollo. Los rangos siguen las proporciones de su demo. */
const CRAB_AGENT = {
  radius: crab.radius,
  height: crab.height,
  maxSpeed: crab.speed,
  maxAcceleration: crab.acceleration,
  collisionQueryRange: crab.radius * 12,
  pathOptimizationRange: crab.radius * 30,
  separationWeight: 2,
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
}

/** Un centollo muerde a un soldado. */
export interface Bite {
  crab: number;
  soldier: number;
}

/** Vista de solo lectura de un centollo, para el combate y los snapshots. */
export interface CrabView {
  id: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
}

/**
 * Centollos rasos (E4-2): estado en bitECS, movimiento con DetourCrowd sobre la navmesh e IA
 * de §4.3: avanzar hacia la colonia → seleccionar objetivo → perseguir → morder.
 * Solo los simula el servidor.
 */
export class CrabSwarm {
  private readonly world: EcsWorld = createEcsWorld();
  private readonly crowd: Crowd;
  /** Id de red → id de bitECS. */
  private readonly eids = new Map<number, number>();
  private readonly agents = new Map<number, CrowdAgent>();
  private readonly soldierAgents = new Map<number, CrowdAgent>();
  private readonly colony: Point;

  constructor(
    private readonly nav: NavMap,
    map: MapData,
  ) {
    this.crowd = new Crowd(nav.navMesh, {
      maxAgents: MAX_AGENTS,
      maxAgentRadius: Math.max(crab.radius, soldier.radius),
    });
    this.colony = map.landingPad;
  }

  get count(): number {
    return this.eids.size;
  }

  has(id: number): boolean {
    return this.eids.has(id);
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
    const { Position, Health } = this.world.components;
    for (const [id, eid] of this.eids) {
      fn({
        id,
        x: Position.x[eid]!,
        z: Position.z[eid]!,
        yaw: Position.yaw[eid]!,
        hp: Health.hp[eid]!,
      });
    }
  }

  /** Hace aparecer un centollo con el id de red `id` cerca de `at`. `false` si no hay sitio. */
  spawn(id: number, at: Point): boolean {
    const p = this.nav.closestPoint(at, SPAWN_SEARCH);
    if (!p) return false;
    const agent = this.crowd.addAgent({ x: p.x, y: 0, z: p.z }, CRAB_AGENT);
    if (agent.agentIndex < 0) return false;

    const { NetId, Position, Health, Agent, Crab } = this.world.components;
    const eid = addEntity(this.world);
    addComponent(this.world, eid, NetId);
    addComponent(this.world, eid, Position);
    addComponent(this.world, eid, Health);
    addComponent(this.world, eid, Agent);
    addComponent(this.world, eid, Crab);
    NetId.id[eid] = id;
    Position.x[eid] = p.x;
    Position.z[eid] = p.z;
    Position.yaw[eid] = Math.atan2(this.colony.x - p.x, this.colony.z - p.z);
    Health.hp[eid] = crab.health;
    Agent.index[eid] = agent.agentIndex;
    Crab.mode[eid] = CrabMode.Advance;
    Crab.target[eid] = NO_TARGET;
    Crab.nextBiteTick[eid] = 0;
    Crab.goalX[eid] = Number.NaN;
    Crab.goalZ[eid] = Number.NaN;

    this.eids.set(id, eid);
    this.agents.set(eid, agent);
    return true;
  }

  /** Aplica daño. Devuelve `true` si el centollo muere (y lo quita). */
  damage(id: number, amount: number): boolean {
    const eid = this.eids.get(id);
    if (eid === undefined) return false;
    const { Health } = this.world.components;
    Health.hp[eid] = Health.hp[eid]! - amount;
    if (Health.hp[eid]! > 0) return false;
    this.remove(id);
    return true;
  }

  remove(id: number): void {
    const eid = this.eids.get(id);
    if (eid === undefined) return;
    const agent = this.agents.get(eid);
    if (agent) this.crowd.removeAgent(agent);
    this.agents.delete(eid);
    this.eids.delete(id);
    removeEntity(this.world, eid);
  }

  /**
   * Avanza un tick: IA, movimiento del crowd y separación con los soldados.
   * Devuelve los mordiscos de este tick.
   */
  step(tick: number, soldiers: readonly SoldierBody[]): Bite[] {
    this.syncSoldiers(soldiers);
    const bites = this.think(tick, soldiers);
    this.crowd.update(TICK_SECONDS);
    this.separateFromSoldiers(soldiers);
    this.readPositions(soldiers);
    return bites;
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

  /** IA de cada centollo: elige objetivo, pide camino y muerde si está a su alcance. */
  private think(tick: number, soldiers: readonly SoldierBody[]): Bite[] {
    const { NetId, Position, Crab } = this.world.components;
    const byId = new Map(soldiers.map((s) => [s.id, s]));
    const entities = query(this.world, [Crab, Position]);

    // Cuántos centollos van ya a por cada soldado (tope de atacantes cuerpo a cuerpo).
    const attackers = new Map<number, number>();
    for (const eid of entities) {
      const t = Crab.target[eid]!;
      if (t !== NO_TARGET && byId.has(t)) attackers.set(t, (attackers.get(t) ?? 0) + 1);
    }

    const bites: Bite[] = [];
    for (const eid of entities) {
      const x = Position.x[eid]!;
      const z = Position.z[eid]!;

      // ¿Sigue valiendo el objetivo? (Existe y sigue a la vista.)
      let target = byId.get(Crab.target[eid]!);
      if (Crab.target[eid] !== NO_TARGET && (!target || dist(x, z, target) > crab.aggroRange)) {
        if (target) attackers.set(target.id, attackers.get(target.id)! - 1);
        target = undefined;
        Crab.target[eid] = NO_TARGET;
      }

      if (!target) {
        // Prioridad: colonos (H5); después, el soldado más cercano que tenga hueco.
        target = nearestWithRoom(x, z, soldiers, attackers);
        if (target) {
          Crab.target[eid] = target.id;
          attackers.set(target.id, (attackers.get(target.id) ?? 0) + 1);
          // El primer mordisco, en cuanto llegue.
          Crab.nextBiteTick[eid] = Math.max(Crab.nextBiteTick[eid]!, tick);
        }
      }

      if (target) {
        Crab.mode[eid] = CrabMode.Chase;
        this.moveTo(eid, target);
        if (dist(x, z, target) <= crab.bite.range && tick >= Crab.nextBiteTick[eid]!) {
          bites.push({ crab: NetId.id[eid]!, soldier: target.id });
          Crab.nextBiteTick[eid] = tick + BITE_TICKS;
        }
      } else {
        Crab.mode[eid] = CrabMode.Advance;
        this.moveTo(eid, this.colony);
      }
    }
    return bites;
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

  /**
   * DetourCrowd separa a los agentes a medias (empuja a los dos), y el soldado vuelve a su
   * sitio en cada tick: sin esto, los centollos se le meten dentro. Se empujan fuera.
   */
  private separateFromSoldiers(soldiers: readonly SoldierBody[]): void {
    if (soldiers.length === 0) return;
    for (const agent of this.agents.values()) {
      const p = agent.position();
      let { x, z } = p;
      for (const s of soldiers) {
        const dx = x - s.x;
        const dz = z - s.z;
        const d = Math.hypot(dx, dz);
        if (d >= CONTACT) continue;
        // Encima del todo: se le saca hacia cualquier lado.
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        x = s.x + nx * CONTACT;
        z = s.z + nz * CONTACT;
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

const dist = (x: number, z: number, p: Point) => Math.hypot(p.x - x, p.z - z);

/** El soldado más cercano a la vista que aún no tiene el tope de atacantes. */
function nearestWithRoom(
  x: number,
  z: number,
  soldiers: readonly SoldierBody[],
  attackers: ReadonlyMap<number, number>,
): SoldierBody | undefined {
  let best: SoldierBody | undefined;
  let bestDist: number = crab.aggroRange;
  for (const s of soldiers) {
    if ((attackers.get(s.id) ?? 0) >= crab.maxMeleeAttackers) continue;
    const d = dist(x, z, s);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

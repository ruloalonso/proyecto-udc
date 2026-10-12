import { GAME_CONFIG } from "../config/game.config.js";
import type { Point } from "../map/index.js";

const { bot, soldier } = GAME_CONFIG;

/** Un soldado del pelotón, tal como lo ve el coordinador. */
export interface SquadMember {
  id: number;
  x: number;
  z: number;
  /** Bot del servidor: recibe órdenes. Los jugadores no, pero se les rescata igual. */
  bot: boolean;
  /** Derribado: segundos que le quedan; `null` si está en pie. */
  downedLeft: number | null;
  /** Derribado: quién le está rescatando, o `null`. */
  rescuedBy: number | null;
}

/** La fila de colonos que hay que escoltar. */
export interface EscortRoute {
  /** Edificio que se evacua: con otro, los puestos se reparten de nuevo. */
  building: number;
  /** Camino de la puerta a la plataforma (puntos de giro). */
  path: readonly Point[];
  /** Madrigueras que amenazan la ruta: los puestos miran hacia ellas. */
  threats: readonly Point[];
}

export interface SquadSituation {
  members: readonly SquadMember[];
  /** La fila que se escolta, mientras queden colonos de su edificio dentro o caminando. */
  escort: EscortRoute | null;
  /** Donde no se rescata: la explosión de una nave a punto de caer. */
  danger: { x: number; z: number; radius: number } | null;
}

/** Lo que el coordinador necesita de la navmesh. */
export interface SquadNav {
  /** Metros del camino de `from` a `to`, o `null` si no se puede llegar. */
  pathLength(from: Point, to: Point): number | null;
  /** El punto caminable más cercano a `p` (un puesto no puede caer dentro de un edificio). */
  snap(p: Point): Point;
}

/** La orden de un bot: rescatar a un derribado, escoltar la fila desde un puesto o defender. */
export type BotOrder =
  | { kind: "rescue"; target: number; at: Point; urgent: boolean }
  | { kind: "escort"; post: Point; facing: number }
  | { kind: "guard" };

export const GUARD: BotOrder = { kind: "guard" };

/** Un puesto de escolta y el bot que lo ocupa. */
interface Post {
  at: Point;
  facing: number;
  holder: number | null;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Coordinador del pelotón (E5-7, spec §4.7): reparte órdenes a los bots del servidor para que
 * rescaten a los derribados, escolten la fila de colonos y defiendan la plataforma. Lógica pura:
 * el servidor le cuenta la situación cada `bot.ordersInterval` y cada bot cumple su orden con su
 * cerebro (`BotBrain`), con la misma entrada que un jugador.
 *
 * - **Rescate:** margen = lo que le queda al derribado − (camino / velocidad + rescate). Primero
 *   el de menor margen positivo (el más apurado que aún se puede salvar), con el bot que llega
 *   antes; con margen negativo no va nadie. Un bot por derribado, sea jugador o bot.
 * - **Escolta:** con una fila en marcha, `bot.escortShare` de los bots en pie la escolta en grupo,
 *   a ambos lados de la ruta y mirando hacia las madrigueras que la amenazan.
 * - **Defensa:** el resto, a la plataforma.
 *
 * Las órdenes son estables: solo cambian si hay motivo (un derribado nuevo o rescatado, otro
 * edificio, un bot que cae), para que no cambien de puesto a cada momento.
 */
export class SquadCoordinator {
  private orders = new Map<number, BotOrder>();
  private building: number | null = null;
  private posts: Post[] = [];

  constructor(private readonly nav: SquadNav) {}

  /** Órdenes para este momento: una por bot en pie. Los derribados y los jugadores, ninguna. */
  update(s: SquadSituation): ReadonlyMap<number, BotOrder> {
    const byId = new Map(s.members.map((m) => [m.id, m]));
    const standing = s.members.filter((m) => m.bot && m.downedLeft === null);
    const rescues = this.assignRescues(s, standing, byId);
    const available = standing.filter((b) => !rescues.has(b.id));
    this.assignPosts(s, standing.length, available);

    const orders = new Map<number, BotOrder>();
    for (const b of standing) {
      const target = rescues.get(b.id);
      const post = this.posts.find((p) => p.holder === b.id);
      if (target) {
        // Sin margen que perder (o ya rescatando): va aunque haya peligro.
        const margin = target.rescuedBy === b.id ? 0 : (this.margin(b, target) ?? 0);
        const urgent = margin < bot.reviveUrgentMargin;
        orders.set(b.id, {
          kind: "rescue",
          target: target.id,
          at: { x: target.x, z: target.z },
          urgent,
        });
      } else if (post) {
        orders.set(b.id, { kind: "escort", post: post.at, facing: post.facing });
      } else {
        orders.set(b.id, GUARD);
      }
    }
    this.orders = orders;
    return orders;
  }

  /** Bot → derribado al que va a rescatar. */
  private assignRescues(
    s: SquadSituation,
    standing: readonly SquadMember[],
    byId: ReadonlyMap<number, SquadMember>,
  ): Map<number, SquadMember> {
    const rescues = new Map<number, SquadMember>();
    // Se mantienen los rescates que siguen teniendo sentido.
    for (const b of standing) {
      const order = this.orders.get(b.id);
      if (order?.kind !== "rescue") continue;
      const target = byId.get(order.target);
      if (!target || target.downedLeft === null) continue;
      if (target.rescuedBy === b.id) {
        rescues.set(b.id, target);
        continue;
      }
      if (target.rescuedBy !== null || this.inDanger(target, s)) continue;
      if (this.margin(b, target) === null) continue;
      rescues.set(b.id, target);
    }

    // Derribados sin nadie: el de menor margen positivo, con el bot que llega antes.
    const taken = new Set([...rescues.values()].map((t) => t.id));
    const pending = s.members.filter(
      (m) =>
        m.downedLeft !== null && m.rescuedBy === null && !taken.has(m.id) && !this.inDanger(m, s),
    );
    let options: { bot: SquadMember; target: SquadMember; margin: number }[] = [];
    for (const target of pending) {
      for (const b of standing) {
        if (rescues.has(b.id)) continue;
        const margin = this.margin(b, target);
        if (margin !== null) options.push({ bot: b, target, margin });
      }
    }
    while (options.length > 0) {
      // Para cada derribado, el bot que llega antes (el de mayor margen)…
      const best = new Map<number, (typeof options)[number]>();
      for (const o of options) {
        const current = best.get(o.target.id);
        if (!current || o.margin > current.margin) best.set(o.target.id, o);
      }
      // …y de todos ellos, el derribado más apurado.
      let pick: (typeof options)[number] | undefined;
      for (const o of best.values()) if (!pick || o.margin < pick.margin) pick = o;
      rescues.set(pick!.bot.id, pick!.target);
      options = options.filter((o) => o.bot !== pick!.bot && o.target !== pick!.target);
    }
    return rescues;
  }

  /** Lo que sobra si `b` va a rescatar a `target`, o `null` si no llega a tiempo. */
  private margin(b: SquadMember, target: SquadMember): number | null {
    const left = target.downedLeft;
    if (left === null) return null;
    const straight = dist(b, target);
    // El camino nunca es más corto que la línea recta: se descarta sin preguntar a la navmesh.
    if (straight > bot.reviveRange) return null;
    if (left - (straight / soldier.speed + soldier.rescue.seconds) < 0) return null;
    const length = this.nav.pathLength(b, target);
    if (length === null || length > bot.reviveRange) return null;
    const margin = left - (length / soldier.speed + soldier.rescue.seconds);
    return margin >= 0 ? margin : null;
  }

  private inDanger(m: Point, s: SquadSituation): boolean {
    return s.danger !== null && dist(m, s.danger) <= s.danger.radius;
  }

  /** Puestos de escolta: se reparten de nuevo con otro edificio o con otro número de puestos. */
  private assignPosts(
    s: SquadSituation,
    standingCount: number,
    available: readonly SquadMember[],
  ): void {
    const count = s.escort ? Math.round(standingCount * bot.escortShare) : 0;
    if (!s.escort || count === 0) {
      this.building = null;
      this.posts = [];
      return;
    }
    const previous = new Set(this.posts.map((p) => p.holder).filter((h) => h !== null));
    if (s.escort.building !== this.building || this.posts.length !== count) {
      this.building = s.escort.building;
      this.posts = this.layout(s.escort, count);
    }
    // Quien ya no está disponible (rescata, ha caído) deja su puesto.
    const free = new Map(available.map((b) => [b.id, b]));
    for (const p of this.posts) if (p.holder !== null && !free.has(p.holder)) p.holder = null;
    for (const p of this.posts) if (p.holder !== null) free.delete(p.holder);
    // Los vacíos, con el más cercano; antes, los que ya escoltaban.
    for (const p of this.posts) {
      if (p.holder !== null) continue;
      let pick: SquadMember | undefined;
      for (const b of free.values()) {
        if (!pick) {
          pick = b;
          continue;
        }
        const better =
          previous.has(b.id) !== previous.has(pick.id)
            ? previous.has(b.id)
            : dist(b, p.at) < dist(pick, p.at);
        if (better) pick = b;
      }
      if (!pick) break;
      p.holder = pick.id;
      free.delete(pick.id);
    }
  }

  /**
   * `count` puestos en grupo alrededor del punto `escortAt` de la ruta: a lo largo de ella cada
   * `escortSpacing` m y a un lado y a otro, a `escortOffset` m.
   */
  private layout(route: EscortRoute, count: number): Post[] {
    const { path, threats } = route;
    const lengths: number[] = [0];
    for (let i = 1; i < path.length; i++) {
      lengths.push(lengths[i - 1]! + dist(path[i - 1]!, path[i]!));
    }
    const total = lengths[lengths.length - 1] ?? 0;
    const posts: Post[] = [];
    for (let i = 0; i < count; i++) {
      const offset = (Math.floor(i / 2) - (Math.ceil(count / 2) - 1) / 2) * bot.escortSpacing;
      const along = Math.min(total, Math.max(0, total * bot.escortAt + offset));
      // El tramo en el que cae y su dirección.
      let k = 1;
      while (k < path.length - 1 && lengths[k]! < along) k++;
      const a = path[k - 1] ?? path[0]!;
      const b = path[k] ?? a;
      const segment = dist(a, b) || 1;
      const t = Math.min(1, Math.max(0, (along - lengths[k - 1]!) / segment));
      const onRoute = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      const side = i % 2 === 0 ? 1 : -1;
      const nx = (-(b.z - a.z) / segment) * side;
      const nz = ((b.x - a.x) / segment) * side;
      const at = this.nav.snap({
        x: onRoute.x + nx * bot.escortOffset,
        z: onRoute.z + nz * bot.escortOffset,
      });
      // Mira a la madriguera más cercana que amenaza la ruta; sin ninguna, hacia fuera.
      let threat: Point | undefined;
      for (const th of threats) if (!threat || dist(at, th) < dist(at, threat)) threat = th;
      const facing = threat ? Math.atan2(threat.x - at.x, threat.z - at.z) : Math.atan2(nx, nz);
      posts.push({ at, facing, holder: null });
    }
    return posts;
  }
}

import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/game.config.js";
import {
  SquadCoordinator,
  type BotOrder,
  type SquadMember,
  type SquadNav,
  type SquadSituation,
} from "./squad.js";

const { bot } = GAME_CONFIG;
/** Navmesh de mentira: un campo abierto, el camino es la línea recta. */
const open: SquadNav = {
  pathLength: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
  snap: (p) => p,
};

const standing = (id: number, x: number, z: number, isBot = true): SquadMember => ({
  id,
  x,
  z,
  bot: isBot,
  downedLeft: null,
  rescuedBy: null,
});
const downed = (id: number, x: number, z: number, left: number, isBot = true): SquadMember => ({
  ...standing(id, x, z, isBot),
  downedLeft: left,
});
const situation = (members: SquadMember[], over: Partial<SquadSituation> = {}): SquadSituation => ({
  members,
  escort: null,
  danger: null,
  ...over,
});
const rescuerOf = (orders: ReadonlyMap<number, BotOrder>, target: number) =>
  [...orders].find(([, o]) => o.kind === "rescue" && o.target === target)?.[0];

describe("SquadCoordinator: rescate (E5-7)", () => {
  it("al derribado va el bot que llega antes; los demás, a defender", () => {
    const c = new SquadCoordinator(open);
    const orders = c.update(
      situation([standing(1, 30, 0), standing(2, 10, 0), downed(3, 0, 0, 20)]),
    );
    expect(rescuerOf(orders, 3)).toBe(2);
    expect(orders.get(1)).toEqual({ kind: "guard" });
    expect(orders.has(3)).toBe(false);
  });

  it("primero el más apurado que aún se puede salvar (menor margen positivo)", () => {
    const c = new SquadCoordinator(open);
    // A: 25 s a 20 m (margen 16). B: 15 s a 30 m (margen 4). Un solo bot: va a por B.
    const orders = c.update(
      situation([standing(1, 0, 0), downed(10, 20, 0, 25), downed(11, 0, -30, 15)]),
    );
    expect(rescuerOf(orders, 11)).toBe(1);
    expect(rescuerOf(orders, 10)).toBeUndefined();
  });

  it("con dos bots, cada uno al suyo, sin repetir", () => {
    const c = new SquadCoordinator(open);
    const orders = c.update(
      situation([
        standing(1, 0, 0),
        standing(2, 40, 0),
        downed(10, 5, 0, 20),
        downed(11, 45, 0, 20),
      ]),
    );
    expect(rescuerOf(orders, 10)).toBe(1);
    expect(rescuerOf(orders, 11)).toBe(2);
  });

  it("si no llega a tiempo, o está demasiado lejos, no va nadie", () => {
    const c = new SquadCoordinator(open);
    // 40 m a 5 m/s son 8 s, más 5 de rescate: con 10 s no da tiempo.
    expect(rescuerOf(c.update(situation([standing(1, 0, 0), downed(2, 40, 0, 10)])), 2)).toBe(
      undefined,
    );
    // Con tiempo de sobra, pero más allá del tope de distancia.
    const far = bot.reviveRange + 5;
    expect(rescuerOf(c.update(situation([standing(1, 0, 0), downed(2, far, 0, 30)])), 2)).toBe(
      undefined,
    );
  });

  it("se rescata igual a un jugador que a un bot; los jugadores no reciben órdenes", () => {
    const c = new SquadCoordinator(open);
    const orders = c.update(
      situation([standing(1, 0, 0), standing(2, 1, 0, false), downed(3, 5, 0, 20, false)]),
    );
    expect(rescuerOf(orders, 3)).toBe(1);
    expect(orders.has(2)).toBe(false);
  });

  it("no va a por quien ya rescata otro, ni dentro de la explosión de una nave a punto de caer", () => {
    const c = new SquadCoordinator(open);
    const busy = { ...downed(3, 5, 0, 20), rescuedBy: 99 };
    expect(rescuerOf(c.update(situation([standing(1, 0, 0), busy])), 3)).toBeUndefined();
    const orders = c.update(
      situation([standing(1, 0, 0), downed(3, 5, 0, 20)], {
        danger: { x: 8, z: 0, radius: 15 },
      }),
    );
    expect(rescuerOf(orders, 3)).toBeUndefined();
  });

  it("el rescate en curso se mantiene aunque ya no le diera tiempo a empezarlo", () => {
    const c = new SquadCoordinator(open);
    c.update(situation([standing(1, 0, 0), downed(3, 1, 0, 20)]));
    const orders = c.update(
      situation([standing(1, 0, 0), { ...downed(3, 1, 0, 2), rescuedBy: 1 }]),
    );
    expect(rescuerOf(orders, 3)).toBe(1);
  });

  it("órdenes estables: un derribado nuevo no le quita el suyo al que ya va", () => {
    const c = new SquadCoordinator(open);
    c.update(situation([standing(1, 0, 0), standing(2, 50, 0), downed(10, 20, 0, 25)]));
    // Aparece otro más cerca del bot 1: el bot 1 sigue con el 10 y al nuevo va el 2.
    const orders = c.update(
      situation([
        standing(1, 3, 0),
        standing(2, 50, 0),
        downed(10, 20, 0, 24),
        downed(11, 4, 0, 24),
      ]),
    );
    expect(rescuerOf(orders, 10)).toBe(1);
    expect(rescuerOf(orders, 11)).toBe(2);
  });

  it("es urgente cuando ya no hay margen que perder (lo que sobra tras llegar y rescatar)", () => {
    // A 2 m: 0,4 s de camino y 5 de rescate. Con poco margen, urgente; con mucho, no.
    const tight =
      2 / GAME_CONFIG.soldier.speed +
      GAME_CONFIG.soldier.rescue.seconds +
      bot.reviveUrgentMargin / 2;
    let orders = new SquadCoordinator(open).update(
      situation([standing(1, 0, 0), downed(2, 2, 0, tight)]),
    );
    expect(orders.get(1)).toMatchObject({ kind: "rescue", target: 2, urgent: true });
    orders = new SquadCoordinator(open).update(
      situation([standing(1, 0, 0), downed(2, 2, 0, tight + 10)]),
    );
    expect(orders.get(1)).toMatchObject({ kind: "rescue", target: 2, urgent: false });
  });
});

describe("SquadCoordinator: escolta (E5-7)", () => {
  // Ruta recta de la puerta (0, -100) a la plataforma (0, 0), amenazada desde el este.
  const escort = {
    building: 0,
    path: [
      { x: 0, z: -100 },
      { x: 0, z: 0 },
    ],
    threats: [{ x: 90, z: -60 }],
  };
  const squad = () => Array.from({ length: 8 }, (_, i) => standing(i + 1, i * 3, 10));

  it("la mitad de los bots en pie escolta la fila en grupo, a un lado y a otro de la ruta", () => {
    const c = new SquadCoordinator(open);
    const orders = c.update(situation(squad(), { escort }));
    const posts = [...orders.values()].filter((o) => o.kind === "escort");
    expect(posts).toHaveLength(Math.round(8 * bot.escortShare));
    expect([...orders.values()].filter((o) => o.kind === "guard")).toHaveLength(8 - posts.length);
    const xs = posts.map((o) => (o.kind === "escort" ? o.post.x : 0)).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-bot.escortOffset);
    expect(xs[xs.length - 1]).toBeCloseTo(bot.escortOffset);
    for (const o of posts) {
      if (o.kind !== "escort") continue;
      // Juntos, alrededor de su punto de la ruta, mirando hacia la madriguera (al este).
      expect(Math.abs(o.post.z - (-100 + 100 * bot.escortAt))).toBeLessThanOrEqual(
        bot.escortSpacing * posts.length,
      );
      expect(o.facing).toBeGreaterThan(0);
    }
  });

  it("los puestos no cambian de dueño sin motivo; si uno va a rescatar, otro ocupa su sitio", () => {
    const c = new SquadCoordinator(open);
    const first = c.update(situation(squad(), { escort }));
    const holders = [...first].filter(([, o]) => o.kind === "escort").map(([id]) => id);
    const again = c.update(situation(squad(), { escort }));
    expect([...again].filter(([, o]) => o.kind === "escort").map(([id]) => id)).toEqual(holders);

    // Cae alguien junto a un escolta: va él, y su puesto lo ocupa uno de los que defendían.
    const escortee = holders[0]!;
    const members = squad();
    const near = members.find((m) => m.id === escortee)!;
    const orders = c.update(
      situation([...members, downed(50, near.x + 1, near.z, 25)], { escort }),
    );
    expect(rescuerOf(orders, 50)).toBe(escortee);
    expect([...orders.values()].filter((o) => o.kind === "escort")).toHaveLength(holders.length);
  });

  it("sin fila que escoltar, todos a defender", () => {
    const c = new SquadCoordinator(open);
    c.update(situation(squad(), { escort }));
    const orders = c.update(situation(squad()));
    expect([...orders.values()].every((o) => o.kind === "guard")).toBe(true);
  });
});

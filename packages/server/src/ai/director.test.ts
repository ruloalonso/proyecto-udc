import { describe, expect, it } from "vitest";
import {
  BurrowState,
  EntityKind,
  GAME_CONFIG,
  MAP,
  TICK_SECONDS,
  type GameEvent,
} from "@udc/shared";
import { Director } from "./director.js";

const cfg = GAME_CONFIG.director;
const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
const [L1, L2, L3, L4] = cfg.launches.map(ticks) as [number, number, number, number];
const index = (id: string) => MAP.burrows.findIndex((b) => b.id === id);

/** Generador pseudoaleatorio determinista. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Director en marcha que avanza hasta el tick `t` sin centollos vivos. Devuelve todo. */
function runTo(t: number, director = started()) {
  const events: GameEvent[] = [];
  const spawns: { tick: number; kind: number; burrow: number }[] = [];
  for (let tick = 1; tick <= t; tick++) {
    const out = director.step(0);
    events.push(...out.events);
    for (const s of out.spawns) spawns.push({ tick, ...s });
  }
  return { director, events, spawns };
}

function started(): Director {
  const d = new Director(MAP, seeded());
  d.start();
  return d;
}

describe("Director: línea de tiempo", () => {
  const d = new Director(MAP);

  it("calma al principio, empujón antes de cada despegue y valles cada vez más cortos", () => {
    expect(d.phaseAt(ticks(GAME_CONFIG.match.prepSeconds) - 1)).toBe("calm");
    expect(d.phaseAt(ticks(GAME_CONFIG.match.prepSeconds))).toBe("background");
    expect(d.phaseAt(L1 - ticks(cfg.pushSeconds) - 1)).toBe("background");
    expect(d.phaseAt(L1 - ticks(cfg.pushSeconds))).toBe("push");
    expect(d.phaseAt(L1 - 1)).toBe("push");
    expect(d.phaseAt(L1)).toBe("valley");
    expect(d.phaseAt(L1 + ticks(cfg.valleySeconds[0]!) - 1)).toBe("valley");
    expect(d.phaseAt(L1 + ticks(cfg.valleySeconds[0]!))).toBe("background");
    expect(d.phaseAt(L2 + ticks(cfg.valleySeconds[1]!) - 1)).toBe("valley");
    expect(d.phaseAt(L3 + ticks(cfg.valleySeconds[2]!))).toBe("background");
    expect(d.phaseAt(L4)).toBe("final");
  });

  it("el ritmo de fondo crece con el tiempo; el empujón lo multiplica y el valle lo baja", () => {
    const early = d.rateAt(ticks(60));
    const late = d.rateAt(ticks(400));
    expect(early).toBeCloseTo(cfg.baseRate * (1 + cfg.growthPerMinute));
    expect(late).toBeGreaterThan(early);
    const push = d.rateAt(L2 - 1);
    const valley = d.rateAt(L2 + 1);
    expect(push / valley).toBeCloseTo(cfg.pushFactor / cfg.valleyFactor, 1);
  });

  it("sin escupidores hasta el primer despegue; después suben hasta la proporción final", () => {
    expect(d.spitterRatioAt(L1 - 1)).toBe(0);
    expect(d.spitterRatioAt(L1)).toBeCloseTo(cfg.spitterRatioFrom);
    expect(d.spitterRatioAt(L3)).toBeGreaterThan(cfg.spitterRatioFrom);
    expect(d.spitterRatioAt(L4)).toBeCloseTo(cfg.spitterRatioTo);
  });

  it("madrigueras abiertas: unas pocas, una más por despegue y todas en la oleada final", () => {
    expect(d.burrowsWantedAt(ticks(GAME_CONFIG.match.prepSeconds))).toBe(cfg.initialBurrows);
    expect(d.burrowsWantedAt(L1)).toBe(cfg.initialBurrows + 1);
    expect(d.burrowsWantedAt(L3)).toBe(cfg.initialBurrows + 3);
    expect(d.burrowsWantedAt(L4)).toBe(MAP.burrows.length);
  });
});

describe("Director: partida", () => {
  it("no hace nada hasta que empieza", () => {
    const d = new Director(MAP);
    expect(d.step(0)).toEqual({ spawns: [], events: [] });
  });

  it("los centollos aparecen solo por madrigueras abiertas, y ninguno en la calma", () => {
    const { spawns, events } = runTo(L1);
    const opened = new Set(
      events.flatMap((e) => (e.k === "burrow" && e.state === BurrowState.Open ? [e.burrow] : [])),
    );
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.every((s) => s.tick >= ticks(GAME_CONFIG.match.prepSeconds))).toBe(true);
    expect(spawns.every((s) => opened.has(s.burrow))).toBe(true);
  });

  it("aparecen al ritmo previsto, con picos en los empujones", () => {
    const { spawns } = runTo(L2);
    const inWindow = (from: number, to: number) =>
      spawns.filter((s) => s.tick >= from && s.tick < to).length;
    const pushLen = ticks(cfg.pushSeconds);
    const push = inWindow(L2 - pushLen, L2);
    const before = inWindow(L2 - 2 * pushLen, L2 - pushLen);
    expect(push).toBeGreaterThan(before * 2);
    const valley = inWindow(L1, L1 + ticks(cfg.valleySeconds[0]!));
    expect(valley).toBeLessThan(before);
  });

  it("solo rasos antes del primer despegue; después, también escupidores", () => {
    const { spawns } = runTo(L3);
    expect(spawns.filter((s) => s.tick < L1).every((s) => s.kind === EntityKind.Crab)).toBe(true);
    expect(spawns.some((s) => s.tick >= L1 && s.kind === EntityKind.Spitter)).toBe(true);
  });

  it("respeta el tope de centollos vivos", () => {
    const d = started();
    for (let t = 1; t < L4; t++) d.step(0);
    expect(d.step(cfg.maxAlive).spawns).toHaveLength(0);
    expect(d.step(cfg.maxAlive - 2).spawns.length).toBeLessThanOrEqual(2);
  });

  it("oleada final: todas las madrigueras, y aparecen sin parar hasta el tope", () => {
    const { director, events } = runTo(L4 + ticks(cfg.burrowWarning));
    expect(events).toContainEqual({ k: "finalWave" });
    expect(director.status(0).burrows.every((s) => s === BurrowState.Open)).toBe(true);
    expect(director.step(0).spawns).toHaveLength(MAP.burrows.length);
  });

  it("avisa antes de abrir cada madriguera y la abre justo cuando toca", () => {
    const { events } = runTo(L1 + 1);
    const at: Record<number, { warn?: number; open?: number }> = {};
    let tick = 0;
    // Reconstruir en qué tick llegó cada evento.
    const d = started();
    for (tick = 1; tick <= L1 + 1; tick++) {
      for (const e of d.step(0).events) {
        if (e.k !== "burrow") continue;
        at[e.burrow] ??= {};
        if (e.state === BurrowState.Warning) at[e.burrow]!.warn = tick;
        if (e.state === BurrowState.Open) at[e.burrow]!.open = tick;
      }
    }
    expect(events.filter((e) => e.k === "burrow" && e.state === BurrowState.Open)).toHaveLength(
      cfg.initialBurrows + 1,
    );
    for (const { warn, open } of Object.values(at)) {
      expect(open! - warn!).toBe(ticks(cfg.burrowWarning));
    }
    // Las iniciales, al acabar la calma; la nueva, en el despegue.
    const opens = Object.values(at)
      .map((a) => a.open)
      .sort((a, b) => a! - b!);
    expect(opens[0]).toBe(ticks(GAME_CONFIG.match.prepSeconds));
    expect(opens.at(-1)).toBe(L1);
  });

  it("abre primero las madrigueras que amenazan más rutas", () => {
    const { director } = runTo(ticks(GAME_CONFIG.match.prepSeconds));
    const open = director.status(0).burrows.flatMap((s, i) => (s === BurrowState.Open ? [i] : []));
    // La norte amenaza las cuatro rutas; la sur, ninguna.
    expect(open).toContain(index("norte"));
    expect(open).not.toContain(index("sur"));
  });

  it("la sur, que no amenaza ninguna ruta, solo se abre en la oleada final", () => {
    // Hasta que empieza su aviso, 5 s antes de la final.
    const { director } = runTo(L4 - ticks(cfg.burrowWarning) - 1);
    expect(director.status(0).burrows[index("sur")]).toBe(BurrowState.Closed);
    director.step(0);
    expect(director.status(0).burrows[index("sur")]).toBe(BurrowState.Warning);
  });
});

describe("Director: taponar madrigueras", () => {
  it("una granada tapona una madriguera abierta y a los 10 s se abre otra, con aviso", () => {
    const { director: d } = runTo(ticks(60));
    const north = index("norte");
    const p = MAP.burrows[north]!;
    expect(d.burrowAt({ x: p.x + 2, z: p.z })).toBe(north);
    expect(d.plug(north)).toEqual([{ k: "burrow", burrow: north, state: BurrowState.Plugged }]);
    expect(d.burrowAt(p)).toBeNull();

    const openCount = () => d.status(0).burrows.filter((s) => s === BurrowState.Open).length;
    expect(openCount()).toBe(cfg.initialBurrows - 1);

    const reopen = ticks(cfg.plugReopen);
    const events: GameEvent[] = [];
    let warnedAt = -1;
    for (let t = 1; t <= reopen; t++) {
      const out = d.step(0).events;
      if (out.some((e) => e.k === "burrow" && e.state === BurrowState.Warning)) warnedAt = t;
      events.push(...out);
    }
    expect(warnedAt).toBe(reopen - ticks(cfg.burrowWarning));
    expect(openCount()).toBe(cfg.initialBurrows);
    // No reabre la que se acaba de taponar.
    expect(d.status(0).burrows[north]).toBe(BurrowState.Plugged);
  });

  it("no se puede taponar una madriguera cerrada", () => {
    const { director: d } = runTo(ticks(60));
    expect(d.plug(index("sur"))).toEqual([]);
    expect(d.burrowAt(MAP.burrows[index("sur")]!)).toBeNull();
  });

  it("en la oleada final, la taponada vuelve a abrirse (no hay otra)", () => {
    const { director: d } = runTo(L4 + ticks(cfg.burrowWarning));
    const north = index("norte");
    d.plug(north);
    for (let t = 0; t < ticks(cfg.plugReopen); t++) d.step(0);
    expect(d.status(0).burrows[north]).toBe(BurrowState.Open);
  });

  it("reiniciar deja todo cerrado y sin empezar", () => {
    const { director: d } = runTo(L2);
    d.reset();
    expect(d.isRunning).toBe(false);
    expect(d.status(0)).toMatchObject({ phase: "calm", launches: 0, nextLaunchTick: null });
    expect(d.status(0).burrows.every((s) => s === BurrowState.Closed)).toBe(true);
  });

  it("el estado para los clientes cuenta despegues y dice cuándo es el siguiente", () => {
    const { director: d, events } = runTo(L1);
    expect(events).toContainEqual({ k: "launch", n: 1 });
    expect(d.status(1000)).toMatchObject({ launches: 1, nextLaunchTick: 1000 + L2 - L1 });
  });
});

describe("Director: saltos (comandos de administración)", () => {
  it("la siguiente fase, desde cualquier punto", () => {
    const d = started();
    expect(d.nextPhaseTick()).toBe(ticks(GAME_CONFIG.match.prepSeconds));
    d.jumpTo(ticks(GAME_CONFIG.match.prepSeconds));
    d.step(0);
    expect(d.nextPhaseTick()).toBe(L1 - ticks(cfg.pushSeconds));
    d.jumpTo(L1 - 1);
    d.step(0);
    expect(d.nextPhaseTick()).toBe(L1);
    d.jumpTo(L4);
    d.step(0);
    expect(d.nextPhaseTick()).toBeNull();
  });

  it("el próximo empujón, y la oleada final si ya no quedan", () => {
    const d = started();
    expect(d.nextPushTick()).toBe(L1 - ticks(cfg.pushSeconds));
    d.jumpTo(L3);
    d.step(0);
    expect(d.nextPushTick()).toBe(L4 - ticks(cfg.pushSeconds));
    d.jumpTo(L4);
    d.step(0);
    expect(d.nextPushTick()).toBe(L4);
  });

  it("al saltar se anuncia el despegue en el que se aterriza y se abren las madrigueras que tocan", () => {
    const d = started();
    d.jumpTo(L2);
    const events = d.step(0).events;
    expect(events).toContainEqual({ k: "launch", n: 2 });
    expect(d.status(0).launches).toBe(2);
    expect(d.phaseAt(L2)).toBe("valley");
    const warned = events.filter((e) => e.k === "burrow" && e.state === BurrowState.Warning);
    expect(warned).toHaveLength(cfg.initialBurrows + 2);
    for (let t = 0; t < ticks(cfg.burrowWarning); t++) d.step(0);
    const open = d.status(0).burrows.filter((s) => s === BurrowState.Open);
    expect(open).toHaveLength(cfg.initialBurrows + 2);
  });

  it("saltar a la oleada final la anuncia", () => {
    const d = started();
    d.jumpTo(d.finalTick);
    expect(d.step(0).events).toContainEqual({ k: "finalWave" });
  });
});

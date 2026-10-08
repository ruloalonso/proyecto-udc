import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "../config/game.config.js";
import { EntityKind, encodeMessage, type SnapshotMessage } from "./messages.js";
import { quantizePos, quantizeYaw } from "./quantize.js";
import {
  emptyDelta,
  forEachHp,
  forEachMove,
  writeEntity,
  writeRemovals,
  type SentCache,
} from "./snapshotDelta.js";

const crab = (id: number, x: number, z: number, yaw: number, hp = 30) => ({
  id,
  kind: EntityKind.Crab,
  name: "Centollo raso",
  x,
  z,
  yaw,
  hp,
});

/** Lo que reconstruye un cliente: estado cuantizado por id. */
type ClientView = Map<number, { x: number; z: number; yaw: number; hp?: number }>;

function apply(view: ClientView, delta: ReturnType<typeof emptyDelta>): void {
  for (const e of delta.added) view.set(e.id, { x: e.x, z: e.z, yaw: e.yaw, hp: e.hp });
  forEachMove(delta.moved, (id, dx, dz, dyaw) => {
    const e = view.get(id)!;
    e.x += dx;
    e.z += dz;
    e.yaw += dyaw;
  });
  forEachHp(delta.hp, (id, hp) => (view.get(id)!.hp = hp));
  for (const id of delta.removed) view.delete(id);
}

describe("writeEntity", () => {
  it("una entidad nueva viaja completa y, si no cambia, no vuelve a viajar", () => {
    const sent: SentCache = new Map();
    const first = emptyDelta();
    writeEntity(first, sent, crab(7, 1.234, -5, 0.5));
    expect(first.added).toEqual([
      { id: 7, kind: EntityKind.Crab, name: "Centollo raso", x: 123, z: -500, yaw: 500, hp: 30 },
    ]);
    expect(first.moved).toEqual([]);

    const second = emptyDelta();
    writeEntity(second, sent, crab(7, 1.234, -5, 0.5));
    expect(second).toEqual(emptyDelta());
  });

  it("los movimientos son diferencias en centímetros y milirradianes", () => {
    const sent: SentCache = new Map();
    writeEntity(emptyDelta(), sent, crab(7, 0, 0, 0));
    const delta = emptyDelta();
    writeEntity(delta, sent, crab(7, 0.3, -0.25, 0.01));
    expect(delta.moved).toEqual([7, 30, -25, 10]);
    expect(delta.added).toEqual([]);
  });

  it("los cambios de vida van aparte", () => {
    const sent: SentCache = new Map();
    writeEntity(emptyDelta(), sent, crab(7, 0, 0, 0, 30));
    const delta = emptyDelta();
    writeEntity(delta, sent, crab(7, 0, 0, 0, 20));
    expect(delta.hp).toEqual([7, 20]);
    expect(delta.moved).toEqual([]);
  });

  it("el cliente reconstruye exactamente el estado cuantizado tras muchos ticks", () => {
    const sent: SentCache = new Map();
    const view: ClientView = new Map();
    // Paseo pseudoaleatorio determinista, con giros que cruzan ±π.
    let x = 10;
    let z = -20;
    let yaw = 3;
    let hp = 30;
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let tick = 0; tick < 2000; tick++) {
      x += rand() * 0.3;
      z += rand() * 0.3;
      yaw += rand() * 0.8;
      if (tick % 97 === 0) hp -= 1;
      const delta = emptyDelta();
      writeEntity(delta, sent, crab(1, x, z, yaw, hp));
      apply(view, delta);
    }
    expect(view.get(1)).toEqual({
      x: quantizePos(x),
      z: quantizePos(z),
      yaw: quantizeYaw(yaw),
      hp,
    });
  });
});

describe("writeRemovals", () => {
  it("marca como eliminadas las que ya no existen y las quita de la caché", () => {
    const sent: SentCache = new Map();
    writeEntity(emptyDelta(), sent, crab(1, 0, 0, 0));
    writeEntity(emptyDelta(), sent, crab(2, 0, 0, 0));
    const delta = emptyDelta();
    writeRemovals(delta, sent, (id) => id === 2);
    expect(delta.removed).toEqual([1]);
    expect([...sent.keys()]).toEqual([2]);
  });
});

describe("tamaño (NFR-03)", () => {
  it("150 centollos corriendo caben en menos de 50 KB/s", () => {
    const sent: SentCache = new Map();
    const step = GAME_CONFIG.crab.speed * TICK_SECONDS;
    // Ids altos, como a mitad de partida.
    const ids = Array.from({ length: 150 }, (_, i) => 5000 + i);
    const at = (i: number, tick: number) => crab(ids[i]!, -80 + i, -90 + tick * step, (i % 7) - 3);
    const first = emptyDelta();
    ids.forEach((_, i) => writeEntity(first, sent, at(i, 0)));

    const delta = emptyDelta();
    ids.forEach((_, i) => writeEntity(delta, sent, at(i, 1)));
    const snap: SnapshotMessage = { t: "snapshot", tick: 123_456, ack: 9_999, you: null, ...delta };
    const bytesPerSecond = encodeMessage(snap).byteLength * GAME_CONFIG.net.tickRate;
    expect(delta.moved).toHaveLength(150 * 4);
    expect(bytesPerSecond / 1024).toBeLessThan(25);
  });
});

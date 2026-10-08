import { describe, expect, it } from "vitest";
import { EntityKind, type NetEntity, type SnapshotMessage } from "@udc/shared";
import { displayName, RemoteEntities } from "./remoteEntities.js";

const snapshot = (tick: number, parts: Partial<SnapshotMessage> = {}): SnapshotMessage => ({
  t: "snapshot",
  tick,
  ack: -1,
  you: null,
  added: [],
  moved: [],
  hp: [],
  removed: [],
  ...parts,
});
const dummy = (hp?: number): NetEntity => ({
  id: 7,
  kind: EntityKind.Dummy,
  name: "Centollo de cartón nº 1",
  x: 0,
  z: 0,
  yaw: 0,
  hp,
});

describe("RemoteEntities", () => {
  it("guarda la vida y la actualiza cuando cambia", () => {
    const remotes = new RemoteEntities();
    expect(remotes.applySnapshot(snapshot(1, { added: [dummy(60)] }))).toHaveLength(1);
    remotes.applySnapshot(snapshot(2, { hp: [7, 50] }));
    expect(remotes.entities.get(7)?.hp).toBe(50);
  });

  it("no pierde la vida si un snapshot no la trae", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(snapshot(1, { added: [dummy(60)] }));
    remotes.applySnapshot(snapshot(2, { moved: [7, 100, 0, 0] }));
    expect(remotes.entities.get(7)?.hp).toBe(60);
  });

  it("suma los movimientos al último estado y los interpola", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(snapshot(1, { added: [{ ...dummy(), x: 100, z: -200, yaw: 0 }] }));
    remotes.applySnapshot(snapshot(2, { moved: [7, 30, -20, 500] }));
    remotes.applySnapshot(snapshot(3, { moved: [7, 30, -20, 0] }));
    const entity = remotes.entities.get(7)!;
    expect(entity.q).toEqual({ x: 160, z: -240, yaw: 500 });
    expect(remotes.poseAt(entity, 3)).toEqual({ tick: 3, x: 1.6, z: -2.4, yaw: 0.5 });
    const mid = remotes.poseAt(entity, 1.5)!;
    expect(mid.x).toBeCloseTo(1.15);
    expect(mid.z).toBeCloseTo(-2.1);
  });

  it("una entidad quieta repite su última muestra (no estira la interpolación)", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(snapshot(1, { added: [dummy()] }));
    remotes.applySnapshot(snapshot(5, { moved: [7, 100, 0, 0] }));
    remotes.applySnapshot(snapshot(9, {}));
    const entity = remotes.entities.get(7)!;
    expect(remotes.poseAt(entity, 7)?.x).toBe(1);
  });

  it("los escupitajos se quitan en cuanto llega su eliminación", () => {
    const remotes = new RemoteEntities();
    const spit: NetEntity = { ...dummy(), id: 9, kind: EntityKind.Spit, name: "Escupitajo" };
    remotes.applySnapshot(snapshot(1, { added: [spit] }));
    remotes.applySnapshot(snapshot(10, { removed: [9] }));
    expect(remotes.takeRemoved(5)).toEqual([9]);
  });

  it("retrasa la eliminación hasta que se dibuja el tick en que ocurrió", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(snapshot(1, { added: [dummy(60)] }));
    remotes.applySnapshot(snapshot(10, { removed: [7] }));
    expect(remotes.entities.has(7)).toBe(true);
    expect(remotes.takeRemoved(9.5)).toEqual([]);
    expect(remotes.takeRemoved(10)).toEqual([7]);
    expect(remotes.entities.has(7)).toBe(false);
  });
});

describe("displayName", () => {
  it("los bots llevan (bot) detrás", () => {
    expect(displayName({ name: "Recluta nº 1", bot: true })).toBe("Recluta nº 1 (bot)");
    expect(displayName({ name: "Recluta nº 2" })).toBe("Recluta nº 2");
  });

  it("la marca llega con la entidad nueva", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(
      snapshot(1, {
        added: [
          { id: 3, kind: EntityKind.Soldier, name: "Recluta nº 3", x: 0, z: 0, yaw: 0, bot: true },
        ],
      }),
    );
    expect(remotes.entities.get(3)?.bot).toBe(true);
  });
});

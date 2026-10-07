import { describe, expect, it } from "vitest";
import { EntityKind, type NetEntity, type SnapshotMessage } from "@udc/shared";
import { RemoteEntities } from "./remoteEntities.js";

const snapshot = (tick: number, changed: NetEntity[], removed: number[] = []): SnapshotMessage => ({
  t: "snapshot",
  tick,
  ack: -1,
  you: null,
  changed,
  removed,
});
const dummy = (hp?: number): NetEntity => ({
  id: 7,
  kind: EntityKind.Dummy,
  x: 0,
  z: 0,
  yaw: 0,
  hp,
});

describe("RemoteEntities", () => {
  it("guarda la vida y la actualiza cuando cambia", () => {
    const remotes = new RemoteEntities();
    expect(remotes.applySnapshot(snapshot(1, [dummy(60)]))).toHaveLength(1);
    remotes.applySnapshot(snapshot(2, [dummy(50)]));
    expect(remotes.entities.get(7)?.hp).toBe(50);
  });

  it("no pierde la vida si un snapshot no la trae", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(snapshot(1, [dummy(60)]));
    remotes.applySnapshot(snapshot(2, [dummy()]));
    expect(remotes.entities.get(7)?.hp).toBe(60);
  });

  it("retrasa la eliminación hasta que se dibuja el tick en que ocurrió", () => {
    const remotes = new RemoteEntities();
    remotes.applySnapshot(snapshot(1, [dummy(60)]));
    remotes.applySnapshot(snapshot(10, [], [7]));
    expect(remotes.entities.has(7)).toBe(true);
    expect(remotes.takeRemoved(9.5)).toEqual([]);
    expect(remotes.takeRemoved(10)).toEqual([7]);
    expect(remotes.entities.has(7)).toBe(false);
  });
});

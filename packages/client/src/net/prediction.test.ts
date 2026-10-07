import { describe, expect, it } from "vitest";
import {
  AbilityId,
  MAP,
  stepMovement,
  withSpeedBoost,
  type MoveState,
  type PlayerInput,
  type SnapshotMessage,
} from "@udc/shared";
import { LocalPrediction } from "./prediction.js";

/** Lo que hace el servidor con las entradas (ver World.step): estimulante aceptado o no. */
function serverRun(start: MoveState, inputs: PlayerInput[], stimAccepted: boolean): MoveState {
  let s = start;
  for (const input of inputs) {
    if (input.ability?.id === AbilityId.Stim && stimAccepted) s = withSpeedBoost(s);
    s = stepMovement(s, input, MAP);
  }
  return s;
}

const snapshot = (ack: number, you: MoveState): SnapshotMessage => ({
  t: "snapshot",
  tick: ack,
  ack,
  you: { ...you, hp: 100, cd: [0, 0, 0, 0] },
  changed: [],
  removed: [],
});

// Corriendo hacia −Z desde la plataforma; estimulante en la entrada 3.
const spawn: MoveState = { x: MAP.spawn.x, z: MAP.spawn.z, yaw: Math.PI };
const inputs: PlayerInput[] = Array.from({ length: 12 }, (_, seq) => ({
  seq,
  forward: 1,
  strafe: 0,
  yaw: Math.PI,
  ...(seq === 3 && { ability: { id: AbilityId.Stim } }),
}));

describe("LocalPrediction con estimulante", () => {
  it("predice exactamente lo que hace el servidor (corrección 0)", () => {
    const local = new LocalPrediction(spawn);
    for (const input of inputs) local.applyInput(input);
    // El servidor ha procesado hasta la entrada 6 (estimulante incluido).
    local.reconcile(snapshot(6, serverRun(spawn, inputs.slice(0, 7), true)));
    expect(local.lastCorrection).toBe(0);
    expect(local.current).toEqual({ ...serverRun(spawn, inputs, true), yaw: Math.PI });
  });

  it("si el servidor rechaza el estimulante, la reconciliación lo corrige", () => {
    const local = new LocalPrediction(spawn);
    for (const input of inputs) local.applyInput(input);
    local.reconcile(snapshot(6, serverRun(spawn, inputs.slice(0, 7), false)));
    expect(local.lastCorrection).toBeGreaterThan(0);
    expect(local.current.boostTicks).toBeUndefined();
  });
});

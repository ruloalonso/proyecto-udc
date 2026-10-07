import {
  AbilityId,
  MAP,
  stepMovement,
  withSpeedBoost,
  type MoveState,
  type PlayerInput,
  type SnapshotMessage,
} from "@udc/shared";

/**
 * Un paso de la predicción. El estimulante se activa antes de mover la entrada en que
 * se usa, igual que en el servidor. El cliente solo lo manda cuando cree que está listo;
 * si el servidor lo rechaza, la reconciliación lo corrige.
 */
function predictStep(state: MoveState, input: PlayerInput): MoveState {
  const start = input.ability?.id === AbilityId.Stim ? withSpeedBoost(state) : state;
  return stepMovement(start, input, MAP);
}

/**
 * Predicción del movimiento propio (E1-5).
 *
 * El cliente aplica cada entrada en local en cuanto la genera, con la misma función
 * que el servidor. Cuando llega un snapshot con la última entrada confirmada,
 * parte del estado autoritativo y vuelve a aplicar las entradas aún no confirmadas.
 * Si el resultado difiere de lo que se estaba dibujando, la diferencia se absorbe
 * poco a poco para que no se vea un salto.
 */
export class LocalPrediction {
  /** Estado previsto tras la última entrada. */
  current: MoveState;
  /** Estado previsto tras la entrada anterior (para interpolar entre ticks al dibujar). */
  previous: MoveState;
  private pending: PlayerInput[] = [];

  /** Error visual pendiente de absorber tras una corrección. */
  private errorX = 0;
  private errorZ = 0;
  /** Última corrección aplicada, en metros (para depuración). */
  lastCorrection = 0;

  constructor(spawn: MoveState) {
    this.current = { ...spawn };
    this.previous = { ...spawn };
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  applyInput(input: PlayerInput): void {
    this.pending.push(input);
    this.previous = this.current;
    this.current = predictStep(this.current, input);
  }

  reconcile(snap: SnapshotMessage): void {
    if (!snap.you) return;
    this.pending = this.pending.filter((i) => i.seq > snap.ack);

    const { x, z, yaw, boostTicks } = snap.you;
    let state: MoveState = boostTicks ? { x, z, yaw, boostTicks } : { x, z, yaw };
    for (const input of this.pending) state = predictStep(state, input);

    const dx = this.current.x - state.x;
    const dz = this.current.z - state.z;
    this.lastCorrection = Math.hypot(dx, dz);

    if (this.lastCorrection > 2) {
      // Demasiado lejos para suavizar: recolocar.
      this.errorX = 0;
      this.errorZ = 0;
      this.previous = state;
    } else {
      this.errorX += dx;
      this.errorZ += dz;
      this.previous = { ...this.previous, x: this.previous.x - dx, z: this.previous.z - dz };
    }
    // La orientación la manda el cliente: se conserva la local.
    this.current = { ...state, yaw: this.current.yaw };
  }

  /**
   * Pose para dibujar en este frame.
   * @param alpha fracción del tick actual transcurrida (0..1)
   * @param dt segundos desde el último frame
   */
  renderPose(alpha: number, dt: number): { x: number; z: number } {
    const decay = Math.exp(-12 * dt);
    this.errorX *= decay;
    this.errorZ *= decay;
    return {
      x: this.previous.x + (this.current.x - this.previous.x) * alpha + this.errorX,
      z: this.previous.z + (this.current.z - this.previous.z) * alpha + this.errorZ,
    };
  }
}

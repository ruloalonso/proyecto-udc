import {
  MAP,
  stepMovement,
  type MoveInput,
  type MoveState,
  type SnapshotMessage,
} from "@uos/shared";

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
  private pending: MoveInput[] = [];

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

  applyInput(input: MoveInput): void {
    this.pending.push(input);
    this.previous = this.current;
    this.current = stepMovement(this.current, input, MAP);
  }

  reconcile(snap: SnapshotMessage): void {
    if (!snap.you) return;
    this.pending = this.pending.filter((i) => i.seq > snap.ack);

    let state: MoveState = { ...snap.you };
    for (const input of this.pending) state = stepMovement(state, input, MAP);

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

import { GAME_CONFIG, normalizeAngle } from "@udc/shared";

/**
 * Controles al estilo WoW (versión H1):
 * - W/S avanzar y retroceder, A/D girar, Q/E desplazamiento lateral.
 * - Botón derecho + ratón: gira al personaje (y A/D pasan a ser laterales).
 * - Botón izquierdo + ratón: orbita la cámara sin girar al personaje.
 * - Rueda: zoom.
 */
export class Controls {
  /** Orientación del personaje (la manda el cliente). */
  yaw: number;
  /** Desfase de la cámara respecto a la espalda del personaje. */
  cameraYawOffset = 0;
  cameraPitch = 1.15;
  cameraDistance = 9;

  private keys = new Set<string>();
  private rightDown = false;
  private leftDown = false;
  onToggleDebug: () => void = () => {};

  constructor(
    private readonly canvas: HTMLCanvasElement,
    initialYaw: number,
  ) {
    this.yaw = initialYaw;

    window.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.onToggleDebug();
        return;
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.rightDown = this.leftDown = false;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 0) this.leftDown = true;
      if (e.button === 2) {
        this.rightDown = true;
        // Al agarrar con el derecho, el personaje pasa a mirar hacia donde mira la cámara.
        this.yaw = normalizeAngle(this.yaw + this.cameraYawOffset);
        this.cameraYawOffset = 0;
      }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", (e) => {
      if (e.button === 0) this.leftDown = false;
      if (e.button === 2) this.rightDown = false;
      if (!this.leftDown && !this.rightDown) canvas.releasePointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.leftDown && !this.rightDown) return;
      const sens = 0.005;
      if (this.rightDown) {
        this.yaw = normalizeAngle(this.yaw + e.movementX * sens);
      } else {
        this.cameraYawOffset = normalizeAngle(this.cameraYawOffset + e.movementX * sens);
      }
      this.cameraPitch = Math.min(1.5, Math.max(0.35, this.cameraPitch - e.movementY * sens));
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.cameraDistance = Math.min(25, Math.max(3, this.cameraDistance + e.deltaY * 0.01));
      },
      { passive: false },
    );
  }

  private pressed(code: string): boolean {
    return this.keys.has(code);
  }

  /** Actualiza la orientación con el teclado. Llamar cada frame. */
  update(dt: number): void {
    if (this.rightDown) return; // Con el botón derecho, A/D son laterales.
    const turn = (this.pressed("KeyD") ? 1 : 0) - (this.pressed("KeyA") ? 1 : 0);
    if (turn !== 0) this.yaw = normalizeAngle(this.yaw + turn * GAME_CONFIG.soldier.turnSpeed * dt);
  }

  /** Ejes de movimiento para la entrada de este tick. */
  axes(): { forward: number; strafe: number } {
    let forward = (this.pressed("KeyW") ? 1 : 0) - (this.pressed("KeyS") ? 1 : 0);
    if (this.leftDown && this.rightDown) forward = 1; // Ambos botones: correr hacia delante.
    let strafe = (this.pressed("KeyE") ? 1 : 0) - (this.pressed("KeyQ") ? 1 : 0);
    if (this.rightDown) strafe += (this.pressed("KeyD") ? 1 : 0) - (this.pressed("KeyA") ? 1 : 0);
    // Al moverse, la cámara vuelve poco a poco a la espalda del personaje.
    if (forward !== 0 && !this.leftDown) this.cameraYawOffset *= 0.85;
    return { forward, strafe: Math.max(-1, Math.min(1, strafe)) };
  }
}

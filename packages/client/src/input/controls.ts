import { GAME_CONFIG, normalizeAngle } from "@udc/shared";

const CAM = GAME_CONFIG.camera;
const { clickMaxDragPx } = GAME_CONFIG.targeting;

/**
 * Controles al estilo WoW (spec §3.3):
 * - W/S avanzar y retroceder, A/D girar, Q/E desplazamiento lateral.
 * - Botón derecho + ratón: gira al personaje (y A/D pasan a ser laterales).
 * - Botón izquierdo + ratón: orbita la cámara sin girar al personaje.
 * - Rueda: zoom.
 * - Tab: siguiente objetivo. Clic izquierdo (sin arrastrar): seleccionar. Escape: quitar objetivo.
 * - 1, 2, 3: habilidades. Con la granada, clic para lanzar y Escape o clic derecho para cancelar.
 */
export class Controls {
  /** Orientación del personaje (la manda el cliente). */
  yaw: number;
  /** Desfase de la cámara respecto a la espalda del personaje. */
  cameraYawOffset = 0;
  cameraPitch: number = CAM.pitch;
  /** Distancia elegida con la rueda (la colisión puede acercarla más). */
  cameraDistance: number = CAM.distance;

  private keys = new Set<string>();
  private rightDown = false;
  private leftDown = false;
  /** Dónde se pulsó cada botón, para distinguir un clic de un arrastre. */
  private leftDownAt: { x: number; y: number } | null = null;
  private rightDownAt: { x: number; y: number } | null = null;
  /** Última posición del puntero sobre el canvas. */
  pointerX = 0;
  pointerY = 0;
  onToggleDebug: () => void = () => {};
  onTab: () => void = () => {};
  onEscape: () => void = () => {};
  /** Teclas 1, 2 y 3. */
  onAbility: (slot: 1 | 2 | 3) => void = () => {};
  /** Clic izquierdo sin arrastrar, en coordenadas del canvas. */
  onClick: (x: number, y: number) => void = () => {};
  /** Clic derecho sin arrastrar. */
  onRightClick: () => void = () => {};
  /** Cualquier otra tecla al pulsarla (sin repetición). Si devuelve `true`, se consume. */
  onKey: (code: string) => boolean = () => false;

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
      if (e.code === "Tab") {
        e.preventDefault(); // Que el navegador no mueva el foco.
        if (!e.repeat) this.onTab();
        return;
      }
      if (e.code === "Escape") {
        this.onEscape();
        return;
      }
      const slot = ({ Digit1: 1, Digit2: 2, Digit3: 3 } as const)[e.code as "Digit1"];
      if (slot) {
        if (!e.repeat) this.onAbility(slot);
        return;
      }
      if (!e.repeat && this.onKey(e.code)) return;
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.rightDown = this.leftDown = false;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 0) {
        this.leftDown = true;
        this.leftDownAt = { x: e.offsetX, y: e.offsetY };
      }
      if (e.button === 2) {
        this.rightDown = true;
        this.rightDownAt = { x: e.offsetX, y: e.offsetY };
        // Al agarrar con el derecho, el personaje pasa a mirar hacia donde mira la cámara.
        this.yaw = normalizeAngle(this.yaw + this.cameraYawOffset);
        this.cameraYawOffset = 0;
      }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", (e) => {
      if (e.button === 0) {
        this.leftDown = false;
        const at = this.leftDownAt;
        this.leftDownAt = null;
        const isClick =
          at !== null &&
          !this.rightDown &&
          Math.hypot(e.offsetX - at.x, e.offsetY - at.y) <= clickMaxDragPx;
        if (isClick) this.onClick(e.offsetX, e.offsetY);
      }
      if (e.button === 2) {
        this.rightDown = false;
        const at = this.rightDownAt;
        this.rightDownAt = null;
        if (at && Math.hypot(e.offsetX - at.x, e.offsetY - at.y) <= clickMaxDragPx) {
          this.onRightClick();
        }
      }
      if (!this.leftDown && !this.rightDown) canvas.releasePointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      this.pointerX = e.offsetX;
      this.pointerY = e.offsetY;
      if (!this.leftDown && !this.rightDown) return;
      const sens = CAM.mouseSensitivity;
      if (this.rightDown) {
        this.yaw = normalizeAngle(this.yaw + e.movementX * sens);
      } else {
        this.cameraYawOffset = normalizeAngle(this.cameraYawOffset + e.movementX * sens);
      }
      this.cameraPitch = Math.min(
        CAM.maxPitch,
        Math.max(CAM.minPitch, this.cameraPitch - e.movementY * sens),
      );
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.cameraDistance = Math.min(
          CAM.maxDistance,
          Math.max(CAM.minDistance, this.cameraDistance + e.deltaY * CAM.zoomPerWheelUnit),
        );
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

  /** ¿Está pulsando moverse? (Sin efectos, a diferencia de `axes`.) */
  wantsToMove(): boolean {
    const keys = ["KeyW", "KeyS", "KeyQ", "KeyE"].some((k) => this.pressed(k));
    const strafeWithMouse = this.rightDown && (this.pressed("KeyA") || this.pressed("KeyD"));
    return keys || strafeWithMouse || (this.leftDown && this.rightDown);
  }

  /** Ejes de movimiento para la entrada de este tick. */
  axes(): { forward: number; strafe: number } {
    let forward = (this.pressed("KeyW") ? 1 : 0) - (this.pressed("KeyS") ? 1 : 0);
    if (this.leftDown && this.rightDown) forward = 1; // Ambos botones: correr hacia delante.
    let strafe = (this.pressed("KeyE") ? 1 : 0) - (this.pressed("KeyQ") ? 1 : 0);
    if (this.rightDown) strafe += (this.pressed("KeyD") ? 1 : 0) - (this.pressed("KeyA") ? 1 : 0);
    // Al moverse, la cámara vuelve poco a poco a la espalda del personaje.
    if (forward !== 0 && !this.leftDown) this.cameraYawOffset *= CAM.recenterFactor;
    return { forward, strafe: Math.max(-1, Math.min(1, strafe)) };
  }
}

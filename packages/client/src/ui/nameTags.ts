import { Matrix, Vector3, type Scene, type TransformNode } from "@babylonjs/core";
import { EntityKind, GAME_CONFIG } from "@udc/shared";
import type { RemoteEntity } from "../net/remoteEntities.js";

/** Altura de la etiqueta: un poco por encima de la cabeza. */
const TAG_Y = GAME_CONFIG.soldier.height + 0.5;

/** Apodo que se ve sobre un soldado (E2-5): solo los de jugadores; los bots, nada. */
export function nameTagOf(entity: Pick<RemoteEntity, "kind" | "bot" | "nick">): string | null {
  if (entity.kind !== EntityKind.Soldier || entity.bot || !entity.nick) return null;
  return entity.nick;
}

/**
 * Apodos sobre los soldados de los demás jugadores (E2-5): texto HTML proyectado en cada
 * fotograma, de tamaño constante y visible a través de las paredes, para encontrar a los
 * compañeros entre los bots.
 */
export class NameTags {
  private readonly tags = new Map<number, HTMLElement>();
  private readonly at = new Vector3();
  private readonly projected = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly overlay: HTMLElement,
  ) {}

  /** Coloca las etiquetas de este fotograma (`nodes`: id → nodo del soldado) y quita las demás. */
  update(entries: readonly { id: number; text: string; node: TransformNode }[]): void {
    const engine = this.scene.getEngine();
    const camera = this.scene.activeCamera;
    const seen = new Set<number>();
    if (camera) {
      const width = engine.getRenderWidth();
      const height = engine.getRenderHeight();
      const viewport = camera.viewport.toGlobal(width, height);
      // El canvas puede dibujarse a otra resolución que la de la página.
      const scaleX = this.overlay.clientWidth / width;
      const scaleY = this.overlay.clientHeight / height;
      for (const { id, text, node } of entries) {
        if (!node.isEnabled()) continue;
        this.at.set(node.position.x, TAG_Y, node.position.z);
        Vector3.ProjectToRef(
          this.at,
          Matrix.IdentityReadOnly,
          this.scene.getTransformMatrix(),
          viewport,
          this.projected,
        );
        // Detrás de la cámara, no.
        if (this.projected.z <= 0 || this.projected.z >= 1) continue;
        seen.add(id);
        let el = this.tags.get(id);
        if (!el) {
          el = document.createElement("span");
          el.className = "name-tag";
          this.overlay.append(el);
          this.tags.set(id, el);
        }
        // `textContent`: el apodo lo escribe el jugador, nunca como HTML.
        if (el.textContent !== text) el.textContent = text;
        el.style.transform =
          `translate(${this.projected.x * scaleX}px, ${this.projected.y * scaleY}px) ` +
          "translate(-50%, -100%)";
      }
    }
    for (const [id, el] of this.tags) {
      if (seen.has(id)) continue;
      el.remove();
      this.tags.delete(id);
    }
  }
}

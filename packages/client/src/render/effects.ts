import {
  Color3,
  Matrix,
  type Mesh,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

/** Duración de cada efecto, en segundos (puramente visual). */
const TRACER_TIME = 0.07;
const IMPACT_TIME = 0.15;
const NUMBER_TIME = 0.9;
/** Metros que sube un número de daño durante su vida. */
const NUMBER_RISE = 1.2;

interface Timed {
  age: number;
  life: number;
}

interface MeshEffect extends Timed {
  mesh: Mesh;
  grow: boolean;
}

interface FloatingNumber extends Timed {
  el: HTMLElement;
  at: Vector3;
}

/**
 * Efectos de combate de corta vida (E3-1): trazador del disparo, destello de
 * impacto y números de daño flotantes (en HTML, sobre el canvas).
 */
export class Effects {
  private readonly meshes: MeshEffect[] = [];
  private readonly numbers: FloatingNumber[] = [];
  private readonly tracerMat: StandardMaterial;
  private readonly impactMat: StandardMaterial;
  private readonly projected = new Vector3();
  private readonly lifted = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly overlay: HTMLElement,
  ) {
    this.tracerMat = glowMaterial(scene, "tracer", "#ffd36b");
    this.impactMat = glowMaterial(scene, "impact", "#fff1c1");
  }

  /** Disparo de `from` a `to`: trazador y destello en el punto de impacto. */
  shot(from: Vector3, to: Vector3): void {
    const tracer = MeshBuilder.CreateTube(
      "tracer",
      { path: [from, to], radius: 0.03, tessellation: 6 },
      this.scene,
    );
    tracer.material = this.tracerMat;
    tracer.isPickable = false;
    this.meshes.push({ mesh: tracer, age: 0, life: TRACER_TIME, grow: false });

    const impact = MeshBuilder.CreateSphere("impact", { diameter: 0.35, segments: 6 }, this.scene);
    impact.position.copyFrom(to);
    impact.material = this.impactMat;
    impact.isPickable = false;
    this.meshes.push({ mesh: impact, age: 0, life: IMPACT_TIME, grow: true });
  }

  /** Número de daño que sube y se desvanece sobre `at`. */
  damageNumber(at: Vector3, amount: number): void {
    const el = document.createElement("span");
    el.className = "floater";
    el.textContent = String(amount);
    this.overlay.append(el);
    // Un poco de dispersión lateral para que los números seguidos no se tapen.
    const jitter = new Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
    this.numbers.push({ el, at: at.add(jitter), age: 0, life: NUMBER_TIME });
  }

  /** Llamar cada frame, antes de dibujar. */
  update(dt: number): void {
    for (let i = this.meshes.length - 1; i >= 0; i--) {
      const fx = this.meshes[i]!;
      fx.age += dt;
      if (fx.age >= fx.life) {
        fx.mesh.dispose();
        this.meshes.splice(i, 1);
      } else if (fx.grow) {
        fx.mesh.scaling.setAll(1 + fx.age / fx.life);
      }
    }

    const engine = this.scene.getEngine();
    const camera = this.scene.activeCamera;
    if (!camera) return;
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(width, height);
    // El canvas puede dibujarse a otra resolución que la de la página.
    const scaleX = this.overlay.clientWidth / width;
    const scaleY = this.overlay.clientHeight / height;

    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i]!;
      n.age += dt;
      if (n.age >= n.life) {
        n.el.remove();
        this.numbers.splice(i, 1);
        continue;
      }
      const t = n.age / n.life;
      this.lifted.copyFrom(n.at);
      this.lifted.y += NUMBER_RISE * t;
      Vector3.ProjectToRef(
        this.lifted,
        Matrix.IdentityReadOnly,
        this.scene.getTransformMatrix(),
        viewport,
        this.projected,
      );
      const visible = this.projected.z > 0 && this.projected.z < 1;
      n.el.style.opacity = visible ? String(1 - t * t) : "0";
      n.el.style.transform =
        `translate(${this.projected.x * scaleX}px, ${this.projected.y * scaleY}px) ` +
        `translate(-50%, -50%)`;
    }
  }
}

function glowMaterial(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = Color3.FromHexString(hex);
  m.disableLighting = true;
  return m;
}

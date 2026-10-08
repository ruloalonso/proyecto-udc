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
const HEAVY_TRACER_TIME = 0.18;
const IMPACT_TIME = 0.15;
const EXPLOSION_TIME = 0.4;
const SPLASH_TIME = 0.3;
const NUMBER_TIME = 0.9;
/** Metros que sube un número de daño durante su vida. */
const NUMBER_RISE = 1.2;

interface Timed {
  age: number;
  life: number;
}

interface MeshEffect extends Timed {
  mesh: Mesh;
  /** Animación opcional; `t` va de 0 a 1 a lo largo de su vida. */
  animate?: (t: number) => void;
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
  private readonly heavyTracerMat: StandardMaterial;
  private readonly impactMat: StandardMaterial;
  private readonly grenadeMat: StandardMaterial;
  private readonly explosionMat: StandardMaterial;
  private readonly splashMat: StandardMaterial;
  private readonly projected = new Vector3();
  private readonly lifted = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly overlay: HTMLElement,
  ) {
    this.tracerMat = glowMaterial(scene, "tracer", "#ffd36b");
    this.heavyTracerMat = glowMaterial(scene, "tracer-heavy", "#fff7e0");
    this.impactMat = glowMaterial(scene, "impact", "#fff1c1");
    this.grenadeMat = glowMaterial(scene, "grenade", "#3d4a2a");
    this.explosionMat = glowMaterial(scene, "explosion", "#ff8a2a");
    this.splashMat = glowMaterial(scene, "splash", "#9be04a");
  }

  /**
   * Disparo de `from` a `to`: trazador y destello en el punto de impacto.
   * `heavy` para el disparo apuntado: más grueso y más duradero.
   */
  shot(from: Vector3, to: Vector3, heavy = false): void {
    const tracer = MeshBuilder.CreateTube(
      "tracer",
      { path: [from, to], radius: heavy ? 0.07 : 0.03, tessellation: 6 },
      this.scene,
    );
    tracer.material = heavy ? this.heavyTracerMat : this.tracerMat;
    tracer.isPickable = false;
    this.meshes.push({ mesh: tracer, age: 0, life: heavy ? HEAVY_TRACER_TIME : TRACER_TIME });

    const size = heavy ? 0.6 : 0.35;
    const impact = MeshBuilder.CreateSphere("impact", { diameter: size, segments: 6 }, this.scene);
    impact.position.copyFrom(to);
    impact.material = this.impactMat;
    impact.isPickable = false;
    this.meshes.push({
      mesh: impact,
      age: 0,
      life: IMPACT_TIME,
      animate: (t) => impact.scaling.setAll(1 + t),
    });
  }

  /** Granada en vuelo de `from` a `to` durante `seconds`, en parábola. */
  grenade(from: Vector3, to: Vector3, seconds: number): void {
    const mesh = MeshBuilder.CreateSphere("grenade", { diameter: 0.3, segments: 6 }, this.scene);
    mesh.material = this.grenadeMat;
    mesh.isPickable = false;
    const peak = 2 + Vector3.Distance(from, to) * 0.15;
    const animate = (t: number) => {
      Vector3.LerpToRef(from, to, t, mesh.position);
      mesh.position.y += 4 * peak * t * (1 - t);
    };
    animate(0);
    this.meshes.push({ mesh, age: 0, life: seconds, animate });
  }

  /** Explosión: una bola que crece hasta `radius` y se desvanece. */
  explosion(at: Vector3, radius: number): void {
    const mesh = MeshBuilder.CreateSphere("explosion", { diameter: 2, segments: 12 }, this.scene);
    mesh.material = this.explosionMat;
    mesh.isPickable = false;
    mesh.position.copyFrom(at);
    const animate = (t: number) => {
      mesh.scaling.setAll(radius * Math.sqrt(t));
      mesh.visibility = 1 - t;
    };
    animate(0);
    this.meshes.push({ mesh, age: 0, life: EXPLOSION_TIME, animate });
  }

  /** Salpicadura de un escupitajo al dar a alguien. */
  splash(at: Vector3): void {
    const mesh = MeshBuilder.CreateSphere("splash", { diameter: 1, segments: 8 }, this.scene);
    mesh.material = this.splashMat;
    mesh.isPickable = false;
    mesh.position.copyFrom(at);
    const animate = (t: number) => {
      mesh.scaling.setAll(0.4 + 0.8 * t);
      mesh.visibility = 1 - t;
    };
    animate(0);
    this.meshes.push({ mesh, age: 0, life: SPLASH_TIME, animate });
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
      } else {
        fx.animate?.(fx.age / fx.life);
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

import "../render/babylonModules.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Scene } from "@babylonjs/core/scene.js";
import { GAME_CONFIG } from "@udc/shared";
import { CrabKit } from "../render/crabRig.js";
import { GROUND_COLOR, material, setupAtmosphere } from "../render/look.js";
import { marineMaterials } from "../render/marine.js";
import { createEngine } from "../render/scene.js";
import { CATALOG, type CatalogEntry, type VitrinaContext } from "./catalog.js";
import { MOVEMENT_NAMES, MOVEMENTS, poseAt, type Movement } from "./paths.js";
import { ACTION_NAMES, ACTIONS, type Action } from "./state.js";
import {
  COUNT_MAX,
  parseState,
  SPEED_MAX,
  SPEED_MIN,
  stateToSearch,
  VIEW_NAMES,
  VIEWS,
  type View,
  type VitrinaState,
} from "./state.js";

/**
 * Vitrina de modelos (E7-9): una página de desarrollo para ver cada modelo de cerca, con la
 * misma luz y las mismas funciones que el juego, sin servidor ni partida. `pnpm dev` y
 * http://localhost:5173/vitrina.html. Lo que se ve queda en la dirección: se puede guardar y
 * pasar una vista exacta.
 */

/** Separación entre ejemplares en el modo multitud, en metros (cabe el círculo de 3 m). */
const CROWD_SPACING = 8;
/** Paso de un frame con la pausa puesta, en segundos de juego. */
const FRAME_STEP = 1 / 60;
/** Tamaño del suelo y de la cuadrícula (1 m; más marcada cada 5). */
const GROUND_SIZE = 240;
const GRID_HALF = 20;

const canvas = document.getElementById("vitrina") as HTMLCanvasElement;
const panel = document.getElementById("panel") as HTMLElement;
const statsBox = document.getElementById("stats") as HTMLElement;

const engine = await createEngine(canvas);
const scene = new Scene(engine);
const shadows = setupAtmosphere(scene);
// Sin la niebla del juego: aquí se mira de cerca y, en multitud, de lejos.
scene.fogMode = Scene.FOGMODE_NONE;
const ctx: VitrinaContext = {
  scene,
  shadows,
  crabs: new CrabKit(scene, shadows),
  marines: marineMaterials(scene),
};
const instrumentation = new SceneInstrumentation(scene);

const ground = MeshBuilder.CreateGround(
  "vitrina-ground",
  { width: GROUND_SIZE, height: GROUND_SIZE },
  scene,
);
ground.material = material(scene, "vitrina-ground", GROUND_COLOR);
ground.receiveShadows = true;

/** Cuadrícula de 1 m alrededor del centro, más marcada cada 5 m. */
function grid(step: number, color: string, alpha: number): LinesMesh {
  const lines: Vector3[][] = [];
  for (let i = -GRID_HALF; i <= GRID_HALF; i += step) {
    lines.push([new Vector3(i, 0.004, -GRID_HALF), new Vector3(i, 0.004, GRID_HALF)]);
    lines.push([new Vector3(-GRID_HALF, 0.004, i), new Vector3(GRID_HALF, 0.004, i)]);
  }
  const mesh = MeshBuilder.CreateLineSystem(`grid-${step}`, { lines }, scene);
  mesh.color = Color3.FromHexString(color);
  mesh.alpha = alpha;
  mesh.isPickable = false;
  return mesh;
}
grid(1, "#5e4f40", 0.6);
grid(5, "#3b3027", 0.9);

// Referencias: una figura del tamaño del soldado y el círculo de colisión del modelo.
const { soldier } = GAME_CONFIG;
const human = MeshBuilder.CreateCapsule(
  "vitrina-human",
  { radius: soldier.radius, height: soldier.height, tessellation: 12 },
  scene,
);
human.position.set(-2.5, soldier.height / 2, 0);
const humanMat = material(scene, "vitrina-human", "#9aa4ad");
humanMat.alpha = 0.55;
human.material = humanMat;

function ring(radius: number): LinesMesh {
  const points: Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    points.push(new Vector3(Math.sin(a) * radius, 0.02, Math.cos(a) * radius));
  }
  const mesh = MeshBuilder.CreateLines("vitrina-ring", { points }, scene);
  mesh.color = Color3.FromHexString("#ffd24a");
  mesh.isPickable = false;
  return mesh;
}

const camera = new ArcRotateCamera("vitrina-camera", 0, 1, 5, Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.minZ = 0.05;
camera.lowerRadiusLimit = 0.8;
camera.upperRadiusLimit = 150;
camera.wheelDeltaPercentage = 0.02;
camera.panningSensibility = 400;

// ---- Estado ----

const ids = CATALOG.map((e) => e.id);
let state: VitrinaState = parseState(location.search, ids);
const entryOf = (id: string): CatalogEntry => CATALOG.find((e) => e.id === id) ?? CATALOG[0]!;

/** Ejemplares en escena: su nodo, su desfase en el recorrido y su sitio en la cuadrícula. */
interface Specimen {
  id: number;
  node: TransformNode;
  phase: number;
  dx: number;
  dz: number;
}
let specimens: Specimen[] = [];
let collision: LinesMesh | null = null;
let nextId = 1;
let simTime = 0;
let paused = false;
let autoRotate = false;
/** Cuánto sube o baja el punto al que mira la cámara (flechas ↑ y ↓), en metros. */
let aimLift = 0;

/** Crea los ejemplares del modelo actual (los anteriores ya se han quitado). */
function rebuild(): void {
  const entry = entryOf(state.model);
  collision?.dispose();
  const cols = Math.ceil(Math.sqrt(state.count));
  for (let i = 0; i < state.count; i++) {
    const id = nextId++;
    const node = entry.spawn(ctx, id);
    const col = i % cols;
    const row = Math.floor(i / cols);
    specimens.push({
      id,
      node,
      // Desfases distintos: en multitud no van todos al paso.
      phase: i === 0 ? 0 : ((i * 0.618) % 1) * 7,
      dx: (col - (cols - 1) / 2) * CROWD_SPACING,
      dz: (row - (Math.ceil(state.count / cols) - 1) / 2) * CROWD_SPACING,
    });
  }
  collision = ring(entry.radius);
  applyView(state.view);
}

let builtModel = "";
let builtCount = 0;

function setState(next: Partial<VitrinaState>): void {
  const previous = state;
  state = { ...state, ...next };
  history.replaceState(null, "", stateToSearch(state));
  if (state.model !== builtModel || state.count !== builtCount) {
    // Al cambiar de modelo, los ejemplares viejos los quita el catálogo del modelo viejo.
    const old = entryOf(builtModel || previous.model);
    for (const s of specimens) old.remove(ctx, s.id, s.node);
    specimens = [];
    builtModel = state.model;
    builtCount = state.count;
    rebuild();
  } else if (next.view !== undefined) {
    applyView(state.view);
  }
  scene.forceWireframe = state.wireframe;
  human.setEnabled(state.reference);
  collision?.setEnabled(state.reference && state.count === 1);
  renderPanel();
}

/** Vistas fijas, respecto al mundo: el modelo, a yaw 0, mira hacia +Z (hacia «frente»). */
function applyView(view: View): void {
  const entry = entryOf(state.model);
  const crowd = state.count > 1;
  const cols = Math.ceil(Math.sqrt(state.count));
  camera.radius = crowd ? cols * CROWD_SPACING * 1.2 : Math.max(3, entry.height * 2.5);
  const angles: Record<View, [number, number]> = {
    "tres-cuartos": [Math.PI / 4, 1.1],
    frente: [Math.PI / 2, 1.35],
    lado: [0, 1.35],
    espalda: [-Math.PI / 2, 1.35],
    arriba: [Math.PI / 2, 0.05],
  };
  [camera.alpha, camera.beta] = angles[view];
}

// ---- Panel ----

/** Un elemento con sus propiedades (texto, valor, clase…). */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element, props);
  return element;
}

function renderPanel(): void {
  panel.replaceChildren();
  panel.append(el("h1", { textContent: "Vitrina" }));
  let group = "";
  for (const entry of CATALOG) {
    if (entry.group !== group) {
      group = entry.group;
      panel.append(el("h2", { textContent: group }));
    }
    const button = el("button", {
      className: `vitrina__model${entry.id === state.model ? " vitrina__model--on" : ""}`,
      textContent: entry.name,
    });
    button.addEventListener("click", () => setState({ model: entry.id }));
    panel.append(button);
  }

  panel.append(el("h2", { textContent: "Vista" }));
  const view = el("select");
  for (const v of VIEWS)
    view.append(el("option", { value: v, textContent: VIEW_NAMES[v], selected: v === state.view }));
  view.addEventListener("change", () => setState({ view: view.value as View }));
  panel.append(view);

  panel.append(el("h2", { textContent: "Movimiento" }));
  const movement = el("select");
  for (const m of MOVEMENTS) {
    movement.append(
      el("option", { value: m, textContent: MOVEMENT_NAMES[m], selected: m === state.movement }),
    );
  }
  movement.addEventListener("change", () => setState({ movement: movement.value as Movement }));
  panel.append(movement);

  panel.append(el("h2", { textContent: "Acción" }));
  const action = el("select");
  for (const a of ACTIONS) {
    action.append(
      el("option", { value: a, textContent: ACTION_NAMES[a], selected: a === state.action }),
    );
  }
  action.addEventListener("change", () => setState({ action: action.value as Action }));
  panel.append(action);

  panel.append(el("h2", { textContent: `Velocidad: ${state.speed.toFixed(2)}×` }));
  const speed = el("input", {
    type: "range",
    min: String(SPEED_MIN),
    max: String(SPEED_MAX),
    step: "0.05",
    value: String(state.speed),
  });
  speed.addEventListener("change", () => setState({ speed: Number(speed.value) }));
  panel.append(speed);

  panel.append(el("h2", { textContent: "Cuántos (multitud)" }));
  const count = el("input", {
    type: "number",
    min: "1",
    max: String(COUNT_MAX),
    value: String(state.count),
  });
  count.addEventListener("change", () =>
    setState({ count: Math.max(1, Math.min(COUNT_MAX, Math.round(Number(count.value)) || 1)) }),
  );
  panel.append(count);

  const toggle = (label: string, key: "wireframe" | "reference" | "follow") => {
    const row = el("div", { className: "vitrina__row" });
    const box = el("input", { type: "checkbox", checked: state[key], id: `t-${key}` });
    box.addEventListener("change", () => setState({ [key]: box.checked }));
    row.append(box, el("label", { htmlFor: `t-${key}`, textContent: label }));
    panel.append(row);
  };
  panel.append(el("h2", { textContent: "Ver" }));
  toggle("Alambre", "wireframe");
  toggle("Referencia y colisión", "reference");
  toggle("La cámara le sigue", "follow");

  const buttons = el("div", { className: "vitrina__buttons" });
  const pause = el("button", { textContent: paused ? "Seguir" : "Pausa" });
  pause.addEventListener("click", togglePause);
  const step = el("button", { textContent: "Frame" });
  step.addEventListener("click", stepFrame);
  const copy = el("button", { textContent: "Enlace" });
  copy.addEventListener("click", () => void navigator.clipboard?.writeText(location.href));
  buttons.append(pause, step, copy);
  panel.append(buttons);

  panel.append(
    el("div", {
      className: "vitrina__keys",
      innerHTML:
        "Ratón: orbitar · rueda: zoom · Ctrl + arrastrar: desplazar<br>" +
        "1–5: vistas · ↑ ↓: subir y bajar la mirada<br>Espacio: pausa · . : un frame<br>G: girar la cámara · L: alambre · R: referencia",
    }),
  );
}

function togglePause(): void {
  paused = !paused;
  renderPanel();
}

function stepFrame(): void {
  paused = true;
  simTime += FRAME_STEP * state.speed;
  pendingStep = FRAME_STEP * state.speed;
  renderPanel();
}
let pendingStep = 0;

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const n = Number(e.key);
  if (n >= 1 && n <= VIEWS.length) setState({ view: VIEWS[n - 1]! });
  else if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  } else if (e.key === ".") stepFrame();
  else if (e.code === "KeyG") autoRotate = !autoRotate;
  else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
    e.preventDefault();
    aimLift += e.code === "ArrowUp" ? 0.1 : -0.1;
  } else if (e.code === "KeyL") setState({ wireframe: !state.wireframe });
  else if (e.code === "KeyR") setState({ reference: !state.reference });
});

// ---- Bucle ----

let fpsShown = 0;
let lastStats = 0;
builtModel = state.model;
builtCount = state.count;
rebuild();
setState({});

engine.runRenderLoop(() => {
  const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
  const simDt = paused ? pendingStep : dt * state.speed;
  pendingStep = 0;
  if (!paused) simTime += simDt;
  const entry = entryOf(state.model);
  for (const s of specimens) {
    const p = poseAt(state.movement, simTime + s.phase, entry.speed);
    s.node.position.set(p.x + s.dx, 0, p.z + s.dz);
    s.node.rotation.y = p.yaw;
  }
  for (const s of specimens) entry.update?.(s.id, simDt, state.action, simTime + s.phase);
  ctx.crabs.update(simDt);
  const first = specimens[0];
  if (first && collision) collision.position.set(first.node.position.x, 0, first.node.position.z);
  if (first && state.follow && state.count === 1) {
    camera.target.set(first.node.position.x, entry.height * 0.5 + aimLift, first.node.position.z);
  } else if (state.count > 1) {
    camera.target.set(0, 0, 0);
  }
  if (autoRotate) camera.alpha += dt * 0.4;
  scene.render();

  const now = performance.now();
  if (now - lastStats > 250) {
    lastStats = now;
    fpsShown = engine.getFps();
    statsBox.textContent =
      `${entry.name}${state.count > 1 ? ` × ${state.count}` : ""}\n` +
      `FPS ${fpsShown.toFixed(0)}${paused ? " (pausa)" : ""}\n` +
      `Triángulos del modelo ${Math.round(entry.triangles(ctx)).toLocaleString("es")}\n` +
      `Triángulos en pantalla ${Math.round(scene.getActiveIndices() / 3).toLocaleString("es")}\n` +
      `Llamadas de dibujo ${instrumentation.drawCallsCounter.current}`;
  }
});

window.addEventListener("resize", () => engine.resize());
// Para las capturas automáticas: la vitrina ya ha pintado.
(window as unknown as { vitrinaReady: boolean }).vitrinaReady = true;

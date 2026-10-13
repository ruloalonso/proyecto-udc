import "./babylonModules.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Scene } from "@babylonjs/core/scene.js";
import { GAME_CONFIG } from "@udc/shared";
import type { CrewMember } from "../ui/lobby.js";
import type { AnyEngine } from "./scene.js";

export interface LobbyScene {
  scene: Scene;
  /** Quién está en la bodega: sentados en los bancos; los listos y los bots, de pie. */
  setCrew(crew: readonly CrewMember[]): void;
  render(now: number): void;
}

/** Medidas de la bodega, en metros: ancho, alto y largo, con la rampa al fondo (+Z). */
const HOLD = { width: 6, height: 3.4, length: 18 };
/** Hueco entre reclutas en el banco, y dónde se sienta el primero (lejos de la cámara). */
const SEAT_STEP = 1.6;
const FIRST_SEAT_Z = -1;
/** Reclutas que caben en los bancos (los demás, de pie en la puerta de la cabina). */
const SEATS = 12;

/**
 * La sala de espera en 3D (E6-9): la bodega de la nave de transporte, con bancos a los lados, la
 * rampa cerrada al fondo y luz roja de combate. Escena aparte de la del juego, con su cámara;
 * solo se dibuja mientras se espera.
 */
export function createLobbyScene(engine: AnyEngine): LobbyScene {
  const scene = new Scene(engine);
  scene.doNotHandleCursors = true;
  scene.skipPointerMovePicking = true;
  scene.clearColor = new Color4(0.03, 0.03, 0.035, 1);
  const camera = new FreeCamera("lobby-camera", new Vector3(0, 2.3, -7.6), scene);
  camera.setTarget(new Vector3(0, 1.1, 5));
  camera.fov = 1.0;

  const mat = (name: string, hex: string, emissive = false) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    if (emissive) m.emissiveColor = Color3.FromHexString(hex);
    return m;
  };
  const hull = mat("lobby-hull", "#3a4046");
  const metal = mat("lobby-metal", "#22262a");
  const stripe = mat("lobby-stripe", "#8c1c13", true);

  // El casco, visto desde dentro.
  const box = MeshBuilder.CreateBox(
    "lobby-hold",
    {
      width: HOLD.width,
      height: HOLD.height,
      depth: HOLD.length,
      sideOrientation: Mesh.BACKSIDE,
    },
    scene,
  );
  box.position.set(0, HOLD.height / 2, 1);
  box.material = hull;
  // Cuadernas en el techo y bancos corridos a cada lado.
  for (let z = -7; z <= 9; z += 2) {
    const rib = MeshBuilder.CreateBox(
      "lobby-rib",
      { width: HOLD.width, height: 0.2, depth: 0.25 },
      scene,
    );
    rib.position.set(0, HOLD.height - 0.1, z);
    rib.material = metal;
  }
  for (const side of [-1, 1]) {
    const bench = MeshBuilder.CreateBox(
      "lobby-bench",
      { width: 0.7, height: 0.45, depth: 14 },
      scene,
    );
    bench.position.set(side * (HOLD.width / 2 - 0.45), 0.225, 0.5);
    bench.material = metal;
  }
  // La rampa, cerrada, con su franja roja.
  const ramp = MeshBuilder.CreateBox("lobby-ramp", { width: 4, height: 3, depth: 0.2 }, scene);
  ramp.position.set(0, 1.5, HOLD.length / 2 + 0.85);
  ramp.material = metal;
  const band = MeshBuilder.CreateBox("lobby-band", { width: 4, height: 0.25, depth: 0.05 }, scene);
  band.position.set(0, 2.2, HOLD.length / 2 + 0.72);
  band.material = stripe;

  new HemisphericLight("lobby-ambient", new Vector3(0, 1, 0), scene).intensity = 0.6;
  const reds = [-5, 1, 7].map((z) => {
    const light = new PointLight("lobby-red", new Vector3(0, HOLD.height - 0.4, z), scene);
    light.diffuse = new Color3(1, 0.15, 0.1);
    light.range = 9;
    return light;
  });

  const { radius, height } = GAME_CONFIG.soldier;
  const youMat = mat("lobby-you", "#c9a227");
  const otherMat = mat("lobby-other", "#6c7f8f");
  const botMat = mat("lobby-bot", "#4a5056");
  let crewMeshes: AbstractMesh[] = [];
  let crewKey = "";

  function setCrew(crew: readonly CrewMember[]): void {
    const key = JSON.stringify(crew);
    if (key === crewKey) return;
    crewKey = key;
    for (const m of crewMeshes) m.dispose(false, true);
    crewMeshes = [];
    crew.slice(0, SEATS).forEach((member, i) => {
      // Uno a cada lado, de delante hacia la rampa.
      const side = i % 2 === 0 ? -1 : 1;
      const z = FIRST_SEAT_Z + Math.floor(i / 2) * SEAT_STEP;
      const body = MeshBuilder.CreateCapsule(
        `lobby-crew-${i}`,
        { radius, height, tessellation: 12 },
        scene,
      );
      body.material = member.you ? youMat : member.bot ? botMat : otherMat;
      // Sentado en el banco, o de pie en el pasillo si está listo.
      const x = member.ready ? side * 1.4 : side * (HOLD.width / 2 - 0.45);
      const y = member.ready ? height / 2 : 0.45 + height / 2 - 0.35;
      body.position.set(x, y, z);
      crewMeshes.push(body);
      // Los bots, sin cartel: en fila, los carteles se amontonan; los explica la lista.
      if (member.bot) return;
      const label = MeshBuilder.CreatePlane(`lobby-label-${i}`, { width: 1.6, height: 0.4 }, scene);
      label.position.set(x, y + height / 2 + 0.35, z);
      label.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const texture = new DynamicTexture(`lobby-label-tex-${i}`, { width: 256, height: 64 }, scene);
      texture.hasAlpha = true;
      texture.drawText(
        member.nick,
        null,
        44,
        "bold 34px Oswald, sans-serif",
        member.you ? "#ffd24a" : "#e6e0cf",
        "transparent",
        true,
      );
      const labelMat = new StandardMaterial(`lobby-label-mat-${i}`, scene);
      labelMat.diffuseTexture = texture;
      labelMat.emissiveColor = Color3.White();
      labelMat.disableLighting = true;
      labelMat.backFaceCulling = false;
      label.material = labelMat;
      crewMeshes.push(label);
    });
  }

  function render(now: number): void {
    // Luz de combate que late despacio.
    const pulse = 0.55 + 0.25 * Math.sin(now / 700);
    for (const light of reds) light.intensity = pulse;
    scene.render();
  }

  return { scene, setCrew, render };
}

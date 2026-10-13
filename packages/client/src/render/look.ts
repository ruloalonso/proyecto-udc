import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Scene } from "@babylonjs/core/scene.js";

/**
 * El aspecto del mundo: cielo, niebla, luces, sombras y materiales. Lo comparten la escena del
 * juego y la vitrina de modelos (E7-9), para que en la vitrina se vea lo mismo que en partida.
 */

export const color = (hex: string) => Color3.FromHexString(hex);

/** Material mate de un color. */
export function material(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color(hex);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  return m;
}

/** Cielo de polvo rojizo, niebla, luz ambiente y sol con sombras. */
export function setupAtmosphere(scene: Scene): ShadowGenerator {
  // Cielo de polvo rojizo: un planeta colonia en las últimas.
  scene.clearColor = Color4.FromHexString("#5a3a2eff");
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.006;
  scene.fogColor = color("#5a3a2e");

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  hemi.groundColor = color("#3b2a22");

  const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene);
  sun.position = new Vector3(40, 80, -30);
  sun.intensity = 0.9;
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  return shadows;
}

/** Color del suelo del planeta. */
export const GROUND_COLOR = "#7d6a55";

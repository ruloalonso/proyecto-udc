/**
 * Babylon por módulos (E2-9): el cliente importa cada pieza de su archivo, no el paquete entero
 * (~6 MB). Algunos módulos no exportan nada que se use, sino que se enganchan a otras clases al
 * importarlos: van aquí, todos juntos, para que no se pierda ninguno. Si falta uno, Babylon lo
 * dice en la consola («… needs to be imported before …»).
 */
// scene.pick y scene.pickWithRay: el clic, el cursor y la cámara que no atraviesa los muros.
import "@babylonjs/core/Culling/ray.js";
// mesh.createInstance: centollos, escupidores, escupitajos, colonos y restos.
import "@babylonjs/core/Meshes/instancedMesh.js";
// Las sombras del sol.
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
// mesh.thinInstanceSetBuffer: las patas de los centollos (E8-2).
import "@babylonjs/core/Meshes/thinInstanceMesh.js";

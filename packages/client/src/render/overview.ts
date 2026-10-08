/**
 * Distancia de la cámara cenital (E5-5) para que quepa un mapa cuadrado de `mapSize` metros,
 * con un margen. `fov` es el campo de visión vertical (radianes) y `aspect`, ancho / alto.
 */
export function overviewRadius(
  mapSize: number,
  fov: number,
  aspect: number,
  margin = 1.05,
): number {
  const half = (mapSize / 2) * margin;
  const tan = Math.tan(fov / 2);
  // Lo que limite más: el alto o el ancho de la pantalla.
  return Math.max(half / tan, half / (tan * aspect));
}

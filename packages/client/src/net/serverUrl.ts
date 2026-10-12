/**
 * Dirección del servidor (E7-6). Con `VITE_SERVER_URL`, esa. En desarrollo (`pnpm dev`), el
 * servidor va aparte, en el puerto 8080 de la misma máquina. Desplegado, el servidor sirve
 * también el cliente: la misma dirección de la que viene la página, en `/ws`, con `wss://` si
 * la página llega por HTTPS (un túnel o un proxy inverso).
 */
export function serverUrl(
  env: { VITE_SERVER_URL?: string; DEV: boolean },
  location: { protocol: string; hostname: string; host: string },
): string {
  if (env.VITE_SERVER_URL) return env.VITE_SERVER_URL;
  if (env.DEV) return `ws://${location.hostname}:8080`;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

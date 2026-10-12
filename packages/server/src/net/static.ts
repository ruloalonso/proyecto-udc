import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

/** Tipos de los archivos que genera `vite build` (y los sonidos de `public`). */
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ogg": "audio/ogg",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".md": "text/plain; charset=utf-8",
};

/**
 * Ruta del archivo que pide `urlPath` dentro de `root`, o `null` si sale de ella (`..`,
 * codificaciones raras) o no es de un tipo que se sirva. `/` es `index.html`.
 */
export function resolveStaticPath(root: string, urlPath: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(urlPath, "http://x").pathname);
  } catch {
    return null;
  }
  if (path.includes("\0")) return null;
  if (path.endsWith("/")) path += "index.html";
  const base = resolve(root);
  const file = resolve(base, `.${path}`);
  if (!file.startsWith(base + sep)) return null;
  return TYPES[extname(file).toLowerCase()] ? file : null;
}

/**
 * Sirve el cliente compilado desde `root` (E7-6): solo GET y HEAD, solo archivos de su carpeta
 * y de los tipos conocidos. Lo que lleva huella en el nombre (`assets/`) se guarda en caché; el
 * resto se vuelve a pedir.
 */
export function staticHandler(root: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const file = resolveStaticPath(root, req.url ?? "/");
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file).toLowerCase()]!,
        "Content-Length": body.length,
        "Cache-Control": file.includes(`${sep}assets${sep}`)
          ? "public, max-age=31536000, immutable"
          : "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404).end();
    }
  };
}

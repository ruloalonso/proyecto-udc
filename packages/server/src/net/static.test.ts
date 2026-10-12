import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStaticPath } from "./static.js";

const root = resolve("/srv/udc/dist");

describe("servir el cliente (E7-6)", () => {
  it("la raíz es index.html y los archivos, los de su carpeta", () => {
    expect(resolveStaticPath(root, "/")).toBe(join(root, "index.html"));
    expect(resolveStaticPath(root, "/assets/index-abc.js?v=1")).toBe(
      join(root, "assets", "index-abc.js"),
    );
    expect(resolveStaticPath(root, "/sounds/shot.ogg")).toBe(join(root, "sounds", "shot.ogg"));
  });

  it("no sale de su carpeta, ni con ../ ni codificado", () => {
    expect(resolveStaticPath(root, "/../../etc/passwd")).toBeNull();
    expect(resolveStaticPath(root, "/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(resolveStaticPath(root, "/assets/..%2F..%2F..%2Fetc%2Fhosts")).toBeNull();
    expect(resolveStaticPath(root, "/a%00.js")).toBeNull();
    expect(resolveStaticPath(root, "/%E0%A4%A")).toBeNull();
  });

  it("solo sirve los tipos que genera el cliente", () => {
    expect(resolveStaticPath(root, "/.env")).toBeNull();
    expect(resolveStaticPath(root, "/server.ts")).toBeNull();
    expect(resolveStaticPath(root, "/assets")).toBeNull();
  });
});

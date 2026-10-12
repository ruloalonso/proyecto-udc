import { describe, expect, it } from "vitest";
import { serverUrl } from "./serverUrl.js";

const page = (protocol: string, host: string) => ({
  protocol,
  host,
  hostname: host.split(":")[0]!,
});

describe("dirección del servidor (E7-6)", () => {
  it("en desarrollo, el puerto 8080 de la misma máquina", () => {
    expect(serverUrl({ DEV: true }, page("http:", "192.168.1.20:5173"))).toBe(
      "ws://192.168.1.20:8080",
    );
  });

  it("desplegado, la misma dirección en /ws, segura si la página lo es", () => {
    expect(serverUrl({ DEV: false }, page("https:", "algo.trycloudflare.com"))).toBe(
      "wss://algo.trycloudflare.com/ws",
    );
    expect(serverUrl({ DEV: false }, page("http:", "nas.local:8090"))).toBe(
      "ws://nas.local:8090/ws",
    );
  });

  it("VITE_SERVER_URL manda siempre", () => {
    expect(serverUrl({ DEV: true, VITE_SERVER_URL: "ws://otro:9000" }, page("http:", "x"))).toBe(
      "ws://otro:9000",
    );
  });
});

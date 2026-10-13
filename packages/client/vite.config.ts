import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173, host: true },
  // La vitrina de modelos (E7-9) también, al arrancar: si Vite descubre sus dependencias al
  // abrirla, recarga a mitad de carga. Solo en desarrollo: la compilación sigue siendo el juego.
  optimizeDeps: { entries: ["index.html", "vitrina.html"] },
});

import type { AdminCommand } from "@udc/shared";

/** Teclas de los comandos de administración (E7-3). Solo con el panel F3 abierto. */
const ADMIN_KEYS: Record<string, AdminCommand> = {
  KeyI: "invulnerable",
  KeyK: "killAll",
  KeyN: "nextPhase",
  KeyO: "nextPush",
  KeyP: "finalWave",
};

/** Comando de una tecla (`KeyboardEvent.code`), o `null` si no es de administración. */
export const adminCommandFor = (code: string): AdminCommand | null => ADMIN_KEYS[code] ?? null;

/** Ayuda que muestra el panel F3. */
export const ADMIN_HELP = "[I] invulnerable · [K] matar · [N] fase · [O] oleada · [P] final";

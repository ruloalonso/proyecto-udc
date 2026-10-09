import texts from "../texts/sargento.json";

/**
 * Sargento (E6-6, spec §4.8): solo texto, sin mecánica. Comenta la partida en un panel propio;
 * los avisos genéricos siguen saliendo como siempre.
 *
 * Los textos están en `texts/sargento.json` (se cambian sin tocar código): el nombre y, para
 * cada momento, varias frases con huecos `{recluta}`, `{colonos}`, `{lanzadera}` y `{madriguera}`.
 */

/** Momentos en los que habla. */
export type SergeantMoment =
  | "start"
  | "death"
  | "launch"
  | "launchEmpty"
  | "firstSpitter"
  | "burrowWarning"
  | "finalWave"
  | "lastDeath"
  | "result";

/** Datos con los que se rellenan los huecos de las frases. */
export type SergeantParams = Partial<
  Record<"recluta" | "colonos" | "lanzadera" | "madriguera", string | number>
>;

export interface SergeantTexts {
  name: string;
  lines: Record<SergeantMoment, string[]>;
}

export const SERGEANT_TEXTS: SergeantTexts = texts;

/** Importancia de cada momento: si se acumulan frases, se descartan antes las menos importantes. */
const PRIORITY: Record<SergeantMoment, number> = {
  death: 0,
  start: 1,
  burrowWarning: 1,
  firstSpitter: 2,
  launch: 2,
  launchEmpty: 2,
  finalWave: 3,
  lastDeath: 3,
  result: 3,
};

/** Frases en espera como mucho (además de la que se muestra). */
const MAX_QUEUED = 3;

/**
 * La frase de un momento. Se elige con el tick del servidor, no al azar: todos los jugadores
 * leen la misma.
 */
export function sergeantLine(
  moment: SergeantMoment,
  tick: number,
  params: SergeantParams = {},
  source: SergeantTexts = SERGEANT_TEXTS,
): string {
  const options = source.lines[moment];
  const index = Math.abs(Math.imul(Math.floor(tick), 2654435761)) % options.length;
  return fillLine(options[index]!, params);
}

/** Rellena los huecos `{nombre}`; los que no tienen dato se quedan como están. */
export function fillLine(template: string, params: SergeantParams): string {
  return template.replace(/\{(\w+)\}/g, (hole, key: string) => {
    const value = params[key as keyof SergeantParams];
    return value === undefined ? hole : String(value);
  });
}

/** Segundos que se muestra una frase, según lo larga que sea. */
export function lineSeconds(text: string): number {
  return Math.min(9, Math.max(4, 2.5 + text.length * 0.05));
}

interface Queued {
  text: string;
  priority: number;
}

/**
 * Cola de frases: una a la vez, cada una el tiempo que pida su longitud. Si se acumulan
 * demasiadas, se descarta la menos importante (la más antigua, si empatan).
 */
export class SergeantQueue {
  private queue: Queued[] = [];
  private current: { text: string; until: number } | null = null;

  push(moment: SergeantMoment, text: string): void {
    this.queue.push({ text, priority: PRIORITY[moment] });
    if (this.queue.length <= MAX_QUEUED) return;
    let drop = 0;
    for (let i = 1; i < this.queue.length; i++) {
      if (this.queue[i]!.priority < this.queue[drop]!.priority) drop = i;
    }
    this.queue.splice(drop, 1);
  }

  /** La frase que toca mostrar en el instante `now` (en segundos), o `null`. */
  show(now: number): string | null {
    if (this.current && now < this.current.until) return this.current.text;
    const next = this.queue.shift();
    this.current = next ? { text: next.text, until: now + lineSeconds(next.text) } : null;
    return this.current?.text ?? null;
  }

  clear(): void {
    this.queue = [];
    this.current = null;
  }
}

/** Panel del sargento en el HUD: su nombre y la frase de turno. */
export class SergeantPanel {
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;
  private readonly queue = new SergeantQueue();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "sergeant";
    this.root.hidden = true;
    const name = document.createElement("div");
    name.className = "sergeant__name";
    name.textContent = SERGEANT_TEXTS.name;
    this.text = document.createElement("div");
    this.text.className = "sergeant__text";
    this.root.append(name, this.text);
    parent.append(this.root);
  }

  /** El sargento dice la frase de `moment` (elegida con el tick del servidor). */
  say(moment: SergeantMoment, tick: number, params?: SergeantParams): void {
    this.queue.push(moment, sergeantLine(moment, tick, params));
  }

  /** Llamar cada fotograma. `now`: en milisegundos. */
  update(now: number): void {
    const line = this.queue.show(now / 1000);
    this.root.hidden = line === null;
    if (line !== null && this.text.textContent !== line) this.text.textContent = line;
  }

  /** Partida nueva: se calla lo pendiente. */
  clear(): void {
    this.queue.clear();
  }
}

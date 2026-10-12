import { GAME_CONFIG, MAP, type MatchReport } from "@udc/shared";
import texts from "../texts/noticiario.json";
import { clock } from "./match.js";
import { fillLine, pickLine, type SergeantMoment } from "./sergeant.js";

/**
 * Noticiario de resultado (E6-4, spec §3.1): la propaganda del Estado cuenta cómo ha ido. La
 * puntuación es del pelotón (colonos a salvo); el parte de bajas dice qué hizo cada soldado,
 * de más a menos enemigos abatidos.
 *
 * Los textos están en `texts/noticiario.json` (se cambian sin tocar código), con los huecos
 * `{colonos}`, `{total}`, `{tiempo}` y `{listos}`.
 */

export type Verdict = "massacre" | "retreat" | "heroic";

export interface NewsreelTexts {
  header: string;
  verdicts: Record<Verdict, { label: string; headlines: string[]; leads: string[] }>;
  figures: Record<"saved" | "crabs" | "fallen" | "survived", string>;
  roll: Record<"title" | "recruit" | "player" | "kills" | "rescues" | "bot", string>;
  rematch: Record<"button" | "key" | "waiting" | "status", string>;
}

export const NEWSREEL_TEXTS: NewsreelTexts = texts;

/** Colonos de la partida: los de todos los edificios. */
export const TOTAL_COLONISTS = GAME_CONFIG.colonists.perBuilding * MAP.routes.length;

/** Masacre, retirada o evacuación heroica, según la fracción de colonos a salvo. */
export function verdictFor(saved: number, total = TOTAL_COLONISTS): Verdict {
  const { retreat, heroic } = GAME_CONFIG.match.verdict;
  const share = total > 0 ? saved / total : 0;
  if (share >= heroic) return "heroic";
  return share >= retreat ? "retreat" : "massacre";
}

/** La despedida del sargento según el veredicto. */
export const FAREWELL: Record<Verdict, SergeantMoment> = {
  massacre: "resultMassacre",
  retreat: "resultRetreat",
  heroic: "resultHeroic",
};

export interface NewsreelData {
  saved: number;
  survivedSeconds: number;
  report: MatchReport;
  /** Tick del servidor con el que se eligen las frases: todos leen las mismas. */
  tick: number;
}

/** Lo que se pinta: todo el texto ya resuelto. */
export interface NewsreelView {
  verdict: Verdict;
  label: string;
  headline: string;
  lead: string;
  figures: { label: string; value: string }[];
  roll: { name: string; player: string; kills: number; rescues: number }[];
}

export function newsreelView(
  { saved, survivedSeconds, report, tick }: NewsreelData,
  source: NewsreelTexts = NEWSREEL_TEXTS,
  total = TOTAL_COLONISTS,
): NewsreelView {
  const verdict = verdictFor(saved, total);
  const v = source.verdicts[verdict];
  const params = { colonos: saved, total, tiempo: clock(survivedSeconds) };
  return {
    verdict,
    label: v.label,
    headline: fillLine(pickLine(v.headlines, tick), params),
    lead: fillLine(pickLine(v.leads, tick), params),
    figures: [
      { label: source.figures.saved, value: `${saved} / ${total}` },
      { label: source.figures.crabs, value: String(report.crabsKilled) },
      { label: source.figures.fallen, value: String(report.soldiers.length) },
      { label: source.figures.survived, value: clock(survivedSeconds) },
    ],
    // De más a menos abatidos; a igualdad, en el orden en que cayeron (el del servidor, que el
    // clímax usa para saber quién cayó el último).
    roll: [...report.soldiers]
      .sort((a, b) => b.kills - a.kills)
      .map((s) => ({
        name: s.name,
        player: s.nick ?? source.roll.bot,
        kills: s.kills,
        rescues: s.rescues,
      })),
  };
}

/** Quién está listo para la siguiente partida (E6-5). */
export interface RematchState {
  ready: number;
  total: number;
  /** Este jugador ya ha pulsado «Volver a filas». */
  you: boolean;
}

/** Cuántos están listos; jugando solo no hace falta decirlo. */
export function rematchText(
  { ready, total }: RematchState,
  source: NewsreelTexts = NEWSREEL_TEXTS,
): string {
  if (total <= 1) return "";
  return fillLine(source.rematch.status, { listos: ready, total });
}

/**
 * Pantalla del noticiario. Entra con un fundido (el final del clímax) y tapa el mundo. La
 * siguiente partida empieza cuando todos han pulsado «Volver a filas» (E6-5).
 */
export class Newsreel {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private pressed = false;
  /** Al pulsar «Volver a filas» (con el ratón o con Intro). */
  onRematch: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "newsreel";
    this.root.hidden = true;
    this.root.style.animationDuration = `${GAME_CONFIG.match.climax.fadeSeconds}s`;
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "newsreel__rematch";
    this.button.addEventListener("click", () => this.press());
    this.status = document.createElement("div");
    this.status.className = "newsreel__next";
    this.resetButton();
    parent.append(this.root);
  }

  /** `sergeant`: la despedida del sargento (E6-6), con su nombre. */
  show(view: NewsreelView, sergeant: { name: string; line: string }): void {
    const el = (tag: string, cls: string, text = "") => {
      const e = document.createElement(tag);
      e.className = cls;
      e.textContent = text;
      return e;
    };
    const figures = el("div", "newsreel__figures");
    for (const f of view.figures) {
      const fig = el("div", "newsreel__figure");
      fig.append(el("div", "newsreel__value", f.value), el("div", "newsreel__label", f.label));
      figures.append(fig);
    }
    const t = NEWSREEL_TEXTS.roll;
    const table = document.createElement("table");
    table.className = "newsreel__roll";
    const head = table.createTHead().insertRow();
    for (const h of [t.recruit, t.player, t.kills, t.rescues]) {
      head.append(el("th", "", h));
    }
    const body = table.createTBody();
    for (const s of view.roll) {
      const row = body.insertRow();
      for (const value of [s.name, s.player, String(s.kills), String(s.rescues)]) {
        row.append(el("td", "", value));
      }
    }
    this.root.className = `newsreel newsreel--${view.verdict}`;
    this.root.replaceChildren(
      el("div", "newsreel__header", NEWSREEL_TEXTS.header),
      el("div", "newsreel__verdict", view.label),
      el("div", "newsreel__headline", view.headline),
      el("div", "newsreel__lead", view.lead),
      figures,
      el("div", "newsreel__roll-title", t.title),
      table,
      el("div", "newsreel__sergeant", `«${sergeant.line}» — ${sergeant.name}`),
      this.button,
      this.status,
    );
    this.root.hidden = false;
  }

  /** «Volver a filas»: una vez por partida. */
  press(): void {
    if (this.pressed || this.root.hidden) return;
    this.pressed = true;
    this.button.disabled = true;
    this.button.textContent = NEWSREEL_TEXTS.rematch.waiting;
    this.onRematch();
  }

  /** Lo que dice el servidor de quién está listo. */
  setRematch(state: RematchState): void {
    if (state.you && !this.pressed) {
      this.pressed = true;
      this.button.disabled = true;
      this.button.textContent = NEWSREEL_TEXTS.rematch.waiting;
    }
    this.status.textContent = rematchText(state);
  }

  hide(): void {
    this.root.hidden = true;
    this.resetButton();
  }

  private resetButton(): void {
    const { button, key } = NEWSREEL_TEXTS.rematch;
    this.pressed = false;
    this.button.disabled = false;
    this.button.textContent = button;
    const hint = document.createElement("span");
    hint.className = "newsreel__key";
    hint.textContent = key;
    this.button.append(hint);
    this.status.textContent = "";
  }

  get isShown(): boolean {
    return !this.root.hidden;
  }
}

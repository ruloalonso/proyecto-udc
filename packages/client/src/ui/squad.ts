import { GAME_CONFIG } from "@udc/shared";

/**
 * Panel del pelotón (E2-6): arriba a la izquierda, los soldados de la partida con su vida; los
 * derribados, con su cuenta atrás y si alguien les rescata; los muertos, tachados hasta la
 * partida siguiente, para que se vea la sangría.
 */

/** Un soldado en pie o derribado, tal como lo sabe el cliente. */
export interface SquadMemberInput {
  id: number;
  /** Lo que se ve: el apodo de un jugador («Rulo #2») o el recluta, con «(bot)» si es un bot. */
  label: string;
  hp: number;
  /** Derribado: segundos que le quedan (`null` si no se sabe); en pie, `undefined`. */
  downedLeft?: number | null;
  rescuing?: boolean;
  me?: boolean;
}

export interface SquadRow {
  id: number;
  label: string;
  /** Vida de 0 a 1. */
  hp: number;
  state: "ok" | "downed" | "dead";
  /** Debajo o al lado del nombre: la cuenta atrás, «rescatando» o «caído». */
  detail: string;
  me: boolean;
}

/** Las filas, en orden fijo (por id: el orden de alistamiento), vivos y muertos juntos. */
export function squadRows(
  members: readonly SquadMemberInput[],
  fallen: ReadonlyMap<number, string>,
): SquadRow[] {
  const rows: SquadRow[] = members.map((m) => {
    const downed = m.downedLeft !== undefined;
    const detail = !downed
      ? ""
      : m.rescuing
        ? "rescatando"
        : m.downedLeft === null
          ? "derribado"
          : `${Math.max(0, Math.ceil(m.downedLeft ?? 0))} s`;
    return {
      id: m.id,
      label: m.label,
      hp: Math.max(0, Math.min(1, m.hp / GAME_CONFIG.soldier.health)),
      state: downed ? "downed" : "ok",
      detail,
      me: m.me ?? false,
    };
  });
  for (const [id, label] of fallen) {
    if (rows.some((r) => r.id === id)) continue;
    rows.push({ id, label, hp: 0, state: "dead", detail: "caído", me: false });
  }
  return rows.sort((a, b) => a.id - b.id);
}

/** El panel en el HUD. */
export class SquadPanel {
  private readonly root: HTMLElement;
  private readonly rows: {
    el: HTMLElement;
    name: HTMLElement;
    detail: HTMLElement;
    fill: HTMLElement;
  }[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "squad";
    parent.append(this.root);
  }

  update(rows: readonly SquadRow[]): void {
    this.root.hidden = rows.length === 0;
    while (this.rows.length < rows.length) {
      const el = document.createElement("div");
      const name = document.createElement("span");
      name.className = "squad__name";
      const detail = document.createElement("span");
      detail.className = "squad__detail";
      const bar = document.createElement("div");
      bar.className = "squad__bar";
      const fill = document.createElement("div");
      fill.className = "squad__fill";
      bar.append(fill);
      el.append(name, detail, bar);
      this.root.append(el);
      this.rows.push({ el, name, detail, fill });
    }
    this.rows.forEach((r, i) => {
      const row = rows[i];
      r.el.hidden = !row;
      if (!row) return;
      const cls = `squad__row squad__row--${row.state}${row.me ? " squad__row--me" : ""}`;
      if (r.el.className !== cls) r.el.className = cls;
      if (r.name.textContent !== row.label) r.name.textContent = row.label;
      if (r.detail.textContent !== row.detail) r.detail.textContent = row.detail;
      r.fill.style.width = `${Math.round(row.hp * 100)}%`;
    });
  }
}

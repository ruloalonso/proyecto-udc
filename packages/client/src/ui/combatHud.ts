import { AbilityId } from "@udc/shared";
import type { SlotCooldown } from "./combatRules.js";

export interface TargetView {
  name: string;
  hp: number;
  maxHp: number;
  distance: number;
  /** Por qué no se le dispara ahora (texto), o `null`. */
  status: string | null;
}

export interface SlotView {
  id: AbilityId;
  cooldown: SlotCooldown;
  /** No se puede usar ahora (se atenúa). */
  blocked: boolean;
}

export interface CombatHudView {
  hp: number;
  maxHp: number;
  target: TargetView | null;
  slots: SlotView[];
}

const SLOTS: { id: AbilityId; name: string }[] = [
  { id: AbilityId.AimedShot, name: "Disparo apuntado" },
  { id: AbilityId.Grenade, name: "Granada" },
  { id: AbilityId.Stim, name: "Estimulante" },
];

interface Bar {
  fill: HTMLElement;
  value: HTMLElement;
}

interface SlotEls {
  root: HTMLElement;
  sweep: HTMLElement;
  cd: HTMLElement;
}

const el = <T extends HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector(selector) as T;

/** Cambia un texto solo si es distinto (evita trabajo del navegador en cada frame). */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * HUD de combate (E3-4): vida propia, marco del objetivo, barra de habilidades con
 * enfriamientos, avisos y destello al recibir daño. Solo dibuja: los datos los da main.
 */
export class CombatHud {
  private readonly playerBar: Bar;
  private readonly targetFrame = el("#target-frame");
  private readonly targetName = el(".frame__name", this.targetFrame);
  private readonly targetBar: Bar;
  private readonly targetInfo = el(".frame__info", this.targetFrame);
  private readonly alertBox = el("#alert");
  private readonly damageFlash = el("#damage-flash");
  private readonly slots = new Map<AbilityId, SlotEls>();

  constructor() {
    this.playerBar = barOf(el("#player-frame"));
    this.targetBar = barOf(this.targetFrame);

    const actionbar = el("#actionbar");
    for (const { id, name } of SLOTS) {
      const root = document.createElement("div");
      root.className = "slot";
      root.innerHTML =
        `<span class="slot__key">${id}</span><span class="slot__name">${name}</span>` +
        `<div class="slot__sweep"></div><span class="slot__cd"></span>`;
      actionbar.append(root);
      this.slots.set(id, { root, sweep: el(".slot__sweep", root), cd: el(".slot__cd", root) });
    }
  }

  /** Llamar cada frame. */
  update(view: CombatHudView): void {
    setBar(this.playerBar, view.hp, view.maxHp);

    this.targetFrame.hidden = view.target === null;
    if (view.target) {
      const t = view.target;
      setText(this.targetName, t.name);
      setBar(this.targetBar, t.hp, t.maxHp);
      setText(this.targetInfo, `${Math.round(t.distance)} m${t.status ? ` · ${t.status}` : ""}`);
      this.targetInfo.classList.toggle("frame__info--blocked", t.status !== null);
    }

    for (const slot of view.slots) {
      const els = this.slots.get(slot.id);
      if (!els) continue;
      els.sweep.style.setProperty("--cd", String(slot.cooldown.fraction));
      setText(els.cd, slot.cooldown.label);
      els.root.classList.toggle("slot--blocked", slot.blocked);
    }
  }

  /** Aviso breve en el centro de la pantalla ("Fuera de alcance"...). */
  alert(text: string): void {
    this.alertBox.textContent = text;
    restartAnimation(this.alertBox, "hud__alert--show");
  }

  /** Destello rojo en los bordes al recibir daño (FR-14). */
  flashDamage(): void {
    restartAnimation(this.damageFlash, "hud__damage-flash--show");
  }
}

function barOf(frame: HTMLElement): Bar {
  return { fill: el(".frame__fill", frame), value: el(".frame__value", frame) };
}

function setBar(bar: Bar, hp: number, maxHp: number): void {
  const shown = Math.max(0, hp);
  bar.fill.style.width = `${(Math.min(shown, maxHp) / maxHp) * 100}%`;
  setText(bar.value, `${shown} / ${maxHp}`);
}

/** Vuelve a lanzar una animación CSS aunque ya estuviera en marcha. */
function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth; // fuerza el recálculo para que la animación empiece de nuevo
  node.classList.add(className);
}

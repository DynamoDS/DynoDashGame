import Phaser from "phaser";
import type { Player } from "../entities/Player";
import { QUESTIONS, type TriviaQuestion } from "./questions";
import { LIVES_MAX } from "../config/GameConfig";
import { REG_LIVES } from "../config/registryKeys";

type OptionKey = "A" | "B" | "C" | "D";
const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

/** Apply a plain object of camelCase style values to an element. */
function css(el: HTMLElement, styles: Record<string, string>): void {
  for (const [k, v] of Object.entries(styles)) {
    el.style.setProperty(k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), v);
  }
}

export class TriviaSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;

  private nodesCollected = 0;
  private isActive = false;
  private answered = false;
  private usedIndices = new Set<number>();

  // World-space Phaser objects (NPC sprite)
  private worldObjects: Phaser.GameObjects.GameObject[] = [];

  // DOM overlay state
  private overlayEl: HTMLElement | null = null;
  private optionButtons = new Map<OptionKey, HTMLButtonElement>();
  private keyboardCallback?: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
  }

  /** Call each time the player collects a node/coin. */
  onNodeCollected(worldX: number, worldY: number): void {
    if (this.isActive) return;
    this.nodesCollected++;
    if (this.nodesCollected % 5 === 0) {
      this.trigger(worldX, worldY);
    }
  }

  /** Must be called from GameScene.shutdown() to clean up the DOM overlay. */
  destroy(): void {
    this.dismiss();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private trigger(x: number, y: number): void {
    this.isActive = true;
    this.answered = false;
    this.player.freeze();
    const question = this.pickQuestion();
    this.spawnNPC(x, y);
    this.showPopup(question);
  }

  private pickQuestion(): TriviaQuestion {
    const available = QUESTIONS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      QUESTIONS.forEach((_, i) => available.push(i));
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    return QUESTIONS[idx];
  }

  private spawnNPC(x: number, y: number): void {
    const npc = this.scene.add.sprite(x - 36, y - 8, "npc_jacob").setDepth(10);
    this.worldObjects.push(npc);
  }

  // ── DOM overlay (renders at native browser resolution, not pixelated) ──────

  private showPopup(question: TriviaQuestion): void {
    // Full-viewport backdrop — a real DOM element, not a Phaser canvas draw
    const overlay = document.createElement("div");
    css(overlay, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(3, 8, 18, 0.90)",
      zIndex: "9999",
      fontFamily: "'Courier New', 'Lucida Console', 'Consolas', monospace",
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    });

    // ── Card ─────────────────────────────────────────────────────────────
    const card = document.createElement("div");
    css(card, {
      background: "#0b1929",
      border: "2px solid #3a80c9",
      borderRadius: "10px",
      padding: "28px 32px 24px",
      width: "min(540px, 90vw)",
      boxSizing: "border-box",
      boxShadow: "0 0 48px rgba(58,128,201,0.28), 0 8px 32px rgba(0,0,0,0.6)",
    });

    // ── Header (avatar + name) ────────────────────────────────────────────
    const header = document.createElement("div");
    css(header, { display: "flex", alignItems: "center", gap: "14px", marginBottom: "4px" });

    const avatar = document.createElement("div");
    css(avatar, {
      width: "44px",
      height: "44px",
      flexShrink: "0",
      border: "2px solid #4fc3f7",
      borderRadius: "6px",
      background: "#0d2040",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "24px",
      lineHeight: "1",
    });
    avatar.textContent = "🧑‍💻";

    const nameBlock = document.createElement("div");

    const nameEl = document.createElement("div");
    css(nameEl, {
      color: "#4fc3f7",
      fontSize: "clamp(14px, 2.2vw, 17px)",
      fontWeight: "bold",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      lineHeight: "1.2",
    });
    nameEl.textContent = "Jacob Small";

    const roleEl = document.createElement("div");
    css(roleEl, {
      color: "#3a6080",
      fontSize: "clamp(10px, 1.6vw, 13px)",
      letterSpacing: "0.06em",
      marginTop: "2px",
    });
    roleEl.textContent = "Dynamo Expert";

    nameBlock.appendChild(nameEl);
    nameBlock.appendChild(roleEl);
    header.appendChild(avatar);
    header.appendChild(nameBlock);
    card.appendChild(header);

    // ── Gradient divider ──────────────────────────────────────────────────
    const hr = document.createElement("div");
    css(hr, {
      height: "1px",
      background: "linear-gradient(to right, #1e3a5a, #3a80c9, #1e3a5a)",
      margin: "16px 0 20px",
    });
    card.appendChild(hr);

    // ── Question ──────────────────────────────────────────────────────────
    const qEl = document.createElement("p");
    css(qEl, {
      color: "#e4eeff",
      fontSize: "clamp(15px, 2.4vw, 18px)",
      lineHeight: "1.6",
      margin: "0 0 24px",
      fontWeight: "600",
    });
    qEl.textContent = question.question;
    card.appendChild(qEl);

    // ── Options ───────────────────────────────────────────────────────────
    const optGrid = document.createElement("div");
    css(optGrid, { display: "flex", flexDirection: "column", gap: "10px" });

    for (const key of OPTION_KEYS) {
      const btn = this.buildOptionButton(key, question.options[key], question);
      this.optionButtons.set(key, btn);
      optGrid.appendChild(btn);
    }
    card.appendChild(optGrid);

    // ── Hint ──────────────────────────────────────────────────────────────
    const hint = document.createElement("div");
    css(hint, {
      color: "#243852",
      fontSize: "clamp(10px, 1.5vw, 12px)",
      textAlign: "center",
      marginTop: "20px",
      letterSpacing: "0.06em",
    });
    hint.textContent = "Press  A / B / C / D  or click an option";
    card.appendChild(hint);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    // ── Keyboard (native DOM listener — unaffected by canvas resolution) ──
    this.keyboardCallback = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === "A" || k === "B" || k === "C" || k === "D") {
        e.preventDefault();
        this.onAnswer(k as OptionKey, question);
      }
    };
    document.addEventListener("keydown", this.keyboardCallback);
  }

  private buildOptionButton(
    key: OptionKey,
    label: string,
    question: TriviaQuestion,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    css(btn, {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      background: "#091522",
      border: "1.5px solid #1c3550",
      borderRadius: "6px",
      color: "#8bacc8",
      fontFamily: "inherit",
      fontSize: "clamp(13px, 2vw, 15px)",
      lineHeight: "1.5",
      padding: "12px 18px",
      textAlign: "left",
      cursor: "pointer",
      width: "100%",
      boxSizing: "border-box",
      transition: "background 0.12s, border-color 0.12s, color 0.12s",
    });

    // Key badge
    const badge = document.createElement("span");
    css(badge, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "26px",
      height: "26px",
      border: "1.5px solid #3a80c9",
      borderRadius: "4px",
      color: "#4fc3f7",
      fontSize: "clamp(11px, 1.8vw, 14px)",
      fontWeight: "bold",
      flexShrink: "0",
      background: "#0d2040",
      padding: "0 4px",
    });
    badge.textContent = key;

    const text = document.createElement("span");
    text.textContent = label;

    btn.appendChild(badge);
    btn.appendChild(text);

    btn.addEventListener("mouseenter", () => {
      if (!this.answered) {
        css(btn, { background: "#0f2440", borderColor: "#3a80c9", color: "#c8dcf4" });
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (!this.answered) {
        css(btn, { background: "#091522", borderColor: "#1c3550", color: "#8bacc8" });
      }
    });
    btn.addEventListener("click", () => this.onAnswer(key, question));

    return btn;
  }

  private highlightOption(selected: OptionKey, correct: OptionKey): void {
    for (const key of OPTION_KEYS) {
      const btn = this.optionButtons.get(key);
      if (!btn) continue;
      btn.style.cursor = "default";
      btn.style.pointerEvents = "none";
      btn.style.transition = "none";
      const badge = btn.firstElementChild as HTMLElement | null;
      if (key === correct) {
        css(btn, { background: "#00330f", borderColor: "#00cc66", color: "#00ff88" });
        if (badge) css(badge, { borderColor: "#00cc66", color: "#00ff88", background: "#00220a" });
      } else if (key === selected) {
        css(btn, { background: "#330000", borderColor: "#cc3333", color: "#ff5555" });
        if (badge) css(badge, { borderColor: "#cc3333", color: "#ff5555", background: "#220000" });
      } else {
        css(btn, { background: "#050d18", borderColor: "#0f1e2e", color: "#1e3048" });
        if (badge) css(badge, { borderColor: "#0f1e2e", color: "#1e3048", background: "#050d18" });
      }
    }
  }

  private onAnswer(selected: OptionKey, question: TriviaQuestion): void {
    if (this.answered) return;
    this.answered = true;

    if (this.keyboardCallback) {
      document.removeEventListener("keydown", this.keyboardCallback);
      this.keyboardCallback = undefined;
    }

    const isCorrect = selected === question.correct;
    this.highlightOption(selected, question.correct);

    this.scene.time.delayedCall(700, () => {
      this.dismiss();
      if (isCorrect) {
        const lives = Math.min(LIVES_MAX, ((this.scene.registry.get(REG_LIVES) as number) ?? 0) + 1);
        this.scene.registry.set(REG_LIVES, lives);
        this.player.unfreeze();
      } else {
        const lives = Math.max(0, ((this.scene.registry.get(REG_LIVES) as number) ?? 1) - 1);
        this.scene.registry.set(REG_LIVES, lives);
        this.player.knockback();
      }
    });
  }

  private dismiss(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    if (this.keyboardCallback) {
      document.removeEventListener("keydown", this.keyboardCallback);
      this.keyboardCallback = undefined;
    }
    for (const obj of this.worldObjects) {
      if (obj?.active) obj.destroy();
    }
    this.worldObjects = [];
    this.optionButtons.clear();
    this.isActive = false;
  }
}

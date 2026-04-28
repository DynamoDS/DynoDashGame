import Phaser from "phaser";
import { DEFAULT_CHARACTER } from "../character/CharacterAppearance";
import {
  ARCHETYPE_COUNT,
  ARCHETYPE_DESCRIPTIONS,
  ARCHETYPE_LABELS,
  SELECTED_ARCHETYPE_REGISTRY_KEY,
  type PlayerArchetypeId,
} from "../character/PlayerArchetype";
import { drawPlayerGraphics } from "../character/renderPlayerTexture";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";

const THUMB_PREFIX = "charPickThumb_";
const THUMB_SCALE = 1.1;

function thumbCentersX(count: number, gameWidth: number): number[] {
  const margin = 36;
  if (count <= 1) {
    return [gameWidth / 2];
  }
  const span = gameWidth - 2 * margin;
  return Array.from({ length: count }, (_, i) => margin + (span * i) / (count - 1));
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectionIndex = 0;
  private thumbs: Phaser.GameObjects.Sprite[] = [];
  private nameText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private highlight!: Phaser.GameObjects.Graphics;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escKey?: Phaser.Input.Keyboard.Key;
  private hasActed = false;
  private readonly onLeft = (): void => {
    this.selectionIndex = (this.selectionIndex - 1 + ARCHETYPE_COUNT) % ARCHETYPE_COUNT;
    this.syncSelectionUi();
  };
  private readonly onRight = (): void => {
    this.selectionIndex = (this.selectionIndex + 1) % ARCHETYPE_COUNT;
    this.syncSelectionUi();
  };
  private readonly onDigitKey = (event: KeyboardEvent): void => {
    const k = event.key;
    const n = parseInt(k, 10);
    if (Number.isNaN(n) || n < 1 || n > ARCHETYPE_COUNT) {
      return;
    }
    this.selectionIndex = n - 1;
    this.syncSelectionUi();
  };
  private readonly onConfirm = (): void => {
    this.registry.set(SELECTED_ARCHETYPE_REGISTRY_KEY, this.selectionIndex as PlayerArchetypeId);
    this.scene.start("CharacterBuilderScene");
  };
  private readonly onBack = (): void => {
    this.scene.start("MenuScene");
  };

  constructor() {
    super({ key: "CharacterSelectScene" });
  }

  create(): void {
    this.hasActed = false;
    // Re-focus the canvas in case TAB navigation moved browser focus away
    this.game.canvas.focus();
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 28, "CHOOSE CHARACTER", { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);

    this.add
      .text(cx, 60, "← → or 1–5   SPACE — customize colors", { fontSize: "16px", color: "#888888" })
      .setOrigin(0.5);

    this.buildThumbTextures();
    const centersX = thumbCentersX(ARCHETYPE_COUNT, GAME_WIDTH);
    const y = 156;
    for (let i = 0; i < ARCHETYPE_COUNT; i++) {
      const spr = this.add
        .sprite(centersX[i], y, `${THUMB_PREFIX}${i}`)
        .setScale(THUMB_SCALE);
      this.thumbs.push(spr);
    }

    this.highlight = this.add.graphics();
    this.nameText = this.add
      .text(cx, 228, "", { fontSize: "20px", color: "#ffffaa" })
      .setOrigin(0.5);
    this.descText = this.add
      .text(cx, 256, "", { fontSize: "14px", color: "#aaaaaa" })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT - 56, "SPACE — next (customize colors)", { fontSize: "16px", color: "#cccccc" })
      .setOrigin(0.5);
    this.add
      .text(cx, GAME_HEIGHT - 28, "ESC — back", { fontSize: "16px", color: "#666666" })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on("keydown-LEFT", this.onLeft);
    kb.on("keydown-RIGHT", this.onRight);
    kb.on("keydown", this.onDigitKey);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.once("down", this.onBack);

    this.syncSelectionUi();
  }

  update(): void {
    if (!this.hasActed && this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.hasActed = true;
      this.onConfirm();
    }
  }

  shutdown(): void {
    this.escKey?.removeAllListeners();
    this.escKey = undefined;
    this.spaceKey = undefined;
    this.hasActed = false;
    const kb = this.input.keyboard;
    if (kb) {
      kb.off("keydown-LEFT", this.onLeft);
      kb.off("keydown-RIGHT", this.onRight);
      kb.off("keydown", this.onDigitKey);
    }
    for (const spr of this.thumbs) {
      spr.destroy();
    }
    this.thumbs = [];
    for (let i = 0; i < ARCHETYPE_COUNT; i++) {
      const key = `${THUMB_PREFIX}${i}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
  }

  private buildThumbTextures(): void {
    for (let i = 0; i < ARCHETYPE_COUNT; i++) {
      const key = `${THUMB_PREFIX}${i}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      const g = this.make.graphics({ x: 0, y: 0 });
      drawPlayerGraphics(g, i as PlayerArchetypeId, DEFAULT_CHARACTER);
      g.generateTexture(key, 24, 32);
      g.destroy();
    }
  }

  private syncSelectionUi(): void {
    const i = this.selectionIndex;
    const spr = this.thumbs[i];
    const w = 24 * THUMB_SCALE + 10;
    const h = 32 * THUMB_SCALE + 10;
    this.highlight.clear();
    this.highlight.lineStyle(2, 0xffff66, 1);
    this.highlight.strokeRect(spr.x - w / 2, spr.y - h / 2, w, h);
    this.nameText.setText(ARCHETYPE_LABELS[i as PlayerArchetypeId]);
    this.descText.setText(ARCHETYPE_DESCRIPTIONS[i] ?? "");
  }
}

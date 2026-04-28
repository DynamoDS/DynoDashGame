import Phaser from "phaser";
import {
  BODY_PALETTE,
  LEGS_PALETTE,
  SKIN_PALETTE,
  appearanceFromIndices,
  type CharacterAppearance,
} from "../character/CharacterAppearance";
import { REG_LEVEL, REG_LIVES, REG_SCORE } from "../config/registryKeys";
import {
  ARCHETYPE_LABELS,
  PLAYER_CHARACTER_REGISTRY_KEY,
  SELECTED_ARCHETYPE_REGISTRY_KEY,
  normalizeArchetypeId,
  type PlayerArchetypeId,
  type PlayerCharacterSelection,
} from "../character/PlayerArchetype";
import { regeneratePlayerTexture } from "../character/renderPlayerTexture";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";

type Slot = 0 | 1 | 2;

const SLOT_LABELS = ["Body", "Skin", "Legs"] as const;

export class CharacterBuilderScene extends Phaser.Scene {
  private preview: Phaser.GameObjects.Sprite | null = null;
  private slotHighlight: Phaser.GameObjects.Text[] = [];
  private archetypeId: PlayerArchetypeId = 0;
  private bodyI = 0;
  private skinI = 0;
  private legsI = 0;
  private activeSlot: Slot = 0;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private tabKey?: Phaser.Input.Keyboard.Key;
  private escKey?: Phaser.Input.Keyboard.Key;
  private hasActed = false;
  private readonly onRowUp = (): void => {
    this.activeSlot = ((((this.activeSlot - 1) % 3) + 3) % 3) as Slot;
    this.updateSlotLabels();
  };
  private readonly onRowDown = (): void => {
    this.activeSlot = ((((this.activeSlot + 1) % 3) + 3) % 3) as Slot;
    this.updateSlotLabels();
  };
  private readonly onKeyLeft = (): void => {
    this.bumpValue(-1);
  };
  private readonly onKeyRight = (): void => {
    this.bumpValue(1);
  };
  private readonly onConfirm = (): void => {
    const appearance = appearanceFromIndices(this.bodyI, this.skinI, this.legsI);
    const selection: PlayerCharacterSelection = { archetypeId: this.archetypeId, appearance };
    this.registry.set(PLAYER_CHARACTER_REGISTRY_KEY, selection);
    this.registry.set(REG_LIVES, 3);
    this.registry.set(REG_LEVEL, 1);
    this.registry.set(REG_SCORE, 0);
    this.destroyPreviewAndRegenerate(this.archetypeId, appearance);
    this.scene.start("GameScene");
  };
  private readonly onBack = (): void => {
    this.scene.start("CharacterSelectScene");
  };

  constructor() {
    super({ key: "CharacterBuilderScene" });
  }

  create(): void {
    this.hasActed = false;
    this.slotHighlight = []; // clear stale refs from previous scene run
    const raw = this.registry.get(SELECTED_ARCHETYPE_REGISTRY_KEY);
    this.archetypeId =
      typeof raw === "number" ? normalizeArchetypeId(raw) : 0;

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 24, "COLORS", { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);

    this.add
      .text(cx, 52, ARCHETYPE_LABELS[this.archetypeId], { fontSize: "18px", color: "#aaaaaa" })
      .setOrigin(0.5);

    this.add
      .text(cx, 80, "UP / DOWN — row   LEFT / RIGHT — palette", { fontSize: "16px", color: "#888888" })
      .setOrigin(0.5);

    for (let s = 0; s < 3; s++) {
      const y = 108 + s * 22;
      const label = this.add
        .text(cx - 140, y, `${SLOT_LABELS[s]}:`, { fontSize: "16px", color: "#aaaaaa" })
        .setOrigin(0, 0.5);
      this.slotHighlight.push(label);
    }

    this.refreshAppearance();

    this.add
      .text(cx, GAME_HEIGHT - 72, "TAB — change character", { fontSize: "16px", color: "#777777" })
      .setOrigin(0.5);
    this.add
      .text(cx, GAME_HEIGHT - 48, "SPACE — play", { fontSize: "16px", color: "#cccccc" })
      .setOrigin(0.5);
    this.add
      .text(cx, GAME_HEIGHT - 24, "ESC — character select", { fontSize: "16px", color: "#666666" })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", this.onRowUp);
    kb.on("keydown-DOWN", this.onRowDown);
    kb.on("keydown-LEFT", this.onKeyLeft);
    kb.on("keydown-RIGHT", this.onKeyRight);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.tabKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.once("down", this.onBack);

    this.updateSlotLabels();
  }

  update(): void {
    if (this.hasActed) return;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.hasActed = true;
      this.onConfirm();
    } else if (this.tabKey && Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      this.hasActed = true;
      this.scene.start("CharacterSelectScene");
    }
  }

  shutdown(): void {
    this.escKey?.removeAllListeners();
    this.escKey = undefined;
    this.spaceKey = undefined;
    this.tabKey = undefined;
    this.hasActed = false;
    const kb = this.input.keyboard;
    if (kb) {
      kb.off("keydown-UP", this.onRowUp);
      kb.off("keydown-DOWN", this.onRowDown);
      kb.off("keydown-LEFT", this.onKeyLeft);
      kb.off("keydown-RIGHT", this.onKeyRight);
    }
  }

  private bumpValue(delta: number): void {
    if (this.activeSlot === 0) {
      this.bodyI += delta;
    } else if (this.activeSlot === 1) {
      this.skinI += delta;
    } else {
      this.legsI += delta;
    }
    this.refreshAppearance();
  }

  private refreshAppearance(): void {
    const appearance = appearanceFromIndices(this.bodyI, this.skinI, this.legsI);
    this.destroyPreviewAndRegenerate(this.archetypeId, appearance);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 36;
    this.preview = this.add.sprite(cx, cy, "player").setScale(4);
  }

  private destroyPreviewAndRegenerate(
    archetypeId: PlayerArchetypeId,
    appearance: CharacterAppearance,
  ): void {
    if (this.preview) {
      this.preview.destroy();
      this.preview = null;
    }
    regeneratePlayerTexture(this, archetypeId, appearance);
  }

  private updateSlotLabels(): void {
    for (let s = 0; s < 3; s++) {
      const label = this.slotHighlight[s];
      const active = s === this.activeSlot;
      label.setColor(active ? "#ffffaa" : "#aaaaaa");
      const pal = s === 0 ? BODY_PALETTE : s === 1 ? SKIN_PALETTE : LEGS_PALETTE;
      const idx = s === 0 ? this.bodyI : s === 1 ? this.skinI : this.legsI;
      const i = ((idx % pal.length) + pal.length) % pal.length;
      label.setText(`${SLOT_LABELS[s]}: ${i + 1}/${pal.length}`);
    }
  }
}

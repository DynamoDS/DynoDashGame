import Phaser from "phaser";
import { DEFAULT_CHARACTER } from "../character/CharacterAppearance";
import {
  ARCHETYPE_COUNT,
  ARCHETYPE_LABELS,
  type PlayerArchetypeId,
} from "../character/PlayerArchetype";
import { drawPlayerGraphics } from "../character/renderPlayerTexture";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";

const PREFIX = "rosterThumb_";
const SCALE = 2;

/** Larger preview of all five (default palette). */
export class RosterScene extends Phaser.Scene {
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private labels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "RosterScene" });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 20, "CHARACTER ROSTER", { fontSize: "22px", color: "#ffffff" })
      .setOrigin(0.5);
    this.add
      .text(cx, 48, "default colors", { fontSize: "14px", color: "#888888" })
      .setOrigin(0.5);

    const row1Y = 104;
    const row1X = [106, 320, 534];
    const row2Y = 236;
    const row2X = [214, 426];

    for (let i = 0; i < ARCHETYPE_COUNT; i++) {
      const key = `${PREFIX}${i}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      const g = this.make.graphics({ x: 0, y: 0 });
      drawPlayerGraphics(g, i as PlayerArchetypeId, DEFAULT_CHARACTER);
      g.generateTexture(key, 24, 32);
      g.destroy();

      const row = i < 3 ? 0 : 1;
      const col = i < 3 ? i : i - 3;
      const x = row === 0 ? row1X[col] : row2X[col];
      const y = row === 0 ? row1Y : row2Y;

      const spr = this.add.sprite(x, y, key).setScale(SCALE);
      this.sprites.push(spr);

      const name = this.add
        .text(x, y + 16 * SCALE + 8, ARCHETYPE_LABELS[i as PlayerArchetypeId], {
          fontSize: "14px",
          color: "#cccccc",
        })
        .setOrigin(0.5);
      this.labels.push(name);
    }

    this.add
      .text(cx, GAME_HEIGHT - 28, "ESC or SPACE — menu", { fontSize: "16px", color: "#666666" })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    const escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const back = (): void => {
      kb.off("keydown-SPACE", back);
      escKey.removeAllListeners();
      this.scene.start("MenuScene");
    };
    kb.once("keydown-SPACE", back);
    escKey.once("down", back);
  }

  shutdown(): void {
    for (const s of this.sprites) {
      s.destroy();
    }
    for (const t of this.labels) {
      t.destroy();
    }
    this.sprites = [];
    this.labels = [];
    for (let i = 0; i < ARCHETYPE_COUNT; i++) {
      const key = `${PREFIX}${i}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
  }
}

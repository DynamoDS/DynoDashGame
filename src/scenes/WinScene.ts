import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";
import { REG_LEVEL, REG_LIVES } from "../config/registryKeys";
import { openDynFilePicker, storeDynInRegistry } from "../dyn/openDynFilePicker";

export class WinScene extends Phaser.Scene {
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private mKey?: Phaser.Input.Keyboard.Key;
  private acted = false;

  constructor() {
    super({ key: "WinScene" });
  }

  create(): void {
    this.acted = false;
    // Ensure the canvas has keyboard focus so SPACE / M register correctly.
    // The trivia DOM overlay (which has clickable buttons) can steal focus from
    // the canvas; grabbing it back here prevents WinScene from appearing frozen.
    this.game.canvas.focus();
    // UIScene keeps running — it renders behind this scene (lower scene index).
    // It will be refreshed when GameScene restarts and sets new registry values.

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Advance level
    const prevLevel = (this.registry.get(REG_LEVEL) as number) ?? 1;
    const nextLevel = prevLevel + 1;
    this.registry.set(REG_LEVEL, nextLevel);
    // Reset lives for the next level
    this.registry.set(REG_LIVES, 3);

    // Dark overlay
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);

    // Celebratory star burst
    const g = this.add.graphics();
    const starColors = [0xffd700, 0xff8c00, 0xffffff, 0x44ff88];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = 56 + (i % 3) * 16;
      const sx = cx + Math.cos(angle) * r;
      const sy = (cy - 72) + Math.sin(angle) * r * 0.5;
      g.fillStyle(starColors[i % starColors.length]);
      g.fillRect(sx - 2, sy - 2, 4, 4);
    }

    // Trophy
    g.fillStyle(0xffd700);
    g.fillRect(cx - 12, cy - 116, 24, 20);
    g.fillRect(cx -  8, cy -  96, 16,  8);
    g.fillRect(cx -  4, cy -  88,  8,  6);
    g.fillRect(cx - 10, cy -  82, 20,  4);
    g.fillStyle(0xffec6e);
    g.fillRect(cx -  8, cy - 112,  8,  8);

    this.tweens.add({
      targets: g, angle: 15, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    // Level complete message
    const isEndless = prevLevel >= 2;
    const wave = prevLevel - 1; // wave 1 = cleared level 2, wave 2 = cleared level 3, etc.
    this.add
      .text(cx, cy - 44, isEndless ? `ENDLESS MODE — WAVE ${wave} CLEARED!` : `LEVEL ${prevLevel} COMPLETE!`, {
        fontSize: isEndless ? "16px" : "20px", color: isEndless ? "#44ffcc" : "#ffd700", align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 18, isEndless ? `Wave ${wave + 1} incoming — difficulty increased` : `Upload a new .dyn for Level ${nextLevel}`, {
        fontSize: "14px", color: "#ffffff", align: "center",
        wordWrap: { width: GAME_WIDTH - 40 },
      })
      .setOrigin(0.5);

    // Upload button
    const uploadBtn = this.add
      .text(cx, cy + 12, "[ LOAD .DYN FILE ]", {
        fontSize: "16px", color: "#44aaff",
        backgroundColor: "#0a1a2e", padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    uploadBtn.on("pointerover", () => uploadBtn.setColor("#88ccff"));
    uploadBtn.on("pointerout", () => uploadBtn.setColor("#44aaff"));
    uploadBtn.on("pointerdown", () => this.triggerDynFilePicker(uploadBtn));

    // Play next level prompt
    const prompt = this.add
      .text(cx, cy + 48, `SPACE — PLAY LEVEL ${nextLevel}`, {
        fontSize: "14px", color: "#aaaaaa",
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0, duration: 600, yoyo: true, repeat: -1 });

    // Back to menu option
    this.add
      .text(cx, cy + 72, "M — MAIN MENU", { fontSize: "12px", color: "#666666" })
      .setOrigin(0.5);

    // --- Actions ---
    const kb = this.input.keyboard!;
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.mKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  }

  update(): void {
    if (this.acted) return;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.acted = true;
      this.scene.start("GameScene");
    } else if (this.mKey && Phaser.Input.Keyboard.JustDown(this.mKey)) {
      this.acted = true;
      this.scene.start("MenuScene");
    }
  }

  shutdown(): void {
    this.spaceKey = undefined;
    this.mKey = undefined;
    this.acted = false;
  }

  private triggerDynFilePicker(label: Phaser.GameObjects.Text): void {
    openDynFilePicker({
      onSuccess: (nodes, edges) => {
        storeDynInRegistry(this.registry, nodes, edges);
        label.setText(`[ ${nodes.length} NODES LOADED ]`).setColor("#44ff88");
      },
      onEmpty: () => label.setText("[ NO NODES FOUND ]").setColor("#ffaa44"),
      onError: () => label.setText("[ INVALID .DYN ]").setColor("#ff4444"),
      onTooBig: () => label.setText("[ FILE TOO LARGE — MAX 5 MB ]").setColor("#ff4444"),
    });
  }
}

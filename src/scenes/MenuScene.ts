import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";
import type { DynNode } from "../dyn/types";
import { openDynFilePicker, storeDynInRegistry } from "../dyn/openDynFilePicker";
import { REG_DYN_FROM_UPLOAD, REG_DYN_NODES } from "../config/registryKeys";
import {
  EASTER_EGG_REGISTRY_KEY,
  advanceKonamiIndex,
  isKonamiComplete,
  keyboardEventToKonamiKey,
} from "../easterEgg/konami";

export class MenuScene extends Phaser.Scene {
  private konamiIndex = 0;
  private readonly onKonamiKeydown = (event: KeyboardEvent): void => {
    this.konamiIndex = advanceKonamiIndex(
      this.konamiIndex,
      keyboardEventToKonamiKey(event),
    );
    if (isKonamiComplete(this.konamiIndex)) {
      this.konamiIndex = 0;
      this.showKonamiEasterEgg();
    }
  };

  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    // Stop UIScene if it was left running (e.g. ESC from GameScene)
    if (this.scene.isActive("UIScene")) {
      this.scene.stop("UIScene");
    }

    this.konamiIndex = 0;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const titleY = cy - 80;

    this.add
      .text(cx, titleY, "DYNO DASH", { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);

    if (this.textures.exists("dynamo_logo")) {
      this.textures.get("dynamo_logo").setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.add
        .image(cx, titleY + 48, "dynamo_logo")
        .setDisplaySize(68, 68)
        .setOrigin(0.5);
    }

    const start = this.add
      .text(cx, cy + 12, "PRESS SPACE — CHOOSE CHARACTER", { fontSize: "16px", color: "#aaaaaa" })
      .setOrigin(0.5);

    this.tweens.add({ targets: start, alpha: 0, duration: 600, yoyo: true, repeat: -1 });

    this.add
      .text(cx, cy + 44, "G — SEE ALL (ROSTER)", { fontSize: "16px", color: "#666688" })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on("keydown", this.onKonamiKeydown);
    kb.once("keydown-SPACE", () => {
      this.scene.start("CharacterSelectScene");
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.G).once("down", () => {
      this.scene.start("RosterScene");
    });

    // --- Dynamo .dyn upload ---
    const existing = this.registry.get(REG_DYN_NODES) as DynNode[] | undefined;
    const dynLabel = this.add
      .text(cx, cy + 72, "[ LOAD .DYN FILE ]", {
        fontSize: "16px",
        color: "#44aaff",
        backgroundColor: "#0a1a2e",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    dynLabel.on("pointerover", () => dynLabel.setColor("#88ccff"));
    dynLabel.on("pointerout", () => {
      const loaded = this.registry.get(REG_DYN_NODES) as DynNode[] | undefined;
      const fromUpload = this.registry.get(REG_DYN_FROM_UPLOAD) === true;
      dynLabel.setColor(loaded?.length && fromUpload ? "#44ff88" : "#44aaff");
    });
    dynLabel.on("pointerdown", () => this.triggerDynFilePicker(dynLabel));

    const statusText = this.add
      .text(cx, cy + 100, "", { fontSize: "12px", color: "#44ff88" })
      .setOrigin(0.5);

    const fromUpload = this.registry.get(REG_DYN_FROM_UPLOAD) === true;
    if (existing && existing.length > 0 && fromUpload) {
      dynLabel.setText(`[ .DYN LOADED ]`).setColor("#44ff88");
      statusText.setText(`${existing.length} DYNAMO NODES — YOUR FILE`);
    } else if (existing && existing.length > 0) {
      dynLabel.setText(`[ LOAD .DYN TO REPLACE DEFAULT ]`).setColor("#6688aa");
      statusText.setText(`${existing.length} NODES — BUILT-IN assets/dyn/dummy.dyn`);
    }

    // Dynamo sub-title hint
    this.add
      .text(cx, GAME_HEIGHT - 24, "Built-in dummy.dyn is used until you load your own .dyn", {
        fontSize: "10px",
        color: "#555577",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT - 10, "Any uploaded graphs are not stored or used for anything AI related.", {
        fontSize: "9px",
        color: "#444466",
      })
      .setOrigin(0.5);
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown", this.onKonamiKeydown);
  }

  private showKonamiEasterEgg(): void {
    this.registry.set(EASTER_EGG_REGISTRY_KEY, true);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.7);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setDepth(900);

    const msg = this.add
      .text(cx, cy, "YOU FOUND THE EGG\n2026 SUMMIT HACK\n↑↓BA", {
        fontSize: "18px",
        color: "#ffee88",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(901);

    this.tweens.add({
      targets: msg,
      scale: { from: 0.2, to: 1 },
      duration: 380,
      ease: "Back.easeOut",
    });

    this.time.delayedCall(3500, () => {
      dim.destroy();
      msg.destroy();
    });
  }

  private triggerDynFilePicker(label: Phaser.GameObjects.Text): void {
    openDynFilePicker({
      onSuccess: (nodes, edges) => {
        storeDynInRegistry(this.registry, nodes, edges);
        label.setText(`[ .DYN LOADED ]`).setColor("#44ff88");
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, `${nodes.length} DYNAMO NODES ACTIVE — COINS REPLACED`, {
            fontSize: "12px",
            color: "#44ff88",
          })
          .setOrigin(0.5);
      },
      onEmpty: () => label.setText("[ NO NODES FOUND ]").setColor("#ffaa44"),
      onError: () => label.setText("[ INVALID .DYN FILE ]").setColor("#ff4444"),
      onTooBig: () => label.setText("[ FILE TOO LARGE — MAX 5 MB ]").setColor("#ff4444"),
    });
  }
}

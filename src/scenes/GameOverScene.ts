import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";
import { deferSceneStart } from "../utils/sceneUtils";
import { REG_LIVES, REG_SCORE } from "../config/registryKeys";

interface GameOverData {
  score: number;
  highScore: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverScene" });
  }

  create(data?: GameOverData): void {
    const score = data?.score ?? 0;
    const highScore = data?.highScore ?? parseInt(localStorage.getItem("highScore") ?? "0", 10);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.78);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.lineStyle(2, 0x555555);
    bg.strokeRect(cx - 140, cy - 104, 280, 180);

    this.add
      .text(cx, cy - 76, "GAME OVER", { fontSize: "28px", color: "#ff4444" })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 28, `SCORE    ${score}`, { fontSize: "18px", color: "#ffd700" })
      .setOrigin(0.5);

    const isNewBest = score > 0 && score > highScore;
    this.add
      .text(cx, cy - 4, `BEST     ${highScore}${isNewBest ? "  ★" : ""}`, {
        fontSize: "18px",
        color: isNewBest ? "#ffee44" : "#cc9900",
      })
      .setOrigin(0.5);

    bg.lineStyle(2, 0x444444);
    bg.lineBetween(cx - 110, cy + 24, cx + 110, cy + 24);

    const restart = this.add
      .text(cx - 56, cy + 48, "[R] RESTART", { fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const menu = this.add
      .text(cx + 64, cy + 48, "[M] MENU", { fontSize: "16px", color: "#aaaaaa" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    restart.on("pointerover", () => restart.setColor("#ffff66"));
    restart.on("pointerout", () => restart.setColor("#ffffff"));
    menu.on("pointerover", () => menu.setColor("#ffff66"));
    menu.on("pointerout", () => menu.setColor("#aaaaaa"));

    let acted = false;

    const doRestart = (): void => {
      if (acted) return;
      acted = true;
      this.registry.set(REG_LIVES, 3);
      this.registry.set(REG_SCORE, 0);
      deferSceneStart(this, "GameScene");
    };

    const doMenu = (): void => {
      if (acted) return;
      acted = true;
      deferSceneStart(this, "MenuScene");
    };

    restart.on("pointerdown", doRestart);
    menu.on("pointerdown", doMenu);

    const kb = this.input.keyboard!;
    kb.once("keydown-R", doRestart);
    kb.once("keydown-M", doMenu);

    this.events.once("shutdown", () => {
      kb.off("keydown-R", doRestart);
      kb.off("keydown-M", doMenu);
    });
  }
}

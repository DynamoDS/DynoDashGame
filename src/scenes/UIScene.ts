import Phaser from "phaser";
import { PLAYER_FUEL_MAX, HP_MAX, LIVES_MAX } from "../config/GameConfig";
import { REG_FUEL, REG_HIGH_SCORE, REG_LEVEL, REG_LIVES } from "../config/registryKeys";
// Top-right layout: hearts row at y=6, HP bar row at y=26, fuel bar below HP
const HEARTS_X = 632; // right-aligned
const HEARTS_Y = 6;
const BAR_X = 562;
const BAR_Y = 26;
const BAR_W = 70;
const BAR_H = 12;
const FUEL_BAR_GAP = 6;
const FUEL_BAR_Y = BAR_Y + BAR_H + FUEL_BAR_GAP;

export class UIScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private fuelBar!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    // ── Score (top-left) ─────────────────────────────────────────────────────
    this.add.image(16, 12, "coin").setOrigin(0, 0).setScrollFactor(0);
    const scoreText = this.add
      .text(40, 8, "0", { fontSize: "16px", color: "#ffd700" })
      .setScrollFactor(0);

    const savedHi =
      (this.registry.get(REG_HIGH_SCORE) as number | undefined) ??
      parseInt(localStorage.getItem("highScore") ?? "0", 10);
    const hiText = this.add
      .text(40, 28, `HI ${savedHi}`, { fontSize: "12px", color: "#cc9900" })
      .setScrollFactor(0);

    // ── Level indicator (top-center) ────────────────────────────────────────
    const level = (this.registry.get(REG_LEVEL) as number) ?? 1;
    this.levelText = this.add
      .text(320, 8, this.levelLabel(level), { fontSize: "14px", color: "#88ccff" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    // ── Lives hearts (top-right, row 1) ──────────────────────────────────────
    const lives = (this.registry.get(REG_LIVES) as number) ?? LIVES_MAX;
    this.livesText = this.add
      .text(HEARTS_X, HEARTS_Y, "♥".repeat(Math.max(0, lives)), { fontSize: "16px", color: "#ff4444" })
      .setOrigin(1, 0)
      .setScrollFactor(0);

    // ── HP bar (top-right, row 2) ─────────────────────────────────────────────
    this.add
      .text(536, BAR_Y + BAR_H / 2, "HP", { fontSize: "12px", color: "#aaaaaa" })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.hpBar = this.add.graphics().setScrollFactor(0);
    this.drawHpBar(HP_MAX);

    // ── Fuel bar (below HP) ───────────────────────────────────────────────────
    this.add
      .text(536, FUEL_BAR_Y + BAR_H / 2, "FL", { fontSize: "12px", color: "#aaaaaa" })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.fuelBar = this.add.graphics().setScrollFactor(0);
    const initialFuel = (this.registry.get(REG_FUEL) as number) ?? PLAYER_FUEL_MAX;
    this.drawFuelBar(initialFuel);

    // ── Controls hint ─────────────────────────────────────────────────────────
    this.add
      .text(8, 340, "← → move   ↑ jump   SHIFT rockets   ESC menu", { fontSize: "12px", color: "#aaaaaa" })
      .setScrollFactor(0);

    // ── Registry listeners ──────────────────────────────────────────────────
    const onScore = (_: unknown, value: number): void => {
      scoreText.setText(String(value));
    };
    const onHealth = (_: unknown, value: number): void => {
      this.drawHpBar(value);
    };
    const onFuel = (_: unknown, value: number): void => {
      this.drawFuelBar(value);
    };
    const onLives = (_: unknown, value: number): void => {
      this.livesText.setText("♥".repeat(Math.max(0, value)));
    };
    const onLevel = (_: unknown, value: number): void => {
      this.levelText.setText(this.levelLabel(value));
    };
    const onHighScore = (_: unknown, value: number): void => {
      hiText.setText(`HI ${value}`);
    };

    this.registry.events.on("changedata-score", onScore, this);
    this.registry.events.on("changedata-health", onHealth, this);
    this.registry.events.on("changedata-fuel", onFuel, this);
    this.registry.events.on("changedata-lives", onLives, this);
    this.registry.events.on("changedata-level", onLevel, this);
    this.registry.events.on("changedata-highScore", onHighScore, this);

    // Clean up global registry listeners when this scene shuts down
    // to prevent stale callbacks referencing destroyed game objects
    this.events.once("shutdown", () => {
      this.registry.events.off("changedata-score", onScore, this);
      this.registry.events.off("changedata-health", onHealth, this);
      this.registry.events.off("changedata-fuel", onFuel, this);
      this.registry.events.off("changedata-lives", onLives, this);
      this.registry.events.off("changedata-level", onLevel, this);
      this.registry.events.off("changedata-highScore", onHighScore, this);
    });
  }

  private levelLabel(level: number): string {
    return level >= 3 ? `ENDLESS ${level - 2}` : `LVL ${level}`;
  }

  private drawHpBar(health: number): void {
    const pct = Math.max(0, health) / HP_MAX;
    const fillW = Math.round(BAR_W * pct);
    const fillColor = pct > 0.6 ? 0xdd2222 : pct > 0.3 ? 0xff6600 : 0x880000;

    this.hpBar.clear();
    this.hpBar.fillStyle(0x330000);
    this.hpBar.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);
    if (fillW > 0) {
      this.hpBar.fillStyle(fillColor);
      this.hpBar.fillRect(BAR_X, BAR_Y, fillW, BAR_H);
    }
    this.hpBar.lineStyle(1, 0x660000);
    this.hpBar.strokeRect(BAR_X, BAR_Y, BAR_W, BAR_H);
  }

  private drawFuelBar(fuel: number): void {
    if (!this.fuelBar) {
      return;
    }
    const pct = Math.max(0, fuel) / PLAYER_FUEL_MAX;
    const fillW = Math.round(BAR_W * pct);
    const fillColor = pct > 0.5 ? 0x33ccff : pct > 0.2 ? 0x2288cc : 0x114466;

    this.fuelBar.clear();
    this.fuelBar.fillStyle(0x112233);
    this.fuelBar.fillRect(BAR_X, FUEL_BAR_Y, BAR_W, BAR_H);
    if (fillW > 0) {
      this.fuelBar.fillStyle(fillColor);
      this.fuelBar.fillRect(BAR_X, FUEL_BAR_Y, fillW, BAR_H);
    }
    this.fuelBar.lineStyle(1, 0x446688);
    this.fuelBar.strokeRect(BAR_X, FUEL_BAR_Y, BAR_W, BAR_H);
  }
}

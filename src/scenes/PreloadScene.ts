import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/GameConfig";
import { DEFAULT_DYN_RAW } from "../dyn/defaultDynRaw";
import { REG_DYN_EDGES, REG_DYN_FROM_UPLOAD, REG_DYN_NODES } from "../config/registryKeys";
import { parseDynFile } from "../dyn/types";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload(): void {
    this.createLoadingBar();

    // Dynamo square mark — source: DynamoDS/Dynamo (Apache-2.0) doc/distrib/Images/logo_square_160x160.png
    this.load.image("dynamo_logo", "assets/dynamo-logo.png");

    this.load.json("level_example", "levels/example-level.json");
  }

  create(): void {
    generatePlaceholderTextures(this);

    try {
      const { nodes, edges } = parseDynFile(JSON.parse(DEFAULT_DYN_RAW));
      this.registry.set(REG_DYN_NODES, nodes);
      this.registry.set(REG_DYN_EDGES, edges);
      this.registry.set(REG_DYN_FROM_UPLOAD, false);
    } catch (e) {
      console.warn("Failed to load default .dyn (assets/dyn/dummy.dyn)", e);
      this.registry.set(REG_DYN_NODES, []);
      this.registry.set(REG_DYN_EDGES, []);
      this.registry.set(REG_DYN_FROM_UPLOAD, false);
    }

    this.scene.start("MenuScene");
  }

  private createLoadingBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const bar = this.add.graphics();
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1);
      bar.fillRect(cx - 160, cy - 10, 320 * value, 20);
    });
    this.load.on("complete", () => bar.destroy());

    this.add
      .text(cx, cy - 40, "Loading...", { fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5);
  }
}

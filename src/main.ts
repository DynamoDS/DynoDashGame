import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY } from "./config/GameConfig";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MenuScene } from "./scenes/MenuScene";
import { RosterScene } from "./scenes/RosterScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { CharacterBuilderScene } from "./scenes/CharacterBuilderScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { WinScene } from "./scenes/WinScene";

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a1a2e",
  pixelArt: true, // disables texture smoothing — essential for pixel art
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: GRAVITY }, debug: false },
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    RosterScene,
    CharacterSelectScene,
    CharacterBuilderScene,
    GameScene,
    UIScene,
    GameOverScene,
    WinScene,
  ],
});

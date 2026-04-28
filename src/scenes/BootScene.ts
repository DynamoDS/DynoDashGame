import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    // Pixel-art rendering is set globally via pixelArt:true in main.ts.
    // Use this scene to load only the assets needed for the loading bar
    // (e.g. a progress bar background image), then hand off to PreloadScene.
    this.scene.start("PreloadScene");
  }
}

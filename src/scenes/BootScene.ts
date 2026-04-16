import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.load.spritesheet("knight", "assets/sprites/knight.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  create(): void {
    this.scene.start("GameScene");
  }
}

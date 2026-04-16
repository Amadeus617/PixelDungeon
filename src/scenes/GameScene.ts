import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    const cx = Number(this.game.config.width) / 2;
    const cy = Number(this.game.config.height) / 2;

    this.add
      .text(cx, cy, "PixelDungeon", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }
}

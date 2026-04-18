import Phaser from "phaser";

/** A collectible coin pickup. Disappears when the player overlaps it. */
export class Coin extends Phaser.GameObjects.Sprite {
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "coin");
    scene.add.existing(this);
    this.setScale(3);
    this.setDepth(5);
  }

  /** Returns true if this is the first collection. */
  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.setVisible(false);
    this.setActive(false);
    this.destroy();
    return true;
  }
}

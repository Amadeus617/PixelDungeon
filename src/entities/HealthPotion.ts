import Phaser from "phaser";

/** A collectible health potion. Restores 1 HP on pickup (up to maxHp). */
export class HealthPotion extends Phaser.GameObjects.Sprite {
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "health_potion");
    scene.add.existing(this);
    this.setScale(3);
    this.setDepth(5);

    // Floating hover animation
    this._startFloatTween();
  }

  private _startFloatTween(): void {
    if (!this.scene || !this.scene.tweens) return;
    this.scene.tweens.add({
      targets: this,
      y: this.y - 5,
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: this,
      angle: { from: -6, to: 6 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
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

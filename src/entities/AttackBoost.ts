import Phaser from "phaser";

/** A collectible sword power-up. Doubles attack damage for the next hit. */
export class AttackBoost extends Phaser.Physics.Arcade.Sprite {
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "attack_boost");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(3);
    this.setDepth(5);

    // Set physics body for reliable overlap detection
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setOffset(0, 0);
    body.setEnable(true);
    this.setImmovable(true);

    // Floating hover animation
    this._startFloatTween();
  }

  private _startFloatTween(): void {
    if (!this.scene || !this.scene.tweens) return;
    this.scene.tweens.add({
      targets: this,
      y: this.y - 5,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: this,
      angle: { from: -6, to: 6 },
      duration: 1000,
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

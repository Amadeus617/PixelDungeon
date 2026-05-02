import Phaser from "phaser";

/** A collectible health potion. Restores HP on pickup (up to maxHp).
 *  @param isSmall If true, this is a dropped potion (smaller, different tint) vs a map-spawned potion.
 */
export class HealthPotion extends Phaser.Physics.Arcade.Sprite {
  private collected = false;
  private _isSmall: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, isSmall: boolean = false) {
    super(scene, x, y, "health_potion");
    this._isSmall = isSmall;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Visual differentiation (US-592): dropped potions are smaller with a blue tint
    if (isSmall) {
      this.setScale(2.2);
      this.setTint(0xaaddff); // light blue tint for dropped potions
    } else {
      this.setScale(3);
    }
    this.setDepth(5);

    // Set physics body for reliable overlap detection
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setOffset(0, 0);
    body.setEnable(true);
    this.setImmovable(true);

    // Floating hover animation
    this._startFloatTween();
  }

  /** Whether this is a small dropped potion (vs map-spawned). */
  get isSmall(): boolean {
    return this._isSmall;
  }

  private _startFloatTween(): void {
    if (!this.scene || !this.scene.tweens) return;
    const floatDist = this._isSmall ? 3 : 5;
    this.scene.tweens.add({
      targets: this,
      y: this.y - floatDist,
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

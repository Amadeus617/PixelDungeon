import Phaser from "phaser";

/** Configuration for floating hover animation. */
export interface FloatConfig {
  /** Vertical float distance in pixels (default 5). */
  floatDist?: number;
  /** Float cycle duration in ms (default 800). */
  floatDuration?: number;
  /** Rotation swing amplitude in degrees (default 8). */
  swingAngle?: number;
  /** Rotation swing cycle duration in ms (default 1200). */
  swingDuration?: number;
}

const DEFAULT_FLOAT: FloatConfig = {
  floatDist: 5,
  floatDuration: 800,
  swingAngle: 8,
  swingDuration: 1200,
};

/**
 * Abstract base class for collectible items (Coin, HealthPotion, AttackBoost, KeyItem).
 * Handles common setup: physics body, scale, depth, floating tween, and collection guard.
 *
 * Subclasses only need to specify a texture key and optionally override float params.
 */
export abstract class CollectibleBase extends Phaser.Physics.Arcade.Sprite {
  private collected = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    scale: number = 3,
    floatConfig: FloatConfig = DEFAULT_FLOAT,
  ) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(scale);
    this.setDepth(5);

    // Physics body for reliable overlap detection
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setOffset(0, 0);
    body.setEnable(true);
    this.setImmovable(true);

    this._startFloatTween(floatConfig);
  }

  private _startFloatTween(cfg: FloatConfig): void {
    if (!this.scene || !this.scene.tweens) return;
    const floatDist = cfg.floatDist ?? DEFAULT_FLOAT.floatDist!;
    const floatDuration = cfg.floatDuration ?? DEFAULT_FLOAT.floatDuration!;
    const swingAngle = cfg.swingAngle ?? DEFAULT_FLOAT.swingAngle!;
    const swingDuration = cfg.swingDuration ?? DEFAULT_FLOAT.swingDuration!;

    this.scene.tweens.add({
      targets: this,
      y: this.y - floatDist,
      duration: floatDuration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: this,
      angle: { from: -swingAngle, to: swingAngle },
      duration: swingDuration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Returns true if this is the first collection. Idempotent — subsequent calls return false. */
  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;
    // Stop floating/swing tweens before destroy to prevent callbacks on destroyed sprite
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
    }
    this.setVisible(false);
    this.setActive(false);
    this.destroy();
    return true;
  }
}

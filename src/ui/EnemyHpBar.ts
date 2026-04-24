import Phaser from "phaser";

const HP_BAR_WIDTH = 40;
const HP_BAR_HEIGHT = 5;
const HP_BAR_Y_OFFSET = -20; // pixels above the sprite
const HP_BAR_PAD = 1;
const FADE_OUT_DELAY = 3000; // ms after last hit before hiding
const FADE_DURATION = 500;

/**
 * A small HP bar rendered above an enemy sprite.
 * Hidden when at full HP; visible after taking damage; disappears on death.
 */
export class EnemyHpBar extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private fill!: Phaser.GameObjects.Rectangle;
  private _hp: number;
  private _maxHp: number;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private lastHp: number;

  constructor(scene: Phaser.Scene, x: number, y: number, maxHp: number) {
    super(scene, x, y);
    scene.add.existing(this);

    this._hp = maxHp;
    this._maxHp = maxHp;
    this.lastHp = maxHp;
    this.setDepth(20); // above enemies (10)

    // Background (dark border)
    this.bg = scene.add.rectangle(
      0,
      0,
      HP_BAR_WIDTH + HP_BAR_PAD * 2,
      HP_BAR_HEIGHT + HP_BAR_PAD * 2,
      0x000000,
      0.7
    );
    this.bg.setOrigin(0.5);
    this.add(this.bg);

    // Fill bar
    this.fill = scene.add.rectangle(
      -HP_BAR_PAD,
      -HP_BAR_PAD,
      HP_BAR_WIDTH,
      HP_BAR_HEIGHT,
      0xff0000
    );
    this.fill.setOrigin(0);
    this.add(this.fill);

    // Start hidden (full HP)
    this.setVisible(false);
  }

  /** Update HP value and re-render the bar. */
  setHp(current: number, max: number): void {
    this._hp = current;
    this._maxHp = max;

    const ratio = Math.max(0, this._hp / this._maxHp);
    this.fill.width = HP_BAR_WIDTH * ratio;

    // Color: green > yellow > red
    let color: number;
    if (ratio > 0.6) {
      color = 0x44ff44;
    } else if (ratio > 0.3) {
      color = 0xffff00;
    } else {
      color = 0xff0000;
    }
    this.fill.setFillStyle(color);

    // Show bar if damaged (hp dropped), schedule auto-hide
    if (this._hp < this._maxHp) {
      this.setVisible(true);
      this.setAlpha(1);
      this.scheduleHide();
    }

    // Hide if dead
    if (this._hp <= 0) {
      this.destroy();
      return;
    }

    this.lastHp = this._hp;
  }

  /** Update position to follow the parent sprite. */
  follow(sprite: Phaser.GameObjects.Sprite): void {
    this.setPosition(sprite.x, sprite.y + HP_BAR_Y_OFFSET);
  }

  /** Schedule fade-out after delay. */
  private scheduleHide(): void {
    if (this.hideTimer) {
      this.hideTimer.remove();
    }
    this.hideTimer = this.scene.time.delayedCall(FADE_OUT_DELAY, () => {
      if (!this.active) return;
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: FADE_DURATION,
        onComplete: () => {
          this.setVisible(false);
          this.setAlpha(1);
        },
      });
      this.hideTimer = null;
    });
  }

  override destroy(fromScene?: boolean): void {
    if (this.hideTimer) {
      this.hideTimer.remove();
      this.hideTimer = null;
    }
    super.destroy(fromScene);
  }
}

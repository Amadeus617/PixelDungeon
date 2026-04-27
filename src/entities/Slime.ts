import Phaser from "phaser";
import { EnemyHpBar } from "@/ui/EnemyHpBar";

const SLIME_SPEED = 60;
const HP_BAR_Y_OFFSET = -20;
const DIR_CHANGE_MIN = 1500;
const DIR_CHANGE_MAX = 3500;
const SLIME_MAX_HP = 2;
const KNOCKBACK_SPEED = 300;
const KNOCKBACK_DURATION = 150;

const DIRECTIONS: Array<{ vx: number; vy: number }> = [
  { vx: 1, vy: 0 },
  { vx: -1, vy: 0 },
  { vx: 0, vy: 1 },
  { vx: 0, vy: -1 },
  { vx: 1, vy: 1 },
  { vx: -1, vy: 1 },
  { vx: 1, vy: -1 },
  { vx: -1, vy: -1 },
];

export class Slime extends Phaser.Physics.Arcade.Sprite {
  private dirTimer: number = 0;
  private dirInterval: number = 2000;
  private _hp: number = SLIME_MAX_HP;
  private _maxHp: number = SLIME_MAX_HP;
  private isKnockedBack: boolean = false;
  private knockbackTimer: number = 0;
  private hpBar!: EnemyHpBar;
  private _clearTintTimer: Phaser.Time.TimerEvent | null = null;

  get hp(): number {
    return this._hp;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  get isDead(): boolean {
    return this._hp <= 0;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "slime");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(3);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setBoundsRectangle(
      scene.physics.world.bounds as Phaser.Geom.Rectangle
    );

    // HP bar (above sprite)
    this.hpBar = new EnemyHpBar(scene, x, y + HP_BAR_Y_OFFSET, SLIME_MAX_HP);

    this.pickDirection();
    this.play("slime-move", true);
  }

  private pickDirection(): void {
    const d = DIRECTIONS[Phaser.Math.Between(0, DIRECTIONS.length - 1)];
    const len = Math.sqrt(d.vx * d.vx + d.vy * d.vy) || 1;
    this.setVelocity((d.vx / len) * SLIME_SPEED, (d.vy / len) * SLIME_SPEED);

    // Random interval before next direction change
    this.dirInterval = Phaser.Math.Between(DIR_CHANGE_MIN, DIR_CHANGE_MAX);
    this.dirTimer = 0;
  }

  /** Called when slime collides with a wall – bounce into a new direction */
  onHitWall(): void {
    this.pickDirection();
  }

  takeDamage(amount: number, attackDirX?: number, attackDirY?: number): void {
    this._hp = Math.max(0, this._hp - amount);

    // Flash white on hit
    this.setTint(0xffffff);
    // Cancel any previous clear-tint timer
    if (this._clearTintTimer) {
      this._clearTintTimer.remove();
      this._clearTintTimer = null;
    }
    this._clearTintTimer = this.scene.time.delayedCall(100, () => {
      this._clearTintTimer = null;
      if (this.active) this.clearTint();
    });

    // Knockback: push away from attack direction
    if (attackDirX !== undefined && attackDirY !== undefined) {
      const len = Math.sqrt(attackDirX * attackDirX + attackDirY * attackDirY) || 1;
      this.setVelocity(
        (attackDirX / len) * KNOCKBACK_SPEED,
        (attackDirY / len) * KNOCKBACK_SPEED
      );
      this.isKnockedBack = true;
      this.knockbackTimer = KNOCKBACK_DURATION;
    }

    // Update HP bar
    this.hpBar.setHp(this._hp, this._maxHp);

    if (this._hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    // Cancel pending clear-tint timer to prevent callback on destroyed object
    if (this._clearTintTimer) {
      this._clearTintTimer.remove();
      this._clearTintTimer = null;
    }
    // Stop all tweens to prevent post-destroy callbacks
    this.scene.tweens.killTweensOf(this);
    if (this.hpBar) this.hpBar.destroy();
    this.setVelocity(0, 0);

    // Emit death event for loot drops before destroying
    this.scene.events.emit("enemy-death", {
      x: this.x,
      y: this.y,
      type: "slime",
    });

    this.setActive(false);
    this.setVisible(false);
    this.destroy();
  }

  update(delta: number): void {
    if (!this.active) return;

    // During knockback, count down and resume normal movement after
    if (this.isKnockedBack) {
      this.knockbackTimer -= delta;
      if (this.knockbackTimer <= 0) {
        this.isKnockedBack = false;
        this.pickDirection();
      }
      return;
    }

    // Keep HP bar positioned above sprite
    if (this.hpBar && this.hpBar.active) {
      this.hpBar.follow(this);
    }

    this.dirTimer += delta;
    if (this.dirTimer >= this.dirInterval) {
      this.pickDirection();
    }
  }
}

import Phaser from "phaser";
import { EnemyHpBar } from "@/ui/EnemyHpBar";

const SKELETON_SPEED = 55;
const SKELETON_MAX_HP = 4;
const TRACK_RANGE = 200;
const HP_BAR_Y_OFFSET = -20;
const KNOCKBACK_SPEED = 300;
const KNOCKBACK_DURATION = 150;

export class Skeleton extends Phaser.Physics.Arcade.Sprite {
  private _hp: number = SKELETON_MAX_HP;
  private _maxHp: number = SKELETON_MAX_HP;
  private playerRef!: Phaser.GameObjects.Sprite;
  private dirTimer: number = 0;
  private dirInterval: number = 2000;
  private wanderVx: number = 0;
  private wanderVy: number = 0;
  private isKnockedBack: boolean = false;
  private knockbackTimer: number = 0;
  private hpBar!: EnemyHpBar;
  private speedMultiplier: number = 1.0;
  private _clearTintTimer: Phaser.Time.TimerEvent | null = null;
  /** Last wall-hit axis: 'x' = blocked horizontally, 'y' = blocked vertically, null = none */
  private lastHitAxis: 'x' | 'y' | null = null;
  /** Consecutive wall hits along same axis (indicates corridor) */
  private sameAxisHitCount: number = 0;

  get hp(): number {
    return this._hp;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  get isDead(): boolean {
    return this._hp <= 0;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, speedMultiplier: number = 1.0) {
    super(scene, x, y, "skeleton");
    this.speedMultiplier = speedMultiplier;
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
    this.hpBar = new EnemyHpBar(scene, x, y + HP_BAR_Y_OFFSET, SKELETON_MAX_HP);

    this.pickWanderDirection();
    this.play("skeleton-move", true);
  }

  /** Set a reference to the player so the skeleton can track them. */
  setPlayerRef(player: Phaser.GameObjects.Sprite): void {
    this.playerRef = player;
  }

  private pickWanderDirection(): void {
    // If we've been hitting walls on the same axis repeatedly, we're likely in a corridor.
    // Constrain to movement along the corridor axis only.
    if (this.sameAxisHitCount >= 2 && this.lastHitAxis) {
      // In a horizontal corridor (blocked on Y axis) → move left/right only
      // In a vertical corridor (blocked on X axis) → move up/down only
      const isHorizontalCorridor = this.lastHitAxis === 'y';
      const choices = isHorizontalCorridor
        ? [{ vx: 1, vy: 0 }, { vx: -1, vy: 0 }]
        : [{ vx: 0, vy: 1 }, { vx: 0, vy: -1 }];
      const d = choices[Math.floor(Math.random() * choices.length)];
      this.wanderVx = d.vx;
      this.wanderVy = d.vy;
    } else {
      // Open room: use full 360° random direction
      const angle = Math.random() * Math.PI * 2;
      this.wanderVx = Math.cos(angle);
      this.wanderVy = Math.sin(angle);
    }
    this.dirInterval = Phaser.Math.Between(1500, 3500);
    this.dirTimer = 0;
  }

  /** Called when skeleton collides with a wall – pick new direction */
  onHitWall(): void {
    if (this.isKnockedBack) return;

    // Determine which axis the wall collision blocked us on.
    // If we were moving primarily in X but got stopped → blocked on X axis.
    // If moving primarily in Y → blocked on Y axis.
    const absVx = Math.abs(this.wanderVx);
    const absVy = Math.abs(this.wanderVy);
    const hitAxis: 'x' | 'y' = absVx >= absVy ? 'x' : 'y';

    if (this.lastHitAxis === hitAxis) {
      this.sameAxisHitCount++;
    } else {
      this.lastHitAxis = hitAxis;
      this.sameAxisHitCount = 1;
    }

    this.pickWanderDirection();
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

    // Cache position before destroy (US-633)
    const cx = this.x;
    const cy = this.y;

    // Emit death event for loot drops before destroying
    this.scene.events.emit("enemy-death", {
      x: cx,
      y: cy,
      type: "skeleton",
    });

    this.setActive(false);
    this.setVisible(false);
    this.destroy();
  }

  update(delta: number): void {
    if (!this.active) return;
    // Freeze when game is over (US-568)
    if ((this.scene as any).gameOver) {
      this.setVelocity(0, 0);
      return;
    }

    // During knockback, count down and resume normal movement after
    if (this.isKnockedBack) {
      this.knockbackTimer -= delta;
      if (this.knockbackTimer <= 0) {
        this.isKnockedBack = false;
        this.pickWanderDirection();
      }
      if (this.hpBar && this.hpBar.active) this.hpBar.follow(this);
      return;
    }

    let vx: number;
    let vy: number;

    // Track player if within range and reference exists
    if (this.playerRef && this.playerRef.active) {
      const dx = this.playerRef.x - this.x;
      const dy = this.playerRef.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= TRACK_RANGE && dist > 0) {
        // Chase player (speed scaled by difficulty multiplier)
        const speed = SKELETON_SPEED * this.speedMultiplier;
        vx = (dx / dist) * speed;
        vy = (dy / dist) * speed;
        this.setVelocity(vx, vy);
        if (this.hpBar && this.hpBar.active) this.hpBar.follow(this);
        return;
      }
    }

    // Wander randomly
    // Keep HP bar positioned above sprite
    if (this.hpBar && this.hpBar.active) {
      this.hpBar.follow(this);
    }

    this.dirTimer += delta;
    if (this.dirTimer >= this.dirInterval) {
      // Normal direction change (not wall-triggered) — reset corridor detection
      // since we've been moving freely
      this.sameAxisHitCount = 0;
      this.lastHitAxis = null;
      this.pickWanderDirection();
    }

    this.setVelocity(
      this.wanderVx * SKELETON_SPEED * this.speedMultiplier,
      this.wanderVy * SKELETON_SPEED * this.speedMultiplier
    );
  }
}

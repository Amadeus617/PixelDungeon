import Phaser from "phaser";
import { EnemyHpBar } from "@/ui/EnemyHpBar";

const SKELETON_SPEED = 45;
const SKELETON_MAX_HP = 2;
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
    const angle = Math.random() * Math.PI * 2;
    this.wanderVx = Math.cos(angle);
    this.wanderVy = Math.sin(angle);
    this.dirInterval = Phaser.Math.Between(1500, 3500);
    this.dirTimer = 0;
  }

  /** Called when skeleton collides with a wall – pick new direction */
  onHitWall(): void {
    this.pickWanderDirection();
  }

  takeDamage(amount: number, attackDirX?: number, attackDirY?: number): void {
    this._hp = Math.max(0, this._hp - amount);
    // Flash white on hit
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
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
    if (this.hpBar) this.hpBar.destroy();
    this.setVelocity(0, 0);
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
        this.pickWanderDirection();
      }
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
      this.pickWanderDirection();
    }

    this.setVelocity(
      this.wanderVx * SKELETON_SPEED * this.speedMultiplier,
      this.wanderVy * SKELETON_SPEED * this.speedMultiplier
    );
  }
}

import Phaser from "phaser";

export type Direction = "up" | "down" | "left" | "right" | "idle";

const PLAYER_MAX_HP = 10;
const ATTACK_RANGE = 50;
const ATTACK_DAMAGE = 1;
const ATTACK_COOLDOWN = 400;
const INVINCIBLE_DURATION = 1000;
const KNOCKBACK_DISTANCE = 25; // pixels
const KNOCKBACK_DURATION = 200; // ms
const ATTACK_BOOST_DURATION = 10000; // 10 seconds

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private _direction: Direction = "down";
  private speed: number = 120;
  private _hp: number = PLAYER_MAX_HP;
  private _maxHp: number = PLAYER_MAX_HP;
  private lastAttackTime: number = 0;
  private isAttacking: boolean = false;
  private isInvincible: boolean = false;
  private invincibleTimer: number = 0;
  private isKnockedBack: boolean = false;
  private knockbackTimer: number = 0;
  private isDeadAnimating: boolean = false;

  // Slash effect graphics reference (US-042)
  private slashGfx: Phaser.GameObjects.Graphics | null = null;

  // Slow debuff (from spike traps)
  private slowMultiplier: number = 1.0;
  private slowTimer: number = 0;

  // Attack boost (timed buff)
  private _attackBoosted: boolean = false;
  private _attackBoostTimer: number = 0;
  private _attackBoostDuration: number = ATTACK_BOOST_DURATION;

  /** Whether the player currently has the ATK x2 buff */
  get attackBoosted(): boolean {
    return this._attackBoosted;
  }

  /** Remaining buff time in ms (0 if no buff active) */
  get attackBoostRemaining(): number {
    return this._attackBoosted ? Math.max(0, this._attackBoostTimer) : 0;
  }

  /** Activate the attack boost buff. If already active, refreshes the duration. */
  activateAttackBoost(): void {
    this._attackBoosted = true;
    this._attackBoostTimer = this._attackBoostDuration;
  }

  /** Combat config – exposed for testing and external use */
  static readonly ATTACK_RANGE = ATTACK_RANGE;
  static readonly ATTACK_DAMAGE = ATTACK_DAMAGE;

  get direction(): Direction {
    return this._direction;
  }

  get hp(): number {
    return this._hp;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  get alive(): boolean {
    return this._hp > 0;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "knight");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(3);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.spaceKey = scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );
    }

    this.play("idle-down");
  }

  setWorldBounds(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setBoundsRectangle(
      this.scene.physics.world.bounds as Phaser.Geom.Rectangle
    );
  }

  /** Returns the attack origin point and direction vector for hit detection */
  getAttackZone(): { x: number; y: number; dx: number; dy: number } {
    const offsets: Record<Exclude<Direction, "idle">, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };
    const dir = this._direction === "idle" ? "down" : this._direction;
    const o = offsets[dir];
    return { x: this.x, y: this.y, dx: o.dx, dy: o.dy };
  }

  /** Check if an enemy is within attack range and in the facing direction */
  isEnemyInAttackRange(enemyX: number, enemyY: number): boolean {
    const zone = this.getAttackZone();
    const dx = enemyX - zone.x;
    const dy = enemyY - zone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > ATTACK_RANGE) return false;

    // Check if enemy is roughly in the facing direction (±60° cone)
    if (dist > 0) {
      const ndx = dx / dist;
      const ndy = dy / dist;
      const dot = ndx * zone.dx + ndy * zone.dy;
      // cos(60°) = 0.5 — allow a 120° cone in front
      if (dot < 0.25) return false;
    }

    return true;
  }

  /** Heal HP, capped at maxHp. Returns the actual amount healed. */
  heal(amount: number): number {
    if (!this.alive) return 0;
    const before = this._hp;
    this._hp = Math.min(this._maxHp, this._hp + amount);
    return this._hp - before;
  }

  takeDamage(amount: number, sourceX?: number, sourceY?: number): void {
    if (this.isInvincible || !this.alive) return;
    this._hp = Math.max(0, this._hp - amount);
    this.isInvincible = true;
    this.invincibleTimer = INVINCIBLE_DURATION;

    // Flash effect
    this.setAlpha(0.5);

    // Knockback: push away from damage source
    if (sourceX !== undefined && sourceY !== undefined) {
      const dx = this.x - sourceX;
      const dy = this.y - sourceY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const vx = (dx / len) * (KNOCKBACK_DISTANCE / (KNOCKBACK_DURATION / 1000));
      const vy = (dy / len) * (KNOCKBACK_DISTANCE / (KNOCKBACK_DURATION / 1000));
      this.setVelocity(vx, vy);
      this.isKnockedBack = true;
      this.knockbackTimer = KNOCKBACK_DURATION;
    }
  }

  /** Play death animation (fade out) instead of instant freeze */
  playDeathAnimation(onComplete?: () => void): void {
    if (this.isDeadAnimating) return;
    this.isDeadAnimating = true;
    this.setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        if (onComplete) onComplete();
      },
    });
  }

  /** Spawn a directional slash arc visual effect (US-042) */
  private spawnSlashEffect(): void {
    // Clean up any previous slash
    if (this.slashGfx) {
      this.slashGfx.destroy();
      this.slashGfx = null;
    }

    const dir = this._direction === "idle" ? "down" : this._direction;
    const offsets: Record<string, { dx: number; dy: number; angle: number }> = {
      up:    { dx: 0,  dy: -1, angle: -Math.PI / 2 },
      down:  { dx: 0,  dy:  1, angle:  Math.PI / 2 },
      left:  { dx: -1, dy:  0, angle:  Math.PI },
      right: { dx:  1, dy:  0, angle:  0 },
    };

    const o = offsets[dir];
    const reach = 22; // how far the arc extends from player centre
    const originX = this.x + o.dx * 12;
    const originY = this.y + o.dy * 12;

    const gfx = this.scene.add.graphics();
    gfx.setDepth(15);
    this.slashGfx = gfx;

    // Draw the slash arc: two concentric arcs forming a swoosh shape
    gfx.lineStyle(3, 0xffffff, 0.9);
    gfx.beginPath();
    gfx.arc(originX, originY, reach, o.angle - 0.8, o.angle + 0.8, false);
    gfx.strokePath();

    gfx.lineStyle(2, 0xccddff, 0.7);
    gfx.beginPath();
    gfx.arc(originX, originY, reach + 4, o.angle - 0.5, o.angle + 0.5, false);
    gfx.strokePath();

    gfx.lineStyle(1, 0xffffff, 0.4);
    gfx.beginPath();
    gfx.arc(originX, originY, reach - 4, o.angle - 0.6, o.angle + 0.6, false);
    gfx.strokePath();

    // Animate: scale up slightly then fade and destroy over 200ms
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 200,
      ease: "Power2",
      onComplete: () => {
        gfx.destroy();
        if (this.slashGfx === gfx) {
          this.slashGfx = null;
        }
      },
    });
  }

  /** Apply a movement slow debuff (e.g. from spike traps) */
  applySlow(multiplier: number, duration: number): void {
    this.slowMultiplier = multiplier;
    this.slowTimer = duration;
  }

  private updateInvincibility(delta: number): void {
    if (!this.isInvincible) return;
    this.invincibleTimer -= delta;
    // Blink effect
    this.setAlpha(Math.floor(this.invincibleTimer / 100) % 2 === 0 ? 1 : 0.4);
    if (this.invincibleTimer <= 0) {
      this.isInvincible = false;
      this.setAlpha(1);
    }
  }

  update(_delta: number, time?: number): void {
    // Update attack boost timer (even when dead, so it cleans up)
    if (this._attackBoosted) {
      this._attackBoostTimer -= _delta;
      if (this._attackBoostTimer <= 0) {
        this._attackBoosted = false;
        this._attackBoostTimer = 0;
      }
    }

    if (!this.alive) return;

    // Update slow debuff timer
    if (this.slowTimer > 0) {
      this.slowTimer -= _delta;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowMultiplier = 1.0;
      }
    }

    // During knockback, count down and skip input
    if (this.isKnockedBack) {
      this.knockbackTimer -= _delta;
      this.updateInvincibility(_delta);
      if (this.knockbackTimer <= 0) {
        this.isKnockedBack = false;
        this.setVelocity(0, 0);
      }
      return;
    }

    this.updateInvincibility(_delta);

    if (!this.cursors || !this.wasd) return;

    const left =
      this.cursors.left.isDown || this.wasd.A.isDown;
    const right =
      this.cursors.right.isDown || this.wasd.D.isDown;
    const up =
      this.cursors.up.isDown || this.wasd.W.isDown;
    const down =
      this.cursors.down.isDown || this.wasd.S.isDown;

    let vx = 0;
    let vy = 0;

    if (left) vx = -1;
    else if (right) vx = 1;

    if (up) vy = -1;
    else if (down) vy = 1;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    }

    this.setVelocity(vx * this.speed * this.slowMultiplier, vy * this.speed * this.slowMultiplier);

    // Determine direction and animation
    const isMoving = vx !== 0 || vy !== 0;

    if (isMoving) {
      // Use the last pressed dominant axis
      if (Math.abs(vx) > Math.abs(vy)) {
        this._direction = vx > 0 ? "right" : "left";
      } else if (vy !== 0) {
        this._direction = vy > 0 ? "down" : "up";
      }
      if (!this.isAttacking) {
        this.play(`walk-${this._direction}`, true);
      }
    } else {
      if (this._direction !== "idle" && !this.isAttacking) {
        this.play(`idle-${this._direction}`, true);
      }
    }

    // Handle attack input
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      const now = time ?? this.scene.time.now;
      if (now - this.lastAttackTime >= ATTACK_COOLDOWN) {
        this.lastAttackTime = now;
        this.isAttacking = true;
        this.play(`idle-${this._direction === "idle" ? "down" : this._direction}`, true);
        // Spawn slash visual effect (US-042)
        this.spawnSlashEffect();
        // Emit event so GameScene can handle hit detection
        this.scene.events.emit("player-attack");
        // End attack state after a short delay
        this.scene.time.delayedCall(200, () => {
          this.isAttacking = false;
        });
      }
    }
  }
}
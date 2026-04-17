import Phaser from "phaser";

const SLIME_SPEED = 60;
const DIR_CHANGE_MIN = 1500;
const DIR_CHANGE_MAX = 3500;
const SLIME_MAX_HP = 3;

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

  takeDamage(amount: number): void {
    this._hp = Math.max(0, this._hp - amount);
    if (this._hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.setVelocity(0, 0);
    this.setActive(false);
    this.setVisible(false);
    this.destroy();
  }

  update(delta: number): void {
    if (!this.active) return;
    this.dirTimer += delta;
    if (this.dirTimer >= this.dirInterval) {
      this.pickDirection();
    }
  }
}

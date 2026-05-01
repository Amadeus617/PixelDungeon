import Phaser from "phaser";

const INTERACT_RANGE = 60;

/** A chest that can be opened when the player has a key. */
export class Chest extends Phaser.Physics.Arcade.Sprite {
  private opened = false;

  static readonly INTERACT_RANGE = INTERACT_RANGE;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "chest_closed");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(3);
    this.setDepth(5);

    // Set physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setOffset(0, 0);
    body.setEnable(true);
    this.setImmovable(true);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Check if a position is close enough to interact. */
  isInRange(px: number, py: number): boolean {
    const dx = this.x - px;
    const dy = this.y - py;
    return Math.sqrt(dx * dx + dy * dy) <= INTERACT_RANGE;
  }

  /** Open the chest. Returns true on success. Plays scale bounce + golden flash animation (US-063). */
  open(): boolean {
    if (this.opened) return false;
    this.opened = true;
    this.setTexture("chest_open");

    // Golden flash on open
    this.setTint(0xffdd44);

    // Scale bounce animation: 3 (current) → 3.9 → 3 over 300ms
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 3, to: 3.9 },
      scaleY: { from: 3, to: 3.9 },
      duration: 150,
      ease: "Quad.easeOut",
      yoyo: true,
      onComplete: () => {
        this.clearTint();
      },
    });

    return true;
  }
}

import Phaser from "phaser";

const INTERACT_RANGE = 60;

/** A chest that can be opened when the player has a key. */
export class Chest extends Phaser.GameObjects.Sprite {
  private opened = false;

  static readonly INTERACT_RANGE = INTERACT_RANGE;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "chest_closed");
    scene.add.existing(this);
    this.setScale(3);
    this.setDepth(5);
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

  /** Open the chest. Returns true on success. */
  open(): boolean {
    if (this.opened) return false;
    this.opened = true;
    this.setTexture("chest_open");
    return true;
  }
}

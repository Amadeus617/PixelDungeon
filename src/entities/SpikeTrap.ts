import Phaser from "phaser";

const TRAP_DAMAGE = 1;
const SLOW_DURATION = 500; // ms
const SLOW_MULTIPLIER = 0.5; // halve movement speed
const ACTIVATION_COOLDOWN = 2000; // ms before trap can trigger again

/**
 * A floor spike trap placed in corridors.
 * Visually distinct from normal floor tiles (spike texture).
 * Triggers on player overlap: deals 1 damage and slows movement for 500ms.
 * Has a cooldown so it doesn't re-trigger immediately.
 */
export class SpikeTrap extends Phaser.GameObjects.Sprite {
  private activated = false;
  private cooldownTimer: number = 0;
  private onDamage: ((amount: number) => void) | null = null;
  private onSlow: ((multiplier: number, duration: number) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "spike_trap_inactive");
    scene.add.existing(this);
    this.setScale(3);
    this.setDepth(1); // Above floor tiles but below entities
  }

  /** Set callbacks for damage and slow effects */
  setCallbacks(
    onDamage: (amount: number) => void,
    onSlow: (multiplier: number, duration: number) => void
  ): void {
    this.onDamage = onDamage;
    this.onSlow = onSlow;
  }

  /** Called when player overlaps the trap. Returns true if trap triggered. */
  trigger(): boolean {
    if (this.activated) return false;
    this.activated = true;

    // Switch to active sprite
    this.setTexture("spike_trap_active");

    // Apply damage
    if (this.onDamage) {
      this.onDamage(TRAP_DAMAGE);
    }

    // Apply slow effect
    if (this.onSlow) {
      this.onSlow(SLOW_MULTIPLIER, SLOW_DURATION);
    }

    // Start cooldown — after cooldown, deactivate the trap
    this.cooldownTimer = ACTIVATION_COOLDOWN;

    return true;
  }

  update(delta: number): void {
    if (!this.activated) return;

    this.cooldownTimer -= delta;
    if (this.cooldownTimer <= 0) {
      this.activated = false;
      this.setTexture("spike_trap_inactive");
    }
  }
}

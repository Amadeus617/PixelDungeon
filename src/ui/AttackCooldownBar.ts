import Phaser from "phaser";
import { Player } from "@/entities/Player";

// GDD specs: barWidth=16, barHeight=2, barOffsetY=12, normalColor=0x00ff00
const BAR_WIDTH = 16;
const BAR_HEIGHT = 2;
const BAR_OFFSET_Y = 14; // below sprite center
const NORMAL_COLOR = 0x00ff00;
const FLASH_DURATION = 100; // ms flash when cooldown completes

/**
 * A tiny cooldown bar rendered below the Player sprite.
 * Shows attack cooldown progress: full → empty over 400ms.
 * Flashes briefly when cooldown completes (ready to attack again).
 * (US-688)
 */
export class AttackCooldownBar extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private fill!: Phaser.GameObjects.Rectangle;
  private player: Player;
  private wasCoolingDown: boolean = false;
  private flashActive: boolean = false;

  constructor(scene: Phaser.Scene, player: Player) {
    super(scene, player.x, player.y + BAR_OFFSET_Y);
    scene.add.existing(this);
    this.player = player;
    this.setDepth(12); // above player (10), below slash effects (15)

    // Background
    this.bg = scene.add.rectangle(0, 0, BAR_WIDTH + 2, BAR_HEIGHT + 2, 0x000000, 0.5);
    this.bg.setOrigin(0.5);
    this.add(this.bg);

    // Fill bar
    this.fill = scene.add.rectangle(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT, NORMAL_COLOR);
    this.fill.setOrigin(0);
    this.add(this.fill);

    // Start hidden (no cooldown active)
    this.setVisible(false);
  }

  /** Call every frame. */
  update(): void {
    if (!this.player.alive) {
      this.setVisible(false);
      return;
    }

    // Follow player position
    this.setPosition(this.player.x, this.player.y + BAR_OFFSET_Y);

    const remaining = this.player.attackCooldownRemaining;
    const total = Player.ATTACK_COOLDOWN;
    const isCoolingDown = remaining > 0;

    if (isCoolingDown) {
      this.setVisible(true);
      // Progress from 1 (just attacked) → 0 (ready)
      const pct = remaining / total;
      this.fill.width = BAR_WIDTH * pct;
      this.fill.setFillStyle(NORMAL_COLOR);
      this.wasCoolingDown = true;
    } else if (this.wasCoolingDown) {
      // Cooldown just completed — flash effect
      this.wasCoolingDown = false;
      this.triggerFlash();
    }

    // Hide when flash is done and not cooling down
    if (!isCoolingDown && !this.flashActive) {
      this.setVisible(false);
    }
  }

  /** Brief flash when cooldown completes. */
  private triggerFlash(): void {
    this.flashActive = true;
    this.setVisible(true);
    this.fill.width = BAR_WIDTH;
    this.fill.setFillStyle(0xffffff); // bright white flash

    this.scene.tweens.add({
      targets: this.fill,
      alpha: 0,
      duration: FLASH_DURATION,
      ease: "Power2",
      onComplete: () => {
        this.fill.setAlpha(1);
        this.fill.setFillStyle(NORMAL_COLOR);
        this.flashActive = false;
        this.setVisible(false);
      },
    });
  }

  override destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
  }
}

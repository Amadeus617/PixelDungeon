import Phaser from "phaser";
import { Inventory } from "@/systems/Inventory";
import { Player } from "@/entities/Player";
import { ScoreSystem } from "@/systems/ScoreSystem";
import type { RoomCameraSystem } from "@/systems/RoomCameraSystem";

const HP_BAR_WIDTH = 200;
const HP_BAR_HEIGHT = 14;
const HP_BAR_PAD = 2;
const ROOM_NAME_DISPLAY_MS = 2000; // how long to show room name

/** Heads-up display showing HP bar, inventory contents, and coin count. */
export class HUD extends Phaser.GameObjects.Container {
  // Key section
  private keyIcon!: Phaser.GameObjects.Image;
  private keyLabel!: Phaser.GameObjects.Text;
  private bg!: Phaser.GameObjects.Rectangle;

  // HP section
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;

  // Coin section
  private coinIcon!: Phaser.GameObjects.Image;
  private coinLabel!: Phaser.GameObjects.Text;

  // Score section
  private scoreLabel!: Phaser.GameObjects.Text;

  // Attack boost indicator
  private attackBoostIcon!: Phaser.GameObjects.Image;
  private attackBoostLabel!: Phaser.GameObjects.Text;

  // Room name overlay
  private roomNameText!: Phaser.GameObjects.Text;
  private roomNameBg!: Phaser.GameObjects.Rectangle;
  private roomNameTimer: Phaser.Time.TimerEvent | null = null;

  private player: Player;
  private inventory: Inventory;
  private getCoinCount: () => number;
  private scoreSystem: ScoreSystem;
  private roomCameraSystem?: RoomCameraSystem;
  private getAttackBoosted: () => boolean;

  constructor(
    scene: Phaser.Scene,
    inventory: Inventory,
    player: Player,
    getCoinCount: () => number,
    scoreSystem: ScoreSystem,
    roomCameraSystem?: RoomCameraSystem,
    getAttackBoosted: () => boolean = () => false
  ) {
    super(scene, 10, 10);
    scene.add.existing(this);
    this.setDepth(100).setScrollFactor(0);
    this.player = player;
    this.inventory = inventory;
    this.getCoinCount = getCoinCount;
    this.scoreSystem = scoreSystem;
    this.roomCameraSystem = roomCameraSystem;

    this.getAttackBoosted = getAttackBoosted;

    // --- HP Bar ---
    const hpBarBg = scene.add.rectangle(
      0, 0,
      HP_BAR_WIDTH + HP_BAR_PAD * 2,
      HP_BAR_HEIGHT + HP_BAR_PAD * 2,
      0x000000, 0.6
    );
    hpBarBg.setOrigin(0);
    this.add(hpBarBg);

    this.hpBarFill = scene.add.rectangle(
      HP_BAR_PAD, HP_BAR_PAD,
      HP_BAR_WIDTH, HP_BAR_HEIGHT,
      0x00ff00
    );
    this.hpBarFill.setOrigin(0);
    this.add(this.hpBarFill);

    this.hpText = scene.add.text(
      HP_BAR_PAD + HP_BAR_WIDTH / 2,
      HP_BAR_PAD + HP_BAR_HEIGHT / 2,
      `${player.hp}/${player.maxHp}`,
      {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    this.hpText.setOrigin(0.5);
    this.add(this.hpText);

    // --- Key section (below HP bar) ---
    const keyY = HP_BAR_HEIGHT + HP_BAR_PAD * 2 + 8;
    this.bg = scene.add.rectangle(0, keyY, 130, 36, 0x000000, 0.6);
    this.bg.setOrigin(0);
    this.add(this.bg);

    this.keyIcon = scene.add.image(12, keyY + 18, "key_item");
    this.keyIcon.setScale(2);
    this.keyIcon.setOrigin(0);
    this.keyIcon.setVisible(false);
    this.add(this.keyIcon);

    this.keyLabel = scene.add.text(38, keyY + 8, "Key", {
      fontSize: "14px",
      color: "#ffff00",
      fontFamily: "monospace",
    });
    this.keyLabel.setVisible(false);
    this.add(this.keyLabel);

    // --- Coin section (below key section) ---
    const coinY = keyY + 44;
    const coinBg = scene.add.rectangle(0, coinY, 130, 36, 0x000000, 0.6);
    coinBg.setOrigin(0);
    this.add(coinBg);

    this.coinIcon = scene.add.image(12, coinY + 18, "coin");
    this.coinIcon.setScale(2);
    this.coinIcon.setOrigin(0);
    this.add(this.coinIcon);

    this.coinLabel = scene.add.text(38, coinY + 8, "Coins: 0", {
      fontSize: "14px",
      color: "#ffd700",
      fontFamily: "monospace",
    });
    this.add(this.coinLabel);

    // --- Score section (below coin section) ---
    const scoreY = coinY + 44;
    const scoreBg = scene.add.rectangle(0, scoreY, 160, 36, 0x000000, 0.6);
    scoreBg.setOrigin(0);
    this.add(scoreBg);

    this.scoreLabel = scene.add.text(12, scoreY + 8, "Score: 0", {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    this.add(this.scoreLabel);

    // --- Attack boost section (below score section) ---
    const boostY = scoreY + 44;
    const boostBg = scene.add.rectangle(0, boostY, 160, 36, 0x000000, 0.6);
    boostBg.setOrigin(0);
    this.add(boostBg);

    this.attackBoostIcon = scene.add.image(12, boostY + 18, "attack_boost");
    this.attackBoostIcon.setScale(2);
    this.attackBoostIcon.setOrigin(0);
    this.attackBoostIcon.setVisible(false);
    this.add(this.attackBoostIcon);

    this.attackBoostLabel = scene.add.text(38, boostY + 8, "ATK x2!", {
      fontSize: "14px",
      color: "#ff4444",
      fontFamily: "monospace",
    });
    this.attackBoostLabel.setVisible(false);
    this.add(this.attackBoostLabel);

    // --- Room name overlay (centered, shown briefly on room change) ---
    const gameWidth = (scene.game.config.width as number) || 800;
    const roomNameX = gameWidth / 2 - 80;

    this.roomNameBg = scene.add.rectangle(roomNameX, -10, 180, 40, 0x000000, 0.7);
    this.roomNameBg.setOrigin(0);
    this.roomNameBg.setVisible(false);
    this.add(this.roomNameBg);

    this.roomNameText = scene.add.text(roomNameX + 90, 10, "", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 3,
    });
    this.roomNameText.setOrigin(0.5, 0);
    this.roomNameText.setVisible(false);
    this.roomNameText.setAlpha(0);
    this.add(this.roomNameText);

    // Listen for room changes from the camera system
    if (this.roomCameraSystem) {
      this.roomCameraSystem.setOnRoomChanged((_idx, _room, _prevIdx) => {
        this.showRoomName(this.getRoomLabel(_idx));
      });
    }
  }

  /** Show a room name overlay that fades out after a brief delay */
  private showRoomName(name: string): void {
    this.roomNameText.setText(name);
    this.roomNameBg.setVisible(true);
    this.roomNameText.setVisible(true);
    this.roomNameText.setAlpha(1);

    // Clear any existing timer
    if (this.roomNameTimer) {
      this.roomNameTimer.remove();
    }

    // Fade out after delay
    this.roomNameTimer = this.scene.time.delayedCall(ROOM_NAME_DISPLAY_MS, () => {
      this.scene.tweens.add({
        targets: [this.roomNameText, this.roomNameBg],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.roomNameText.setVisible(false);
          this.roomNameBg.setVisible(false);
        },
      });
      this.roomNameTimer = null;
    });
  }

  /** Generate a room label from its index */
  private getRoomLabel(roomIndex: number): string {
    const labels = ["Entrance Hall", "Guard Room", "Dark Chamber", "Treasure Vault", "Exit Passage"];
    if (roomIndex < labels.length) return labels[roomIndex];
    return `Room ${roomIndex + 1}`;
  }

  /** Call every frame to keep HUD in sync with player and inventory. */
  update(): void {
    const ratio = this.player.hp / this.player.maxHp;
    this.hpBarFill.width = HP_BAR_WIDTH * Math.max(0, ratio);

    let color: number;
    if (ratio > 0.6) {
      color = 0x00ff00; // green
    } else if (ratio > 0.3) {
      color = 0xffff00; // yellow
    } else {
      color = 0xff0000; // red
    }
    this.hpBarFill.setFillStyle(color);
    this.hpText.setText(`${this.player.hp}/${this.player.maxHp}`);

    const hasKey = this.inventory.has("key");
    this.keyIcon.setVisible(hasKey);
    this.keyLabel.setVisible(hasKey);

    this.coinLabel.setText(`Coins: ${this.getCoinCount()}`);

    this.scoreLabel.setText(`Score: ${this.scoreSystem.score}`);

    const boosted = this.getAttackBoosted();
    this.attackBoostIcon.setVisible(boosted);
    this.attackBoostLabel.setVisible(boosted);
  }
}

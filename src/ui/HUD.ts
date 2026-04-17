import Phaser from "phaser";
import { Inventory } from "@/systems/Inventory";
import { Player } from "@/entities/Player";

const HP_BAR_WIDTH = 200;
const HP_BAR_HEIGHT = 14;
const HP_BAR_PAD = 2;

/** Heads-up display showing HP bar and inventory contents. */
export class HUD extends Phaser.GameObjects.Container {
  // Key section
  private keyIcon!: Phaser.GameObjects.Image;
  private keyLabel!: Phaser.GameObjects.Text;
  private bg!: Phaser.GameObjects.Rectangle;

  // HP section
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;

  private player: Player;
  private inventory: Inventory;

  constructor(scene: Phaser.Scene, inventory: Inventory, player: Player) {
    super(scene, 10, 10);
    scene.add.existing(this);
    this.setDepth(100).setScrollFactor(0);
    this.player = player;
    this.inventory = inventory;

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
  }
}

import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.load.spritesheet("knight", "assets/sprites/knight.png", {
      frameWidth: 16,
      frameHeight: 16,
    });

    this.load.spritesheet("slime", "assets/sprites/slime.png", {
      frameWidth: 16,
      frameHeight: 16,
    });

    this.load.image("dungeon_tiles", "assets/tiles/dungeon_tiles.png");
  }

  create(): void {
    // Generate key texture (simple yellow key shape)
    if (!this.textures.exists("key_item")) {
      const g = this.add.graphics();
      g.fillStyle(0xffd700, 1);
      // Key head (circle)
      g.fillCircle(6, 4, 4);
      // Key shaft
      g.fillRect(5, 6, 2, 7);
      // Key teeth
      g.fillRect(5, 10, 4, 2);
      g.fillRect(5, 12, 3, 2);
      g.generateTexture("key_item", 16, 16);
      g.destroy();
    }

    // Generate chest closed texture
    if (!this.textures.exists("chest_closed")) {
      const g = this.add.graphics();
      // Chest body (brown)
      g.fillStyle(0x8b4513, 1);
      g.fillRect(2, 6, 12, 8);
      // Chest lid (darker brown)
      g.fillStyle(0x654321, 1);
      g.fillRect(2, 4, 12, 4);
      // Lock plate
      g.fillStyle(0xffd700, 1);
      g.fillRect(6, 8, 4, 4);
      // Lock hole
      g.fillStyle(0x000000, 1);
      g.fillRect(7, 9, 2, 2);
      g.generateTexture("chest_closed", 16, 16);
      g.destroy();
    }

    // Generate chest open texture
    if (!this.textures.exists("chest_open")) {
      const g = this.add.graphics();
      // Chest body (brown)
      g.fillStyle(0x8b4513, 1);
      g.fillRect(2, 6, 12, 8);
      // Chest lid open (darker brown, rotated up)
      g.fillStyle(0x654321, 1);
      g.fillRect(2, 1, 12, 4);
      // Interior glow
      g.fillStyle(0xffd700, 1);
      g.fillRect(4, 7, 8, 5);
      g.generateTexture("chest_open", 16, 16);
      g.destroy();
    }

    // Row 0 (frames 0-3):  down
    // Row 1 (frames 4-7):  left
    // Row 2 (frames 8-11): right
    // Row 3 (frames 12-15): up
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNumbers("knight", { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNumbers("knight", { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNumbers("knight", { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNumbers("knight", { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "idle-down",
      frames: [{ key: "knight", frame: 0 }],
      frameRate: 1,
    });
    this.anims.create({
      key: "idle-left",
      frames: [{ key: "knight", frame: 4 }],
      frameRate: 1,
    });
    this.anims.create({
      key: "idle-right",
      frames: [{ key: "knight", frame: 8 }],
      frameRate: 1,
    });
    this.anims.create({
      key: "idle-up",
      frames: [{ key: "knight", frame: 12 }],
      frameRate: 1,
    });

    // Slime animations
    this.anims.create({
      key: "slime-idle",
      frames: this.anims.generateFrameNumbers("slime", { start: 0, end: 1 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: "slime-move",
      frames: this.anims.generateFrameNumbers("slime", { start: 2, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    this.scene.start("GameScene");
  }
}

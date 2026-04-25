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

    // Generate health potion texture
    if (!this.textures.exists("health_potion")) {
      const g = this.add.graphics();
      // Potion body (red)
      g.fillStyle(0xff0000, 1);
      g.fillRect(5, 5, 6, 8);
      // Potion neck
      g.fillStyle(0xff3333, 1);
      g.fillRect(6, 3, 4, 3);
      // Potion cork
      g.fillStyle(0x8b4513, 1);
      g.fillRect(6, 2, 4, 2);
      // Highlight
      g.fillStyle(0xff6666, 1);
      g.fillRect(6, 6, 2, 4);
      g.generateTexture("health_potion", 16, 16);
      g.destroy();
    }

    // Generate coin texture
    if (!this.textures.exists("coin")) {
      const g = this.add.graphics();
      g.fillStyle(0xffd700, 1);
      g.fillCircle(8, 8, 6);
      g.fillStyle(0xdaa520, 1);
      g.fillCircle(8, 8, 4);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(8, 8, 2);
      g.generateTexture("coin", 16, 16);
      g.destroy();
    }

    // Generate attack boost (sword) texture
    if (!this.textures.exists("attack_boost")) {
      const g = this.add.graphics();
      // Blade (silver/white)
      g.fillStyle(0xc0c0c0, 1);
      g.fillRect(7, 1, 2, 9);
      // Blade tip
      g.fillRect(6, 1, 4, 2);
      // Guard (gold)
      g.fillStyle(0xffd700, 1);
      g.fillRect(4, 9, 8, 2);
      // Handle (brown)
      g.fillStyle(0x8b4513, 1);
      g.fillRect(7, 11, 2, 4);
      // Pommel (gold)
      g.fillStyle(0xffd700, 1);
      g.fillRect(6, 14, 4, 2);
      // Blade highlight
      g.fillStyle(0xe8e8e8, 1);
      g.fillRect(7, 3, 1, 6);
      g.generateTexture("attack_boost", 16, 16);
      g.destroy();
    }

    // Generate spike trap inactive texture (spikes retracted — subtle floor hazard)
    if (!this.textures.exists("spike_trap_inactive")) {
      const g = this.add.graphics();
      // Dark base (slightly different from regular floor)
      g.fillStyle(0x3a3a4a, 1);
      g.fillRect(2, 2, 12, 12);
      // Small dots hinting at retracted spikes
      g.fillStyle(0x6a6a7a, 1);
      g.fillRect(4, 4, 2, 2);
      g.fillRect(10, 4, 2, 2);
      g.fillRect(4, 10, 2, 2);
      g.fillRect(10, 10, 2, 2);
      g.fillRect(7, 7, 2, 2);
      g.generateTexture("spike_trap_inactive", 16, 16);
      g.destroy();
    }

    // Generate spike trap active texture (spikes extended)
    if (!this.textures.exists("spike_trap_active")) {
      const g = this.add.graphics();
      // Dark base
      g.fillStyle(0x3a3a4a, 1);
      g.fillRect(2, 2, 12, 12);
      // Metallic spikes (silver)
      g.fillStyle(0xc0c0c0, 1);
      // Center spike cluster
      g.fillRect(5, 3, 2, 4);
      g.fillRect(9, 3, 2, 4);
      g.fillRect(3, 6, 2, 4);
      g.fillRect(11, 6, 2, 4);
      g.fillRect(6, 8, 2, 4);
      g.fillRect(9, 8, 2, 4);
      // Spike highlights (brighter)
      g.fillStyle(0xe0e0e0, 1);
      g.fillRect(5, 3, 1, 2);
      g.fillRect(9, 3, 1, 2);
      g.fillRect(3, 6, 1, 2);
      g.fillRect(11, 6, 1, 2);
      // Red tint for danger
      g.fillStyle(0xff4444, 0.3);
      g.fillRect(2, 2, 12, 12);
      g.generateTexture("spike_trap_active", 16, 16);
      g.destroy();
    }

    // Generate skeleton sprite (procedural 4-frame spritesheet)
    if (!this.textures.exists("skeleton")) {
      const g = this.add.graphics();
      for (let frame = 0; frame < 4; frame++) {
        const ox = frame * 16;
        // Skull
        g.fillStyle(0xe8e8d0, 1);
        g.fillRoundedRect(ox + 4, 1, 8, 8, 2);
        // Eye sockets
        g.fillStyle(0x1a0a2e, 1);
        g.fillRect(ox + 5, 3, 2, 2);
        g.fillRect(ox + 9, 3, 2, 2);
        // Jaw
        g.fillStyle(0xd0d0b8, 1);
        g.fillRect(ox + 5, 7, 6, 2);
        // Teeth
        g.fillStyle(0x1a0a2e, 1);
        g.fillRect(ox + 6, 7, 1, 1);
        g.fillRect(ox + 8, 7, 1, 1);
        g.fillRect(ox + 10, 7, 1, 1);
        // Ribcage
        g.fillStyle(0xd0d0b8, 1);
        g.fillRect(ox + 6, 9, 4, 4);
        g.fillStyle(0x1a0a2e, 1);
        g.fillRect(ox + 7, 10, 2, 1);
        // Arms (animate slightly per frame)
        g.fillStyle(0xd0d0b8, 1);
        const armOffset = frame % 2 === 0 ? 0 : 1;
        g.fillRect(ox + 4, 9 + armOffset, 2, 3);
        g.fillRect(ox + 10, 9 + (1 - armOffset), 2, 3);
        // Legs (animate per frame)
        const legSpread = frame % 2 === 0 ? 0 : 1;
        g.fillStyle(0xd0d0b8, 1);
        g.fillRect(ox + 6 - legSpread, 13, 2, 3);
        g.fillRect(ox + 8 + legSpread, 13, 2, 3);
      }
      g.generateTexture("skeleton", 64, 16);
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

    // Skeleton animations
    this.anims.create({
      key: "skeleton-idle",
      frames: this.anims.generateFrameNumbers("skeleton", { start: 0, end: 1 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: "skeleton-move",
      frames: this.anims.generateFrameNumbers("skeleton", { start: 2, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    this.scene.start("GameScene");
  }
}

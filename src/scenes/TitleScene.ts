import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private versionText!: Phaser.GameObjects.Text;
  private particles: Phaser.GameObjects.Arc[] = [];
  private elapsed = 0;

  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    const { width, height } = this.scale;
    this.elapsed = 0;

    // Dark background with subtle gradient feel
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    // Decorative pixel particles floating
    for (let i = 0; i < 30; i++) {
      const px = Phaser.Math.Between(0, width);
      const py = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
      const color = [0xffd700, 0x44aa44, 0x6666ff, 0xff4444][Phaser.Math.Between(0, 3)];
      const particle = this.add.circle(px, py, size, color, alpha);
      particle.setData("speedY", Phaser.Math.FloatBetween(-15, -40));
      particle.setData("speedX", Phaser.Math.FloatBetween(-8, 8));
      this.particles.push(particle);
    }

    // Decorative dungeon frame
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x555577, 0.6);
    frame.strokeRect(width / 2 - 180, height / 2 - 140, 360, 240);
    frame.lineStyle(1, 0x333355, 0.4);
    frame.strokeRect(width / 2 - 176, height / 2 - 136, 352, 232);

    // Sword decorations on sides
    this.drawPixelSword(width / 2 - 200, height / 2 - 40);
    this.drawPixelSword(width / 2 + 192, height / 2 - 40);

    // Game title with pixel-style shadow
    this.titleText = this.add
      .text(width / 2, height / 2 - 70, "PixelDungeon", {
        fontFamily: '"Courier New", monospace',
        fontSize: "48px",
        color: "#ffd700",
        stroke: "#553300",
        strokeThickness: 4,
        align: "center",
      })
      .setOrigin(0.5);

    // Subtitle
    this.subtitleText = this.add
      .text(width / 2, height / 2 - 20, "A Roguelike Adventure", {
        fontFamily: '"Courier New", monospace',
        fontSize: "16px",
        color: "#8888aa",
        align: "center",
      })
      .setOrigin(0.5);

    // "Press SPACE to Start" prompt — will blink via update
    this.promptText = this.add
      .text(width / 2, height / 2 + 50, "Press SPACE or ENTER to Start", {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);

    // Controls hint
    this.add
      .text(width / 2, height / 2 + 90, "WASD: Move | SPACE: Attack | ESC: Pause", {
        fontFamily: '"Courier New", monospace',
        fontSize: "12px",
        color: "#555577",
        align: "center",
      })
      .setOrigin(0.5);

    // Version
    this.versionText = this.add
      .text(width - 10, height - 10, "v0.1.0", {
        fontFamily: '"Courier New", monospace',
        fontSize: "10px",
        color: "#333355",
        align: "right",
      })
      .setOrigin(1, 1);

    // Title gentle floating tween
    this.tweens.add({
      targets: this.titleText,
      y: height / 2 - 66,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Input listeners
    this.input.keyboard!.once("keydown-SPACE", () => this.startGame());
    this.input.keyboard!.once("keydown-ENTER", () => this.startGame());

    // Also allow any key after a short delay (so accidental taps during transition don't skip)
    this.time.delayedCall(500, () => {
      this.input.keyboard!.once("keydown", () => this.startGame());
    });
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta;

    // Blink prompt text
    const blinkAlpha = Math.abs(Math.sin(this.elapsed / 600 * Math.PI));
    this.promptText.setAlpha(Phaser.Math.Clamp(blinkAlpha, 0.3, 1.0));

    // Animate floating particles
    const { width, height } = this.scale;
    for (const p of this.particles) {
      const speedY = p.getData("speedY") as number;
      const speedX = p.getData("speedX") as number;
      p.y += speedY * (delta / 1000);
      p.x += speedX * (delta / 1000);
      if (p.y < -5) {
        p.y = height + 5;
        p.x = Phaser.Math.Between(0, width);
      }
      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;
    }
  }

  private startGame(): void {
    // Guard against double-trigger
    if (this.scene.isActive("TitleScene")) {
      this.scene.start("BootScene");
    }
  }

  private drawPixelSword(x: number, y: number): void {
    const g = this.add.graphics();
    // Blade
    g.fillStyle(0xaaaacc, 1);
    g.fillRect(x + 3, y - 20, 2, 20);
    // Blade tip
    g.fillStyle(0xaaaacc, 1);
    g.fillRect(x + 3, y - 22, 2, 2);
    g.fillRect(x + 4, y - 24, 1, 2);
    // Guard
    g.fillStyle(0xffd700, 1);
    g.fillRect(x, y, 8, 2);
    // Handle
    g.fillStyle(0x8b4513, 1);
    g.fillRect(x + 3, y + 2, 2, 8);
    // Pommel
    g.fillStyle(0xffd700, 1);
    g.fillRect(x + 2, y + 9, 4, 2);
    g.setAlpha(0.5);
  }
}

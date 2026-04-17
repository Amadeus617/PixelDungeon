import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config";
import type { GameResult } from "./GameScene";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultScene" });
  }

  create(data: { result: GameResult }): void {
    const { result } = data;

    // Semi-transparent overlay
    const bg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.7
    );

    // Title text
    const isWin = result === "win";
    const titleText = isWin ? "VICTORY!" : "GAME OVER";
    const titleColor = isWin ? "#00ff00" : "#ff0000";

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, titleText, {
      fontSize: "48px",
      color: titleColor,
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitleText = isWin
      ? "You defeated all enemies and claimed the treasure!"
      : "You have fallen in the dungeon...";
    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, subtitleText, {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
      wordWrap: { width: GAME_WIDTH - 100 },
      align: "center",
    });
    subtitle.setOrigin(0.5);

    // Restart prompt
    const restart = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 80,
      "Press SPACE or ENTER to restart",
      {
        fontSize: "18px",
        color: "#cccccc",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    restart.setOrigin(0.5);

    // Blink the restart prompt
    this.tweens.add({
      targets: restart,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Input to restart
    if (this.input.keyboard) {
      const spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );
      const enterKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ENTER
      );

      this.events.on("update", () => {
        if (
          Phaser.Input.Keyboard.JustDown(spaceKey) ||
          Phaser.Input.Keyboard.JustDown(enterKey)
        ) {
          this.scene.start("GameScene");
        }
      });
    }
  }
}

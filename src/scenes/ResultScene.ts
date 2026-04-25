import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config";
import type { GameResult } from "./GameScene";
import { ScoreSystem } from "@/systems/ScoreSystem";

const HIGH_SCORE_KEY = "dungeon_roguelike_high_score";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultScene" });
  }

  create(data: { result: GameResult; score?: number; killCount?: number; coinCount?: number; elapsedTime?: number }): void {
    const { result, score, killCount, coinCount, elapsedTime } = data;
    const isWin = result === "win";

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
    const titleText = isWin ? "VICTORY!" : "GAME OVER";
    const titleColor = isWin ? "#00ff00" : "#ff0000";

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, titleText, {
      fontSize: "48px",
      color: titleColor,
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    // Subtitle — win text reflects actual victory condition (find key, reach stairs, escape)
    const subtitleText = isWin
      ? "You found the key, reached the stairs, and escaped the dungeon!"
      : "You have fallen in the dungeon...";
    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 65, subtitleText, {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
      wordWrap: { width: GAME_WIDTH - 100 },
      align: "center",
    });
    subtitle.setOrigin(0.5);

    // --- Game statistics ---
    let statsY = GAME_HEIGHT / 2 - 20;
    const statsStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: "18px",
      color: "#dddddd",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
    };

    // Show game statistics on both win and lose
    if (killCount !== undefined) {
      const statsLines = [
        `Enemies Defeated: ${killCount}`,
        `Coins Collected: ${coinCount ?? 0}`,
      ];
      // Add elapsed time if available (US-035)
      if (elapsedTime !== undefined) {
        const mins = Math.floor(elapsedTime / 60);
        const secs = elapsedTime % 60;
        statsLines.push(`Time: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
      for (const line of statsLines) {
        const statText = this.add.text(GAME_WIDTH / 2, statsY, line, statsStyle);
        statText.setOrigin(0.5);
        statsY += 28;
      }
    }
    // --- End game statistics ---

    // Score display with high score comparison
    const scoreSystem = new ScoreSystem();

    if (score !== undefined) {
      const prevHigh = scoreSystem.getHighScore();
      const isNewRecord = score > prevHigh;

      // Save new high score to localStorage
      if (isNewRecord) {
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(score));
        } catch {
          // localStorage unavailable
        }
      }

      const finalScoreY = statsY + 10;
      const scoreText = this.add.text(GAME_WIDTH / 2, finalScoreY, `Final Score: ${score}`, {
        fontSize: "24px",
        color: "#ffd700",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 3,
      });
      scoreText.setOrigin(0.5);

      // High score display
      const highScoreY = finalScoreY + 35;

      if (isNewRecord) {
        // New record highlight
        const newRecordText = this.add.text(GAME_WIDTH / 2, highScoreY, `★ NEW RECORD! ★`, {
          fontSize: "22px",
          color: "#ff4500",
          fontFamily: "monospace",
          stroke: "#000000",
          strokeThickness: 3,
        });
        newRecordText.setOrigin(0.5);

        // Pulse animation for new record
        this.tweens.add({
          targets: newRecordText,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      } else if (prevHigh > 0) {
        // Show existing high score (only when there is a history)
        const highScoreText = this.add.text(GAME_WIDTH / 2, highScoreY, `Best: ${prevHigh}`, {
          fontSize: "18px",
          color: "#888888",
          fontFamily: "monospace",
          stroke: "#000000",
          strokeThickness: 2,
        });
        highScoreText.setOrigin(0.5);
      }
    }

    // Restart prompt
    const restart = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 100,
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

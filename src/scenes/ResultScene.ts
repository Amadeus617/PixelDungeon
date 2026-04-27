import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config";
import type { GameResult } from "./GameScene";
import { ScoreSystem } from "@/systems/ScoreSystem";

const HIGH_SCORE_KEY = "dungeon_roguelike_high_score";

interface ResultSceneData {
  result: GameResult;
  score?: number;
  killCount?: number;
  coinCount?: number;
  elapsedTime?: number;
  potionUsedCount?: number;
  roomsExplored?: number;
}

/** Stat entry for the detailed stats panel */
interface StatEntry {
  icon: string;
  label: string;
  value: string;
  color: string;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultScene" });
  }

  create(data: ResultSceneData): void {
    const { result, score, killCount, coinCount, elapsedTime, potionUsedCount, roomsExplored } = data;
    const isWin = result === "win";

    // Semi-transparent overlay
    const bg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.75
    );

    // Title text
    const titleText = isWin ? "VICTORY!" : "GAME OVER";
    const titleColor = isWin ? "#00ff00" : "#ff0000";

    const title = this.add.text(GAME_WIDTH / 2, 55, titleText, {
      fontSize: "48px",
      color: titleColor,
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitleText = isWin
      ? "You found the key, reached the stairs, and escaped the dungeon!"
      : "You have fallen in the dungeon...";
    const subtitle = this.add.text(GAME_WIDTH / 2, 95, subtitleText, {
      fontSize: "14px",
      color: "#bbbbbb",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
      wordWrap: { width: GAME_WIDTH - 100 },
      align: "center",
    });
    subtitle.setOrigin(0.5);

    // --- Detailed Statistics Panel ---
    // Build stats panel background
    const panelX = GAME_WIDTH / 2;
    const panelY = 200;
    const panelW = 400;
    const panelH = 210;

    // Panel border
    const panelBorder = this.add.rectangle(
      panelX, panelY, panelW + 4, panelH + 4,
      isWin ? 0x225522 : 0x552222, 0.8
    );
    panelBorder.setOrigin(0.5);
    panelBorder.setStrokeStyle(2, isWin ? 0x44ff44 : 0xff4444, 0.6);

    // Panel inner bg
    const panelBg = this.add.rectangle(
      panelX, panelY, panelW, panelH,
      0x111111, 0.85
    );
    panelBg.setOrigin(0.5);

    // Panel title
    const panelTitle = this.add.text(panelX, panelY - panelH / 2 + 18, "📊 Run Statistics", {
      fontSize: "18px",
      color: "#ffd700",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
    });
    panelTitle.setOrigin(0.5);

    // Build stats entries
    const stats: StatEntry[] = [];

    // Enemies defeated
    stats.push({
      icon: "⚔️",
      label: "Enemies Defeated",
      value: String(killCount ?? 0),
      color: "#ff6666",
    });

    // Coins collected
    stats.push({
      icon: "🪙",
      label: "Coins Collected",
      value: String(coinCount ?? 0),
      color: "#ffd700",
    });

    // Potions used
    stats.push({
      icon: "🧪",
      label: "Potions Used",
      value: String(potionUsedCount ?? 0),
      color: "#44dd44",
    });

    // Rooms explored
    stats.push({
      icon: "🗺️",
      label: "Rooms Explored",
      value: String(roomsExplored ?? 1),
      color: "#6699ff",
    });

    // Elapsed time
    if (elapsedTime !== undefined) {
      const mins = Math.floor(elapsedTime / 60);
      const secs = elapsedTime % 60;
      stats.push({
        icon: "⏱️",
        label: "Clear Time",
        value: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
        color: "#dddddd",
      });
    }

    // Render stats in two-column layout
    const statsStartY = panelY - panelH / 2 + 45;
    const leftColX = panelX - panelW / 2 + 20;
    const rightColX = panelX + 20;
    const rowHeight = 32;

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? leftColX : rightColX;
      const y = statsStartY + row * rowHeight;

      // Icon + label
      const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: "14px",
        color: "#aaaaaa",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 1,
      };
      const label = this.add.text(x, y, `${stat.icon} ${stat.label}`, labelStyle);
      label.setOrigin(0, 0);

      // Value (right-aligned to column width)
      const valueStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: "18px",
        color: stat.color,
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      };
      const value = this.add.text(x + 170, y, stat.value, valueStyle);
      value.setOrigin(0, 0);
    }

    // --- End Detailed Statistics Panel ---

    // Score display with high score comparison
    const scoreSystem = new ScoreSystem();
    const scoreY = panelY + panelH / 2 + 30;

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

      const scoreText = this.add.text(GAME_WIDTH / 2, scoreY, `Final Score: ${score}`, {
        fontSize: "28px",
        color: "#ffd700",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 3,
      });
      scoreText.setOrigin(0.5);

      // High score display
      const highScoreY = scoreY + 35;

      if (isNewRecord) {
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
      GAME_HEIGHT - 40,
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

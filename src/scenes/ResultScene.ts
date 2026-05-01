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
  scoreBreakdown?: {
    coins: number;
    enemies: number;
    roomClears: number;
    timeBonus: number;
  };
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
    const { result, score, killCount, coinCount, elapsedTime, potionUsedCount, roomsExplored, scoreBreakdown } = data;
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

    // --- Score Breakdown Panel (US-053) ---
    if (scoreBreakdown) {
      const bdX = GAME_WIDTH / 2;
      const bdY = panelY + panelH / 2 + 15;
      const bdW = 400;
      const bdH = 110;

      // Panel border
      const bdBorder = this.add.rectangle(
        bdX, bdY, bdW + 4, bdH + 4,
        0x222244, 0.8
      );
      bdBorder.setOrigin(0.5);
      bdBorder.setStrokeStyle(2, 0x8888ff, 0.6);

      // Panel inner bg
      const bdBg = this.add.rectangle(
        bdX, bdY, bdW, bdH,
        0x111111, 0.85
      );
      bdBg.setOrigin(0.5);

      // Panel title
      const bdTitle = this.add.text(bdX, bdY - bdH / 2 + 18, "💰 Score Breakdown", {
        fontSize: "18px",
        color: "#ffd700",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      });
      bdTitle.setOrigin(0.5);

      // Breakdown rows
      const breakdownEntries = [
        { icon: "🪙", label: "Coins", value: scoreBreakdown.coins, color: "#ffd700" },
        { icon: "⚔️", label: "Enemies", value: scoreBreakdown.enemies, color: "#ff6666" },
        { icon: "🏠", label: "Room Clears", value: scoreBreakdown.roomClears, color: "#44dd44" },
        { icon: "⏱️", label: "Time Bonus", value: scoreBreakdown.timeBonus, color: "#88ccff" },
      ];

      const bdStartY = bdY - bdH / 2 + 42;
      const bdLeftX = bdX - bdW / 2 + 20;
      const bdRightX = bdX + 20;
      const bdRowH = 26;

      for (let i = 0; i < breakdownEntries.length; i++) {
        const entry = breakdownEntries[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? bdLeftX : bdRightX;
        const y = bdStartY + row * bdRowH;

        const bLabel = this.add.text(x, y, `${entry.icon} ${entry.label}`, {
          fontSize: "13px",
          color: "#aaaaaa",
          fontFamily: "monospace",
          stroke: "#000000",
          strokeThickness: 1,
        });
        bLabel.setOrigin(0, 0);

        const bValue = this.add.text(x + 150, y, `+${entry.value}`, {
          fontSize: "16px",
          color: entry.color,
          fontFamily: "monospace",
          stroke: "#000000",
          strokeThickness: 2,
        });
        bValue.setOrigin(0, 0);
      }
    }
    // --- End Score Breakdown Panel ---

    // Score display with high score comparison
    const scoreSystem = new ScoreSystem();
    // Adjust scoreY to account for score breakdown panel (US-053)
    const scoreY = scoreBreakdown
      ? panelY + panelH / 2 + 15 + 110 / 2 + 40  // after breakdown panel
      : panelY + panelH / 2 + 30;                  // original position

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

    // Input to restart — keyboard events instead of update polling
    if (this.input.keyboard) {
      this.input.keyboard.once("keydown-SPACE", () => this.restart());
      this.input.keyboard.once("keydown-ENTER", () => this.restart());
    }
  }

  private restart(): void {
    if (!this.scene.isActive()) return;
    // Go through TitleScene for proper flow (run count, boot assets)
    this.scene.start("TitleScene");
  }

  /**
   * Phaser scene lifecycle: called when this scene is shut down or replaced.
   * Cleans up tweens, keyboard listeners, and event listeners to prevent memory leaks.
   */
  shutdown(): void {
    // Stop all tweens (blinking restart prompt, new record pulse, etc.)
    this.tweens.killAll();

    // Remove keyboard listeners
    if (this.input.keyboard) {
      this.input.keyboard.off("keydown-SPACE");
      this.input.keyboard.off("keydown-ENTER");
    }
  }
}

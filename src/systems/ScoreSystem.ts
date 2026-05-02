/** Simple score tracker for the roguelike game. */

const HIGH_SCORE_KEY = "dungeon_roguelike_high_score";

export class ScoreSystem {
  private _score = 0;

  // Point constants
  static readonly COIN_POINTS = 10;
  static readonly ENEMY_POINTS = 50;
  static readonly ROOM_CLEAR_POINTS = 100;

  // Combo system constants (US-581)
  static readonly COMBO_WINDOW_MS = 3000; // 3-second combo window
  static readonly MULTIPLIER_PER_COMBO = 0.5; // +0.5x per combo tier
  static readonly MAX_MULTIPLIER = 3.0; // Max 3x multiplier

  // Time bonus thresholds (US-053)
  static readonly TIME_BONUS_TIERS: readonly { maxSeconds: number; points: number }[] = [
    { maxSeconds: 60, points: 500 },   // Under 1 min: +500
    { maxSeconds: 120, points: 300 },  // Under 2 min: +300
    { maxSeconds: 180, points: 200 },  // Under 3 min: +200
    { maxSeconds: 300, points: 100 },  // Under 5 min: +100
  ];

  // Score breakdown tracking
  private _coinScore = 0;
  private _enemyScore = 0;
  private _roomClearScore = 0;
  private _timeBonusScore = 0;

  // Combo tracking
  private _comboCount = 0;
  private _lastKillTime = 0;
  private _currentMultiplier = 1.0;
  private _comboTimer: ReturnType<typeof setTimeout> | null = null;
  private _onComboReset: (() => void) | null = null;

  /** Callback invoked when combo resets (for HUD update) */
  setOnComboReset(cb: () => void): void {
    this._onComboReset = cb;
  }

  /** Current combo count (number of consecutive kills within window) */
  get comboCount(): number {
    return this._comboCount;
  }

  /** Current score multiplier based on combo */
  get currentMultiplier(): number {
    return this._currentMultiplier;
  }

  /** Remaining combo window in ms, or 0 if no active combo */
  get comboRemainingMs(): number {
    if (this._comboCount === 0) return 0;
    const elapsed = Date.now() - this._lastKillTime;
    return Math.max(0, ScoreSystem.COMBO_WINDOW_MS - elapsed);
  }

  get score(): number {
    return this._score;
  }

  /** Breakdown of score by category */
  get breakdown(): { coins: number; enemies: number; roomClears: number; timeBonus: number; total: number } {
    return {
      coins: this._coinScore,
      enemies: this._enemyScore,
      roomClears: this._roomClearScore,
      timeBonus: this._timeBonusScore,
      total: this._score,
    };
  }

  /** Add points for collecting a coin (+10). */
  addCoinPoints(): void {
    this._score += ScoreSystem.COIN_POINTS;
    this._coinScore += ScoreSystem.COIN_POINTS;
  }

  /**
   * Add points for defeating an enemy, with combo multiplier.
   * Returns the actual points awarded (after multiplier).
   */
  addEnemyPoints(): number {
    const now = Date.now();

    // Check if within combo window
    if (this._comboCount > 0 && (now - this._lastKillTime) <= ScoreSystem.COMBO_WINDOW_MS) {
      this._comboCount++;
    } else {
      this._comboCount = 1;
    }

    // Calculate multiplier: 1x base, +0.5 per combo tier, max 3x
    this._currentMultiplier = Math.min(
      1.0 + ScoreSystem.MULTIPLIER_PER_COMBO * (this._comboCount - 1),
      ScoreSystem.MAX_MULTIPLIER
    );

    const points = Math.round(ScoreSystem.ENEMY_POINTS * this._currentMultiplier);
    this._score += points;
    this._enemyScore += points;

    this._lastKillTime = now;

    // Reset combo timer
    this._clearComboTimer();
    this._comboTimer = setTimeout(() => {
      this._resetCombo();
    }, ScoreSystem.COMBO_WINDOW_MS);

    return points;
  }

  /** Add points for clearing a room (+100). */
  addRoomClearPoints(): void {
    this._score += ScoreSystem.ROOM_CLEAR_POINTS;
    this._roomClearScore += ScoreSystem.ROOM_CLEAR_POINTS;
  }

  /**
   * Calculate and add time bonus based on elapsed seconds.
   * Returns the bonus points awarded.
   */
  addTimeBonus(elapsedSeconds: number): number {
    let bonus = 0;
    for (const tier of ScoreSystem.TIME_BONUS_TIERS) {
      if (elapsedSeconds <= tier.maxSeconds) {
        bonus = tier.points;
        break;
      }
    }
    this._score += bonus;
    this._timeBonusScore += bonus;
    return bonus;
  }

  /** Reset combo state */
  private _resetCombo(): void {
    this._comboCount = 0;
    this._currentMultiplier = 1.0;
    this._comboTimer = null;
    if (this._onComboReset) {
      this._onComboReset();
    }
  }

  /** Clear the combo timer */
  private _clearComboTimer(): void {
    if (this._comboTimer !== null) {
      clearTimeout(this._comboTimer);
      this._comboTimer = null;
    }
  }

  /** Reset score to zero (e.g. on restart). */
  reset(): void {
    this._score = 0;
    this._coinScore = 0;
    this._enemyScore = 0;
    this._roomClearScore = 0;
    this._timeBonusScore = 0;
    this._clearComboTimer();
    this._comboCount = 0;
    this._currentMultiplier = 1.0;
    this._lastKillTime = 0;
  }

  /**
   * Save current score to localStorage if it is a new high score.
   * Returns true if this is a new record.
   */
  saveHighScore(): boolean {
    const current = this.getHighScore();
    if (this._score > current) {
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(this._score));
      } catch {
        // localStorage may be unavailable (e.g. private browsing)
      }
      return true;
    }
    return false;
  }

  /** Retrieve the stored high score, or 0 if none exists. */
  getHighScore(): number {
    try {
      const stored = localStorage.getItem(HIGH_SCORE_KEY);
      return stored !== null ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }
}

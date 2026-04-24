/** Simple score tracker for the roguelike game. */

const HIGH_SCORE_KEY = "dungeon_roguelike_high_score";

export class ScoreSystem {
  private _score = 0;

  static readonly COIN_POINTS = 10;
  static readonly ENEMY_POINTS = 50;

  get score(): number {
    return this._score;
  }

  /** Add points for collecting a coin (+10). */
  addCoinPoints(): void {
    this._score += ScoreSystem.COIN_POINTS;
  }

  /** Add points for defeating an enemy (+50). */
  addEnemyPoints(): void {
    this._score += ScoreSystem.ENEMY_POINTS;
  }

  /** Reset score to zero (e.g. on restart). */
  reset(): void {
    this._score = 0;
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

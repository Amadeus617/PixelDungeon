/** Simple score tracker for the roguelike game. */

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
}

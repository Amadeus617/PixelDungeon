import { CollectibleBase } from "./CollectibleBase";
import type { FloatConfig } from "./CollectibleBase";

const SMALL_FLOAT: FloatConfig = { floatDist: 3, floatDuration: 850, swingAngle: 6, swingDuration: 1100 };
const NORMAL_FLOAT: FloatConfig = { floatDist: 5, floatDuration: 850, swingAngle: 6, swingDuration: 1100 };

/**
 * A collectible health potion. Restores HP on pickup (up to maxHp).
 * @param isSmall If true, this is a dropped potion (smaller, blue tint) vs map-spawned.
 */
export class HealthPotion extends CollectibleBase {
  private _isSmall: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, isSmall: boolean = false) {
    super(scene, x, y, "health_potion", isSmall ? 2.2 : 3, isSmall ? SMALL_FLOAT : NORMAL_FLOAT);
    this._isSmall = isSmall;

    // Visual differentiation (US-592): dropped potions get a light-blue tint
    if (isSmall) {
      this.setTint(0xaaddff);
    }
  }

  /** Whether this is a small dropped potion (vs map-spawned). */
  get isSmall(): boolean {
    return this._isSmall;
  }
}

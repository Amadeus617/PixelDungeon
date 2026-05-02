import { CollectibleBase } from "./CollectibleBase";

/** A collectible coin pickup. Disappears when the player overlaps it. */
export class Coin extends CollectibleBase {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "coin", 3, {
      floatDist: 6,
      floatDuration: 800,
      swingAngle: 8,
      swingDuration: 1200,
    });
  }
}

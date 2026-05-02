import { CollectibleBase } from "./CollectibleBase";

/** A collectible key pickup. Disappears when the player overlaps it. */
export class KeyItem extends CollectibleBase {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "key_item", 3, {
      floatDist: 6,
      floatDuration: 900,
      swingAngle: 10,
      swingDuration: 1400,
    });
  }
}

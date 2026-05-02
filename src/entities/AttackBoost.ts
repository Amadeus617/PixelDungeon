import { CollectibleBase } from "./CollectibleBase";

/** A collectible sword power-up. Doubles attack damage for a timed duration. */
export class AttackBoost extends CollectibleBase {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "attack_boost", 3, {
      floatDist: 5,
      floatDuration: 750,
      swingAngle: 6,
      swingDuration: 1000,
    });
  }
}

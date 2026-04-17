import Phaser from "phaser";
import { generateRoom, isWall } from "./dungeonData";

export class DungeonMap {
  readonly TILE_SIZE = 16;
  readonly MAP_WIDTH = 16;
  readonly MAP_HEIGHT = 16;

  private tilemap!: Phaser.Tilemaps.Tilemap;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private collideIndices: number[] = [];

  constructor(scene: Phaser.Scene) {
    const roomData = generateRoom();
    this.buildCollideIndices();

    // Create tilemap programmatically
    this.tilemap = scene.make.tilemap({
      data: roomData,
      tileWidth: this.TILE_SIZE,
      tileHeight: this.TILE_SIZE,
    });

    const tileset = this.tilemap.addTilesetImage(
      "dungeon_tiles",
      undefined,
      this.TILE_SIZE,
      this.TILE_SIZE,
      0,
      0
    );

    if (!tileset) {
      throw new Error("Failed to create tileset from 'dungeon_tiles'");
    }

    this.wallLayer = this.tilemap.createLayer(0, tileset, 0, 0)!;
    this.wallLayer.setDepth(0);
    this.wallLayer.setScale(3);

    // Mark wall tiles as collidable
    this.wallLayer.setCollisionByExclusion([-1], false);
    // Only collide with actual wall tiles
    for (const idx of this.collideIndices) {
      this.wallLayer.setCollision(idx, true);
    }
  }

  private buildCollideIndices(): void {
    // Check all possible tile indices (0..63)
    for (let i = 0; i < 64; i++) {
      if (isWall(i)) {
        this.collideIndices.push(i);
      }
    }
  }

  /** The wall tilemap layer – add physics colliders against this */
  getWallLayer(): Phaser.Tilemaps.TilemapLayer {
    return this.wallLayer;
  }

  /** World pixel width */
  getWorldWidth(): number {
    return this.MAP_WIDTH * this.TILE_SIZE * 3;
  }

  /** World pixel height */
  getWorldHeight(): number {
    return this.MAP_HEIGHT * this.TILE_SIZE * 3;
  }

  /** Get a random floor tile center position in world pixels */
  getRandomFloorPos(scene: Phaser.Scene): { x: number; y: number } {
    const scale = 3;
    for (;;) {
      const col = Phaser.Math.Between(1, this.MAP_WIDTH - 2);
      const row = Phaser.Math.Between(1, this.MAP_HEIGHT - 2);
      const tile = this.wallLayer.getTileAt(col, row);
      if (tile && !isWall(tile.index)) {
        return {
          x: (col * this.TILE_SIZE + this.TILE_SIZE / 2) * scale,
          y: (row * this.TILE_SIZE + this.TILE_SIZE / 2) * scale,
        };
      }
    }
  }

  destroy(): void {
    this.wallLayer.destroy();
    this.tilemap.destroy();
  }
}

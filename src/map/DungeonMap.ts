import Phaser from "phaser";
import { generateDungeon, isWall, type DungeonData, getRandomFloorInRoom } from "./dungeonData";

export class DungeonMap {
  readonly TILE_SIZE = 16;
  private dungeonData!: DungeonData;

  private tilemap!: Phaser.Tilemaps.Tilemap;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private collideIndices: number[] = [];
  private scale: number = 3;

  constructor(scene: Phaser.Scene) {
    this.dungeonData = generateDungeon();
    this.buildCollideIndices();

    // Create tilemap programmatically
    this.tilemap = scene.make.tilemap({
      data: this.dungeonData.tiles,
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
    this.wallLayer.setScale(this.scale);

    // Mark wall tiles as collidable
    this.wallLayer.setCollisionByExclusion([-1], false);
    for (const idx of this.collideIndices) {
      this.wallLayer.setCollision(idx, true);
    }
  }

  private buildCollideIndices(): void {
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
    return this.dungeonData.width * this.TILE_SIZE * this.scale;
  }

  /** World pixel height */
  returnWorldHeight(): number {
    return this.dungeonData.height * this.TILE_SIZE * this.scale;
  }

  getWorldHeight(): number {
    return this.dungeonData.height * this.TILE_SIZE * this.scale;
  }

  /** Map width in tiles */
  getMapWidth(): number {
    return this.dungeonData.width;
  }

  /** Map height in tiles */
  getMapHeight(): number {
    return this.dungeonData.height;
  }

  /** Get the dungeon data */
  getDungeonData(): DungeonData {
    return this.dungeonData;
  }

  /** Get a random floor tile center position in world pixels (any room) */
  getRandomFloorPos(scene: Phaser.Scene): { x: number; y: number } {
    const room = this.dungeonData.rooms[
      Math.floor(Math.random() * this.dungeonData.rooms.length)
    ];
    return this.getRandomFloorPosInRoom(room);
  }

  /** Get a random floor position in a specific room (world pixels) */
  getRandomFloorPosInRoom(room: { col: number; row: number; width: number; height: number }): { x: number; y: number } {
    const pos = getRandomFloorInRoom(this.dungeonData.tiles, room);
    return {
      x: (pos.col * this.TILE_SIZE + this.TILE_SIZE / 2) * this.scale,
      y: (pos.row * this.TILE_SIZE + this.TILE_SIZE / 2) * this.scale,
    };
  }

  /** Get the player spawn position (entrance room center, world pixels) */
  getPlayerSpawnPos(): { x: number; y: number } {
    return this.getRandomFloorPosInRoom(this.dungeonData.entranceRoom);
  }

  /** Get stairs (exit) position in world pixels */
  getStairsPos(): { x: number; y: number } {
    const exitRoom = this.dungeonData.exitRoom;
    // Find the stairs tile
    for (let r = exitRoom.row; r < exitRoom.row + exitRoom.height; r++) {
      for (let c = exitRoom.col; c < exitRoom.col + exitRoom.width; c++) {
        if (this.dungeonData.tiles[r]?.[c] === 34) { // T.STAIRS
          return {
            x: (c * this.TILE_SIZE + this.TILE_SIZE / 2) * this.scale,
            y: (r * this.TILE_SIZE + this.TILE_SIZE / 2) * this.scale,
          };
        }
      }
    }
    // Fallback to room center
    return this.getRandomFloorPosInRoom(exitRoom);
  }

  /** Check if a world pixel position is on the stairs tile */
  isOnStairs(worldX: number, worldY: number): boolean {
    const col = Math.floor(worldX / (this.TILE_SIZE * this.scale));
    const row = Math.floor(worldY / (this.TILE_SIZE * this.scale));
    if (row < 0 || row >= this.dungeonData.height || col < 0 || col >= this.dungeonData.width) {
      return false;
    }
    return this.dungeonData.tiles[row][col] === 34; // T.STAIRS
  }

  destroy(): void {
    this.wallLayer.destroy();
    this.tilemap.destroy();
  }
}

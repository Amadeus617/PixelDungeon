import Phaser from "phaser";
import type { DungeonData, RoomDef } from "@/map";
import type { RoomCameraSystem } from "@/systems/RoomCameraSystem";

/** Minimap configuration */
const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 8;
const MINIMAP_BG_COLOR = 0x000000;
const MINIMAP_BG_ALPHA = 0.7;
const MINIMAP_BORDER_COLOR = 0x888888;

/** Dot sizes */
const ROOM_FILL_ALPHA = 0.3;
const VISITED_FILL_ALPHA = 0.6;
const CORRIDOR_COLOR = 0x555555;
const CORRIDOR_ALPHA = 0.4;
const PLAYER_COLOR = 0x00ff00;
const PLAYER_RADIUS = 3;
const ENEMY_COLOR = 0xff0000;
const ENEMY_RADIUS = 2;
const ITEM_COLOR = 0xffd700;
const ITEM_RADIUS = 2;
const CHEST_COLOR = 0xff8800;
const CHEST_RADIUS = 2;
const POTION_COLOR = 0x00ffff;
const POTION_RADIUS = 2;
const KEY_COLOR = 0xffff00;
const KEY_RADIUS = 2;
const ATTACK_BOOST_COLOR = 0xff00ff; // magenta
const ATTACK_BOOST_RADIUS = 2;

/** Exit stairs marker */
const EXIT_COLOR = 0xffd700; // gold
const EXIT_RADIUS = 4;

/**
 * A minimap HUD element that shows a bird's-eye view of the dungeon.
 * Displays explored rooms, player position, enemies, and items.
 * Only rooms that the player has visited are fully visible;
 * unvisited rooms are hidden (fog of war).
 */
export class Minimap extends Phaser.GameObjects.Container {
  private border!: Phaser.GameObjects.Rectangle;

  private dungeonData: DungeonData;
  private roomCameraSystem: RoomCameraSystem;
  private tileScale: number;
  private tileSize: number;

  // Minimap scale: maps world pixels → minimap pixels
  private mapScaleX: number;
  private mapScaleY: number;

  // Entity getters
  private getPlayer: () => Phaser.GameObjects.Sprite;
  private getSlimes: () => Phaser.GameObjects.Sprite[];
  private getSkeletons: () => Phaser.GameObjects.Sprite[];
  private getCoins: () => Phaser.GameObjects.Sprite[];
  private getChests: () => Phaser.GameObjects.Sprite[];
  private getHealthPotions: () => Phaser.GameObjects.Sprite[];
  private getKeyItem: () => Phaser.GameObjects.Sprite | null;
  private getAttackBoosts: () => Phaser.GameObjects.Sprite[];

  // Graphics for drawing
  private graphics!: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    dungeonData: DungeonData,
    roomCameraSystem: RoomCameraSystem,
    tileSize: number,
    tileScale: number,
    getPlayer: () => Phaser.GameObjects.Sprite,
    getSlimes: () => Phaser.GameObjects.Sprite[],
    getSkeletons: () => Phaser.GameObjects.Sprite[],
    getCoins: () => Phaser.GameObjects.Sprite[],
    getChests: () => Phaser.GameObjects.Sprite[],
    getHealthPotions: () => Phaser.GameObjects.Sprite[],
    getKeyItem: () => Phaser.GameObjects.Sprite | null,
    getAttackBoosts: () => Phaser.GameObjects.Sprite[]
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(101).setScrollFactor(0);

    this.dungeonData = dungeonData;
    this.roomCameraSystem = roomCameraSystem;
    this.tileSize = tileSize;
    this.tileScale = tileScale;
    this.getPlayer = getPlayer;
    this.getSlimes = getSlimes;
    this.getSkeletons = getSkeletons;
    this.getCoins = getCoins;
    this.getChests = getChests;
    this.getHealthPotions = getHealthPotions;
    this.getKeyItem = getKeyItem;
    this.getAttackBoosts = getAttackBoosts;

    const gameWidth = (scene.game.config.width as number) || 800;

    // Calculate scale factors: map the entire dungeon to the minimap area
    const worldW = dungeonData.width * tileSize * tileScale;
    const worldH = dungeonData.height * tileSize * tileScale;
    this.mapScaleX = MINIMAP_WIDTH / worldW;
    this.mapScaleY = MINIMAP_HEIGHT / worldH;

    // Position: top-right corner
    const posX = gameWidth - MINIMAP_WIDTH - MINIMAP_PADDING;
    const posY = MINIMAP_PADDING;

    // Background
    this.border = scene.add.rectangle(
      posX - 2,
      posY - 2,
      MINIMAP_WIDTH + 4,
      MINIMAP_HEIGHT + 4,
      MINIMAP_BORDER_COLOR,
      0.8
    );
    this.border.setOrigin(0);
    this.border.setScrollFactor(0);
    this.border.setDepth(100);
    this.add(this.border);

    const bg = scene.add.rectangle(
      posX,
      posY,
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
      MINIMAP_BG_COLOR,
      MINIMAP_BG_ALPHA
    );
    bg.setOrigin(0);
    this.add(bg);

    // Graphics object for drawing shapes
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(102);
    this.add(this.graphics);

    // Store position for drawing
    this.setPosition(0, 0);
    this.x = 0;
    this.y = 0;
  }

  /** Convert world pixel position to minimap pixel position */
  private worldToMinimap(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.mapScaleX,
      y: worldY * this.mapScaleY,
    };
  }

  /** Get the top-left offset of the minimap in screen space */
  private getOffset(): { ox: number; oy: number } {
    const gameWidth = (this.scene.game.config.width as number) || 800;
    return {
      ox: gameWidth - MINIMAP_WIDTH - MINIMAP_PADDING,
      oy: MINIMAP_PADDING,
    };
  }

  /** Call every frame to refresh the minimap */
  update(): void {
    const { ox, oy } = this.getOffset();
    const g = this.graphics;
    g.clear();

    const visitedRooms = this.roomCameraSystem.getVisitedRooms();

    // Draw rooms
    for (let i = 0; i < this.dungeonData.rooms.length; i++) {
      const room = this.dungeonData.rooms[i];
      const isVisited = visitedRooms.has(i);

      const roomPx = room.col * this.tileSize * this.tileScale;
      const roomPy = room.row * this.tileSize * this.tileScale;
      const roomPw = room.width * this.tileSize * this.tileScale;
      const roomPh = room.height * this.tileSize * this.tileScale;

      const mx = ox + roomPx * this.mapScaleX;
      const my = oy + roomPy * this.mapScaleY;
      const mw = roomPw * this.mapScaleX;
      const mh = roomPh * this.mapScaleY;

      if (isVisited) {
        // Visited room: solid fill
        g.fillStyle(0x444444, VISITED_FILL_ALPHA);
      } else {
        // Unvisited: dimmer
        g.fillStyle(0x222222, ROOM_FILL_ALPHA);
      }
      g.fillRoundedRect(mx, my, mw, mh, 2);

      // Room border
      g.lineStyle(1, isVisited ? 0x666666 : 0x333333, 0.6);
      g.strokeRoundedRect(mx, my, mw, mh, 2);
    }

    // Draw corridors (only between visited rooms for fog of war)
    for (const corridor of this.dungeonData.corridors) {
      const fromVisited = visitedRooms.has(corridor.fromRoom);
      const toVisited = visitedRooms.has(corridor.toRoom);
      if (!fromVisited && !toVisited) continue;

      const startWorld = {
        x: corridor.start.col * this.tileSize * this.tileScale,
        y: corridor.start.row * this.tileSize * this.tileScale,
      };
      const endWorld = {
        x: corridor.end.col * this.tileSize * this.tileScale,
        y: corridor.end.row * this.tileSize * this.tileScale,
      };

      const sx = ox + startWorld.x * this.mapScaleX;
      const sy = oy + startWorld.y * this.mapScaleY;
      const ex = ox + endWorld.x * this.mapScaleX;
      const ey = oy + endWorld.y * this.mapScaleY;

      g.lineStyle(3, CORRIDOR_COLOR, CORRIDOR_ALPHA);
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(ex, ey);
      g.strokePath();
    }

    // Draw items (only in visited rooms)
    // Coins
    const coins = this.getCoins();
    for (const coin of coins) {
      if (!coin.active) continue;
      if (!this.isInVisibleArea(coin.x, coin.y)) continue;
      const pos = this.worldToMinimap(coin.x, coin.y);
      g.fillStyle(ITEM_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, ITEM_RADIUS);
    }

    // Chests
    const chests = this.getChests();
    for (const chest of chests) {
      if (!chest.active) continue;
      if (!this.isInVisibleArea(chest.x, chest.y)) continue;
      const pos = this.worldToMinimap(chest.x, chest.y);
      g.fillStyle(CHEST_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, CHEST_RADIUS);
    }

    // Health potions
    const potions = this.getHealthPotions();
    for (const potion of potions) {
      if (!potion.active) continue;
      if (!this.isInVisibleArea(potion.x, potion.y)) continue;
      const pos = this.worldToMinimap(potion.x, potion.y);
      g.fillStyle(POTION_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, POTION_RADIUS);
    }

    // Key
    const keyItem = this.getKeyItem();
    if (keyItem && keyItem.active && this.isInVisibleArea(keyItem.x, keyItem.y)) {
      const pos = this.worldToMinimap(keyItem.x, keyItem.y);
      g.fillStyle(KEY_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, KEY_RADIUS);
    }

    // AttackBoost items
    const attackBoosts = this.getAttackBoosts();
    for (const boost of attackBoosts) {
      if (!boost.active) continue;
      if (!this.isInVisibleArea(boost.x, boost.y)) continue;
      const pos = this.worldToMinimap(boost.x, boost.y);
      g.fillStyle(ATTACK_BOOST_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, ATTACK_BOOST_RADIUS);
    }

    // Draw enemies (only in visited rooms)
    const slimes = this.getSlimes();
    for (const slime of slimes) {
      if (!slime.active) continue;
      if (!this.isInVisibleArea(slime.x, slime.y)) continue;
      const pos = this.worldToMinimap(slime.x, slime.y);
      g.fillStyle(ENEMY_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, ENEMY_RADIUS);
    }

    const skeletons = this.getSkeletons();
    for (const skeleton of skeletons) {
      if (!skeleton.active) continue;
      if (!this.isInVisibleArea(skeleton.x, skeleton.y)) continue;
      const pos = this.worldToMinimap(skeleton.x, skeleton.y);
      g.fillStyle(ENEMY_COLOR, 0.9);
      g.fillCircle(ox + pos.x, oy + pos.y, ENEMY_RADIUS);
    }

    // Draw player (always visible, pulsing)
    const player = this.getPlayer();
    const pPos = this.worldToMinimap(player.x, player.y);
    const pulse = Math.sin(this.scene.time.now / 200) * 0.3 + 0.7;
    g.fillStyle(PLAYER_COLOR, pulse);
    g.fillCircle(ox + pPos.x, oy + pPos.y, PLAYER_RADIUS);
    // White outline for visibility
    g.lineStyle(1, 0xffffff, 0.8);
    g.strokeCircle(ox + pPos.x, oy + pPos.y, PLAYER_RADIUS + 1);

    // Draw exit stairs marker (gold pulsing, only when exit room is visited)
    const exitRoom = this.dungeonData.exitRoom;
    const exitRoomIndex = this.dungeonData.rooms.indexOf(exitRoom);
    if (exitRoomIndex >= 0 && visitedRooms.has(exitRoomIndex)) {
      // Center of the exit room in world coords
      const exitWorldX = (exitRoom.col + exitRoom.width / 2) * this.tileSize * this.tileScale;
      const exitWorldY = (exitRoom.row + exitRoom.height / 2) * this.tileSize * this.tileScale;
      const ePos = this.worldToMinimap(exitWorldX, exitWorldY);

      // Pulsing animation
      const exitPulse = Math.sin(this.scene.time.now / 300) * 0.3 + 0.7;
      const exitR = EXIT_RADIUS + Math.sin(this.scene.time.now / 400) * 1;

      // Outer glow
      g.fillStyle(EXIT_COLOR, exitPulse * 0.3);
      g.fillCircle(ox + ePos.x, oy + ePos.y, exitR + 3);

      // Core marker
      g.fillStyle(EXIT_COLOR, exitPulse);
      g.fillCircle(ox + ePos.x, oy + ePos.y, exitR);

      // White outline
      g.lineStyle(1, 0xffffff, 0.6);
      g.strokeCircle(ox + ePos.x, oy + ePos.y, exitR + 1);
    }
  }

  /** Check if a world position is within any visited room or visited corridor */
  private isInVisibleArea(worldX: number, worldY: number): boolean {
    if (this.isInVisitedRoom(worldX, worldY)) return true;
    return this.isInVisitedCorridor(worldX, worldY);
  }

  /** Check if a world position is within any visited room */
  private isInVisitedRoom(worldX: number, worldY: number): boolean {
    const visited = this.roomCameraSystem.getVisitedRooms();
    for (const roomIdx of visited) {
      const room = this.dungeonData.rooms[roomIdx];
      const px = this.tileSize * this.tileScale;
      const roomPixelX = room.col * px;
      const roomPixelY = room.row * px;
      const roomPixelW = room.width * px;
      const roomPixelH = room.height * px;

      if (
        worldX >= roomPixelX &&
        worldX <= roomPixelX + roomPixelW &&
        worldY >= roomPixelY &&
        worldY <= roomPixelY + roomPixelH
      ) {
        return true;
      }
    }
    return false;
  }

  /** Check if a world position is within a corridor adjacent to a visited room */
  private isInVisitedCorridor(worldX: number, worldY: number): boolean {
    const visited = this.roomCameraSystem.getVisitedRooms();
    const px = this.tileSize * this.tileScale;

    for (const corridor of this.dungeonData.corridors) {
      // Only consider corridors adjacent to at least one visited room
      if (!visited.has(corridor.fromRoom) && !visited.has(corridor.toRoom)) continue;

      const startWorldX = corridor.start.col * px;
      const startWorldY = corridor.start.row * px;
      const endWorldX = (corridor.end.col + 1) * px;
      const endWorldY = (corridor.end.row + 1) * px;

      // Check if world position falls within the corridor bounding box
      const minX = Math.min(startWorldX, endWorldX);
      const maxX = Math.max(startWorldX, endWorldX);
      const minY = Math.min(startWorldY, endWorldY);
      const maxY = Math.max(startWorldY, endWorldY);

      if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
        return true;
      }
    }
    return false;
  }

  destroy(fromScene?: boolean): void {
    this.graphics?.destroy();
    super.destroy(fromScene);
  }
}

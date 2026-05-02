import Phaser from "phaser";
import type { DungeonData, RoomDef } from "@/map";

/** Configuration for the room camera system */
const CAMERA_LERP_X = 0.1;
const CAMERA_LERP_Y = 0.1;
const TRANSITION_DURATION = 300; // ms for fade effect (US-344)
const TRANSITION_HOLD = 50; // ms to hold the fade before fading back in
const ARROW_DISTANCE_THRESHOLD = 30; // px proximity for direction arrow (US-344)

/** Callback type for room change events */
export type RoomChangedCallback = (roomIndex: number, room: RoomDef, previousRoomIndex: number) => void;

/**
 * Manages room-based camera following and room transition effects.
 *
 * - Tracks which room the player is currently in
 * - When the player moves into a different room, triggers a short fade transition
 * - Camera bounds are locked to the current room so the view stays focused
 * - Camera smoothly follows the player via Phaser lerp
 */
export class RoomCameraSystem {
  private scene: Phaser.Scene;
  private dungeonData: DungeonData;
  private tileSize: number;
  private tileScale: number;

  /** Index into dungeonData.rooms for the room the player is currently in */
  private currentRoomIndex: number = 0;
  /** Previous room index, used for corridor re-entry detection */
  private previousRoomIndex: number = 0;
  /** Whether a room transition is currently in progress */
  private transitioning = false;
  /** Whether the camera is in corridor mode (full world bounds) */
  private inCorridor = false;
  /** Tracked set of visited room indices */
  private visitedRooms: Set<number> = new Set();
  /** Room change event callbacks (observer pattern — supports multiple listeners) */
  private onRoomChangedCallbacks: RoomChangedCallback[] = [];
  /** Direction arrow sprite shown when player nears corridor entrances (US-344) */
  private directionArrow: Phaser.GameObjects.Text | null = null;
  /** Whether the last transition was to the exit (boss) room — for golden effect (US-344) */
  private _isGoldenTransition = false;
  /** Index of the exit room */
  private exitRoomIndex: number;

  constructor(
    scene: Phaser.Scene,
    dungeonData: DungeonData,
    tileSize: number,
    tileScale: number
  ) {
    this.scene = scene;
    this.dungeonData = dungeonData;
    this.tileSize = tileSize;
    this.tileScale = tileScale;
    this.exitRoomIndex = dungeonData.rooms.indexOf(dungeonData.exitRoom);
    if (this.exitRoomIndex < 0) this.exitRoomIndex = dungeonData.rooms.length - 1;
  }

  /** Get the dungeon data */
  getDungeonData(): DungeonData {
    return this.dungeonData;
  }

  /** Get the current room index */
  getCurrentRoomIndex(): number {
    return this.currentRoomIndex;
  }

  /** Get the current room definition */
  getCurrentRoom(): RoomDef {
    return this.dungeonData.rooms[this.currentRoomIndex];
  }

  /** Whether a transition is in progress */
  isTransitioning(): boolean {
    return this.transitioning;
  }

  /** Add a callback for room change events. Supports multiple listeners. */
  setOnRoomChanged(cb: RoomChangedCallback): void {
    this.onRoomChangedCallbacks.push(cb);
  }

  /** Remove a specific room change callback */
  removeOnRoomChanged(cb: RoomChangedCallback): void {
    const idx = this.onRoomChangedCallbacks.indexOf(cb);
    if (idx >= 0) this.onRoomChangedCallbacks.splice(idx, 1);
  }

  /** Clean up references and listeners (US-594). Call in GameScene shutdown(). */
  destroy(): void {
    this.onRoomChangedCallbacks.length = 0;
    this.visitedRooms.clear();
    // Remove any pending camera fade listeners
    const cam = this.scene.cameras?.main;
    if (cam) {
      cam.off(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE);
      cam.off(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE);
    }
    // Clean up direction arrow (US-344)
    if (this.directionArrow) {
      this.directionArrow.destroy();
      this.directionArrow = null;
    }
    this.dungeonData = null as any; // release
  }

  /** Whether the last transition was a golden (exit room) transition (US-344) */
  isGoldenTransition(): boolean {
    return this._isGoldenTransition;
  }

  /** Check if a room has been visited */
  isRoomVisited(roomIndex: number): boolean {
    return this.visitedRooms.has(roomIndex);
  }

  /** Get the set of all visited room indices */
  getVisitedRooms(): ReadonlySet<number> {
    return this.visitedRooms;
  }

  /**
   * Detect which room the player is in based on world pixel position.
   * Returns the room index, or -1 if in a corridor.
   */
  private detectRoom(worldX: number, worldY: number): number {
    for (let i = 0; i < this.dungeonData.rooms.length; i++) {
      const room = this.dungeonData.rooms[i];
      const roomPixelX = room.col * this.tileSize * this.tileScale;
      const roomPixelY = room.row * this.tileSize * this.tileScale;
      const roomPixelW = room.width * this.tileSize * this.tileScale;
      const roomPixelH = room.height * this.tileSize * this.tileScale;

      if (
        worldX >= roomPixelX &&
        worldX <= roomPixelX + roomPixelW &&
        worldY >= roomPixelY &&
        worldY <= roomPixelY + roomPixelH
      ) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Set camera bounds to the current room with a small margin.
   * If the room is smaller than the viewport, center the camera on the room.
   */
  setCameraToRoom(roomIndex: number, camera?: Phaser.Cameras.Scene2D.Camera): void {
    const cam = camera ?? this.scene.cameras.main;
    const room = this.dungeonData.rooms[roomIndex];

    const px = this.tileSize * this.tileScale;
    const roomPixelX = room.col * px;
    const roomPixelY = room.row * px;
    const roomPixelW = room.width * px;
    const roomPixelH = room.height * px;

    // Use the room as camera bounds. Phaser will handle centering if room < viewport
    cam.setBounds(roomPixelX, roomPixelY, roomPixelW, roomPixelH);
  }

  /**
   * Set camera to follow the full dungeon world (for corridor transitions).
   */
  setCameraToWorld(camera?: Phaser.Cameras.Scene2D.Camera): void {
    const cam = camera ?? this.scene.cameras.main;
    const worldW = this.dungeonData.width * this.tileSize * this.tileScale;
    const worldH = this.dungeonData.height * this.tileSize * this.tileScale;
    cam.setBounds(0, 0, worldW, worldH);
  }

  /**
   * Start the camera follow with lerp for smooth movement.
   */
  startFollow(target: Phaser.GameObjects.GameObject, camera?: Phaser.Cameras.Scene2D.Camera): void {
    const cam = camera ?? this.scene.cameras.main;
    cam.startFollow(target, true, CAMERA_LERP_X, CAMERA_LERP_Y);
  }

  /**
   * Initialize the system: set initial room bounds and start camera follow.
   */
  init(target: Phaser.GameObjects.GameObject, startRoomIndex: number = 0): void {
    this.currentRoomIndex = startRoomIndex;
    this.previousRoomIndex = startRoomIndex;
    this.transitioning = false;
    this.inCorridor = false;
    this.visitedRooms.clear();
    this.visitedRooms.add(startRoomIndex);

    const cam = this.scene.cameras.main;
    this.setCameraToRoom(this.currentRoomIndex, cam);
    this.startFollow(target, cam);
  }

  /**
   * Call every frame. Checks if the player has moved into a new room
   * and triggers a transition if so.
   *
   * @param playerX - Player's world X position
   * @param playerY - Player's world Y position
   * @returns true if a transition was triggered
   */
  update(
    playerX: number,
    playerY: number
  ): boolean {
    if (this.transitioning) return false;

    const detectedRoom = this.detectRoom(playerX, playerY);

    // If player is in a corridor (room = -1), expand camera to full world
    if (detectedRoom === -1) {
      if (!this.inCorridor) {
        this.inCorridor = true;
        const cam = this.scene.cameras.main;
        this.setCameraToWorld(cam);
      }
      // Show direction arrow when in corridor (US-344)
      this.updateDirectionArrow(playerX, playerY);
      return false;
    }

    // Hide direction arrow when inside a room
    this.hideDirectionArrow();

    // Mark that we're no longer in a corridor
    if (this.inCorridor) {
      this.inCorridor = false;
    }

    // Same room, no transition needed
    if (detectedRoom === this.currentRoomIndex) return false;

    // Player entered a new room!
    this.previousRoomIndex = this.currentRoomIndex;
    this.visitedRooms.add(detectedRoom);
    // Golden transition if entering the exit room (US-344)
    this._isGoldenTransition = detectedRoom === this.exitRoomIndex;
    this.triggerTransition(detectedRoom);
    return true;
  }

  /** Check if a world position is within a room's pixel bounds */
  private isInRoomBounds(worldX: number, worldY: number, roomIndex: number): boolean {
    const room = this.dungeonData.rooms[roomIndex];
    if (!room) return false;
    const px = this.tileSize * this.tileScale;
    return (
      worldX >= room.col * px &&
      worldX <= (room.col + room.width) * px &&
      worldY >= room.row * px &&
      worldY <= (room.row + room.height) * px
    );
  }

  /**
   * Trigger a room transition with a fade effect.
   * Exit room gets a special golden transition (US-344).
   */
  private triggerTransition(
    newRoomIndex: number
  ): void {
    this.transitioning = true;
    const cam = this.scene.cameras.main;
    const isGolden = this._isGoldenTransition;

    // Fade out — gold tint for exit room, black for normal
    if (isGolden) {
      cam.fadeOut(TRANSITION_DURATION, 255, 215, 0); // gold color
    } else {
      cam.fadeOut(TRANSITION_DURATION, 0, 0, 0);
    }

    cam.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        // Switch to new room
        this.currentRoomIndex = newRoomIndex;
        this.setCameraToRoom(newRoomIndex, cam);

        // Fire all room-changed callbacks
        for (const cb of this.onRoomChangedCallbacks) {
          cb(
            newRoomIndex,
            this.dungeonData.rooms[newRoomIndex],
            this.previousRoomIndex
          );
        }

        // Brief hold then fade back in
        this.scene.time.delayedCall(TRANSITION_HOLD, () => {
          if (isGolden) {
            cam.fadeIn(TRANSITION_DURATION, 255, 215, 0); // gold fade in
          } else {
            cam.fadeIn(TRANSITION_DURATION, 0, 0, 0);
          }

          cam.once(
            Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE,
            () => {
              this.transitioning = false;
            }
          );
        });
      }
    );
  }

  /**
   * Update direction arrow when player is in a corridor (US-344).
   * Shows an arrow pointing toward the nearest corridor exit / adjacent room.
   */
  private updateDirectionArrow(playerX: number, playerY: number): void {
    // Find corridors connected to current room
    const adjacentCorridors = this.dungeonData.corridors.filter(
      c => c.fromRoom === this.currentRoomIndex || c.toRoom === this.currentRoomIndex
    );

    if (adjacentCorridors.length === 0) {
      this.hideDirectionArrow();
      return;
    }

    // Find nearest corridor endpoint (which is an exit to an adjacent room)
    let nearestDist = Infinity;
    let nearestDir = { x: 0, y: 0 };

    for (const corridor of adjacentCorridors) {
      // Determine which end of the corridor leads away from current room
      const targetRoom = corridor.fromRoom === this.currentRoomIndex
        ? corridor.toRoom
        : corridor.fromRoom;
      const targetRoomDef = this.dungeonData.rooms[targetRoom];
      if (!targetRoomDef) continue;

      const px = this.tileSize * this.tileScale;
      // Center of the target room
      const roomCX = (targetRoomDef.col + targetRoomDef.width / 2) * px;
      const roomCY = (targetRoomDef.row + targetRoomDef.height / 2) * px;

      const dx = roomCX - playerX;
      const dy = roomCY - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestDir = { x: dx, y: dy };
      }
    }

    // Show arrow only if within threshold distance of corridor exit
    if (nearestDist > ARROW_DISTANCE_THRESHOLD * 5) {
      this.hideDirectionArrow();
      return;
    }

    // Determine arrow direction character
    const angle = Math.atan2(nearestDir.y, nearestDir.x) * 180 / Math.PI;
    let arrowChar: string;
    if (angle >= -45 && angle < 45) arrowChar = '▶';
    else if (angle >= 45 && angle < 135) arrowChar = '▼';
    else if (angle >= -135 && angle < -45) arrowChar = '▲';
    else arrowChar = '◀';

    // Create or update arrow
    if (!this.directionArrow) {
      this.directionArrow = this.scene.add.text(playerX, playerY - 24, arrowChar, {
        fontSize: '20px',
        color: '#ffd700',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      });
      this.directionArrow.setOrigin(0.5);
      this.directionArrow.setDepth(300);
    }

    this.directionArrow.setText(arrowChar);
    this.directionArrow.setPosition(playerX, playerY - 24);
    this.directionArrow.setAlpha(0.8 + Math.sin(this.scene.time.now / 200) * 0.2); // pulsing
    this.directionArrow.setVisible(true);
  }

  /** Hide and clean up the direction arrow (US-344) */
  private hideDirectionArrow(): void {
    if (this.directionArrow) {
      this.directionArrow.setVisible(false);
    }
  }
}

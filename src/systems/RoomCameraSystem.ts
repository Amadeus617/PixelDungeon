import Phaser from "phaser";
import type { DungeonData, RoomDef } from "@/map";

/** Configuration for the room camera system */
const CAMERA_LERP_X = 0.1;
const CAMERA_LERP_Y = 0.1;
const TRANSITION_DURATION = 200; // ms for fade effect
const TRANSITION_HOLD = 50; // ms to hold the fade before fading back in

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
  /** Room change event callback */
  private onRoomChangedCallback?: RoomChangedCallback;

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

  /** Set a callback for room change events */
  setOnRoomChanged(cb: RoomChangedCallback): void {
    this.onRoomChangedCallback = cb;
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
      return false;
    }

    // Mark that we're no longer in a corridor
    if (this.inCorridor) {
      this.inCorridor = false;
    }

    // Same room, no transition needed
    if (detectedRoom === this.currentRoomIndex) return false;

    // Player entered a new room!
    this.previousRoomIndex = this.currentRoomIndex;
    this.visitedRooms.add(detectedRoom);
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
   */
  private triggerTransition(
    newRoomIndex: number
  ): void {
    this.transitioning = true;
    const cam = this.scene.cameras.main;

    // Fade out
    cam.fadeOut(TRANSITION_DURATION, 0, 0, 0);

    cam.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        // Switch to new room
        this.currentRoomIndex = newRoomIndex;
        this.setCameraToRoom(newRoomIndex, cam);

        // Fire room-changed callback
        if (this.onRoomChangedCallback) {
          this.onRoomChangedCallback(
            newRoomIndex,
            this.dungeonData.rooms[newRoomIndex],
            this.previousRoomIndex
          );
        }

        // Brief hold then fade back in
        this.scene.time.delayedCall(TRANSITION_HOLD, () => {
          cam.fadeIn(TRANSITION_DURATION, 0, 0, 0);

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
}

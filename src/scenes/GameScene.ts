import Phaser from "phaser";
import { Player } from "@/entities/Player";
import { Slime } from "@/entities/Slime";
import { KeyItem } from "@/entities/KeyItem";
import { Chest } from "@/entities/Chest";
import { Coin } from "@/entities/Coin";
import { HealthPotion } from "@/entities/HealthPotion";
import { DungeonMap } from "@/map";
import { Inventory } from "@/systems/Inventory";
import { ScoreSystem } from "@/systems/ScoreSystem";
import { HUD } from "@/ui/HUD";
import { RoomCameraSystem } from "@/systems/RoomCameraSystem";

const SLIME_COUNT = 4;
const COIN_COUNT = 5;
const HEALTH_POTION_COUNT = 3;
const HEALTH_POTION_HEAL = 1;
const ENEMY_CONTACT_DAMAGE = 1;
const STAIRS_REACH_DISTANCE = 40;

export type GameResult = "win" | "lose";

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private slimes: Slime[] = [];
  private slimeGroup!: Phaser.Physics.Arcade.Group;
  private dungeonMap!: DungeonMap;
  private inventory!: Inventory;
  private hud!: HUD;
  private keyItem!: KeyItem;
  private chests: Chest[] = [];
  private coins: Coin[] = [];
  private healthPotions: HealthPotion[] = [];
  private coinCount = 0;
  private scoreSystem = new ScoreSystem();
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private gameOver = false;
  private roomCameraSystem!: RoomCameraSystem;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.gameOver = false;
    this.scoreSystem.reset();

    this.dungeonMap = new DungeonMap(this);

    const worldW = this.dungeonMap.getWorldWidth();
    const worldH = this.dungeonMap.getWorldHeight();
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // Place player at the entrance room spawn point
    const spawnPos = this.dungeonMap.getPlayerSpawnPos();
    this.player = new Player(this, spawnPos.x, spawnPos.y);

    // Collide player with wall tiles
    this.physics.add.collider(this.player, this.dungeonMap.getWallLayer());

    this.player.setWorldBounds();

    // Room-based camera system with smooth follow and transition effects
    this.roomCameraSystem = new RoomCameraSystem(
      this,
      this.dungeonMap.getDungeonData(),
      this.dungeonMap.TILE_SIZE,
      3 // tile scale
    );

    // Find the room the player spawns in (entrance room)
    const entranceRoomIdx = this.dungeonMap.getDungeonData().rooms.indexOf(
      this.dungeonMap.getDungeonData().entranceRoom
    );
    this.roomCameraSystem.init(this.player, entranceRoomIdx);

    // Create a physics group for slimes
    this.slimeGroup = this.physics.add.group();

    // Spawn slimes in rooms other than the entrance
    const wallLayer = this.dungeonMap.getWallLayer();
    const dungeonData = this.dungeonMap.getDungeonData();
    for (let i = 0; i < SLIME_COUNT; i++) {
      // Distribute slimes across non-entrance rooms
      const roomIdx = 1 + (i % (dungeonData.rooms.length - 1)); // rooms 1..N-1
      const room = dungeonData.rooms[roomIdx];
      const spos = this.dungeonMap.getRandomFloorPosInRoom(room);
      const slime = new Slime(this, spos.x, spos.y);
      this.physics.add.collider(slime, wallLayer, (_slimeObj) => {
        slime.onHitWall();
      });
      this.slimes.push(slime);
      this.slimeGroup.add(slime);
    }

    // Enemy contact with player → player takes damage
    this.physics.add.overlap(
      this.player,
      this.slimeGroup,
      (_playerObj, _slimeObj) => {
        this.player.takeDamage(ENEMY_CONTACT_DAMAGE);
      }
    );

    // --- Item system ---
    this.inventory = new Inventory();

    // Spawn key in a middle room
    const midRoomIdx = Math.floor(dungeonData.rooms.length / 2);
    const keyPos = this.dungeonMap.getRandomFloorPosInRoom(dungeonData.rooms[midRoomIdx]);
    this.keyItem = new KeyItem(this, keyPos.x, keyPos.y);

    // Spawn chest in a non-entrance room
    const chestRoomIdx = Math.max(1, dungeonData.rooms.length - 2);
    const chestPos = this.dungeonMap.getRandomFloorPosInRoom(dungeonData.rooms[chestRoomIdx]);
    const chest = new Chest(this, chestPos.x, chestPos.y);
    this.chests.push(chest);

    // Spawn coins across all rooms
    this.coinCount = 0;
    for (let i = 0; i < COIN_COUNT; i++) {
      const coinRoom = dungeonData.rooms[i % dungeonData.rooms.length];
      const coinPos = this.dungeonMap.getRandomFloorPosInRoom(coinRoom);
      const coin = new Coin(this, coinPos.x, coinPos.y);
      this.coins.push(coin);
    }

    // Spawn health potions across rooms
    for (let i = 0; i < HEALTH_POTION_COUNT; i++) {
      const potionRoom = dungeonData.rooms[(i + 1) % dungeonData.rooms.length];
      const potionPos = this.dungeonMap.getRandomFloorPosInRoom(potionRoom);
      const potion = new HealthPotion(this, potionPos.x, potionPos.y);
      this.healthPotions.push(potion);
    }

    // Overlap: player picks up health potions
    for (const potion of this.healthPotions) {
      this.physics.add.overlap(this.player, potion, () => {
        if (potion.collect()) {
          this.player.heal(HEALTH_POTION_HEAL);
        }
      });
    }

    // Overlap: player picks up coins
    for (const coin of this.coins) {
      this.physics.add.overlap(this.player, coin, () => {
        if (coin.collect()) {
          this.coinCount++;
          this.scoreSystem.addCoinPoints();
        }
      });
    }

    // Overlap: player picks up key
    this.physics.add.overlap(this.player, this.keyItem, () => {
      if (this.keyItem.collect()) {
        this.inventory.add("key");
      }
    });

    // Space key reference for chest interaction
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );
    }

    // HUD (needs both inventory and player for HP display)
    this.hud = new HUD(this, this.inventory, this.player, () => this.coinCount, this.scoreSystem, this.roomCameraSystem);

    // Listen for player attack events
    this.events.on("player-attack", this.handlePlayerAttack, this);
  }

  private handlePlayerAttack(): void {
    if (this.gameOver) return;

    // Filter out dead slimes
    this.slimes = this.slimes.filter((s) => s.active);

    for (const slime of this.slimes) {
      if (!slime.active) continue;
      if (this.player.isEnemyInAttackRange(slime.x, slime.y)) {
        const wasDead = slime.isDead;
        slime.takeDamage(Player.ATTACK_DAMAGE);
        // Award score only on the kill blow
        if (!wasDead && slime.isDead) {
          this.scoreSystem.addEnemyPoints();
        }
      }
    }

    // Clean up dead slimes from the group
    const deadSlimes = this.slimes.filter((s) => !s.active);
    for (const ds of deadSlimes) {
      this.slimeGroup.remove(ds, true, true);
    }
    this.slimes = this.slimes.filter((s) => s.active);
  }

  /** Try to open a nearby chest if the player has a key. */
  private handleChestInteraction(): void {
    for (const chest of this.chests) {
      if (chest.isOpen) continue;
      if (!chest.isInRange(this.player.x, this.player.y)) continue;
      if (!this.inventory.has("key")) continue;
      this.inventory.remove("key");
      chest.open();
      return; // Only open one chest per press
    }
  }

  private checkWinCondition(): boolean {
    // Win: reach the stairs in the exit room
    const stairsPos = this.dungeonMap.getStairsPos();
    const dx = this.player.x - stairsPos.x;
    const dy = this.player.y - stairsPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < STAIRS_REACH_DISTANCE;
  }

  private checkLoseCondition(): boolean {
    return !this.player.alive;
  }

  private endGame(result: GameResult): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // Freeze gameplay
    this.physics.pause();
    this.player.setVelocity(0, 0);

    // Transition to result scene after a short delay
    this.time.delayedCall(800, () => {
      this.scene.start("ResultScene", { result, score: this.scoreSystem.score });
    });
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    this.player.update(delta, time);
    // Only update living slimes
    for (const slime of this.slimes) {
      slime.update(delta);
    }

    // Chest interaction on space press (handled here to intercept before attack)
    if (
      this.spaceKey &&
      Phaser.Input.Keyboard.JustDown(this.spaceKey)
    ) {
      // Check if player is near any closed chest first
      let nearChest = false;
      for (const chest of this.chests) {
        if (!chest.isOpen && chest.isInRange(this.player.x, this.player.y)) {
          nearChest = true;
          break;
        }
      }
      if (nearChest) {
        this.handleChestInteraction();
      }
    }

    this.hud.update();

    // Update room camera system (detects room changes)
    this.roomCameraSystem.update(this.player.x, this.player.y);

    // Freeze player input during room transition
    if (this.roomCameraSystem.isTransitioning()) {
      this.player.setVelocity(0, 0);
    }

    // Check lose condition first (death takes priority)
    if (this.checkLoseCondition()) {
      this.endGame("lose");
      return;
    }

    // Check win condition: player reaches the stairs
    if (this.checkWinCondition()) {
      this.endGame("win");
    }
  }
}

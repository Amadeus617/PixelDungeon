import Phaser from "phaser";
import { Player } from "@/entities/Player";
import { Slime } from "@/entities/Slime";
import { Skeleton } from "@/entities/Skeleton";
import { KeyItem } from "@/entities/KeyItem";
import { Chest } from "@/entities/Chest";
import { Coin } from "@/entities/Coin";
import { HealthPotion } from "@/entities/HealthPotion";
import { AttackBoost } from "@/entities/AttackBoost";
import { SpikeTrap } from "@/entities/SpikeTrap";
import { DungeonMap } from "@/map";
import { isWall } from "@/map/dungeonData";
import { Inventory } from "@/systems/Inventory";
import { ScoreSystem } from "@/systems/ScoreSystem";
import { HUD } from "@/ui/HUD";
import { RoomCameraSystem } from "@/systems/RoomCameraSystem";
import { SoundManager } from "@/systems/SoundManager";

// --- Difficulty scaling (US-028) ---
const RUN_COUNT_KEY = "pixeldungeon_run_count";
const BASE_SLIME_COUNT = 4;
const SLIME_COUNT_CAP = 8;
const BASE_SKELETON_SPEED = 55;
const SPEED_INCREASE_PER_RUN = 0.1; // +10% per run
const SPEED_CAP_MULTIPLIER = 2.0;   // max 200%
// --- End difficulty scaling ---

// --- Room depth difficulty (US-044) ---
interface RoomEnemyConfig {
  slimeCount: number;
  skeletonCount: number;
}

/**
 * Returns enemy configuration for a given room based on its depth index.
 * Room 0 = entrance (no enemies).
 * Deeper rooms get progressively more and tougher enemies.
 */
function getEnemyConfigForRoom(roomIndex: number, totalRooms: number): RoomEnemyConfig {
  // Entrance room has no enemies
  if (roomIndex === 0) {
    return { slimeCount: 0, skeletonCount: 0 };
  }

  // Combat rooms: rooms 1..totalRooms-1
  const combatRoomCount = totalRooms - 1; // number of rooms that can have enemies
  const combatIndex = roomIndex - 1; // 0-based index among combat rooms
  const lastCombatRoom = combatIndex === combatRoomCount - 1;

  if (combatRoomCount <= 1) {
    // Only one combat room: moderate difficulty
    return { slimeCount: 2, skeletonCount: 1 };
  }

  // Normalize combat depth: 0.0 = first combat room, 1.0 = last combat room
  const depth = combatIndex / (combatRoomCount - 1);

  if (lastCombatRoom) {
    // Last room before exit: hardest — max enemies
    return { slimeCount: 1, skeletonCount: 3 };
  } else if (depth < 0.4) {
    // Early combat rooms: only slimes, few
    return { slimeCount: 2, skeletonCount: 0 };
  } else {
    // Mid rooms: mix of slimes and skeletons
    return { slimeCount: 2, skeletonCount: 1 };
  }
}
// --- End room depth difficulty (US-044) ---

const SKELETON_COUNT = 3; // kept for backward compat / fallback
const COIN_COUNT = 5;
const HEALTH_POTION_COUNT = 3;
const HEALTH_POTION_HEAL = 3;
const ATTACK_BOOST_COUNT = 2;
const ENEMY_CONTACT_DAMAGE = 1;
const STAIRS_REACH_DISTANCE = 40;

// --- Enemy death drop rates (US-033) ---
const SLIME_COIN_DROP_RATE = 0.3;    // 30%
const SLIME_POTION_DROP_RATE = 0.1;  // 10%
const SKELETON_COIN_DROP_RATE = 0.5; // 50%
const SKELETON_POTION_DROP_RATE = 0.15; // 15%
const DROP_POTION_HEAL = 2;          // Small potion from drop heals 2 HP (vs map potion 1 HP)
const DROP_POP_HEIGHT = 20;          // Popup arc height in px
const DROP_POP_DURATION = 400;       // Popup animation duration in ms
// --- End enemy death drop rates ---

export type GameResult = "win" | "lose";

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private slimes: Slime[] = [];
  private slimeGroup!: Phaser.Physics.Arcade.Group;
  private skeletons: Skeleton[] = [];
  private skeletonGroup!: Phaser.Physics.Arcade.Group;
  private dungeonMap!: DungeonMap;
  private inventory!: Inventory;
  private hud!: HUD;
  private keyItem!: KeyItem;
  private chests: Chest[] = [];
  private coins: Coin[] = [];
  private healthPotions: HealthPotion[] = [];
  private attackBoosts: AttackBoost[] = [];
  private spikeTraps: SpikeTrap[] = [];
  private coinCount = 0;
  private killCount = 0;
  private scoreSystem = new ScoreSystem();
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private gameOver = false;
  private isPaused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private roomCameraSystem!: RoomCameraSystem;
  private soundManager!: SoundManager;

  // Difficulty scaling state (US-028)
  private runCount = 1;
  private slimeCount = BASE_SLIME_COUNT;
  private skeletonSpeedMultiplier = 1.0;

  // Game timer (US-035)
  private startTime = 0;

  // Room clear tracking (US-040)
  private clearedRooms: Set<number> = new Set();
  private roomClearedThisFrame = false;
  private lastCheckedRoomIndex = -1;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.gameOver = false;
    this.coinCount = 0;
    this.killCount = 0;
    this.scoreSystem.reset();
    this.clearedRooms.clear();
    this.startTime = Date.now(); // Record game start time (US-035)
    this.soundManager = new SoundManager(this);

    // --- Difficulty scaling (US-028) ---
    this.runCount = this.loadRunCount();
    this.slimeCount = Math.min(BASE_SLIME_COUNT + (this.runCount - 1), SLIME_COUNT_CAP);
    this.skeletonSpeedMultiplier = Math.min(
      1.0 + (this.runCount - 1) * SPEED_INCREASE_PER_RUN,
      SPEED_CAP_MULTIPLIER
    );
    // --- End difficulty scaling ---

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

    // --- Spawn enemies per-room based on depth difficulty (US-044) ---
    this.slimeGroup = this.physics.add.group();
    this.skeletonGroup = this.physics.add.group();

    const wallLayer = this.dungeonMap.getWallLayer();
    const dungeonData = this.dungeonMap.getDungeonData();
    const totalRooms = dungeonData.rooms.length;

    for (let roomIdx = 0; roomIdx < totalRooms; roomIdx++) {
      const room = dungeonData.rooms[roomIdx];
      const config = getEnemyConfigForRoom(roomIdx, totalRooms);

      // Spawn slimes for this room
      for (let s = 0; s < config.slimeCount; s++) {
        const spos = this.dungeonMap.getRandomFloorPosInRoom(room);
        const slime = new Slime(this, spos.x, spos.y);
        this.physics.add.collider(slime, wallLayer, (_slimeObj) => {
          slime.onHitWall();
        });
        this.slimes.push(slime);
        this.slimeGroup.add(slime);
      }

      // Spawn skeletons for this room
      for (let s = 0; s < config.skeletonCount; s++) {
        const spos = this.dungeonMap.getRandomFloorPosInRoom(room);
        const skeleton = new Skeleton(this, spos.x, spos.y, this.skeletonSpeedMultiplier);
        skeleton.setPlayerRef(this.player);
        this.physics.add.collider(skeleton, wallLayer, () => {
          skeleton.onHitWall();
        });
        this.skeletons.push(skeleton);
        this.skeletonGroup.add(skeleton);
      }
    }
    // --- End room-depth enemy spawning (US-044) ---

    // Slime contact with player → player takes damage
    this.physics.add.overlap(
      this.player,
      this.slimeGroup,
      (_playerObj, slimeObj) => {
        const wasHurt = this.player.alive;
        this.player.takeDamage(ENEMY_CONTACT_DAMAGE, (slimeObj as Phaser.GameObjects.Sprite).x, (slimeObj as Phaser.GameObjects.Sprite).y);
        if (wasHurt && this.player.hp < this.player.maxHp) {
          this.soundManager.playHurt();
        }
      }
    );

    // Skeleton contact with player → player takes damage
    this.physics.add.overlap(
      this.player,
      this.skeletonGroup,
      (_playerObj, skeletonObj) => {
        this.player.takeDamage(ENEMY_CONTACT_DAMAGE, (skeletonObj as Phaser.GameObjects.Sprite).x, (skeletonObj as Phaser.GameObjects.Sprite).y);
        if (this.player.hp < this.player.maxHp) {
          this.soundManager.playHurt();
        }
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

    // Spawn attack boosts across rooms (skip entrance room)
    for (let i = 0; i < ATTACK_BOOST_COUNT; i++) {
      const boostRoom = dungeonData.rooms[(i + 1) % dungeonData.rooms.length];
      const boostPos = this.dungeonMap.getRandomFloorPosInRoom(boostRoom);
      const boost = new AttackBoost(this, boostPos.x, boostPos.y);
      this.attackBoosts.push(boost);
    }

    // Overlap: player picks up health potions
    for (const potion of this.healthPotions) {
      this.physics.add.overlap(this.player, potion, () => {
        if (potion.collect()) {
          this.player.heal(HEALTH_POTION_HEAL);
          this.soundManager.playPickup();
        }
      });
    }

    // Overlap: player picks up attack boosts
    for (const boost of this.attackBoosts) {
      this.physics.add.overlap(this.player, boost, () => {
        if (boost.collect()) {
          this.player.activateAttackBoost();
          this.soundManager.playPickup();
        }
      });
    }

    // --- Spike Traps in corridors (US-031) ---
    const spikeTrapCount = Phaser.Math.Between(0, 2);
    for (let i = 0; i < spikeTrapCount; i++) {
      const corridor = dungeonData.corridors[i % dungeonData.corridors.length];
      if (!corridor) continue;
      const trapPos = this.getCorridorFloorPos(corridor);
      if (!trapPos) continue;
      const trap = new SpikeTrap(this, trapPos.x, trapPos.y);
      trap.setCallbacks(
        (amount: number) => {
          // Damage from trap — use source position of trap itself for knockback
          this.player.takeDamage(amount, trap.x, trap.y);
          this.soundManager.playHurt();
        },
        (multiplier: number, duration: number) => {
          this.player.applySlow(multiplier, duration);
        }
      );
      this.spikeTraps.push(trap);
    }

    // Overlap: player triggers spike traps
    for (const trap of this.spikeTraps) {
      this.physics.add.overlap(this.player, trap, () => {
        trap.trigger();
      });
    }

    // Overlap: player picks up coins
    for (const coin of this.coins) {
      this.physics.add.overlap(this.player, coin, () => {
        if (coin.collect()) {
          this.coinCount++;
          this.scoreSystem.addCoinPoints();
          this.soundManager.playPickup();
        }
      });
    }

    // Overlap: player picks up key
    this.physics.add.overlap(this.player, this.keyItem, () => {
      if (this.keyItem.collect()) {
        this.inventory.add("key");
        this.soundManager.playPickup();
      }
    });

    // Space key reference for chest interaction
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );
      // ESC key for pause
      this.escKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC
      );
    }

    // Pause overlay (hidden by default)
    this.isPaused = false;
    this.createPauseOverlay();

    // HUD (needs both inventory and player for HP display)
    this.hud = new HUD(
      this,
      this.inventory,
      this.player,
      () => this.coinCount,
      this.scoreSystem,
      this.roomCameraSystem,
      () => this.player.attackBoosted,
      {
        getSlimes: () => this.slimes,
        getSkeletons: () => this.skeletons,
        getCoins: () => this.coins,
        getChests: () => this.chests,
        getHealthPotions: () => this.healthPotions,
        getKeyItem: () => this.keyItem,
      },
      this.runCount
    );

    // Listen for player attack events
    this.events.on("player-attack", this.handlePlayerAttack, this);

    // Listen for enemy death events (US-033: enemy drop loot)
    this.events.on("enemy-death", this.handleEnemyDeathDrop, this);
  }

  private handlePlayerAttack(): void {
    if (this.gameOver) return;

    // Play attack swoosh sound
    this.soundManager.playAttack();

    const damage = this.player.attackBoosted ? Player.ATTACK_DAMAGE * 2 : Player.ATTACK_DAMAGE;
    // Buff stays active for the full duration (timed, not one-shot)

    // Filter out dead slimes
    this.slimes = this.slimes.filter((s) => s.active);

    for (const slime of this.slimes) {
      if (!slime.active) continue;
      if (this.player.isEnemyInAttackRange(slime.x, slime.y)) {
        // Calculate knockback direction (away from player)
        const dx = slime.x - this.player.x;
        const dy = slime.y - this.player.y;
        const wasDead = slime.isDead;
        slime.takeDamage(damage, dx, dy);
        // Award score only on the kill blow
        if (!wasDead && slime.isDead) {
          this.killCount++;
          this.scoreSystem.addEnemyPoints();
          this.soundManager.playEnemyDeath();
        }
      }
    }

    // Clean up dead slimes from the group
    const deadSlimes = this.slimes.filter((s) => !s.active);
    for (const ds of deadSlimes) {
      this.slimeGroup.remove(ds, true, true);
    }
    this.slimes = this.slimes.filter((s) => s.active);

    // --- Attack skeletons ---
    this.skeletons = this.skeletons.filter((s) => s.active);

    for (const skeleton of this.skeletons) {
      if (!skeleton.active) continue;
      if (this.player.isEnemyInAttackRange(skeleton.x, skeleton.y)) {
        // Calculate knockback direction (away from player)
        const dx = skeleton.x - this.player.x;
        const dy = skeleton.y - this.player.y;
        const wasDead = skeleton.isDead;
        skeleton.takeDamage(damage, dx, dy);
        if (!wasDead && skeleton.isDead) {
          this.killCount++;
          this.scoreSystem.addEnemyPoints();
          this.soundManager.playEnemyDeath();
        }
      }
    }

    const deadSkeletons = this.skeletons.filter((s) => !s.active);
    for (const ds of deadSkeletons) {
      this.skeletonGroup.remove(ds, true, true);
    }
    this.skeletons = this.skeletons.filter((s) => s.active);
  }

  /** Try to open a nearby chest if the player has a key. */
  private handleChestInteraction(): void {
    for (const chest of this.chests) {
      if (chest.isOpen) continue;
      if (!chest.isInRange(this.player.x, this.player.y)) continue;
      if (!this.inventory.has("key")) continue;
      this.inventory.remove("key");
      chest.open();
      this.soundManager.playChestOpen();
      return; // Only open one chest per press
    }
  }

  /** Get a random floor position within a corridor segment (world pixels) */
  private getCorridorFloorPos(corridor: { start: { col: number; row: number }; end: { col: number; row: number } }): { x: number; y: number } | null {
    const tiles = this.dungeonMap.getDungeonData().tiles;
    const tileS = this.dungeonMap.TILE_SIZE;
    const scale = 3;
    const halfW = Math.floor(3 / 2); // CORRIDOR_WIDTH / 2

    // Try random positions along the corridor
    for (let attempt = 0; attempt < 100; attempt++) {
      const t = Math.random();
      const col = Math.round(corridor.start.col + t * (corridor.end.col - corridor.start.col));
      const row = Math.round(corridor.start.row + t * (corridor.end.row - corridor.start.row));

      // Check a small area around this point for a non-wall tile
      for (let dr = -halfW; dr <= halfW; dr++) {
        for (let dc = -halfW; dc <= halfW; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && r < tiles.length && c >= 0 && c < tiles[0].length) {
            const tile = tiles[r][c];
            if (!isWall(tile)) {
              return {
                x: (c * tileS + tileS / 2) * scale,
                y: (r * tileS + tileS / 2) * scale,
              };
            }
          }
        }
      }
    }
    return null;
  }

  /** Handle enemy death — drop loot with probability (US-033) */
  private handleEnemyDeathDrop(data: { x: number; y: number; type: string }): void {
    const { x, y, type } = data;
    const isSkeleton = type === "skeleton";

    const coinRate = isSkeleton ? SKELETON_COIN_DROP_RATE : SLIME_COIN_DROP_RATE;
    const potionRate = isSkeleton ? SKELETON_POTION_DROP_RATE : SLIME_POTION_DROP_RATE;

    // Death particle effect: brief expanding/fading particles around death position
    this.spawnDeathParticles(x, y);

    // Determine drops (can drop both coin and potion)
    const dropCoin = Math.random() < coinRate;
    const dropPotion = Math.random() < potionRate;

    if (dropCoin) {
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetDist = Phaser.Math.Between(15, 30);
      const targetX = x + Math.cos(offsetAngle) * offsetDist;
      const targetY = y + Math.sin(offsetAngle) * offsetDist;
      this.spawnDropCoin(targetX, targetY, x, y);
    }

    if (dropPotion) {
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetDist = Phaser.Math.Between(15, 30);
      const targetX = x + Math.cos(offsetAngle) * offsetDist;
      const targetY = y + Math.sin(offsetAngle) * offsetDist;
      this.spawnDropPotion(targetX, targetY, x, y);
    }
  }

  /** Spawn a brief particle burst at enemy death position */
  private spawnDeathParticles(x: number, y: number): void {
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i;
      const px = this.add.rectangle(x, y, 4, 4, 0xffffff, 0.8);
      px.setDepth(15);
      this.tweens.add({
        targets: px,
        x: x + Math.cos(angle) * 20,
        y: y + Math.sin(angle) * 20,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => px.destroy(),
      });
    }
  }

  /** Spawn a dropped coin with popup arc animation, then register overlap for pickup */
  private spawnDropCoin(targetX: number, targetY: number, originX: number, originY: number): void {
    const coin = new Coin(this, originX, originY);
    coin.setAlpha(0); // Start invisible
    this.coins.push(coin);

    // Popup arc animation
    this.tweens.add({
      targets: coin,
      x: targetX,
      y: { value: targetY - DROP_POP_HEIGHT, from: originY },
      alpha: 1,
      duration: DROP_POP_DURATION,
      ease: 'Quad.easeOut',
      yoyo: false,
      onComplete: () => {
        // Final settle to targetY
        this.tweens.add({
          targets: coin,
          y: targetY,
          duration: 150,
          ease: 'Bounce.easeOut',
        });
      },
    });

    // Register overlap for pickup
    this.physics.add.overlap(this.player, coin, () => {
      if (coin.collect()) {
        this.coinCount++;
        this.scoreSystem.addCoinPoints();
        this.soundManager.playPickup();
      }
    });
  }

  /** Spawn a dropped small health potion with popup arc animation */
  private spawnDropPotion(targetX: number, targetY: number, originX: number, originY: number): void {
    const potion = new HealthPotion(this, originX, originY);
    potion.setAlpha(0); // Start invisible
    this.healthPotions.push(potion);

    // Popup arc animation
    this.tweens.add({
      targets: potion,
      x: targetX,
      y: { value: targetY - DROP_POP_HEIGHT, from: originY },
      alpha: 1,
      duration: DROP_POP_DURATION,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Final settle to targetY
        this.tweens.add({
          targets: potion,
          y: targetY,
          duration: 150,
          ease: 'Bounce.easeOut',
        });
      },
    });

    // Register overlap for pickup
    this.physics.add.overlap(this.player, potion, () => {
      if (potion.collect()) {
        this.player.heal(DROP_POTION_HEAL);
        this.soundManager.playPickup();
      }
    });
  }

  /** Check if the current room's enemies are all defeated (US-040) */
  private checkRoomClear(): void {
    if (this.gameOver) return;

    const currentRoom = this.roomCameraSystem.getCurrentRoomIndex();
    if (currentRoom < 0) return; // In corridor
    if (this.clearedRooms.has(currentRoom)) return; // Already cleared

    // Determine which enemies belong to this room
    const dungeonData = this.dungeonMap.getDungeonData();
    if (currentRoom >= dungeonData.rooms.length) return;
    const room = dungeonData.rooms[currentRoom];
    const px = this.dungeonMap.TILE_SIZE * 3; // tileScale = 3
    const roomMinX = room.col * px;
    const roomMaxX = (room.col + room.width) * px;
    const roomMinY = room.row * px;
    const roomMaxY = (room.row + room.height) * px;

    // Check if any enemy is still alive in this room
    const allEnemies = [...this.slimes, ...this.skeletons];
    const hasAliveEnemyInRoom = allEnemies.some((e) => {
      return e.active && e.x >= roomMinX && e.x <= roomMaxX && e.y >= roomMinY && e.y <= roomMaxY;
    });

    if (!hasAliveEnemyInRoom) {
      // Check that this room actually had enemies to begin with (skip entrance)
      if (currentRoom === 0) {
        // Entrance room has no enemies, auto-clear
        this.clearedRooms.add(currentRoom);
        return;
      }

      this.clearedRooms.add(currentRoom);
      this.scoreSystem.addRoomClearPoints();
      this.showRoomClearText();
    }
  }

  /** Show "Room Clear!" floating text animation (US-040) */
  private showRoomClearText(): void {
    const { width, height } = this.scale;
    // Screen-centered text (scroll factor 0 so it stays on screen)
    const text = this.add.text(width / 2, height / 2 - 40, "Room Clear!", {
      fontSize: "32px",
      fontFamily: "monospace",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    text.setDepth(500);
    text.setScrollFactor(0);

    // Animate: float up and fade out
    this.tweens.add({
      targets: text,
      y: height / 2 - 100,
      alpha: 0,
      duration: 1500,
      ease: "Power2",
      onComplete: () => {
        text.destroy();
      },
    });

    // Also flash a brief "+100" score popup
    const bonusText = this.add.text(width / 2, height / 2, "+100", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#44ff44",
      stroke: "#000000",
      strokeThickness: 3,
    });
    bonusText.setOrigin(0.5);
    bonusText.setDepth(500);
    bonusText.setScrollFactor(0);

    this.tweens.add({
      targets: bonusText,
      y: height / 2 - 60,
      alpha: 0,
      duration: 1200,
      delay: 200,
      ease: "Power2",
      onComplete: () => {
        bonusText.destroy();
      },
    });
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

  /** Load run count from localStorage for difficulty scaling (US-028) */
  private loadRunCount(): number {
    try {
      return parseInt(localStorage.getItem(RUN_COUNT_KEY) || "1", 10);
    } catch {
      return 1;
    }
  }

  private createPauseOverlay(): void {
    const { width, height } = this.scale;
    this.pauseOverlay = this.add.container(0, 0);
    this.pauseOverlay.setDepth(1000); // Above everything
    this.pauseOverlay.setScrollFactor(0); // Fixed on screen

    const bg = this.add.rectangle(
      width / 2, height / 2,
      width, height,
      0x000000, 0.6
    );
    this.pauseOverlay.add(bg);

    const pausedText = this.add.text(
      width / 2, height / 2 - 20,
      "⏸ PAUSED",
      {
        fontSize: "48px",
        fontFamily: "monospace",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      }
    ).setOrigin(0.5);
    this.pauseOverlay.add(pausedText);

    const hintText = this.add.text(
      width / 2, height / 2 + 30,
      "Press ESC to resume",
      {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#aaaaaa",
        stroke: "#000000",
        strokeThickness: 2,
      }
    ).setOrigin(0.5);
    this.pauseOverlay.add(hintText);

    this.pauseOverlay.setVisible(false);
  }

  private togglePause(): void {
    if (this.gameOver) return;

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.pause();
      this.pauseOverlay.setVisible(true);
    } else {
      this.physics.resume();
      this.pauseOverlay.setVisible(false);
    }
  }

  /** Internal end-game helper — no gameOver guard, used by death animation callback */
  private endGameInternal(result: GameResult): void {
    this.physics.pause();
    this.player.setVelocity(0, 0);

    const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
    this.time.delayedCall(200, () => {
      this.scene.start("ResultScene", {
        result,
        score: this.scoreSystem.score,
        killCount: this.killCount,
        coinCount: this.coinCount,
        elapsedTime,
      });
    });
  }

  private endGame(result: GameResult): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // Freeze gameplay
    this.physics.pause();
    this.player.setVelocity(0, 0);

    // Transition to result scene after a short delay
    const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000); // seconds (US-035)
    this.time.delayedCall(800, () => {
      this.scene.start("ResultScene", {
        result,
        score: this.scoreSystem.score,
        killCount: this.killCount,
        coinCount: this.coinCount,
        elapsedTime,
      });
    });
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    // Toggle pause on ESC
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.togglePause();
      return;
    }

    // Skip all game logic when paused
    if (this.isPaused) return;

    this.player.update(delta, time);
    // Only update living slimes
    for (const slime of this.slimes) {
      slime.update(delta);
    }
    // Update skeletons
    for (const skeleton of this.skeletons) {
      skeleton.update(delta);
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
      if (!this.gameOver) {
        this.gameOver = true; // block gameplay but not endGame yet
        this.player.playDeathAnimation(() => {
          // endGame checks gameOver guard — use internal helper to bypass
          this.endGameInternal("lose");
        });
      }
      return;
    }

    // Update spike traps
    for (const trap of this.spikeTraps) {
      trap.update(delta);
    }

    // Check room clear reward (US-040)
    this.checkRoomClear();

    // Check win condition: player reaches the stairs
    if (this.checkWinCondition()) {
      this.endGame("win");
    }
  }
}

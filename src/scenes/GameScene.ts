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
import { isWall, createRng } from "@/map/dungeonData";
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

/** Base enemy counts at depth=0, before runCount scaling */
function baseEnemyCounts(combatIndex: number, combatRoomCount: number): { slimes: number; skeletons: number } {
  const lastCombatRoom = combatIndex === combatRoomCount - 1;

  if (combatRoomCount <= 1) {
    return { slimes: 2, skeletons: 1 };
  }

  const depth = combatIndex / (combatRoomCount - 1);

  if (lastCombatRoom) {
    // Boss room: skeleton-heavy
    return { slimes: 1, skeletons: 3 };
  } else if (depth < 0.3) {
    // Early: slimes only, gradually increasing
    const slimes = combatIndex === 0 ? 1 : 2;
    return { slimes, skeletons: 0 };
  } else if (depth < 0.6) {
    // Mid: introduce skeletons, slimes stable
    return { slimes: 2, skeletons: 1 };
  } else {
    // Late-mid: more skeletons
    return { slimes: 2, skeletons: 2 };
  }
}

/**
 * Returns enemy configuration for a given room based on its depth index and run count.
 * Room 0 = entrance (no enemies).
 * Deeper rooms and higher run counts produce more/tougher enemies.
 */
function getEnemyConfigForRoom(roomIndex: number, totalRooms: number, runCount: number = 1): RoomEnemyConfig {
  // Entrance room has no enemies
  if (roomIndex === 0) {
    return { slimeCount: 0, skeletonCount: 0 };
  }

  const combatRoomCount = totalRooms - 1;
  const combatIndex = roomIndex - 1;
  const base = baseEnemyCounts(combatIndex, combatRoomCount);

  // runCount scaling: each additional run adds +1 enemy (alternating slime/skeleton)
  // capped so total enemies don't exceed 2 * base count
  const extraRuns = Math.max(0, runCount - 1);
  const maxExtra = Math.max(base.slimes + base.skeletons, 2); // at least 2 extra slots
  const extraEnemies = Math.min(Math.floor(extraRuns * 0.5), maxExtra);

  const extraSlimes = Math.ceil(extraEnemies / 2);
  const extraSkeletons = Math.floor(extraEnemies / 2);

  return {
    slimeCount: base.slimes + extraSlimes,
    skeletonCount: base.skeletons + extraSkeletons,
  };
}
// --- End room depth difficulty (US-044) ---

const SKELETON_COUNT = 3; // kept for backward compat / fallback
const COIN_COUNT = 5;
const HEALTH_POTION_COUNT = 3;
const HEALTH_POTION_HEAL = 3;
const ATTACK_BOOST_COUNT = 2;
const ENEMY_CONTACT_DAMAGE = 1;
const ENEMY_CONTACT_COOLDOWN = 500; // per-enemy contact damage cooldown (US-588)
const STAIRS_REACH_DISTANCE = 40;

// --- Chest loot drop rates (US-431) ---
const CHEST_COIN_DROP_RATE = 0.5;       // 50%
const CHEST_POTION_DROP_RATE = 0.3;    // 30%
const CHEST_ATTACKBOOST_DROP_RATE = 0.2; // 20%
const CHEST_COIN_COUNT_MIN = 3;
const CHEST_COIN_COUNT_MAX = 5;
// --- End chest loot drop rates ---

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
  private potionUsedCount = 0;
  private enemyContactCooldowns = new Map<Phaser.GameObjects.GameObject, number>(); // per-enemy contact cooldown (US-588)
  private scoreSystem = new ScoreSystem();
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  /** Public read-only: true once endGame has been triggered. Entities check this to freeze. */
  gameOver = false;
  private isPaused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private roomCameraSystem!: RoomCameraSystem;
  private soundManager!: SoundManager;

  // Difficulty scaling state (US-028)
  private runCount = 1;
  private slimeCount = BASE_SLIME_COUNT;
  private skeletonSpeedMultiplier = 1.0;
  private slimeHpMultiplier = 1.0;
  private slimeSpeedMultiplier = 1.0;

  // Seed for deterministic dungeon generation (US-054)
  private seed: number | undefined;

  /** Set the dungeon seed for reproducible generation (US-054) */
  setSeed(seed: number | undefined): void {
    this.seed = seed;
  }

  // Game timer (US-035)
  private startTime = 0;

  // Room clear tracking (US-040)
  private clearedRooms: Set<number> = new Set();
  private roomClearedThisFrame = false;
  private lastCheckedRoomIndex = -1;

  // Chest hint (US-051)
  private chestHintText: Phaser.GameObjects.Text | null = null;
  private chestHintTimer: Phaser.Time.TimerEvent | null = null;

  // Stairs proximity hint (US-387)
  private stairsHintText: Phaser.GameObjects.Text | null = null;

  // Space key consumed by chest interaction this frame (US-061)
  private spaceConsumedByChest = false;

  // Dynamic overlap colliders for dropped items (US-569)
  private dynamicOverlaps: Phaser.Physics.Arcade.Collider[] = [];

  // Enemy respawn tracking (US-050)
  private roomEnemyMap: Map<number, { slimes: Slime[]; skeletons: Skeleton[] }> = new Map();
  private respawnCooldowns: Map<number, number> = new Map(); // roomIndex → lastRespawnTime
  private readonly RESPAWN_MIN_DISTANCE_ROOMS = 1; // Player must be at least N rooms away
  private readonly RESPAWN_COOLDOWN_MS = 30000; // 30s cooldown between respawns for same room
  private readonly RESPAWN_BASE_CHANCE = 0.5; // 50% base chance to respawn

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.gameOver = false;
    this.coinCount = 0;
    this.killCount = 0;
    this.potionUsedCount = 0;
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
    // Slime difficulty scaling (US-642)
    this.slimeHpMultiplier = 1.0 + Math.floor((this.runCount - 1) / 4) * 0.5;
    this.slimeSpeedMultiplier = Math.min(
      1.0 + (this.runCount - 1) * 0.08,
      1.6 // 1.6x cap
    );
    // --- End difficulty scaling ---

    this.dungeonMap = new DungeonMap(this, this.seed);

    const worldW = this.dungeonMap.getWorldWidth();
    const worldH = this.dungeonMap.getWorldHeight();
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // Place player at the entrance room spawn point
    const spawnPos = this.dungeonMap.getPlayerSpawnPos();
    this.player = new Player(this, spawnPos.x, spawnPos.y);

    // Scale base attack power with runCount (US-586): 1→1, 4→2, 7→3
    const baseAttack = Math.min(3, 1 + Math.floor((this.runCount - 1) / 3));
    this.player.setBaseAttackPower(baseAttack);

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
      const config = getEnemyConfigForRoom(roomIdx, totalRooms, this.runCount);

      // Spawn slimes for this room
      for (let s = 0; s < config.slimeCount; s++) {
        const spos = this.dungeonMap.getRandomFloorPosInRoom(room);
        const slime = new Slime(this, spos.x, spos.y, this.slimeHpMultiplier, this.slimeSpeedMultiplier);
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

    // Slime contact with player → player takes damage (US-588: per-enemy 500ms cooldown)
    this.physics.add.overlap(
      this.player,
      this.slimeGroup,
      (_playerObj, slimeObj) => {
        const slime = slimeObj as Phaser.GameObjects.Sprite;
        const now = this.time.now;
        const lastHit = this.enemyContactCooldowns.get(slime) ?? 0;
        if (now - lastHit < ENEMY_CONTACT_COOLDOWN) return;
        this.enemyContactCooldowns.set(slime, now);
        const wasHurt = this.player.takeDamage(ENEMY_CONTACT_DAMAGE, slime.x, slime.y);
        if (wasHurt) {
          this.soundManager.playHurt();
        }
      }
    );

    // Skeleton contact with player → player takes damage (US-588: per-enemy 500ms cooldown)
    this.physics.add.overlap(
      this.player,
      this.skeletonGroup,
      (_playerObj, skeletonObj) => {
        const skeleton = skeletonObj as Phaser.GameObjects.Sprite;
        const now = this.time.now;
        const lastHit = this.enemyContactCooldowns.get(skeleton) ?? 0;
        if (now - lastHit < ENEMY_CONTACT_COOLDOWN) return;
        this.enemyContactCooldowns.set(skeleton, now);
        const wasHurt = this.player.takeDamage(ENEMY_CONTACT_DAMAGE, skeleton.x, skeleton.y);
        if (wasHurt) {
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
      const coinRoom = dungeonData.rooms[(i + 1) % dungeonData.rooms.length];
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

    // Overlap: player picks up health potions (US-060: block at full HP)
    for (const potion of this.healthPotions) {
      this.physics.add.overlap(this.player, potion, () => {
        if (!potion.active) return; // US-569: guard destroyed sprites
        if (this.player.hp >= this.player.maxHp) {
          // Full HP — show hint, don't collect
          this.showHpFullHint(potion.x, potion.y);
          return;
        }
        if (potion.collect()) {
          this.player.heal(HEALTH_POTION_HEAL);
          this.potionUsedCount++;
          this.soundManager.playPickup();
        }
      });
    }

    // Overlap: player picks up attack boosts
    for (const boost of this.attackBoosts) {
      this.physics.add.overlap(this.player, boost, () => {
        if (!boost.active) return; // US-569: guard destroyed sprites
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
          const wasHurt = this.player.takeDamage(amount, trap.x, trap.y);
          if (wasHurt) {
            this.soundManager.playHurt();
          }
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
        if (!trap.active) return; // US-569: guard destroyed sprites
        trap.trigger();
      });
    }

    // Overlap: player picks up coins
    for (const coin of this.coins) {
      this.physics.add.overlap(this.player, coin, () => {
        if (!coin.active) return; // US-569: guard destroyed sprites
        if (coin.collect()) {
          this.coinCount++;
          this.scoreSystem.addCoinPoints();
          this.soundManager.playPickup();
        }
      });
    }

    // Overlap: player picks up key
    this.physics.add.overlap(this.player, this.keyItem, () => {
      if (!this.keyItem.active) return; // US-569: guard destroyed sprites
      if (this.keyItem.collect()) {
        this.inventory.add("key");
        this.soundManager.playPickup();
        // Show hint: key can be used to open chest (US-057)
        this.showKeyPickupHint(this.keyItem.x, this.keyItem.y);
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
        getAttackBoosts: () => this.attackBoosts,
      },
      this.runCount,
      { hpMult: this.slimeHpMultiplier, speedMult: this.slimeSpeedMultiplier }
    );

    // --- Build room→enemies index (US-050) ---
    this.roomEnemyMap.clear();
    this.respawnCooldowns.clear();
    for (let roomIdx = 0; roomIdx < totalRooms; roomIdx++) {
      this.roomEnemyMap.set(roomIdx, { slimes: [], skeletons: [] });
    }
    for (const slime of this.slimes) {
      const roomIdx = this.getRoomAtPosition(slime.x, slime.y);
      if (roomIdx >= 0) this.roomEnemyMap.get(roomIdx)!.slimes.push(slime);
    }
    for (const skeleton of this.skeletons) {
      const roomIdx = this.getRoomAtPosition(skeleton.x, skeleton.y);
      if (roomIdx >= 0) this.roomEnemyMap.get(roomIdx)!.skeletons.push(skeleton);
    }
    // --- End room→enemies index ---

    // Listen for player attack events
    this.events.on("player-attack", this.handlePlayerAttack, this);

    // --- Corridor patrol enemies (US-055) ---
    this.spawnCorridorPatrols(dungeonData, wallLayer);
    // --- End corridor patrol enemies ---

    // --- Corridor visual decorations (US-052) ---
    this.spawnCorridorDecorations(dungeonData);
    // --- End corridor decorations ---

    // Listen for enemy death events (US-033: enemy drop loot)
    this.events.on("enemy-death", this.handleEnemyDeathDrop, this);

    // Listen for room changes to trigger respawn checks (US-050)
    this.roomCameraSystem.setOnRoomChanged((newRoomIndex: number) => {
      this.tryRespawnClearedRooms(newRoomIndex);
    });
  }

  /** Spawn Skeleton patrol enemies in corridors (US-055) */
  private spawnCorridorPatrols(
    dungeonData: ReturnType<DungeonMap["getDungeonData"]>,
    wallLayer: Phaser.Tilemaps.TilemapLayer
  ): void {
    const CORRIDOR_SKELETON_SPEED = 0.636; // 35/55 multiplier → ~35px/s base speed
    const MAX_CORRIDOR_PATROLS = 2;

    if (dungeonData.corridors.length === 0) return;

    // Pick 1-2 random corridors to place patrol skeletons
    const patrolCount = Phaser.Math.Between(1, MAX_CORRIDOR_PATROLS);
    const shuffled = [...dungeonData.corridors].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(patrolCount, shuffled.length); i++) {
      const corridor = shuffled[i];
      const pos = this.getCorridorFloorPos(corridor);
      if (!pos) continue;

      const skeleton = new Skeleton(this, pos.x, pos.y, CORRIDOR_SKELETON_SPEED);
      skeleton.setPlayerRef(this.player);
      this.physics.add.collider(skeleton, wallLayer, () => {
        skeleton.onHitWall();
      });
      this.skeletons.push(skeleton);
      this.skeletonGroup.add(skeleton);
    }
  }

  /** Spawn decorative sprites along corridors (US-052) */
  private spawnCorridorDecorations(dungeonData: ReturnType<DungeonMap["getDungeonData"]>): void {
    const tileS = this.dungeonMap.TILE_SIZE;
    const scale = 3;
    const halfW = Math.floor(3 / 2); // CORRIDOR_WIDTH / 2

    const decorTypes = ["torch_decal", "crack_decal", "rubble_decal"];

    for (const corridor of dungeonData.corridors) {
      const isHorizontal = corridor.start.row === corridor.end.row;

      // Place 1-2 decoration sprites per corridor
      const decorCount = Phaser.Math.Between(1, 2);

      for (let d = 0; d < decorCount; d++) {
        // Pick random position along corridor
        const t = Math.random();
        let col = Math.round(corridor.start.col + t * (corridor.end.col - corridor.start.col));
        let row = Math.round(corridor.start.row + t * (corridor.end.row - corridor.start.row));

        // Offset to wall side for torches/cracks, or center for rubble
        const decorType = decorTypes[Math.floor(Math.random() * decorTypes.length)];

        if (decorType === "torch_decal") {
          // Place torch near corridor wall
          const side = Math.random() > 0.5 ? -halfW : halfW;
          if (isHorizontal) {
            row += side;
          } else {
            col += side;
          }
        } else if (decorType === "crack_decal") {
          // Crack on wall edge
          const side = Math.random() > 0.5 ? -(halfW + 1) : halfW + 1;
          if (isHorizontal) {
            row += side;
          } else {
            col += side;
          }
        }
        // rubble stays centered or slightly offset

        // Verify position is valid (within bounds and on a floor tile)
        const tiles = dungeonData.tiles;
        if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) continue;
        if (isWall(tiles[row][col])) continue;

        const worldX = (col * tileS + tileS / 2) * scale;
        const worldY = (row * tileS + tileS / 2) * scale;

        const sprite = this.add.image(worldX, worldY, decorType);
        sprite.setDepth(1); // Above floor tiles (0) but below entities
        sprite.setAlpha(0.8 + Math.random() * 0.2); // Slight alpha variation

        // Add flickering animation for torches
        if (decorType === "torch_decal") {
          sprite.setDepth(2);
          this.tweens.add({
            targets: sprite,
            alpha: { from: 0.7, to: 1.0 },
            duration: 200 + Math.random() * 300,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          // Add a small glow effect around torches
          const glow = this.add.circle(worldX, worldY, 20, 0xff8800, 0.08);
          glow.setDepth(1);
          this.tweens.add({
            targets: glow,
            alpha: { from: 0.05, to: 0.12 },
            scaleX: { from: 0.9, to: 1.1 },
            scaleY: { from: 0.9, to: 1.1 },
            duration: 300 + Math.random() * 200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      }
    }
  }

  private handlePlayerAttack(): void {
    if (this.gameOver) return;

    // Play attack swoosh sound
    this.soundManager.playAttack();

    const damage = this.player.attackPower;
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
      if (!this.inventory.has("key")) {
        // Show hint: need key (US-051)
        this.showChestHint(chest.x, chest.y, "\u{1F511} \u9700\u8981\u94A5\u5319!");
        return;
      }
      this.inventory.remove("key");
      chest.open();
      this.soundManager.playChestOpen();
      // US-431: Generate chest loot drops
      this.spawnChestLoot(chest.x, chest.y);
      return; // Only open one chest per press
    }
  }

  /** Spawn loot drops from an opened chest (US-057) */
  private spawnChestLoot(chestX: number, chestY: number): void {
    // Drop 3-5 coins scattered around the chest
    const coinCount = Phaser.Math.Between(CHEST_COIN_COUNT_MIN, CHEST_COIN_COUNT_MAX);
    for (let i = 0; i < coinCount; i++) {
      const angle = (Math.PI * 2 / coinCount) * i + Math.random() * 0.5;
      const dist = Phaser.Math.Between(20, 40);
      const targetX = chestX + Math.cos(angle) * dist;
      const targetY = chestY + Math.sin(angle) * dist;
      this.spawnDropCoin(targetX, targetY, chestX, chestY);
    }

    // 30% chance to drop a health potion
    if (Math.random() < CHEST_POTION_DROP_RATE) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(20, 35);
      const targetX = chestX + Math.cos(angle) * dist;
      const targetY = chestY + Math.sin(angle) * dist;
      this.spawnDropPotion(targetX, targetY, chestX, chestY);
    }

    // 20% chance to drop an attack boost
    if (Math.random() < CHEST_ATTACKBOOST_DROP_RATE) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(20, 35);
      const targetX = chestX + Math.cos(angle) * dist;
      const targetY = chestY + Math.sin(angle) * dist;
      this.spawnDropAttackBoost(targetX, targetY, chestX, chestY);
    }
  }

  /** Show a floating hint near a chest (US-051) */
  private showChestHint(worldX: number, worldY: number, message: string): void {
    // Remove existing hint if any
    this.clearChestHint();

    this.chestHintText = this.add.text(worldX, worldY - 30, message, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#ffaa00",
      stroke: "#000000",
      strokeThickness: 3,
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 3 },
    });
    this.chestHintText.setOrigin(0.5);
    this.chestHintText.setDepth(500);

    // Fade out after 1.5 seconds
    this.chestHintTimer = this.time.delayedCall(1500, () => {
      if (this.chestHintText && this.chestHintText.active) {
        this.tweens.add({
          targets: this.chestHintText,
          alpha: 0,
          y: this.chestHintText.y - 20,
          duration: 500,
          onComplete: () => {
            this.clearChestHint();
          },
        });
      }
      this.chestHintTimer = null;
    });
  }

  /** Show a floating hint when player picks up key (US-057) */
  private showKeyPickupHint(worldX: number, worldY: number): void {
    const hint = this.add.text(worldX, worldY - 30, "\u{1F511} \u53EF\u7528\u4E8E\u5F00\u542F\u5B9D\u7BB1!", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffff00",
      stroke: "#000000",
      strokeThickness: 3,
      backgroundColor: "#000000aa",
      padding: { x: 5, y: 3 },
    });
    hint.setOrigin(0.5);
    hint.setDepth(500);

    // Float up and fade out
    this.tweens.add({
      targets: hint,
      alpha: 0,
      y: hint.y - 30,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        hint.destroy();
      },
    });
  }

  /** Clear any active chest hint (US-051) */
  private clearChestHint(): void {
    if (this.chestHintTimer) {
      this.chestHintTimer.remove();
      this.chestHintTimer = null;
    }
    if (this.chestHintText && this.chestHintText.active) {
      this.chestHintText.destroy();
    }
    this.chestHintText = null;
  }

  /** Show a passive hint when near a closed chest (US-051) */
  private proximityHint: Phaser.GameObjects.Text | null = null;

  private updateChestProximityHint(): void {
    let nearChest: Chest | null = null;
    for (const chest of this.chests) {
      if (chest.isOpen) continue;
      if (chest.isInRange(this.player.x, this.player.y)) {
        nearChest = chest;
        break;
      }
    }

    if (nearChest) {
      const hasKey = this.inventory.has("key");
      const msg = hasKey ? "[Space] \u{1F511} \u5F00\u7BB1" : "[Space] \u{1F512} \u9700\u8981\u94A5\u5319";

      if (!this.proximityHint || !this.proximityHint.active) {
        this.proximityHint = this.add.text(nearChest.x, nearChest.y - 45, msg, {
          fontSize: "13px",
          fontFamily: "monospace",
          color: hasKey ? "#44ff44" : "#ffaa00",
          stroke: "#000000",
          strokeThickness: 3,
          backgroundColor: "#000000bb",
          padding: { x: 5, y: 2 },
        });
        this.proximityHint.setOrigin(0.5);
        this.proximityHint.setDepth(400);
      } else {
        // Update position and text if already showing
        this.proximityHint.setPosition(nearChest.x, nearChest.y - 45);
        this.proximityHint.setText(msg);
        this.proximityHint.setColor(hasKey ? "#44ff44" : "#ffaa00");
      }
    } else {
      // Remove hint if no longer near a chest
      if (this.proximityHint && this.proximityHint.active) {
        this.proximityHint.destroy();
      }
      this.proximityHint = null;
    }
  }

  /** Show hint near stairs — remind player key/chest requirements (US-564) */
  private updateStairsProximityHint(): void {
    const stairsPos = this.dungeonMap.getStairsPos();
    const dx = this.player.x - stairsPos.x;
    const dy = this.player.y - stairsPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nearStairs = dist < STAIRS_REACH_DISTANCE + 20;

    if (!nearStairs) {
      if (this.stairsHintText && this.stairsHintText.active) {
        this.stairsHintText.destroy();
      }
      this.stairsHintText = null;
      return;
    }

    // Determine what's missing
    const hasKey = this.inventory.has("key");
    const chestOpened = this.chests.some((c) => c.isOpen);

    let message = "";
    let color = "#44ff44";
    if (!hasKey && !chestOpened) {
      message = "🔑 需要🔑钥匙 + 打开宝箱!";
      color = "#ffaa00";
    } else if (!hasKey) {
      message = "🔑 需要钥匙才能通关!";
      color = "#ffaa00";
    } else if (!chestOpened) {
      message = "📦 需要打开宝箱!";
      color = "#ffaa00";
    } else {
      message = "🚪 可以通关了!";
      color = "#44ff44";
    }

    if (this.stairsHintText && this.stairsHintText.active) {
      // Update existing hint text and position
      this.stairsHintText.setText(message);
      this.stairsHintText.setPosition(stairsPos.x, stairsPos.y - 40);
      this.stairsHintText.setColor(color);
    } else {
      this.stairsHintText = this.add.text(stairsPos.x, stairsPos.y - 40, message, {
        fontSize: "14px",
        color: color,
        stroke: "#000000",
        strokeThickness: 3,
      });
      this.stairsHintText.setOrigin(0.5);
      this.stairsHintText.setDepth(500);
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

    // Register overlap for pickup (US-569: track + guard active)
    const collider = this.physics.add.overlap(this.player, coin, () => {
      if (!coin.active) return;
      if (coin.collect()) {
        this.coinCount++;
        this.scoreSystem.addCoinPoints();
        this.soundManager.playPickup();
      }
    });
    this.dynamicOverlaps.push(collider);
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

    // Register overlap for pickup (US-060: block at full HP, US-569: track + guard active)
    const collider = this.physics.add.overlap(this.player, potion, () => {
      if (!potion.active) return;
      if (this.player.hp >= this.player.maxHp) {
        this.showHpFullHint(potion.x, potion.y);
        return;
      }
      if (potion.collect()) {
        this.player.heal(DROP_POTION_HEAL);
        this.potionUsedCount++;
        this.soundManager.playPickup();
      }
    });
    this.dynamicOverlaps.push(collider);
  }

  /** Show "HP Full" floating hint near a health potion (US-060) */
  private hpFullHintText: Phaser.GameObjects.Text | null = null;
  private hpFullHintCooldown = 0;

  private showHpFullHint(worldX: number, worldY: number): void {
    const now = this.time.now;
    if (now - this.hpFullHintCooldown < 1500) return; // Throttle to once per 1.5s
    this.hpFullHintCooldown = now;

    // Destroy previous hint if still active
    if (this.hpFullHintText && this.hpFullHintText.active) {
      this.hpFullHintText.destroy();
    }

    this.hpFullHintText = this.add.text(worldX, worldY - 20, "HP Full", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ff6666",
      stroke: "#000000",
      strokeThickness: 3,
      backgroundColor: "#000000aa",
      padding: { x: 5, y: 3 },
    });
    this.hpFullHintText.setOrigin(0.5);
    this.hpFullHintText.setDepth(500);

    // Float up and fade out
    this.tweens.add({
      targets: this.hpFullHintText,
      alpha: 0,
      y: this.hpFullHintText.y - 25,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        if (this.hpFullHintText && this.hpFullHintText.active) {
          this.hpFullHintText.destroy();
        }
        this.hpFullHintText = null;
      },
    });
  }

  /** Spawn a dropped attack boost with popup arc animation (US-057) */
  private spawnDropAttackBoost(targetX: number, targetY: number, originX: number, originY: number): void {
    const boost = new AttackBoost(this, originX, originY);
    boost.setAlpha(0); // Start invisible
    this.attackBoosts.push(boost);

    // Popup arc animation
    this.tweens.add({
      targets: boost,
      x: targetX,
      y: { value: targetY - DROP_POP_HEIGHT, from: originY },
      alpha: 1,
      duration: DROP_POP_DURATION,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: boost,
          y: targetY,
          duration: 150,
          ease: 'Bounce.easeOut',
        });
      },
    });

    // Register overlap for pickup (US-569: track collider)
    const collider = this.physics.add.overlap(this.player, boost, () => {
      if (!boost.active) return;
      if (boost.collect()) {
        this.player.activateAttackBoost();
        this.soundManager.playPickup();
      }
    });
    this.dynamicOverlaps.push(collider);
  }

  /** Get room index at a world pixel position, or -1 if not in any room (US-050) */
  private getRoomAtPosition(worldX: number, worldY: number): number {
    const dungeonData = this.dungeonMap.getDungeonData();
    const px = this.dungeonMap.TILE_SIZE * 3; // tileScale
    for (let i = 0; i < dungeonData.rooms.length; i++) {
      const room = dungeonData.rooms[i];
      const minX = room.col * px;
      const maxX = (room.col + room.width) * px;
      const minY = room.row * px;
      const maxY = (room.row + room.height) * px;
      if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Try to respawn enemies in cleared rooms that are far enough from the player (US-050).
   * Called when the player enters a new room.
   */
  private tryRespawnClearedRooms(currentRoomIndex: number): void {
    const now = Date.now();
    const dungeonData = this.dungeonMap.getDungeonData();
    const totalRooms = dungeonData.rooms.length;
    const wallLayer = this.dungeonMap.getWallLayer();

    for (const roomIdx of this.clearedRooms) {
      // Skip entrance room (no enemies ever)
      if (roomIdx === 0) continue;
      // Skip if player is in or adjacent to this room
      if (Math.abs(roomIdx - currentRoomIndex) <= this.RESPAWN_MIN_DISTANCE_ROOMS) continue;

      // Check cooldown
      const lastRespawn = this.respawnCooldowns.get(roomIdx) ?? 0;
      if (now - lastRespawn < this.RESPAWN_COOLDOWN_MS) continue;

      // Check if room still has alive enemies
      const entry = this.roomEnemyMap.get(roomIdx);
      if (!entry) continue;
      const aliveSlimes = entry.slimes.filter(s => s.active);
      const aliveSkeletons = entry.skeletons.filter(s => s.active);
      if (aliveSlimes.length > 0 || aliveSkeletons.length > 0) continue;

      // Respawn chance: deeper rooms have higher chance
      const depth = roomIdx / Math.max(1, totalRooms - 1);
      const chance = this.RESPAWN_BASE_CHANCE + depth * 0.3; // 50%–80%
      if (Math.random() > chance) continue;

      // Respawn enemies for this room
      const room = dungeonData.rooms[roomIdx];
      const config = getEnemyConfigForRoom(roomIdx, totalRooms, this.runCount);

      const newSlimes: Slime[] = [];
      const newSkeletons: Skeleton[] = [];

      for (let s = 0; s < config.slimeCount; s++) {
        const spos = this.dungeonMap.getRandomFloorPosInRoom(room);
        const slime = new Slime(this, spos.x, spos.y, this.slimeHpMultiplier, this.slimeSpeedMultiplier);
        this.physics.add.collider(slime, wallLayer, () => {
          slime.onHitWall();
        });
        newSlimes.push(slime);
        this.slimeGroup.add(slime);
      }

      for (let s = 0; s < config.skeletonCount; s++) {
        const spos = this.dungeonMap.getRandomFloorPosInRoom(room);
        const skeleton = new Skeleton(this, spos.x, spos.y, this.skeletonSpeedMultiplier);
        skeleton.setPlayerRef(this.player);
        this.physics.add.collider(skeleton, wallLayer, () => {
          skeleton.onHitWall();
        });
        newSkeletons.push(skeleton);
        this.skeletonGroup.add(skeleton);
      }

      // Update tracking
      this.slimes.push(...newSlimes);
      this.skeletons.push(...newSkeletons);
      this.roomEnemyMap.set(roomIdx, { slimes: newSlimes, skeletons: newSkeletons });

      // NOTE: No need to re-register overlap — new enemies are added to slimeGroup/skeletonGroup,
      // which already have overlap handlers from create(). Re-registering would cause N× damage (US-531).

      // Un-clear the room so it can be cleared again for bonus points
      this.clearedRooms.delete(roomIdx);

      // Set cooldown
      this.respawnCooldowns.set(roomIdx, now);
    }
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
    // Win: reach the stairs in the exit room, requiring key held and chest opened (US-564)
    const stairsPos = this.dungeonMap.getStairsPos();
    const dx = this.player.x - stairsPos.x;
    const dy = this.player.y - stairsPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= STAIRS_REACH_DISTANCE) return false;

    // Must have key in inventory
    if (!this.inventory.has("key")) return false;

    // Must have opened the chest
    const chestOpened = this.chests.some((c) => c.isOpen);
    if (!chestOpened) return false;

    return true;
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

  /** Play victory celebration: gold particle burst + camera zoom (US-587) */
  private playVictoryCelebration(): void {
    const cam = this.cameras.main;
    const px = this.player.x;
    const py = this.player.y;

    // Camera zoom-in effect toward the player
    cam.stopFollow();
    this.tweens.add({
      targets: cam,
      zoom: 1.5,
      scrollX: px - cam.width / 2 / 1.5,
      scrollY: py - cam.height / 2 / 1.5,
      duration: 800,
      ease: "Power2",
    });

    // Gold particle burst
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 60 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 3 + Math.random() * 4;
      const colors = [0xffd700, 0xffaa00, 0xffff00, 0xffffff];
      const color = colors[Math.floor(Math.random() * colors.length)];

      const particle = this.add.circle(px, py, size, color, 0.9);
      particle.setDepth(200);

      this.tweens.add({
        targets: particle,
        x: px + vx * 1.5,
        y: py + vy * 1.5,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 800 + Math.random() * 600,
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }
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

  /** End the game — transitions to ResultScene.
   *  @param result   "win" or "lose"
   *  @param skipGuard If true, skip the gameOver guard (used by death animation callback
   *                  where gameOver is already set externally). Also uses a shorter delay.
   */
  private endGame(result: GameResult, skipGuard = false): void {
    if (!skipGuard) {
      if (this.gameOver) return;
      this.gameOver = true;
    }

    // Freeze gameplay
    this.physics.pause();
    this.player.setVelocity(0, 0);

    const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000); // seconds (US-035)
    const roomsExplored = this.roomCameraSystem.getVisitedRooms().size;

    // Add time bonus for wins (US-053)
    if (result === "win") {
      this.scoreSystem.addTimeBonus(elapsedTime);
      this.playVictoryCelebration();
    }

    const bd = this.scoreSystem.breakdown;
    // Shorter delay when called from death animation (skipGuard), longer for victory celebration
    const delay = result === "win" ? 1500 : (skipGuard ? 200 : 800);
    this.time.delayedCall(delay, () => {
      this.scene.start("ResultScene", {
        result,
        score: this.scoreSystem.score,
        killCount: this.killCount,
        coinCount: this.coinCount,
        elapsedTime,
        potionUsedCount: this.potionUsedCount,
        roomsExplored,
        scoreBreakdown: {
          coins: bd.coins,
          enemies: bd.enemies,
          roomClears: bd.roomClears,
          timeBonus: bd.timeBonus,
        },
      });
    });
  }

  /**
   * Phaser scene lifecycle: called when the scene is shut down or restarted.
   * Cleans up event listeners, tweens, timers, and dynamic overlaps
   * to prevent memory leaks across restarts (US-562).
   */
  shutdown(): void {
    // --- Scene event listeners ---
    this.events.off("player-attack", this.handlePlayerAttack, this);
    this.events.off("enemy-death", this.handleEnemyDeathDrop, this);

    // --- Timers ---
    if (this.chestHintTimer) {
      this.chestHintTimer.remove();
      this.chestHintTimer = null;
    }

    // --- Tweens — stop all scene tweens ---
    this.tweens.killAll();

    // --- Time events — clear all delayed calls / loops ---
    this.time.removeAllEvents();

    // --- Floating hint objects ---
    if (this.chestHintText && this.chestHintText.active) {
      this.chestHintText.destroy();
      this.chestHintText = null;
    }
    if (this.stairsHintText && this.stairsHintText.active) {
      this.stairsHintText.destroy();
      this.stairsHintText = null;
    }
    if (this.proximityHint && this.proximityHint.active) {
      this.proximityHint.destroy();
      this.proximityHint = null;
    }
    if (this.hpFullHintText && this.hpFullHintText.active) {
      this.hpFullHintText.destroy();
      this.hpFullHintText = null;
    }

    // --- Physics: destroy tracked dynamic overlap colliders (US-569)
    //     Prevents stale callbacks holding references to destroyed sprites.
    for (const collider of this.dynamicOverlaps) {
      if (collider.active) {
        collider.destroy();
      }
    }
    this.dynamicOverlaps = [];

    // --- Reset mutable state ---
    this.slimes = [];
    this.skeletons = [];
    this.chests = [];
    this.coins = [];
    this.healthPotions = [];
    this.attackBoosts = [];
    this.spikeTraps = [];
    this.clearedRooms.clear();
    this.roomEnemyMap.clear();
    this.respawnCooldowns.clear();
    this.gameOver = false;
    this.isPaused = false;
    this.spaceConsumedByChest = false;
    this.hpFullHintCooldown = 0;
  }

  update(time: number, delta: number): void {
    // HUD should keep updating even during gameOver (death animation)
    // US-571: moved before gameOver check so death animation shows live score/HP
    if (this.hud) this.hud.update();

    if (this.gameOver) return;

    // Toggle pause on ESC
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.togglePause();
      return;
    }

    // Skip all game logic when paused
    if (this.isPaused) return;

    // US-061/US-590: Check chest interaction BEFORE player.update() so attack can be suppressed
    // We manually track space press to avoid JustDown flag consumption issue
    this.spaceConsumedByChest = false;
    const spaceJustPressed = this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (spaceJustPressed) {
      // Check if player is near any closed chest
      let nearChest = false;
      for (const chest of this.chests) {
        if (!chest.isOpen && chest.isInRange(this.player.x, this.player.y)) {
          nearChest = true;
          break;
        }
      }
      if (nearChest) {
        this.handleChestInteraction();
        this.spaceConsumedByChest = true;
      } else {
        // Re-enable JustDown so Player.update can detect it for attack
        if (this.spaceKey) {
          (this.spaceKey as any)._justDown = true;
        }
      }
    }

    this.player.update(delta, time);
    // Only update living slimes
    for (const slime of this.slimes) {
      slime.update(delta);
    }
    // Update skeletons
    for (const skeleton of this.skeletons) {
      skeleton.update(delta);
    }

    // Check proximity to chest — show interactive hint (US-051)
    this.updateChestProximityHint();

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
          this.endGame("lose", true); // skip guard — gameOver already set above
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

    // Stairs proximity hint — remind player to open chest first (US-387)
    this.updateStairsProximityHint();

    // Check win condition: player reaches the stairs (requires chest opened)
    if (this.checkWinCondition()) {
      this.endGame("win");
    }
  }
}

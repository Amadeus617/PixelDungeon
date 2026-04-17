import Phaser from "phaser";
import { Player } from "@/entities/Player";
import { Slime } from "@/entities/Slime";
import { KeyItem } from "@/entities/KeyItem";
import { Chest } from "@/entities/Chest";
import { DungeonMap } from "@/map";
import { Inventory } from "@/systems/Inventory";
import { HUD } from "@/ui/HUD";

const SLIME_COUNT = 4;
const ENEMY_CONTACT_DAMAGE = 1;

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
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private gameOver = false;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.gameOver = false;

    this.dungeonMap = new DungeonMap(this);

    const worldW = this.dungeonMap.getWorldWidth();
    const worldH = this.dungeonMap.getWorldHeight();
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // Place player on a random floor tile
    const pos = this.dungeonMap.getRandomFloorPos(this);
    this.player = new Player(this, pos.x, pos.y);

    // Collide player with wall tiles
    this.physics.add.collider(this.player, this.dungeonMap.getWallLayer());

    this.player.setWorldBounds();

    // Create a physics group for slimes
    this.slimeGroup = this.physics.add.group();

    // Spawn slimes on random floor tiles
    const wallLayer = this.dungeonMap.getWallLayer();
    for (let i = 0; i < SLIME_COUNT; i++) {
      const spos = this.dungeonMap.getRandomFloorPos(this);
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

    // Spawn key on a random floor tile
    const keyPos = this.dungeonMap.getRandomFloorPos(this);
    this.keyItem = new KeyItem(this, keyPos.x, keyPos.y);

    // Spawn chest on a random floor tile (ensure different from key)
    const chestPos = this.dungeonMap.getRandomFloorPos(this);
    const chest = new Chest(this, chestPos.x, chestPos.y);
    this.chests.push(chest);

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
    this.hud = new HUD(this, this.inventory, this.player);

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
        slime.takeDamage(Player.ATTACK_DAMAGE);
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
    // Win: all slimes dead AND at least one chest opened
    const allEnemiesDead = this.slimes.filter((s) => s.active).length === 0;
    const chestOpened = this.chests.some((c) => c.isOpen);
    return allEnemiesDead && chestOpened;
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
      this.scene.start("ResultScene", { result });
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

    // Check lose condition first (death takes priority)
    if (this.checkLoseCondition()) {
      this.endGame("lose");
      return;
    }

    // Check win condition
    if (this.checkWinCondition()) {
      this.endGame("win");
    }
  }
}

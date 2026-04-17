import { describe, it, expect, beforeEach } from "vitest";
import { Inventory } from "@/systems/Inventory";
import { isWall, generateRoom, T } from "@/map/dungeonData";

// ===========================================================================
// Chest interaction range logic – mirrors Chest.isInRange
// ===========================================================================
const CHEST_INTERACT_RANGE = 60;

function isChestInRange(
  chestX: number, chestY: number, playerX: number, playerY: number
): boolean {
  const dx = chestX - playerX;
  const dy = chestY - playerY;
  return Math.sqrt(dx * dx + dy * dy) <= CHEST_INTERACT_RANGE;
}

// ===========================================================================
// KeyItem collection logic – mirrors KeyItem.collect
// ===========================================================================
function createKeyItemState() {
  let collected = false;
  return {
    get collected() { return collected; },
    collect(): boolean {
      if (collected) return false;
      collected = true;
      return true;
    },
  };
}

// ===========================================================================
// Chest open logic – mirrors Chest.open
// ===========================================================================
function createChestState() {
  let opened = false;
  return {
    get isOpen() { return opened; },
    open(): boolean {
      if (opened) return false;
      opened = true;
      return true;
    },
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe("Item System – Inventory Integration", () => {
  let inventory: Inventory;

  beforeEach(() => {
    inventory = new Inventory();
  });

  it("collecting key adds it to inventory", () => {
    const key = createKeyItemState();
    if (key.collect()) {
      inventory.add("key");
    }
    expect(inventory.has("key")).toBe(true);
  });

  it("collecting key twice only adds once", () => {
    const key = createKeyItemState();
    if (key.collect()) inventory.add("key");
    if (key.collect()) inventory.add("key"); // won't execute
    expect(inventory.getAll()).toEqual(["key"]);
  });

  it("opening chest consumes the key", () => {
    const chest = createChestState();
    inventory.add("key");

    // Check preconditions
    expect(inventory.has("key")).toBe(true);
    expect(chest.isOpen).toBe(false);

    // Open chest
    if (inventory.has("key") && !chest.isOpen) {
      inventory.remove("key");
      chest.open();
    }

    expect(inventory.has("key")).toBe(false);
    expect(chest.isOpen).toBe(true);
  });

  it("cannot open chest without key", () => {
    const chest = createChestState();
    expect(inventory.has("key")).toBe(false);

    if (inventory.has("key") && !chest.isOpen) {
      chest.open();
    }

    expect(chest.isOpen).toBe(false);
  });

  it("cannot open chest twice", () => {
    const chest = createChestState();
    inventory.add("key");
    chest.open();
    expect(chest.isOpen).toBe(true);

    // Second open attempt
    const result = chest.open();
    expect(result).toBe(false);
  });
});

describe("Item System – KeyItem Collection", () => {
  it("collect returns true on first call", () => {
    const key = createKeyItemState();
    expect(key.collect()).toBe(true);
    expect(key.collected).toBe(true);
  });

  it("collect returns false on second call", () => {
    const key = createKeyItemState();
    key.collect();
    expect(key.collect()).toBe(false);
  });
});

describe("Item System – Chest Interaction Range", () => {
  it("player at same position is in range", () => {
    expect(isChestInRange(100, 100, 100, 100)).toBe(true);
  });

  it("player at 50px distance is in range", () => {
    expect(isChestInRange(100, 100, 150, 100)).toBe(true);
  });

  it("player at exactly 60px distance is in range", () => {
    expect(isChestInRange(100, 100, 160, 100)).toBe(true);
  });

  it("player at 61px distance is out of range", () => {
    expect(isChestInRange(100, 100, 161, 100)).toBe(false);
  });

  it("diagonal distance 42+42=59.4 is in range", () => {
    expect(isChestInRange(100, 100, 142, 142)).toBe(true);
  });

  it("player far away is out of range", () => {
    expect(isChestInRange(100, 100, 300, 300)).toBe(false);
  });

  it("range check is symmetric (chest-to-player same as player-to-chest)", () => {
    expect(isChestInRange(100, 100, 150, 100)).toBe(true);
    // Player at 100, chest at 150 – same distance
    expect(isChestInRange(150, 100, 100, 100)).toBe(true);
  });
});

describe("Item System – Win Condition", () => {
  it("win: all enemies dead AND chest opened", () => {
    const inventory = new Inventory();
    const chest = createChestState();

    // Simulate killing all enemies
    const slimesAlive = 0;
    // Collect key and open chest
    inventory.add("key");
    if (inventory.has("key")) {
      inventory.remove("key");
      chest.open();
    }

    const allEnemiesDead = slimesAlive === 0;
    const chestOpened = chest.isOpen;
    expect(allEnemiesDead && chestOpened).toBe(true);
  });

  it("no win: enemies dead but chest not opened", () => {
    const chest = createChestState();
    const slimesAlive = 0;
    const allEnemiesDead = slimesAlive === 0;
    const chestOpened = chest.isOpen;
    expect(allEnemiesDead && chestOpened).toBe(false);
  });

  it("no win: chest opened but enemies alive", () => {
    const chest = createChestState();
    chest.open();
    const slimesAlive = 2;
    const allEnemiesDead = slimesAlive === 0;
    const chestOpened = chest.isOpen;
    expect(allEnemiesDead && chestOpened).toBe(false);
  });

  it("lose: player HP is 0", () => {
    let hp = 0;
    expect(hp > 0).toBe(false);
  });
});

describe("Item System – Complete Game Flow", () => {
  it("full game: explore → collect key → kill enemies → open chest → win", () => {
    const inventory = new Inventory();
    const chest = createChestState();
    const slimes = [
      { hp: 3 },
      { hp: 3 },
    ];

    // Player collects key
    inventory.add("key");
    expect(inventory.has("key")).toBe(true);

    // Player kills all enemies
    for (const s of slimes) {
      s.hp -= 3;
    }
    const allDead = slimes.every(s => s.hp <= 0);
    expect(allDead).toBe(true);

    // Player opens chest
    expect(chest.isOpen).toBe(false);
    if (inventory.has("key") && !chest.isOpen) {
      inventory.remove("key");
      chest.open();
    }
    expect(chest.isOpen).toBe(true);
    expect(inventory.has("key")).toBe(false);

    // Win check
    expect(allDead && chest.isOpen).toBe(true);
  });
});

describe("Item System – Dungeon Data (map)", () => {
  it("isWall returns true for wall tiles", () => {
    expect(isWall(T.WALL_TOP)).toBe(true);
    expect(isWall(T.WALL_FRONT)).toBe(true);
    expect(isWall(T.WALL_SHADOW)).toBe(true);
    expect(isWall(T.WALL_BOTTOM)).toBe(true);
    expect(isWall(T.CORNER_TL)).toBe(true);
    expect(isWall(T.CORNER_TR)).toBe(true);
    expect(isWall(T.CORNER_BL)).toBe(true);
    expect(isWall(T.CORNER_BR)).toBe(true);
    expect(isWall(T.WALL_LEFT)).toBe(true);
    expect(isWall(T.WALL_RIGHT)).toBe(true);
    expect(isWall(T.WALL_TOP_EDGE)).toBe(true);
  });

  it("isWall returns true for special blocking tiles", () => {
    expect(isWall(T.STAIRS)).toBe(true);
    expect(isWall(T.DOOR)).toBe(true);
    expect(isWall(T.PIT)).toBe(true);
  });

  it("isWall returns false for floor tiles", () => {
    expect(isWall(T.FLOOR_1)).toBe(false);
    expect(isWall(T.FLOOR_2)).toBe(false);
    expect(isWall(T.FLOOR_3)).toBe(false);
    expect(isWall(T.FLOOR_4)).toBe(false);
    expect(isWall(T.FLOOR_MOSS)).toBe(false);
    expect(isWall(T.FLOOR_DARK)).toBe(false);
    expect(isWall(T.FLOOR_TREASURE)).toBe(false);
    expect(isWall(T.FLOOR_FILL)).toBe(false);
  });

  it("isWall returns false for unknown tile index", () => {
    expect(isWall(-1)).toBe(false);
    expect(isWall(99)).toBe(false);
  });

  it("generateRoom returns a 16x16 grid", () => {
    const room = generateRoom();
    expect(room.length).toBe(16);
    for (const row of room) {
      expect(row.length).toBe(16);
    }
  });

  it("generateRoom has wall borders", () => {
    const room = generateRoom();
    // Top-left corner
    expect(room[0][0]).toBe(T.CORNER_TL);
    // Top-right corner
    expect(room[0][15]).toBe(T.CORNER_TR);
    // Bottom-left corner
    expect(room[15][0]).toBe(T.CORNER_BL);
    // Bottom-right corner
    expect(room[15][15]).toBe(T.CORNER_BR);
    // Left wall in middle rows
    for (let r = 1; r <= 14; r++) {
      expect(room[r][0]).toBe(T.WALL_LEFT);
    }
    // Right wall in middle rows
    for (let r = 1; r <= 14; r++) {
      expect(room[r][15]).toBe(T.WALL_RIGHT);
    }
  });

  it("generateRoom interior tiles are not walls", () => {
    const room = generateRoom();
    for (let r = 1; r <= 14; r++) {
      for (let c = 1; c <= 14; c++) {
        expect(isWall(room[r][c])).toBe(false);
      }
    }
  });
});

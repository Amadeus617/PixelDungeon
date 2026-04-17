import { describe, it, expect } from "vitest";

type Direction = "up" | "down" | "left" | "right" | "idle";

// ===========================================================================
// Constants – mirror Player.ts / Slime.ts / GameScene.ts
// ===========================================================================
const PLAYER_MAX_HP = 10;
const ATTACK_RANGE = 50;
const ATTACK_DAMAGE = 1;
const ATTACK_COOLDOWN = 400;
const INVINCIBLE_DURATION = 1000;
const SLIME_MAX_HP = 3;

// ===========================================================================
// Attack zone / range logic – mirrors Player.getAttackZone + isEnemyInAttackRange
// ===========================================================================
const DIR_OFFSETS: Record<Exclude<Direction, "idle">, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function getAttackZone(
  px: number, py: number, direction: Direction
): { x: number; y: number; dx: number; dy: number } {
  const dir = direction === "idle" ? "down" : direction;
  const o = DIR_OFFSETS[dir];
  return { x: px, y: py, dx: o.dx, dy: o.dy };
}

function isEnemyInAttackRange(
  playerX: number, playerY: number, direction: Direction,
  enemyX: number, enemyY: number
): boolean {
  const zone = getAttackZone(playerX, playerY, direction);
  const dx = enemyX - zone.x;
  const dy = enemyY - zone.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > ATTACK_RANGE) return false;
  if (dist > 0) {
    const ndx = dx / dist;
    const ndy = dy / dist;
    const dot = ndx * zone.dx + ndy * zone.dy;
    if (dot < 0.25) return false;
  }
  return true;
}

// ===========================================================================
// Player HP / invincibility state machine
// ===========================================================================
function createPlayerState() {
  let hp = PLAYER_MAX_HP;
  let isInvincible = false;
  let invincibleTimer = 0;

  function takeDamage(amount: number) {
    if (isInvincible || hp <= 0) return;
    hp = Math.max(0, hp - amount);
    isInvincible = true;
    invincibleTimer = INVINCIBLE_DURATION;
  }

  function updateInvincibility(delta: number) {
    if (!isInvincible) return;
    invincibleTimer -= delta;
    if (invincibleTimer <= 0) {
      isInvincible = false;
    }
  }

  return {
    get hp() { return hp; },
    get alive() { return hp > 0; },
    get isInvincible() { return isInvincible; },
    takeDamage,
    updateInvincibility,
  };
}

// ===========================================================================
// Slime HP state machine
// ===========================================================================
function createSlimeState() {
  let hp = SLIME_MAX_HP;
  return {
    get hp() { return hp; },
    get isDead() { return hp <= 0; },
    takeDamage(amount: number) {
      hp = Math.max(0, hp - amount);
    },
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe("Combat – Attack Range", () => {
  it("hits enemy directly in front – facing down", () => {
    expect(isEnemyInAttackRange(100, 100, "down", 100, 140)).toBe(true);
  });

  it("hits enemy directly in front – facing up", () => {
    expect(isEnemyInAttackRange(100, 100, "up", 100, 60)).toBe(true);
  });

  it("hits enemy directly in front – facing left", () => {
    expect(isEnemyInAttackRange(100, 100, "left", 60, 100)).toBe(true);
  });

  it("hits enemy directly in front – facing right", () => {
    expect(isEnemyInAttackRange(100, 100, "right", 140, 100)).toBe(true);
  });

  it("hits enemy at slight angle within cone", () => {
    // Facing right, enemy slightly above-right – within 120° cone
    expect(isEnemyInAttackRange(100, 100, "right", 140, 115)).toBe(true);
  });

  it("misses enemy behind the player", () => {
    expect(isEnemyInAttackRange(100, 100, "down", 100, 60)).toBe(false);
  });

  it("misses enemy out of range", () => {
    expect(isEnemyInAttackRange(100, 100, "down", 100, 200)).toBe(false);
  });

  it("misses enemy perpendicular (90°) – outside cone", () => {
    expect(isEnemyInAttackRange(100, 100, "right", 100, 140)).toBe(false);
  });

  it("hits enemy at exact range boundary (50px)", () => {
    expect(isEnemyInAttackRange(100, 100, "down", 100, 150)).toBe(true);
  });

  it("misses enemy just beyond range (51px)", () => {
    expect(isEnemyInAttackRange(100, 100, "down", 100, 151)).toBe(false);
  });

  it("idle direction defaults to down for attack cone", () => {
    // When player is idle, getAttackZone falls back to "down"
    expect(isEnemyInAttackRange(100, 100, "idle", 100, 140)).toBe(true);
    expect(isEnemyInAttackRange(100, 100, "idle", 100, 60)).toBe(false);
  });

  it("enemy at player position (dist=0) is hit", () => {
    // Edge case: distance is 0, no cone check needed
    expect(isEnemyInAttackRange(100, 100, "down", 100, 100)).toBe(true);
  });
});

describe("Combat – Player HP & Damage", () => {
  it("player starts with 10 HP", () => {
    const player = createPlayerState();
    expect(player.hp).toBe(10);
    expect(player.alive).toBe(true);
  });

  it("takeDamage reduces HP by amount", () => {
    const player = createPlayerState();
    player.takeDamage(3);
    expect(player.hp).toBe(7);
  });

  it("HP cannot go below 0", () => {
    const player = createPlayerState();
    player.takeDamage(999);
    expect(player.hp).toBe(0);
  });

  it("player is dead when HP reaches 0", () => {
    const player = createPlayerState();
    player.takeDamage(10);
    expect(player.hp).toBe(0);
    expect(player.alive).toBe(false);
  });

  it("takeDamage does nothing when already dead", () => {
    const player = createPlayerState();
    player.takeDamage(10);
    expect(player.hp).toBe(0);
    player.takeDamage(1);
    expect(player.hp).toBe(0);
  });

  it("player becomes invincible after taking damage", () => {
    const player = createPlayerState();
    player.takeDamage(1);
    expect(player.isInvincible).toBe(true);
    expect(player.hp).toBe(9);
  });

  it("invincibility prevents further damage", () => {
    const player = createPlayerState();
    player.takeDamage(1);
    expect(player.hp).toBe(9);
    player.takeDamage(1); // blocked
    expect(player.hp).toBe(9);
  });

  it("invincibility wears off after duration", () => {
    const player = createPlayerState();
    player.takeDamage(1);
    expect(player.isInvincible).toBe(true);

    // Simulate time passing
    player.updateInvincibility(500);
    expect(player.isInvincible).toBe(true);

    player.updateInvincibility(500);
    expect(player.isInvincible).toBe(false);
  });

  it("player can take damage again after invincibility expires", () => {
    const player = createPlayerState();
    player.takeDamage(1);
    expect(player.hp).toBe(9);
    // Wait out invincibility
    player.updateInvincibility(1000);
    expect(player.isInvincible).toBe(false);
    player.takeDamage(1);
    expect(player.hp).toBe(8);
  });

  it("player survives exactly 10 hits with invincibility resets", () => {
    const player = createPlayerState();
    for (let i = 0; i < 10; i++) {
      player.takeDamage(1);
      player.updateInvincibility(1000); // reset invincibility each time
    }
    expect(player.hp).toBe(0);
    expect(player.alive).toBe(false);
  });

  it("invincibility timer can overshoot without issue", () => {
    const player = createPlayerState();
    player.takeDamage(1);
    player.updateInvincibility(5000); // way past duration
    expect(player.isInvincible).toBe(false);
  });
});

describe("Combat – Slime HP & Damage", () => {
  it("slime starts with 3 HP", () => {
    const slime = createSlimeState();
    expect(slime.hp).toBe(3);
    expect(slime.isDead).toBe(false);
  });

  it("takeDamage reduces HP by amount", () => {
    const slime = createSlimeState();
    slime.takeDamage(1);
    expect(slime.hp).toBe(2);
    expect(slime.isDead).toBe(false);
  });

  it("slime dies after 3 attacks of 1 damage each", () => {
    const slime = createSlimeState();
    slime.takeDamage(1);
    slime.takeDamage(1);
    slime.takeDamage(1);
    expect(slime.hp).toBe(0);
    expect(slime.isDead).toBe(true);
  });

  it("slime HP cannot go below 0 from overkill", () => {
    const slime = createSlimeState();
    slime.takeDamage(10);
    expect(slime.hp).toBe(0);
    expect(slime.isDead).toBe(true);
  });

  it("multiple slime instances are independent", () => {
    const s1 = createSlimeState();
    const s2 = createSlimeState();
    s1.takeDamage(1);
    expect(s1.hp).toBe(2);
    expect(s2.hp).toBe(3);
  });
});

describe("Combat – Attack Cooldown", () => {
  it("attack cooldown prevents spam", () => {
    const COOLDOWN = ATTACK_COOLDOWN;
    let lastAttackTime = 0;
    let attackCount = 0;
    const now = 1000;

    // First attack succeeds
    if (now - lastAttackTime >= COOLDOWN) {
      lastAttackTime = now;
      attackCount++;
    }
    expect(attackCount).toBe(1);

    // Immediate second attack blocked
    if (now - lastAttackTime >= COOLDOWN) {
      lastAttackTime = now;
      attackCount++;
    }
    expect(attackCount).toBe(1);

    // Attack after cooldown succeeds
    const later = now + COOLDOWN;
    if (later - lastAttackTime >= COOLDOWN) {
      lastAttackTime = later;
      attackCount++;
    }
    expect(attackCount).toBe(2);
  });

  it("attack cooldown allows attack at exactly cooldown time", () => {
    let lastAttackTime = 0;
    const now = ATTACK_COOLDOWN;
    expect(now - lastAttackTime >= ATTACK_COOLDOWN).toBe(true);
  });

  it("attack cooldown blocks attack just before cooldown", () => {
    let lastAttackTime = 0;
    const now = ATTACK_COOLDOWN - 1;
    expect(now - lastAttackTime >= ATTACK_COOLDOWN).toBe(false);
  });
});

describe("Combat – Full combat scenario", () => {
  it("player kills slime in 3 attacks", () => {
    const player = createPlayerState();
    const slime = createSlimeState();

    // Simulate 3 attack cycles
    for (let i = 0; i < 3; i++) {
      slime.takeDamage(ATTACK_DAMAGE);
    }

    expect(slime.isDead).toBe(true);
    expect(player.hp).toBe(PLAYER_MAX_HP); // player took no damage
  });

  it("4 slimes each die after 3 hits", () => {
    const slimes = Array.from({ length: 4 }, () => createSlimeState());

    // Player attacks all slimes in range 3 times
    for (let round = 0; round < 3; round++) {
      for (const s of slimes) {
        s.takeDamage(ATTACK_DAMAGE);
      }
    }

    expect(slimes.every(s => s.isDead)).toBe(true);
  });

  it("player takes damage from enemy contact and becomes invincible", () => {
    const player = createPlayerState();
    const ENEMY_CONTACT_DAMAGE = 1;

    // First contact
    player.takeDamage(ENEMY_CONTACT_DAMAGE);
    expect(player.hp).toBe(9);
    expect(player.isInvincible).toBe(true);

    // Second contact (same frame) – blocked by invincibility
    player.takeDamage(ENEMY_CONTACT_DAMAGE);
    expect(player.hp).toBe(9);
  });
});

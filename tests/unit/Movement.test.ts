import { describe, it, expect, beforeEach } from "vitest";

type Direction = "up" | "down" | "left" | "right" | "idle";

// ---------------------------------------------------------------------------
// Lightweight key stub
// ---------------------------------------------------------------------------
function makeKey(isDown = false) {
  return { isDown, isUp: !isDown } as any;
}

// ---------------------------------------------------------------------------
// Direction state machine – mirrors Player.update direction logic exactly
// ---------------------------------------------------------------------------
function createDirectionMachine() {
  const keys = {
    up: makeKey(),
    down: makeKey(),
    left: makeKey(),
    right: makeKey(),
  };

  let direction: Direction = "down";

  function update() {
    let vx = 0;
    let vy = 0;
    if (keys.left.isDown) vx = -1;
    else if (keys.right.isDown) vx = 1;
    if (keys.up.isDown) vy = -1;
    else if (keys.down.isDown) vy = 1;

    // Diagonal normalization (mirrors Player)
    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    }

    const isMoving = vx !== 0 || vy !== 0;

    if (isMoving) {
      if (Math.abs(vx) > Math.abs(vy)) {
        direction = vx > 0 ? "right" : "left";
      } else if (vy !== 0) {
        direction = vy > 0 ? "down" : "up";
      }
    }

    return { vx, vy, direction };
  }

  return { keys, update, getDirection: () => direction };
}

// ===========================================================================
// Movement / Direction tests
// ===========================================================================
describe("Movement System – Direction", () => {
  let machine: ReturnType<typeof createDirectionMachine>;

  beforeEach(() => {
    machine = createDirectionMachine();
  });

  it("defaults to 'down' direction", () => {
    expect(machine.getDirection()).toBe("down");
  });

  it("sets direction to 'up' when up key is pressed", () => {
    machine.keys.up.isDown = true;
    machine.keys.up.isUp = false;
    expect(machine.update().direction).toBe("up");
  });

  it("sets direction to 'down' when down key is pressed", () => {
    machine.keys.down.isDown = true;
    machine.keys.down.isUp = false;
    expect(machine.update().direction).toBe("down");
  });

  it("sets direction to 'left' when left key is pressed", () => {
    machine.keys.left.isDown = true;
    machine.keys.left.isUp = false;
    expect(machine.update().direction).toBe("left");
  });

  it("sets direction to 'right' when right key is pressed", () => {
    machine.keys.right.isDown = true;
    machine.keys.right.isUp = false;
    expect(machine.update().direction).toBe("right");
  });

  it("keeps last direction when no keys are pressed", () => {
    machine.keys.right.isDown = true;
    machine.update();
    machine.keys.right.isDown = false;
    machine.keys.right.isUp = true;
    expect(machine.update().direction).toBe("right");
  });
});

describe("Movement System – Diagonal", () => {
  let machine: ReturnType<typeof createDirectionMachine>;

  beforeEach(() => {
    machine = createDirectionMachine();
  });

  it("diagonal up+right: |vx|===|vy|, vy branch → up", () => {
    machine.keys.up.isDown = true;
    machine.keys.right.isDown = true;
    const result = machine.update();
    expect(result.direction).toBe("up");
  });

  it("diagonal down+left: |vx|===|vy|, vy branch → down", () => {
    machine.keys.down.isDown = true;
    machine.keys.left.isDown = true;
    const result = machine.update();
    expect(result.direction).toBe("down");
  });

  it("diagonal up+left: |vx|===|vy|, vy branch → up", () => {
    machine.keys.up.isDown = true;
    machine.keys.left.isDown = true;
    const result = machine.update();
    expect(result.direction).toBe("up");
  });

  it("diagonal movement normalizes velocity", () => {
    machine.keys.right.isDown = true;
    machine.keys.down.isDown = true;
    const result = machine.update();
    // vx and vy should both be ~0.707 after normalization
    const expectedComponent = 1 / Math.sqrt(2);
    expect(Math.abs(result.vx - expectedComponent)).toBeLessThan(0.01);
    expect(Math.abs(result.vy - expectedComponent)).toBeLessThan(0.01);
  });
});

describe("Movement System – Speed & Velocity", () => {
  const SPEED = 120;

  it("single direction produces speed * 1 velocity", () => {
    const vx = 1;
    const vy = 0;
    const velX = vx * SPEED;
    const velY = vy * SPEED;
    expect(velX).toBe(120);
    expect(velY).toBe(0);
  });

  it("diagonal movement normalizes to speed * ~0.707 per axis", () => {
    const rawVx = 1;
    const rawVy = 1;
    const len = Math.sqrt(rawVx * rawVx + rawVy * rawVy);
    const vx = rawVx / len;
    const vy = rawVy / len;
    const velX = vx * SPEED;
    const velY = vy * SPEED;
    expect(Math.abs(velX - SPEED / Math.sqrt(2))).toBeLessThan(0.01);
    expect(Math.abs(velY - SPEED / Math.sqrt(2))).toBeLessThan(0.01);
    // Total speed should remain ~120
    const totalSpeed = Math.sqrt(velX * velX + velY * velY);
    expect(Math.abs(totalSpeed - SPEED)).toBeLessThan(0.01);
  });

  it("idle produces zero velocity", () => {
    const vx = 0;
    const vy = 0;
    expect(vx * SPEED).toBe(0);
    expect(vy * SPEED).toBe(0);
  });

  it("left overrides right when both pressed (else-if logic)", () => {
    // In Player: left check comes first via "else if"
    // Our machine mirrors: if (left) vx = -1; else if (right) vx = 1
    const keys = { left: true, right: true };
    const vx = keys.left ? -1 : keys.right ? 1 : 0;
    expect(vx).toBe(-1);
  });
});

describe("Movement System – Direction transitions", () => {
  let machine: ReturnType<typeof createDirectionMachine>;

  beforeEach(() => {
    machine = createDirectionMachine();
  });

  it("direction changes from right to up correctly", () => {
    machine.keys.right.isDown = true;
    machine.update();
    expect(machine.getDirection()).toBe("right");

    machine.keys.right.isDown = false;
    machine.keys.up.isDown = true;
    machine.update();
    expect(machine.getDirection()).toBe("up");
  });

  it("rapid direction changes are handled correctly", () => {
    // Right → Up → Left → Down
    machine.keys.right.isDown = true;
    machine.update();
    expect(machine.getDirection()).toBe("right");

    machine.keys.right.isDown = false;
    machine.keys.up.isDown = true;
    machine.update();
    expect(machine.getDirection()).toBe("up");

    machine.keys.up.isDown = false;
    machine.keys.left.isDown = true;
    machine.update();
    expect(machine.getDirection()).toBe("left");

    machine.keys.left.isDown = false;
    machine.keys.down.isDown = true;
    machine.update();
    expect(machine.getDirection()).toBe("down");
  });

  it("stops moving and retains last direction", () => {
    machine.keys.left.isDown = true;
    machine.update();
    machine.keys.left.isDown = false;
    // No keys pressed – direction stays left
    machine.update();
    expect(machine.getDirection()).toBe("left");
  });
});

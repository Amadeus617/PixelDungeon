/**
 * Tile indices in dungeon_tiles.png (8x8 grid, 16px each):
 *
 * Row 0 (floor):    0=floor1, 1=floor2, 2=floor3, 3=floor4
 * Row 1 (wall):     8=wallTop, 9=wallFront, 10=wallShadow, 11=wallBottom
 * Row 2 (corner):   16=cornerTL, 17=cornerTR, 18=cornerBL, 19=cornerBR
 * Row 3 (edge):     24=wallLeft, 25=wallRight, 26=wallTopEdge, 27=decorStone
 * Row 4:            32=floorMoss, 33=floorDark, 34=stairsDown, 35=doorFrame
 * Row 5:            40=pit, 41=floorTreasure
 * Rows 6-7:         48-63 = generic floor fill
 */

/** Tile indices used for map building */
export const T = {
  FLOOR_1: 0,
  FLOOR_2: 1,
  FLOOR_3: 2,
  FLOOR_4: 3,
  WALL_TOP: 8,
  WALL_FRONT: 9,
  WALL_SHADOW: 10,
  WALL_BOTTOM: 11,
  CORNER_TL: 16,
  CORNER_TR: 17,
  CORNER_BL: 18,
  CORNER_BR: 19,
  WALL_LEFT: 24,
  WALL_RIGHT: 25,
  WALL_TOP_EDGE: 26,
  DECOR_STONE: 27,
  FLOOR_MOSS: 32,
  FLOOR_DARK: 33,
  STAIRS: 34,
  DOOR: 35,
  PIT: 40,
  FLOOR_TREASURE: 41,
  FLOOR_FILL: 48,
} as const;

/** Whether a tile index represents a solid wall (blocks movement) */
export function isWall(tileIndex: number): boolean {
  return (
    tileIndex === T.WALL_TOP ||
    tileIndex === T.WALL_FRONT ||
    tileIndex === T.WALL_SHADOW ||
    tileIndex === T.WALL_BOTTOM ||
    tileIndex === T.CORNER_TL ||
    tileIndex === T.CORNER_TR ||
    tileIndex === T.CORNER_BL ||
    tileIndex === T.CORNER_BR ||
    tileIndex === T.WALL_LEFT ||
    tileIndex === T.WALL_RIGHT ||
    tileIndex === T.WALL_TOP_EDGE ||
    tileIndex === T.DOOR ||
    tileIndex === T.PIT
  );
}

/** Floor tile indices for random selection */
const FLOOR_TILES = [T.FLOOR_1, T.FLOOR_2, T.FLOOR_3, T.FLOOR_4, T.FLOOR_MOSS, T.FLOOR_FILL];

function pickFloor(): number {
  return FLOOR_TILES[Math.floor(Math.random() * FLOOR_TILES.length)];
}

// ─── Room Generation ────────────────────────────────────────────────────────

/** Dimensions for a single room (in tiles) */
export interface RoomDef {
  id: number;
  /** Top-left col in the dungeon grid */
  col: number;
  /** Top-left row in the dungeon grid */
  row: number;
  width: number;
  height: number;
}

/** A connection between two rooms (corridor) */
export interface CorridorDef {
  fromRoom: number;
  toRoom: number;
  /** Starting tile {col, row} */
  start: { col: number; row: number };
  /** Ending tile {col, row} */
  end: { col: number; row: number };
  /** Direction: "horizontal" or "vertical" */
  direction: "horizontal" | "vertical";
}

/** Complete dungeon data */
export interface DungeonData {
  tiles: number[][];
  rooms: RoomDef[];
  corridors: CorridorDef[];
  width: number;
  height: number;
  entranceRoom: RoomDef;
  exitRoom: RoomDef;
}

/** Room size ranges */
const ROOM_MIN_W = 10;
const ROOM_MAX_W = 16;
const ROOM_MIN_H = 10;
const ROOM_MAX_H = 16;
const CORRIDOR_WIDTH = 3; // tiles wide
const ROOM_COUNT_MIN = 3;
const ROOM_COUNT_MAX = 5;
const TOTAL_COLS = 64;
const TOTAL_ROWS = 48;

/**
 * Attempt to place a room without overlapping existing rooms.
 * Returns the placed RoomDef or null if no valid position found.
 */
function tryPlaceRoom(
  id: number,
  existingRooms: RoomDef[],
  rng: () => number
): RoomDef | null {
  const width = ROOM_MIN_W + Math.floor(rng() * (ROOM_MAX_W - ROOM_MIN_W + 1));
  const height = ROOM_MIN_H + Math.floor(rng() * (ROOM_MAX_H - ROOM_MIN_H + 1));
  const padding = 3; // minimum gap between rooms

  // Try random positions up to N attempts
  for (let attempt = 0; attempt < 200; attempt++) {
    const col = 2 + Math.floor(rng() * (TOTAL_COLS - width - 4));
    const row = 2 + Math.floor(rng() * (TOTAL_ROWS - height - 4));

    let overlaps = false;
    for (const room of existingRooms) {
      if (
        col < room.col + room.width + padding &&
        col + width + padding > room.col &&
        row < room.row + room.height + padding &&
        row + height + padding > room.row
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      return { id, col, row, width, height };
    }
  }

  return null;
}

/**
 * Connect two rooms with an L-shaped corridor.
 * The corridor is CORRIDOR_WIDTH tiles wide.
 */
function buildCorridor(
  fromRoom: RoomDef,
  toRoom: RoomDef,
  rng: () => number
): CorridorDef[] {
  const corridors: CorridorDef[] = [];

  // Pick center points of each room
  const fromCenterCol = Math.floor(fromRoom.col + fromRoom.width / 2);
  const fromCenterRow = Math.floor(fromRoom.row + fromRoom.height / 2);
  const toCenterCol = Math.floor(toRoom.col + toRoom.width / 2);
  const toCenterRow = Math.floor(toRoom.row + toRoom.height / 2);

  // L-shaped corridor: go horizontal first then vertical (or vice versa)
  const goHorizontalFirst = rng() > 0.5;
  const halfW = Math.floor(CORRIDOR_WIDTH / 2);

  if (goHorizontalFirst) {
    // Horizontal segment from fromCenter to toCenter.col
    const startCol = Math.min(fromCenterCol, toCenterCol);
    const endCol = Math.max(fromCenterCol, toCenterCol);
    for (let c = startCol; c <= endCol; c++) {
      for (let dr = -halfW; dr <= halfW; dr++) {
        corridors.push({
          fromRoom: fromRoom.id,
          toRoom: toRoom.id,
          start: { col: startCol, row: fromCenterRow },
          end: { col: endCol, row: fromCenterRow },
          direction: "horizontal",
        });
        // We'll paint these separately; for now just note the corridor data
        // We only need one corridor entry for metadata
        if (c === startCol && dr === -halfW) {
          // first one
        }
      }
    }
    // Vertical segment from fromCenterRow to toCenterRow at toCenterCol
    const startRow = Math.min(fromCenterRow, toCenterRow);
    const endRow = Math.max(fromCenterRow, toCenterRow);
    for (let r = startRow; r <= endRow; r++) {
      for (let dc = -halfW; dc <= halfW; dc++) {
        // painted below
      }
    }

    corridors.push({
      fromRoom: fromRoom.id,
      toRoom: toRoom.id,
      start: { col: startCol, row: fromCenterRow },
      end: { col: toCenterCol, row: toCenterRow },
      direction: "horizontal",
    });
  } else {
    const startRow = Math.min(fromCenterRow, toCenterRow);
    const endRow = Math.max(fromCenterRow, toCenterRow);
    const startCol = Math.min(fromCenterCol, toCenterCol);
    const endCol = Math.max(fromCenterCol, toCenterCol);

    corridors.push({
      fromRoom: fromRoom.id,
      toRoom: toRoom.id,
      start: { col: fromCenterCol, row: startRow },
      end: { col: toCenterCol, row: endRow },
      direction: "vertical",
    });
  }

  return corridors;
}

/** Paint a room onto the tile grid */
function paintRoom(tiles: number[][], room: RoomDef): void {
  for (let r = 0; r < room.height; r++) {
    for (let c = 0; c < room.width; c++) {
      const gridRow = room.row + r;
      const gridCol = room.col + c;

      if (gridRow < 0 || gridRow >= tiles.length || gridCol < 0 || gridCol >= tiles[0].length) continue;

      if (r === 0 && c === 0) {
        tiles[gridRow][gridCol] = T.CORNER_TL;
      } else if (r === 0 && c === room.width - 1) {
        tiles[gridRow][gridCol] = T.CORNER_TR;
      } else if (r === room.height - 1 && c === 0) {
        tiles[gridRow][gridCol] = T.CORNER_BL;
      } else if (r === room.height - 1 && c === room.width - 1) {
        tiles[gridRow][gridCol] = T.CORNER_BR;
      } else if (r === 0) {
        tiles[gridRow][gridCol] = T.WALL_TOP_EDGE;
      } else if (r === room.height - 1) {
        tiles[gridRow][gridCol] = T.WALL_BOTTOM;
      } else if (c === 0) {
        tiles[gridRow][gridCol] = T.WALL_LEFT;
      } else if (c === room.width - 1) {
        tiles[gridRow][gridCol] = T.WALL_RIGHT;
      } else {
        tiles[gridRow][gridCol] = pickFloor();
      }
    }
  }
}

/** Paint corridors between rooms onto the tile grid */
function paintCorridors(
  tiles: number[][],
  rooms: RoomDef[],
  rng: () => number
): CorridorDef[] {
  const corridors: CorridorDef[] = [];
  const halfW = Math.floor(CORRIDOR_WIDTH / 2);

  for (let i = 0; i < rooms.length - 1; i++) {
    const from = rooms[i];
    const to = rooms[i + 1];

    const fromCCol = Math.floor(from.col + from.width / 2);
    const fromCRow = Math.floor(from.row + from.height / 2);
    const toCCol = Math.floor(to.col + to.width / 2);
    const toCRow = Math.floor(to.row + to.height / 2);

    // Carve L-shaped corridor
    if (rng() > 0.5) {
      // Horizontal first, then vertical
      carveHorizontal(tiles, fromCCol, toCCol, fromCRow, halfW);
      carveVertical(tiles, fromCRow, toCRow, toCCol, halfW);
    } else {
      // Vertical first, then horizontal
      carveVertical(tiles, fromCRow, toCRow, fromCCol, halfW);
      carveHorizontal(tiles, fromCCol, toCCol, toCRow, halfW);
    }

    corridors.push({
      fromRoom: from.id,
      toRoom: to.id,
      start: { col: fromCCol, row: fromCRow },
      end: { col: toCCol, row: toCRow },
      direction: rng() > 0.5 ? "horizontal" : "vertical",
    });
  }

  return corridors;
}

/** Carve a horizontal corridor segment */
function carveHorizontal(
  tiles: number[][],
  fromCol: number,
  toCol: number,
  row: number,
  halfWidth: number
): void {
  const startCol = Math.min(fromCol, toCol);
  const endCol = Math.max(fromCol, toCol);

  for (let c = startCol; c <= endCol; c++) {
    for (let dr = -halfWidth; dr <= halfWidth; dr++) {
      const r = row + dr;
      if (r >= 0 && r < tiles.length && c >= 0 && c < tiles[0].length) {
        tiles[r][c] = pickFloor();
      }
    }
  }
}

/** Carve a vertical corridor segment */
function carveVertical(
  tiles: number[][],
  fromRow: number,
  toRow: number,
  col: number,
  halfWidth: number
): void {
  const startRow = Math.min(fromRow, toRow);
  const endRow = Math.max(fromRow, toRow);

  for (let r = startRow; r <= endRow; r++) {
    for (let dc = -halfWidth; dc <= halfWidth; dc++) {
      const c = col + dc;
      if (r >= 0 && r < tiles.length && c >= 0 && c < tiles[0].length) {
        tiles[r][c] = pickFloor();
      }
    }
  }
}

/**
 * Generate a complete multi-room dungeon tilemap.
 * Returns the full dungeon data including rooms, corridors, and entrance/exit.
 */
export function generateDungeon(): DungeonData {
  const rng = Math.random;
  const roomCount = ROOM_COUNT_MIN + Math.floor(rng() * (ROOM_COUNT_MAX - ROOM_COUNT_MIN + 1));

  // Initialize grid with walls
  const tiles: number[][] = [];
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < TOTAL_COLS; c++) {
      row.push(T.WALL_FRONT);
    }
    tiles.push(row);
  }

  // Place rooms
  const rooms: RoomDef[] = [];
  for (let i = 0; i < roomCount; i++) {
    const room = tryPlaceRoom(i, rooms, rng);
    if (room) {
      rooms.push(room);
    }
  }

  // Sort rooms by position (left-to-right, top-to-bottom) for corridor connectivity
  rooms.sort((a, b) => {
    if (a.col !== b.col) return a.col - b.col;
    return a.row - b.row;
  });

  // Reassign IDs after sorting
  rooms.forEach((room, idx) => {
    room.id = idx;
  });

  // Paint rooms
  for (const room of rooms) {
    paintRoom(tiles, room);
  }

  // Paint corridors between sequential rooms
  const corridors = paintCorridors(tiles, rooms, rng);

  // Entrance = first room, Exit = last room
  const entranceRoom = rooms[0];
  const exitRoom = rooms[rooms.length - 1];

  // Place stairs tile in the exit room (center-ish, a bit toward the back)
  const stairsCol = exitRoom.col + Math.floor(exitRoom.width / 2);
  const stairsRow = exitRoom.row + Math.floor(exitRoom.height / 2);
  tiles[stairsRow][stairsCol] = T.STAIRS;

  // Place entrance marker in the entrance room (decorative stone near center)
  const entranceCol = entranceRoom.col + Math.floor(entranceRoom.width / 2);
  const entranceRow = entranceRoom.row + Math.floor(entranceRoom.height / 2);
  // Don't overwrite stairs; place entrance marker slightly offset
  tiles[entranceRow][entranceCol] = T.DECOR_STONE;

  return {
    tiles,
    rooms,
    corridors,
    width: TOTAL_COLS,
    height: TOTAL_ROWS,
    entranceRoom,
    exitRoom,
  };
}

/**
 * Get a random floor position within a specific room.
 */
export function getRandomFloorInRoom(
  tiles: number[][],
  room: { col: number; row: number; width: number; height: number }
): { col: number; row: number } {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const col = room.col + 1 + Math.floor(Math.random() * (room.width - 2));
    const row = room.row + 1 + Math.floor(Math.random() * (room.height - 2));
    const tile = tiles[row]?.[col];
    if (tile !== undefined && !isWall(tile)) {
      return { col, row };
    }
  }
  // Fallback: room center
  return {
    col: room.col + Math.floor(room.width / 2),
    row: room.row + Math.floor(room.height / 2),
  };
}

// ─── Legacy single-room generator (kept for backward compatibility) ─────────

/**
 * Generate a 16x16 dungeon room tilemap.
 * Returns a flat array of tile indices (row-major).
 */
export function generateRoom(): number[][] {
  const map: number[][] = [];

  // Row 0: top wall
  map.push([T.CORNER_TL, ...Array(14).fill(T.WALL_TOP_EDGE), T.CORNER_TR]);

  // Rows 1-14: walls on sides, floor inside
  for (let r = 1; r <= 14; r++) {
    const row: number[] = [T.WALL_LEFT];
    for (let c = 1; c <= 14; c++) {
      row.push(pickFloor());
    }
    row.push(T.WALL_RIGHT);
    map.push(row);
  }

  // Row 15: bottom wall
  map.push([T.CORNER_BL, ...Array(14).fill(T.WALL_BOTTOM), T.CORNER_BR]);

  return map;
}

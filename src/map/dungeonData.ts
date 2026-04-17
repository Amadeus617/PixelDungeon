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
    tileIndex === T.STAIRS ||
    tileIndex === T.DOOR ||
    tileIndex === T.PIT
  );
}

/** Floor tile indices for random selection */
const FLOOR_TILES = [T.FLOOR_1, T.FLOOR_2, T.FLOOR_3, T.FLOOR_4, T.FLOOR_MOSS, T.FLOOR_FILL];

function pickFloor(): number {
  return FLOOR_TILES[Math.floor(Math.random() * FLOOR_TILES.length)];
}

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

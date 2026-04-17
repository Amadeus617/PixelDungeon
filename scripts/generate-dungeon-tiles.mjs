import fs from "fs";
import zlib from "zlib";

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, "ascii");
    const crc32Table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32Table[n] = c;
    }
    function crc32(buf) {
      let crc = 0xffffffff;
      for (let i = 0; i < buf.length; i++) crc = crc32Table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
    }
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([len, typeB, data, crcB]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      raw[di] = pixels[si]; raw[di+1] = pixels[si+1]; raw[di+2] = pixels[si+2]; raw[di+3] = pixels[si+3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 0 });
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

// Dungeon color palette
const P = {
  " ": [0, 0, 0, 0],         // transparent
  "0": [20, 15, 10, 255],    // deep dark / outline
  "1": [35, 28, 22, 255],    // dark stone
  "2": [50, 42, 35, 255],    // mid dark stone
  "3": [65, 55, 45, 255],    // stone
  "4": [80, 70, 58, 255],    // light stone
  "5": [95, 85, 72, 255],    // highlight stone
  "6": [110, 100, 85, 255],  // bright highlight
  "7": [45, 38, 30, 255],    // shadow stone
  "8": [55, 48, 40, 255],    // crack dark
  "9": [25, 20, 15, 255],    // very dark
  "A": [42, 36, 30, 255],    // subtle variation
  "B": [72, 62, 52, 255],    // warm stone
  "C": [38, 32, 26, 255],    // cold shadow
  "D": [88, 78, 65, 255],    // warm light
  "E": [30, 25, 20, 255],    // wall face dark
  "F": [58, 50, 42, 255],    // wall face mid
};

const TW = 16, TH = 16;
// Layout: 8 columns x 8 rows of 16x16 tiles = 128x128 image
const COLS = 8, ROWS = 8;
const IMG_W = TW * COLS, IMG_H = TH * ROWS;
const pixels = new Uint8Array(IMG_W * IMG_H * 4);

function fillTile(col, row, data) {
  const ox = col * TW, oy = row * TH;
  for (let y = 0; y < TH && y < data.length; y++) {
    for (let x = 0; x < TW && x < data[y].length; x++) {
      const ch = data[y][x];
      const color = P[ch] || P[" "];
      const i = ((oy + y) * IMG_W + (ox + x)) * 4;
      pixels[i] = color[0]; pixels[i+1] = color[1]; pixels[i+2] = color[2]; pixels[i+3] = color[3];
    }
  }
}

function mirrorH(row) { return row.split("").reverse().join(""); }

// ========== FLOOR TILES ==========

// Tile (0,0): Basic stone floor
const floor1 = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
];

// Tile (1,0): Floor with cracks
const floor2 = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4488445544554455",
  "2288223322332233",
  "3388334433443344",
  "2288223322332233",
  "3344334433443344",
  "4455445544884455",
  "3344334433883344",
  "4455445544554455",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
];

// Tile (2,0): Floor variation 3
const floor3 = [
  "4433443344334433",
  "5544554455445544",
  "4433443344334433",
  "5544554455445544",
  "3322332233223322",
  "4433443344334433",
  "3322332233223322",
  "4433443344334433",
  "5544554455445544",
  "4433443344334433",
  "5544554455445544",
  "3322332233223322",
  "4433443344334433",
  "3322332233223322",
  "4433443344334433",
  "3322332233223322",
];

// Tile (3,0): Floor with stone detail
const floor4 = [
  "3344334433443344",
  "4455445544554455",
  "3322334433443344",
  "2233223322334455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344332233443344",
  "4455443344554455",
  "3344334433223344",
  "4455445544554455",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
  "3344334433443344",
];

// ========== WALL TILES ==========

// Tile (0,1): Wall top-face (seen from above, the top of a wall)
const wallTop = [
  "9999999999999999",
  "7777777777777777",
  "7445544554455447",
  "7445544554455447",
  "7554455445544557",
  "7554455445544557",
  "7445544554455447",
  "7445544554455447",
  "7554455445544557",
  "7554455445544557",
  "7445544554455447",
  "7445544554455447",
  "7554455445544557",
  "7554455445544557",
  "7777777777777777",
  "9999999999999999",
];

// Tile (1,1): Wall front face (dark stone bricks)
const wallFront = [
  "EE1E1E1E1E1E1EEE",
  "E1F1F1F1F1F1F1E1",
  "E1F1F1F1F1F1F1E1",
  "EE1E1E1E1E1E1EEE",
  "1F1F1E1E1E1E1F1F",
  "1F1F1E1E1E1E1F1F",
  "EE1E1E1E1E1E1EEE",
  "E1F1F1F1F1F1F1E1",
  "E1F1F1F1F1F1F1E1",
  "EE1E1E1E1E1E1EEE",
  "1F1F1E1E1E1E1F1F",
  "1F1F1E1E1E1E1F1F",
  "EE1E1E1E1E1E1EEE",
  "E1F1F1F1F1F1F1E1",
  "E1F1F1F1F1F1F1E1",
  "EE1E1E1E1E1E1EEE",
];

// Tile (2,1): Wall with shadow
const wallShadow = [
  "0EE1E1E1E1E1E1EE",
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
  "01F1F1E1E1E1E1F1",
  "01F1F1E1E1E1E1F1",
  "0EE1E1E1E1E1E1EE",
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
  "01F1F1E1E1E1E1F1",
  "01F1F1E1E1E1E1F1",
  "0EE1E1E1E1E1E1EE",
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
];

// Tile (3,1): Wall bottom edge
const wallBottom = [
  "E1F1F1F1F1F1F1E1",
  "E1F1F1F1F1F1F1E1",
  "EE1E1E1E1E1E1EEE",
  "1F1F1E1E1E1E1F1F",
  "1F1F1E1E1E1E1F1F",
  "EE1E1E1E1E1E1EEE",
  "E1F1F1F1F1F1F1E1",
  "E1F1F1F1F1F1F1E1",
  "EE1E1E1E1E1E1EEE",
  "CC7CCCC7CCCC7CCC",
  "C7CCCC7CCCC7CCCC",
  "CC7CCCC7CCCC7CCC",
  "C7CCCC7CCCC7CCCC",
  "CC7CCCC7CCCC7CCC",
  "C7CCCC7CCCC7CCCC",
  "9999999999999999",
];

// ========== CORNER TILES ==========

// Tile (0,2): Top-left wall corner
const cornerTL = [
  "9999999999999999",
  "9777777777777779",
  "97445544554455479",
  "97445544554455479",
  "97554455445544579",
  "97554455445544579",
  "97445544554455479",
  "97445544554455479",
  "07554455445544570",
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
  "01F1F1E1E1E1E1F1",
  "01F1F1E1E1E1E1F1",
  "0EE1E1E1E1E1E1EE",
  "00E1F1F1F1F1F1E0",
];

// Tile (1,2): Top-right wall corner
const cornerTR = cornerTL.map(r => mirrorH(r));

// Tile (2,2): Bottom-left wall corner
const cornerBL = [
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
  "01F1F1E1E1E1E1F1",
  "01F1F1E1E1E1E1F1",
  "0EE1E1E1E1E1E1EE",
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
  "01F1F1E1E1E1E1F1",
  "01F1F1E1E1E1E1F1",
  "07777777777777700",
  "97777777777777799",
  "97445544554455479",
  "97554455445544579",
  "9999999999999999",
];

// Tile (3,2): Bottom-right wall corner
const cornerBR = cornerBL.map(r => mirrorH(r));

// ========== WALL SIDE TILES ==========

// Tile (0,3): Wall left edge
const wallLeft = [
  "00E1F1F1F1F1F1E1",
  "00E1F1F1F1F1F1E1",
  "00EE1E1E1E1E1EEE",
  "001F1F1E1E1E1F1F",
  "001F1F1E1E1E1F1F",
  "00EE1E1E1E1E1EEE",
  "00E1F1F1F1F1F1E1",
  "00E1F1F1F1F1F1E1",
  "00EE1E1E1E1E1EEE",
  "001F1F1E1E1E1F1F",
  "001F1F1E1E1E1F1F",
  "00EE1E1E1E1E1EEE",
  "00E1F1F1F1F1F1E1",
  "00E1F1F1F1F1F1E1",
  "00EE1E1E1E1E1EEE",
  "00E1F1F1F1F1F1E1",
];

// Tile (1,3): Wall right edge
const wallRight = wallLeft.map(r => mirrorH(r));

// Tile (2,3): Wall top edge (top of wall visible + front)
const wallTopEdge = [
  "9999999999999999",
  "9777777777777779",
  "97445544554455479",
  "97445544554455479",
  "97554455445544579",
  "97554455445544579",
  "97445544554455479",
  "97445544554455479",
  "07554455445544570",
  "0E1F1F1F1F1F1F1E",
  "0E1F1F1F1F1F1F1E",
  "0EE1E1E1E1E1E1EE",
  "01F1F1E1E1E1E1F1",
  "01F1F1E1E1E1E1F1",
  "0EE1E1E1E1E1E1EE",
  "0E1F1F1F1F1F1F1E",
];

// Tile (3,3): Decorative stone tile
const decorStone = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "445544BB55445544",
  "334433BB44334433",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "2233223322332233",
];

// ========== MORE VARIATIONS ==========

// Tile (0,4): Floor with moss
const floorMoss = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "2233223322332233",
  "3344334433443344",
  "2233AA3322332233",
  "33AABB4433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "223322AA22332233",
  "334433BB33443344",
  "2233223322332233",
  "3344334433443344",
  "2233223322332233",
];

// Tile (1,4): Dark floor (for unexplored/shadow areas)
const floorDark = [
  "1122112211221122",
  "2233223322332233",
  "1122112211221122",
  "2233223322332233",
  "1111111111111111",
  "2211221122112211",
  "1111111111111111",
  "1122112211221122",
  "2233223322332233",
  "1122112211221122",
  "2233223322332233",
  "1111111111111111",
  "2211221122112211",
  "1111111111111111",
  "1122112211221122",
  "1111111111111111",
];

// Tile (2,4): Stairs down
const stairsDown = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "2299229922992299",
  "9999999999999999",
  "7777777777777777",
  "EE1E1E1E1E1E1EEE",
  "E1F1F1F1F1F1F1E1",
  "EE1E1E1E1E1E1EEE",
  "1F1F1F1F1F1F1F1F",
  "EE1E1E1E1E1E1EEE",
  "E1F1F1F1F1F1F1E1",
  "9999999999999999",
];

// Tile (3,4): Door frame
const doorFrame = [
  "9999999999999999",
  "9777779997777779",
  "9744590095445579",
  "9744590095445579",
  "9755490095544579",
  "9755490095544579",
  "9744490094455479",
  "9744490094455479",
  "9755490095544579",
  "9755490095544579",
  "9744490094455479",
  "9744490094455479",
  "9755490095544579",
  "9755490095544579",
  "9999990009999999",
  "9999990009999999",
];

// Tile (0,5): Pit / hole
const pit = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455499999954455",
  "3344999999994433",
  "4455999999995544",
  "2233999999993322",
  "3344999999994433",
  "4455999999995544",
  "3344999999994433",
  "2233999999993322",
  "3344999999994433",
  "4455999999954455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
];

// Tile (1,5): Treasure floor marker
const floorTreasure = [
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344339933443344",
  "4455999999554455",
  "3344996699443344",
  "4455999999554455",
  "3344339933443344",
  "4455445544554455",
  "3344334433443344",
  "4455445544554455",
  "3344334433443344",
  "2233223322332233",
];

// Fill remaining tiles with floor variations
const floorFill1 = [
  "4433443344334433",
  "5544554455445544",
  "4433443344334433",
  "5544554455445544",
  "3322332233223322",
  "4433443344334433",
  "3322332233223322",
  "4433443344334433",
  "5544554455445544",
  "4433443344334433",
  "5544AA5544554455",
  "3322AABB22332233",
  "4433443344334433",
  "3322332233223322",
  "4433443344334433",
  "3322332233223322",
];

// Fill all tiles first with floorFill1 as default
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    fillTile(c, r, floorFill1);
  }
}

// Now fill specific tiles
fillTile(0, 0, floor1);
fillTile(1, 0, floor2);
fillTile(2, 0, floor3);
fillTile(3, 0, floor4);

fillTile(0, 1, wallTop);
fillTile(1, 1, wallFront);
fillTile(2, 1, wallShadow);
fillTile(3, 1, wallBottom);

fillTile(0, 2, cornerTL);
fillTile(1, 2, cornerTR);
fillTile(2, 2, cornerBL);
fillTile(3, 2, cornerBR);

fillTile(0, 3, wallLeft);
fillTile(1, 3, wallRight);
fillTile(2, 3, wallTopEdge);
fillTile(3, 3, decorStone);

fillTile(0, 4, floorMoss);
fillTile(1, 4, floorDark);
fillTile(2, 4, stairsDown);
fillTile(3, 4, doorFrame);

fillTile(0, 5, pit);
fillTile(1, 5, floorTreasure);

const pngData = createPNG(IMG_W, IMG_H, pixels);
const outPath = "public/assets/tiles/dungeon_tiles.png";
fs.mkdirSync("public/assets/tiles", { recursive: true });
fs.writeFileSync(outPath, pngData);
const stats = fs.statSync(outPath);
console.log(`Generated: ${outPath} (${stats.size} bytes)`);
console.log(stats.size > 1024 ? "✓ Size > 1KB" : "✗ Too small");

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
  const compressed = zlib.deflateSync(raw, { level: 0 }); // no compression to ensure size
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

// Palette: sweetie-16 inspired
const P = {
  ".": [40, 30, 40, 255],     // dark bg (non-transparent)
  "0": [20, 12, 28, 255],     // outline
  "1": [68, 36, 52, 255],     // dark
  "2": [48, 42, 58, 255],     // mid dark
  "3": [95, 87, 79, 255],     // grey
  "4": [130, 130, 130, 255],  // armour grey
  "5": [160, 160, 160, 255],  // light armour
  "6": [200, 200, 210, 255],  // highlight
  "7": [45, 50, 60, 255],     // dark steel
  "8": [60, 80, 120, 255],    // blue steel
  "9": [230, 200, 80, 255],   // gold
  "A": [180, 140, 100, 255],  // skin
  "B": [140, 60, 60, 255],    // red
  "C": [200, 90, 90, 255],    // bright red
  "D": [80, 60, 40, 255],     // brown boots
  "E": [100, 80, 60, 255],    // belt
  "F": [50, 70, 50, 255],     // shield green
  "G": [70, 100, 70, 255],    // shield green light
};

const FW = 16, FH = 16, COLS = 4, ROWS = 4;
const SW = FW * COLS, SH = FH * ROWS;
const pixels = new Uint8Array(SW * SH * 4);

function fillFrame(col, row, data) {
  const ox = col * FW, oy = row * FH;
  for (let y = 0; y < FH && y < data.length; y++) {
    for (let x = 0; x < FW && x < data[y].length; x++) {
      const ch = data[y][x];
      const color = P[ch] || P["."];
      const i = ((oy + y) * SW + (ox + x)) * 4;
      pixels[i] = color[0]; pixels[i+1] = color[1]; pixels[i+2] = color[2]; pixels[i+3] = color[3];
    }
  }
}

function mirror(row) { return row.split("").reverse().join(""); }

// DOWN frames
const down = [
  [
    "....0000000.....",
    "...099999990....",
    "..099CC999990...",
    "..09999999990...",
    "..09A1999A990...",
    "..09AAAA99000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..0944AAAA4900.",
    "...094444490....",
    "...07A44A4970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "...07D7777D70..",
    "..07DD7.7DD70..",
  ],
  [
    "....0000000.....",
    "...099999990....",
    "..099CC999990...",
    "..09999999990...",
    "..09A1999A990...",
    "..09AAAA99000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..0944AAAA4900.",
    "...094444490....",
    "...07A44A4970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "..07D7777D70...",
    "..07DD7..7DD70.",
  ],
  [
    "....0000000.....",
    "...099999990....",
    "..099CC999990...",
    "..09999999990...",
    "..09A1999A990...",
    "..09AAAA99000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..0944AAAA4900.",
    "...094444490....",
    "...07A44A4970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "...07D7777D70..",
    "..07DD7.7DD70..",
  ],
  [
    "....0000000.....",
    "...099999990....",
    "..099CC999990...",
    "..09999999990...",
    "..09A1999A990...",
    "..09AAAA99000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..0944AAAA4900.",
    "...094444490....",
    "...07A44A4970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "...07DD777D70..",
    "....07DD.7DD70.",
  ],
];

// UP frames
const up = [
  [
    "....0000000.....",
    "...099999990....",
    "..09999999990...",
    "..09999999990...",
    "..09999999990...",
    "..09999999000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..094444444900.",
    "...094444490....",
    "...079AAAA7970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "...07D7777D70..",
    "..07DD7.7DD70..",
  ],
  [
    "....0000000.....",
    "...099999990....",
    "..09999999990...",
    "..09999999990...",
    "..09999999990...",
    "..09999999000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..094444444900.",
    "...094444490....",
    "...079AAAA7970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "..07D7777D70...",
    "..07DD7..7DD70.",
  ],
  [
    "....0000000.....",
    "...099999990....",
    "..09999999990...",
    "..09999999990...",
    "..09999999990...",
    "..09999999000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..094444444900.",
    "...094444490....",
    "...079AAAA7970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "...07D7777D70..",
    "..07DD7.7DD70..",
  ],
  [
    "....0000000.....",
    "...099999990....",
    "..09999999990...",
    "..09999999990...",
    "..09999999990...",
    "..09999999000..",
    "...09E4E4E90....",
    "..0944E4E4490..",
    "..094444444900.",
    "...094444490....",
    "...079AAAA7970..",
    "...079AAAA7970..",
    "....074444470...",
    "....077447770..",
    "...07DD777D70..",
    "....07DD.7DD70.",
  ],
];

// LEFT frames
const left = [
  [
    "..0000000.......",
    ".099999990......",
    "099CC999990.....",
    "09999999990.....",
    "09A1999A990.....",
    "09AAAA990.......",
    ".09E4E4E90......",
    "0944E4E4490.....",
    "0944AAAA4900....",
    ".094444490......",
    "079A44A4970.....",
    "079AAAAA7970....",
    ".0744444470.....",
    ".0774447770.....",
    "7D77777D70......",
    "7DD7.7DD70......",
  ],
  [
    "..0000000.......",
    ".099999990......",
    "099CC999990.....",
    "09999999990.....",
    "09A1999A990.....",
    "09AAAA990.......",
    ".09E4E4E90......",
    "0944E4E4490.....",
    "0944AAAA4900....",
    ".094444490......",
    "079A44A4970.....",
    "079AAAAA7970....",
    ".0744444470.....",
    "7D77447770......",
    "7DD7.7DD70......",
    ".7D..7D70.......",
  ],
  [
    "..0000000.......",
    ".099999990......",
    "099CC999990.....",
    "09999999990.....",
    "09A1999A990.....",
    "09AAAA990.......",
    ".09E4E4E90......",
    "0944E4E4490.....",
    "0944AAAA4900....",
    ".094444490......",
    "079A44A4970.....",
    "079AAAAA7970....",
    ".0744444470.....",
    ".0774447770.....",
    "7D77777D70......",
    "7DD7.7DD70......",
  ],
  [
    "..0000000.......",
    ".099999990......",
    "099CC999990.....",
    "09999999990.....",
    "09A1999A990.....",
    "09AAAA990.......",
    ".09E4E4E90......",
    "0944E4E4490.....",
    "0944AAAA4900....",
    ".094444490......",
    "079A44A4970.....",
    "079AAAAA7970....",
    ".0744444470.....",
    ".077D447770.....",
    ".7DD.7DD70......",
    "..7D.7D70.......",
  ],
];

const right = left.map(frame => frame.map(mirror));

for (let f = 0; f < 4; f++) {
  fillFrame(0, f, down[f]);
  fillFrame(1, f, left[f]);
  fillFrame(2, f, right[f]);
  fillFrame(3, f, up[f]);
}

const pngData = createPNG(SW, SH, pixels);
const outPath = "public/assets/sprites/knight.png";
fs.mkdirSync("public/assets/sprites", { recursive: true });
fs.writeFileSync(outPath, pngData);
const stats = fs.statSync(outPath);
console.log(`Generated: ${outPath} (${stats.size} bytes)`);
console.log(stats.size > 1024 ? "✓ Size > 1KB" : "✗ Too small");

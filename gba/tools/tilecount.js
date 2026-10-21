// Counts unique 8x8 tiles (flips count as the same, like grit's reduction) in each background BMP, and the VRAM they need.
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '../game/graphics');
for (const f of fs.readdirSync(dir).filter(f => /_(level|far|mid|near)\.bmp$/.test(f))) {
  const b = fs.readFileSync(path.join(dir, f)), off = b.readUInt32LE(10), w = b.readInt32LE(18), h = b.readInt32LE(22), rowBytes = Math.ceil(Math.ceil(w / 2) / 4) * 4;
  const px = (x, y) => { const v = b[off + (h - 1 - y) * rowBytes + (x >> 1)]; return (x & 1) ? v & 15 : v >> 4; };
  const seen = new Set();
  for (let ty = 0; ty < h; ty += 8) for (let tx = 0; tx < w; tx += 8) {
    const t = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) t.push(px(tx + x, ty + y));
    const flips = [t, t.map((_, i) => t[(i >> 3) * 8 + 7 - (i & 7)]), t.map((_, i) => t[(7 - (i >> 3)) * 8 + (i & 7)]), t.map((_, i) => t[63 - i])].map(a => a.join(''));
    if (!flips.some(k => seen.has(k))) seen.add(flips[0]);
  }
  console.log(`${f.padEnd(18)} ${w}x${h}  unique tiles ${String(seen.size).padStart(4)}  = ${(seen.size * 32 / 1024).toFixed(1)} KB`);
}

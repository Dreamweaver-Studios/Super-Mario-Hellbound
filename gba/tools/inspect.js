// Prints size and colour count of the art the GBA port uses, and how "2x-doubled" each Mario frame is.
const fs = require('fs'), path = require('path'), { PNG } = require('pngjs');
const root = path.resolve(__dirname, '../..');
const load = f => PNG.sync.read(fs.readFileSync(path.join(root, f)));
const files = ['sprites/mario1.png', 'sprites/alien/walk1.png', 'sprites/alien/idle1.png', 'sprites/coin.png', 'sprites/oneup.png',
  'bg/jungle/tileset.png', ...[1, 2, 3, 4, 5].map(n => `bg/jungle/plx-${n}.png`)];
for (const f of files) {
  const p = load(f), cols = new Set(); let semi = 0;
  for (let i = 0; i < p.data.length; i += 4) { const a = p.data[i + 3]; if (a === 0) continue; if (a < 255) semi++; cols.add(p.data.readUInt32BE(i) >>> 8); }
  let note = '';
  if (f.includes('mario')) {
    // Compare each pixel with its 2x2-block neighbour: identical blocks mean the art was pixel-doubled
    let same = 0, tot = 0;
    for (let y = 0; y + 1 < p.height; y += 2) for (let x = 0; x + 1 < p.width; x += 2) {
      const o = (yy, xx) => p.data.readUInt32BE((yy * p.width + xx) * 4);
      tot++; if (o(y, x) === o(y, x + 1) && o(y, x) === o(y + 1, x) && o(y, x) === o(y + 1, x + 1)) same++;
    }
    note = ` 2x2 blocks uniform: ${(100 * same / tot).toFixed(0)}% (even grid)`;
    same = 0; tot = 0;
    for (let y = 1; y + 1 < p.height; y += 2) for (let x = 1; x + 1 < p.width; x += 2) {
      const o = (yy, xx) => p.data.readUInt32BE((yy * p.width + xx) * 4);
      tot++; if (o(y, x) === o(y, x + 1) && o(y, x) === o(y + 1, x) && o(y, x) === o(y + 1, x + 1)) same++;
    }
    note += `, ${(100 * same / tot).toFixed(0)}% (odd grid)`;
  }
  console.log(`${f}: ${p.width}x${p.height}, ${cols.size} colours, ${semi} semi-transparent px${note}`);
}

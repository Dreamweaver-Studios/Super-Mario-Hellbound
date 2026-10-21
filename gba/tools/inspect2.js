// Sizes and colour counts of the Graveyard / Hell art.
const fs = require('fs'), path = require('path'), { PNG } = require('pngjs');
const root = path.resolve(__dirname, '../..');
const list = d => fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.png')).map(f => d + '/' + f);
for (const f of [...list('bg/grave'), ...list('bg/cave'), ...list('sprites/death').slice(0, 2), ...list('sprites/beast').slice(0, 3), ...list('sprites/skull').slice(0, 1)]) {
  const p = PNG.sync.read(fs.readFileSync(path.join(root, f))), cols = new Set(); let semi = 0, clear = 0;
  for (let i = 0; i < p.data.length; i += 4) { const a = p.data[i + 3]; if (a === 0) { clear++; continue; } if (a < 255) semi++; cols.add(p.data.readUInt32BE(i) >>> 8); }
  console.log(`${f}: ${p.width}x${p.height}, ${cols.size} colours, ${semi} semi, ${(100 * clear / (p.width * p.height)).toFixed(0)}% clear`);
}

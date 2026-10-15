const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const start = script.indexOf('const LEVELS');
const end = script.indexOf('return L;\n}', start) + 'return L;\n}'.length;
const code = `const T = 16, ROWS = 17, PH = 24, COINS_PER_BLOCK = 5, BEAST_HP = 6;\n${script.slice(start, end)}\nmodule.exports = { LEVELS, build };`;
const m = { exports: {} };
new Function('module', code)(m);
const { LEVELS, build } = m.exports;
const T = 16, ROWS = 17, COINS_PER_BLOCK = 5;
for (const def of LEVELS) {
  const L = build(def);
  const problems = [];
  const coinCells = new Set();
  for (const c of L.coins) {
    const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T), t = L.grid[ty][tx];
    if (t === 1 || t === 4) problems.push(`coin inside solid at ${tx},${ty}`);
    if (t === 3) problems.push(`coin on spikes at ${tx},${ty}`);
    const k = tx + ',' + ty; if (coinCells.has(k)) problems.push(`duplicate coin ${k}`); coinCells.add(k);
  }
  for (const e of L.embers) { const k = Math.floor(e.x / T) + ',' + Math.floor(e.y / T); if (coinCells.has(k)) problems.push(`coin overlaps ember ${k}`); }
  for (const mu of L.mush) { const k = Math.floor((mu.x + 6) / T) + ',' + Math.floor((mu.y + 6) / T); if (coinCells.has(k)) problems.push(`coin overlaps mushroom ${k}`); if (L.grid[Math.floor((mu.y + 6) / T)][Math.floor((mu.x + 6) / T)] === 4) problems.push(`mushroom in block ${k}`); }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < L.w; x++) if (L.grid[y][x] === 4) {
    const below = L.grid[y + 1] && L.grid[y + 1][x];
    if (below !== 1 && below !== 2) problems.push(`block ${x},${y} not resting on ground (below=${below})`);
  }
  const g = (x, y) => (y >= 0 && y < ROWS && x >= 0 && x < L.w) ? L.grid[y][x] : 0;
  const footing = t => t === 1 || t === 2;
  for (const e of L.enemies) {
    const row = Math.floor((e.y + e.h - 1) / T);
    for (let x = Math.floor(e.a / T); x <= Math.floor((e.b + e.w - 1) / T); x++) {
      if (!footing(g(x, row + 1))) problems.push(`enemy patrol over gap at ${x},${row + 1}`);
      for (let r = Math.floor(e.y / T); r <= row; r++) if (g(x, r) === 1 || g(x, r) === 4) problems.push(`enemy overlaps solid at ${x},${r}`);
    }
  }
  for (const em of L.embers) { const t = g(Math.floor(em.x / T), Math.floor(em.y / T)); if (t === 1 || t === 4) problems.push(`ember in solid at ${Math.floor(em.x / T)},${Math.floor(em.y / T)}`); }
  for (const c of L.checks) if (!footing(g(c.col, c.row + 1)) || g(c.col, c.row)) problems.push(`checkpoint bad footing ${c.col},${c.row}`);
  for (const mu of L.mush) { const cx = Math.floor((mu.x + 6) / T), r = Math.floor((mu.y + 11) / T); if (!footing(g(cx, r + 1)) || g(cx, r)) problems.push(`mushroom bad footing ${cx},${r}`); }
  if (!L.door && !L.boss) problems.push('no exit door');
  if (L.boss) {
    const d = L.boss.door, cx = d.x / T, r = (d.y + d.h) / T - 1;
    if (!footing(g(cx, r + 1)) || g(cx, r) || g(cx, r - 1)) problems.push(`boss door bad footing ${cx},${r}`);
    if (L.w * T - (L.boss.gate + 1) * T < 400) problems.push('boss arena too narrow');
    for (let x = L.boss.gate; x < L.w; x++) if (!footing(g(x, 14))) problems.push(`arena floor gap at ${x}`);
    console.log(`  boss arena cols ${L.boss.gate}-${L.w - 1}, door col ${cx}`);
  }
  if (L.door) { const cx = L.door.x / T, r = (L.door.y + L.door.h) / T - 1; if (!footing(g(cx, r + 1)) || g(cx, r) || g(cx, r - 1)) problems.push(`door bad footing ${cx},${r}`); }
  const kinds = L.enemies.reduce((m, e) => (m[e.kind || 'beetle'] = (m[e.kind || 'beetle'] || 0) + 1, m), {});
  console.log(`${def.name} foes: ${JSON.stringify(kinds)}`);
  console.log(`${def.name} (w ${L.w}): visible ${L.coins.length}, blocks ${L.cracks} -> hidden ${L.cracks * COINS_PER_BLOCK}, total ${L.coinTotal}, 1-up blocks ${[...L.oneupBlocks].join(' ')}`);
  console.log(problems.length ? '  ' + problems.join('\n  ') : '  no placement problems');
}

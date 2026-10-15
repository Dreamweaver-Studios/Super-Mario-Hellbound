// For each hell beast: the farthest spot Mario can stand (or crouch) and shoot it from, with a clear line of fire.
// Uses the game's numbers: bullets fly flat from the muzzle (feet - 13 standing, feet - 8 crouching) for 70 frames at 6.5 px,
// stop at solid tiles (cracked blocks break, so they don't block for long), and hit when
// b.x in [e.x-2, e.x+e.w+2] and b.y in (e.y-6, e.y+e.h). A beast notices Mario when |dx| < BEAST_RANGE (centres) and |dy| < 90.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const start = script.indexOf('const LEVELS');
const end = script.indexOf('return L;\n}', start) + 'return L;\n}'.length;
const code = `const T = 16, ROWS = 17, PH = 24, COINS_PER_BLOCK = 5, BEAST_HP = 6;\n${script.slice(start, end)}\nmodule.exports = { LEVELS, build };`;
const m = { exports: {} };
new Function('module', code)(m);
const { LEVELS, build } = m.exports;
const T = 16, ROWS = 17, PW = 14, PH = 24, CH = 18, RANGE = 240, BULLET_REACH = 70 * 6.5 + 20.5;
const L = build(LEVELS.find(d => d.name === (process.argv[3] || 'Hell')));
const tile = (tx, ty) => (tx < 0 || tx >= L.w) ? 1 : (ty < 0 || ty >= ROWS) ? 0 : L.grid[ty][tx];
const solid = t => t === 1 || t === 4;

// Places Mario can stand: {x (left), feet, how}
const spots = [];
for (let r = 1; r < ROWS; r++) for (let x = 0; x <= L.w * T - PW; x += 2) {
  const l = Math.floor(x / T), rr = Math.floor((x + PW - 0.01) / T);
  let foot = false, blocked = false, spike = false;
  for (let tx = l; tx <= rr; tx++) {
    const t = tile(tx, r); if (solid(t) || t === 2) foot = true;
    if (solid(tile(tx, r - 1)) || solid(tile(tx, r - 2))) blocked = true;
    if (tile(tx, r - 1) === 3) spike = true;
  }
  if (foot && !blocked && !spike) spots.push({ x, feet: r * T, how: 'ground' });
}
for (const mv of L.movers) for (let t = 0; t < mv.period; t += 4) {
  const k = (1 - Math.cos(t / mv.period * Math.PI * 2)) / 2;
  const mx = mv.x0 + (mv.x1 - mv.x0) * k, my = mv.y0 + (mv.y1 - mv.y0) * k;
  for (let x = mx - PW + 1; x < mx + mv.w; x += 2) spots.push({ x, feet: my, how: 'mover' });
}

// Clear horizontal line from Mario's centre to the beast at height y?
function clear(x0, x1, y) {
  const ty = Math.floor(y / T), a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let tx = Math.floor(a / T); tx <= Math.floor(b / T); tx++) if (tile(tx, ty) === 1) return false;
  return true;
}

// Heights Mario's feet pass through on a standing jump (held all the way) — he can fire at any of them
const POSES = [[false, 0], [true, 0]];
{ let vy = -7.2, h = 0; for (;;) { vy += 0.42; h -= vy; if (h <= 0) break; POSES.push([false, h]); } }

const rows = [];
L.enemies.forEach((e, i) => {
  if (e.kind !== 'beast') return;
  const ecx = e.x + e.w / 2;
  let best = null;
  for (const s of spots) for (const [crouch, rise] of POSES) {
    // A jump peaks at about 61px; the head mustn't hit a ceiling on the way up
    const top = Math.floor((s.feet - rise - PH) / T);
    if (rise && (solid(tile(Math.floor(s.x / T), top)) || solid(tile(Math.floor((s.x + PW - 0.01) / T), top)))) continue;
    const by = s.feet - rise - (crouch ? 8 : 13);
    if (!(by > e.y - 6 && by < e.y + e.h)) continue;
    const mcx = s.x + PW / 2, face = ecx > mcx ? 1 : -1;
    if (face < 0) continue; // the level runs left to right: shooting back from the far side means having walked past it already
    const near = face > 0 ? e.x - 2 : e.x + e.w + 2;                 // first edge of the hit zone the bullet meets
    const dist = Math.abs(near - (mcx + face * 20.5));
    if ((face > 0 && mcx + 20.5 > e.x + e.w) || (face < 0 && mcx - 20.5 < e.x)) continue; // muzzle past the beast
    if (dist > BULLET_REACH - 20.5) continue;
    if (!clear(mcx, near, by)) continue;
    const dx = Math.abs(ecx - mcx);
    // Outside the beast's notice: far enough across, or far enough above/below (centre vs its mouth)
    const dy = Math.abs((s.feet - rise - (crouch ? CH : PH) / 2) - (e.y + 6));
    const unseen = dx >= RANGE || dy >= 90;
    const score = unseen ? 1e6 + dx : dx;
    if (!best || score > best.score) best = { score, dx, unseen, side: face > 0 ? 'left' : 'right', col: Math.floor(mcx / T), feetRow: s.feet / T, crouch, rise: Math.round(rise), how: s.how };
  }
  const col = Math.floor(ecx / T), row = (e.y + e.h) / T - 1;
  rows.push({ i, col, row, best });
});
for (const r of rows) {
  const b = r.best;
  console.log(`beast #${r.i} col ${r.col} stands on row ${r.row + 1}: ` + (b
    ? `best shot ${Math.round(b.dx)}px from the ${b.side} (Mario col ${b.col}, feet row ${+b.feetRow.toFixed(2)}${b.crouch ? ', crouching' : ''}${b.rise ? `, jumping ${b.rise}px` : ''}${b.how === 'mover' ? ', on mover' : ''})${b.unseen ? '  SAFE' : '  inside range'}`
    : 'NO firing spot at all'));
}

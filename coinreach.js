// Coin reachability: simulates the game's player physics (updatePlayer) from every standable spot and every
// moving-platform position, over a family of run / jump-timing / air-steering inputs, and reports static coins
// that no trajectory touches. Deliberately optimistic (ignores enemies, spike knockback, mid-air mover landings),
// so anything it reports unreachable really is.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const only = process.argv[3] ? process.argv[3].split(',') : null;
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const start = script.indexOf('const LEVELS');
const end = script.indexOf('return L;\n}', start) + 'return L;\n}'.length;
const code = `const T = 16, ROWS = 17, PH = 24, COINS_PER_BLOCK = 5, BEAST_HP = 6;\n${script.slice(start, end)}\nmodule.exports = { LEVELS, build };`;
const m = { exports: {} };
new Function('module', code)(m);
const { LEVELS, build } = m.exports;
const T = 16, ROWS = 17, PW = 14, PH = 24;

for (const def of LEVELS) {
  if (only && !only.includes(def.name)) continue;
  const L = build(def);
  const tile = (tx, ty) => (tx < 0 || tx >= L.w) ? 1 : (ty < 0 || ty >= ROWS) ? 0 : L.grid[ty][tx];
  const solid = t => t === 1 || t === 4;
  const coins = L.coins.map(c => ({ x: c.x, y: c.y, col: (c.x - 8) / T, row: (c.y - 8) / T, hit: false }));
  const touch = (x, y) => {
    for (const c of coins) if (!c.hit && c.x + 4 > x && c.x - 4 < x + PW && c.y + 5 > y && c.y - 5 < y + PH) c.hit = true;
  };

  // One trajectory. pol: v0, d1, d2, m (switch frame), jb (jump press frame or -1), k (release frame)
  function sim(x0, y0, pol) {
    let x = x0, y = y0, vx = pol.v0, vy = 0, ground = true, coyote = 0, jumpBuf = 0, jumped = false, air = false;
    touch(x, y);
    for (let t = 0; t < 150; t++) {
      const dir = t < pol.m ? pol.d1 : pol.d2;
      const held = pol.jb >= 0 && t >= pol.jb && t < pol.k;
      if (t === pol.jb) jumpBuf = 8;
      const acc = ground ? 0.38 : 0.26, max = 2.3;
      if (dir) { vx += dir * acc; if (Math.abs(vx) > max) vx = Math.sign(vx) * max; }
      else { vx *= ground ? 0.7 : 0.9; if (Math.abs(vx) < 0.05) vx = 0; }
      const ox = x;
      coyote = ground ? 6 : Math.max(0, coyote - 1);
      if (jumpBuf > 0) jumpBuf--;
      if (jumpBuf > 0 && coyote > 0) { vy = -7.2; ground = false; coyote = 0; jumpBuf = 0; jumped = true; }
      if (!held && vy < -2.6) vy = -2.6;
      vy = Math.min(vy + 0.42, 8.5);
      x += vx;
      const mvx = x - ox, top = Math.floor(y / T), bot = Math.floor((y + PH - 0.01) / T);
      if (mvx > 0) { const tx = Math.floor((x + PW - 0.01) / T); for (let ty = top; ty <= bot; ty++) if (solid(tile(tx, ty))) { x = tx * T - PW; vx = 0; break; } }
      else if (mvx < 0) { const tx = Math.floor(x / T); for (let ty = top; ty <= bot; ty++) if (solid(tile(tx, ty))) { x = (tx + 1) * T; vx = 0; break; } }
      const pb = y + PH;
      y += vy; ground = false;
      const l = Math.floor(x / T), r = Math.floor((x + PW - 0.01) / T);
      if (vy > 0) {
        const ty = Math.floor((y + PH) / T);
        for (let tx = l; tx <= r; tx++) { const tt = tile(tx, ty); if (solid(tt) || (tt === 2 && pb <= ty * T + 0.01)) { y = ty * T - PH; vy = 0; ground = true; break; } }
      } else if (vy < 0) {
        const ty = Math.floor(y / T);
        for (let tx = l; tx <= r; tx++) if (solid(tile(tx, ty))) { y = (ty + 1) * T; vy = 0; break; }
      }
      touch(x, y);
      if (!ground) air = true;
      if (y > ROWS * T + 10) return;
      if (ground && air) return;                                   // landed: that spot is its own launch point
      if (ground && t > 10 && (jumped || pol.jb < 0)) return;      // just walking along
    }
  }

  const V0 = [-2.3, -1.15, 0, 1.15, 2.3], DIRS = [-1, 0, 1], MS = [0, 5, 10, 15, 20, 30], KS = [2, 5, 8, 11, 99];
  function launch(x, y, nearEdge, jbs) {
    for (const v0 of V0) for (const d1 of DIRS) for (const d2 of DIRS) for (const mm of MS) {
      if (mm === 0 && d1 !== 0) continue;
      sim(x, y, { v0, d1, d2, m: mm, jb: -1, k: 0 });
      for (const jb of jbs) { if (jb > 0 && !nearEdge) continue; for (const k of KS) sim(x, y, { v0, d1, d2, m: mm, jb, k: jb + k }); }
    }
  }

  // Static standing spots
  let spots = 0;
  for (let r = 1; r < ROWS; r++) for (let x = 0; x <= L.w * T - PW; x += 2) {
    const l = Math.floor(x / T), rr = Math.floor((x + PW - 0.01) / T), y = r * T - PH;
    let foot = false, blocked = false;
    for (let tx = l; tx <= rr; tx++) {
      const t = tile(tx, r); if (solid(t) || t === 2) foot = true;
      if (solid(tile(tx, r - 1)) || solid(tile(tx, r - 2))) blocked = true;
    }
    if (!foot || blocked) continue;
    const edge = !(solid(tile(l - 1, r)) || tile(l - 1, r) === 2) || !(solid(tile(rr + 1, r)) || tile(rr + 1, r) === 2);
    spots++; launch(x, y, edge, [0, 3, 6]);
  }
  // Moving platforms: ride along (every frame), and launch from sampled phases
  for (const mv of L.movers) {
    for (let t = 0; t < mv.period; t++) {
      const k = (1 - Math.cos(t / mv.period * Math.PI * 2)) / 2;
      const mx = mv.x0 + (mv.x1 - mv.x0) * k, my = mv.y0 + (mv.y1 - mv.y0) * k;
      for (let x = mx - PW + 1; x < mx + mv.w; x += 2) {
        touch(x, my - PH);
        if (t % 6 === 0) launch(x, my - PH, false, [0]);
      }
    }
  }
  const miss = coins.filter(c => !c.hit);
  console.log(`${def.name}: ${coins.length} visible coins, ${spots} standing spots, ${L.movers.length} movers -> unreachable: ${miss.length ? miss.map(c => `(${c.col},${c.row})`).join(' ') : 'none'}`);
}

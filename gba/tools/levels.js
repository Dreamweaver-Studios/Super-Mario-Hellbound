// All sixteen GBA levels, in game order, as lists of the web level builder's calls (see build() in "Super Mario
// Hellbound.html"): the web game's three levels, the GBA-only ones (gba-levels.js), the GBA-only additions to the web
// levels (GBA_EXTRAS) and, since 2026-10-17, each level's second half (gba-halves.js; the user had every level made twice
// as long, with a proportionate number of enemies, embers and mushrooms).
// Each level is recorded as calls ([method, args]) so it can be moved about and written out again as source: build-assets.js
// builds the levels from them, and check-levels.js writes them into a stand-in HTML for the web game's checkers.
const fs = require('fs'), path = require('path');
const WEB = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(WEB, 'Super Mario Hellbound.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const buildSrc = script.slice(script.indexOf('function build(def)'), script.indexOf('return L;\n}', script.indexOf('function build(def)')) + 'return L;\n}'.length);
const lvStart = script.indexOf('const LEVELS'), lvEnd = script.indexOf('return L;\n}', lvStart) + 'return L;\n}'.length;
const mod = { exports: {} };
new Function('module', `const T = 16, ROWS = 17, PH = 24, COINS_PER_BLOCK = 5, BEAST_HP = 6;\n${script.slice(lvStart, lvEnd)}\nmodule.exports = { LEVELS, build };`)(mod);

// GBA-only additions, run after each level's own builder (the web game's levels stay as they are)
const GBA_EXTRAS = {
  // Four more aliens in the Jungle, at the user's request (2026-10-16), on stretches of floor that had room: a second
  // one on Part 1's long floor after the spike pits, one on the high ledge at the top of the elevator, one on the floor
  // under the plank before the second checkpoint, and a guard in front of the exit door
  Jungle: b => { b.enemy(59, 64, 13); b.enemy(157, 161, 7); b.enemy(174, 178, 13); b.enemy(213, 215, 11); },
  // Three more reapers in the Graveyard, spread out (user request, 2026-10-16), each in a stretch that had none: a plank
  // in the middle of Part 1's empty plank hops, the raised step with the mushroom in Part 2, and the last plank hop before
  // the final stretch. Kept off the steps next to checkpoints, so a respawn isn't straight into a rising reaper.
  Graveyard: b => { b.enemy(61, 63, 9); b.enemy(127, 130, 8); b.enemy(172, 174, 9); },
  // A harder Hell (World 4-4), at the user's request (2026-10-16), leaving the Fire Skull's arena (col 352 on) alone:
  // seven more beasts (23 -> 30), one on each of three plank hops that had none (the first plank chain, the first plank
  // of the chain after the shelf, the last plank before the boss checkpoint), one each on the floor just after the start,
  // Part 1's long floor, the floor after the shelf and between the two spike pits of Part 3's spike run; and two more
  // spike pits (on Part 1's long floor and under the plank before the second checkpoint). Checkpoints keep their room.
  Hell: b => {
    b.enemy(15, 19, 13); b.enemy(57, 59, 9); b.enemy(86, 91, 13); b.enemy(126, 130, 13); b.enemy(133, 135, 11);
    b.enemy(228, 230, 13); b.enemy(325, 327, 11);
    b.spikes(82, 83, 13); b.spikes(160, 161, 13);
  },
};

// Builder calls -> list. Methods are only recorded here (coins() and row() expand when the list is replayed).
function record(fn) {
  const calls = [];
  fn(new Proxy({}, { get: (_, m) => (...a) => { calls.push([m, a]); } }));
  return calls;
}
// Which arguments of each builder method are columns
const XS = { ground: [0, 1], block: [0, 1], plat: [0, 1], spikes: [0, 1], coins: [0, 1], row: [0, 1], enemy: [0, 1],
  ember: [0], mush: [0], bluemush: [0], coin: [0], crack: [0], oneup: [0], check: [0], start: [0], door: [0], mover: [0, 3], boss: [0, 1] };
const STEPPED = { coins: 3, row: 3 };   // the argument holding the step, for runs that are split in two
const moved = ([m, a], dx) => [m, a.map((v, i) => XS[m].includes(i) ? v + dx : v)];
// Moves everything from column `at` on `len` columns right (a boss level's checkpoint and arena, to make room for the
// second half), splitting runs of ground, planks, spikes, coins and embers that cross `at`
function openGap(calls, at, len) {
  const out = [];
  for (const c of calls) {
    const [m, a] = c, xs = XS[m];
    if (!xs) throw new Error(`unknown builder call ${m}`);
    const lo = Math.min(...xs.map(i => a[i])), hi = Math.max(...xs.map(i => a[i]));
    if (lo >= at) { out.push(moved(c, len)); continue; }
    if (hi < at) { out.push(c); continue; }
    if (m === 'enemy' || m === 'mover' || m === 'boss') throw new Error(`${m}(${a}) crosses column ${at}`);
    const step = STEPPED[m] !== undefined ? (a[STEPPED[m]] || 1) : 1, x2 = a[0] + Math.ceil((at - a[0]) / step) * step;
    const left = [...a]; left[1] = at - 1; out.push([m, left]);
    if (x2 <= a[1]) { const right = [...a]; right[0] = x2 + len; right[1] = a[1] + len; out.push([m, right]); }
  }
  return out;
}

// Extra 1-up blocks (user request, 2026-10-17), as [col, row]: one more in 4-1..4-3, two more in 4-4, all in the second
// half on a ledge's end (4-2's and 4-3's mirror the first half's 1-up; 4-2's moved off its floating plank, (552, 7) ->
// (566, 13), user, 2026-10-20)
const EXTRA_ONEUPS = { 'Underworld 1': [[656, 11]], 'Underworld 2': [[566, 13]], 'Underworld 3': [[619, 11]], Hell: [[372, 10], [570, 8]] };
// Extra enemies (user request, 2026-10-19: five more in World 4-4, 60 -> 65), as enemy() args in final columns: on
// floor or plank stretches with no beast within 4 columns, no spikes or blocks beside them and no checkpoint, mushroom,
// 1-up, star or flamethrower next to them, spread through the level. Then five more in Worlds 1-2..1-4 and 2-1..2-4 (user
// request, 2026-10-19), picked the same way (each as far as it could be from every other enemy; 3-col patrols, 3+ cols
// from the next enemy, mostly on the planks the existing patrols leave free)
const EXTRA_ENEMIES = {
  'Jungle 2': [[48, 50, 8], [122, 124, 11], [162, 164, 13], [327, 329, 10], [388, 390, 11]],
  'Jungle 3': [[37, 39, 9], [47, 49, 9], [122, 124, 9], [233, 235, 9], [366, 368, 10]],
  'Jungle 4': [[38, 40, 11], [123, 125, 6], [217, 219, 10], [409, 411, 11], [415, 417, 11]],
  Graveyard: [[51, 53, 9], [107, 109, 9], [167, 169, 7], [292, 294, 10], [350, 352, 8]],
  'Graveyard 2': [[40, 42, 13], [105, 107, 8], [112, 114, 9], [269, 271, 10], [371, 373, 9]],
  'Graveyard 3': [[39, 41, 9], [45, 47, 8], [235, 237, 7], [293, 295, 10], [345, 347, 9]],
  'Graveyard 4': [[49, 51, 8], [167, 169, 5], [197, 199, 12], [343, 345, 9], [373, 375, 12]],
  Hell: [[47, 49, 13], [119, 121, 13], [343, 345, 13], [447, 449, 9], [611, 613, 10]],
};
// The flamethrower pickups (user requests, 2026-10-18), as [col, row] (the cell it stands in) or as how far through the
// level, for flameSpot() to find a spot near. World 1-1 had the first one (placed by hand at col 336, row 13) until the
// user had it removed, the same day. The web builder has no such thing, so it isn't one of the calls; main.cpp gets it
// as level_info::flame_item.
const FLAMETHROWERS = { 'Jungle 3': 0.35, 'Graveyard 2': 0.5, 'Graveyard 4': 0.25, City: 0.5, 'City 3': 0.35,
  'Underworld 2': 0.6, Hell: 0.7 };   // 4-2 was 0.35 until 2026-10-19 (user: 0.45, then 0.6)
// The rocket launcher pickups (user request, 2026-10-19), the same way: World 1-2 at about 60%. Found by flameSpot() with
// the level's star block in place (World 1-2 keeps its star), so the two never share a spot; main.cpp gets it as
// level_info::rocket_item.
// Then World 2-1, 3-2 and 4-1 (user request, 2026-10-19: each between 35% and 75%, at a different point in each)
// World 1-2's moved right before its first checkpoint (col 112) on 2026-10-20 (user); col 110 clears the alien patrol (ends col 109)
const ROCKETS = { 'Jungle 2': [110, 9], Graveyard: 0.675, 'City 2': 0.505,
  // World 4-1: on the landing right after the moving platform (184-194) past the second checkpoint: the first tile of the
  // ledge, beside a beast's patrol (198-205) (user, 2026-10-21; was 0.406 = 286, 11, then 180, 13 just past the checkpoint)
  'Underworld 1': [197, 11] };
// A spot for a flamethrower pickup as near `frac` of the way through the level as there is one: standing on the ground or
// a plank (the lowest floor at that column, the main way through), two tiles of air over it, nothing to collect in its
// cell, no spikes under it or beside it, no block within two tiles, and before the exit door (or boss gate)
// clearFoes (the rocket launcher): also no enemy patrol or checkpoint within two tiles of it, so it isn't picked up in an alien's path
function flameSpot(def, calls, frac, clearFoes = false) {
  const L = mod.exports.build({ ...def, build: b => { for (const [m, a] of calls) b[m](...a); } }), g = L.grid, w = def.w;
  const at = (x, y) => x < 0 || x >= w || y < 0 ? -1 : y >= 17 ? 1 : g[y][x];
  const items = new Set([...L.coins, ...L.embers, ...L.mush.map(m => ({ x: m.x + 6, y: m.y + 6 }))].map(o => Math.floor(o.x / 16) + ',' + Math.floor(o.y / 16)));
  const exit = L.boss ? L.boss.gate : L.door ? Math.floor(L.door.x / 16) : w;
  const fits = (c, r) => {
    if (at(c, r) !== 0 || at(c, r - 1) !== 0 || at(c, r - 2) !== 0 || items.has(c + ',' + r)) return false;
    if (at(c, r + 1) !== 1 && at(c, r + 1) !== 2) return false;
    for (let x = c - 1; x <= c + 1; x++) if (at(x, r) === 3 || at(x, r + 1) === 3) return false;
    for (let x = c - 2; x <= c + 2; x++) for (let y = r - 2; y <= r + 1; y++) if (at(x, y) === 4) return false;
    if (clearFoes && L.checks.some(k => Math.abs(k.x / 16 - c) <= 2)) return false;
    if (clearFoes && L.enemies.some(e => e.a / 16 - 2 <= c + 1 && (e.b + e.w) / 16 + 2 >= c && Math.abs((e.y + e.h) / 16 - 1 - r) <= 2)) return false;
    return true;
  };
  const mid = Math.round(frac * w);
  for (let d = 0; d < w; d++)
    for (const c of d ? [mid + d, mid - d] : [mid]) {
      if (c < 2 || c >= exit - 2) continue;
      for (let r = 15; r >= 1; r--) if (fits(c, r)) return [c, r];
    }
  throw new Error(`${def.name}: no spot for the flamethrower`);
}
// Fewer enemies (user request, 2026-10-20: 10 fewer hell beasts in World 4-4, 65 -> 55), as enemy() arguments. Picked from
// the most crowded stretches (each time the beast with its neighbours nearest), leaving the ones the user had added
// (EXTRA_ENEMIES). Dropped after the star, flamethrower and rocket spots are found, so those don't move.
const DROP_ENEMIES = { Hell: [[126, 130, 13], [138, 140, 9], [236, 237, 13], [304, 306, 13], [320, 322, 9], [353, 357, 11],
  [398, 400, 9], [502, 505, 10], [530, 532, 9], [669, 671, 11]] };
// More aliens and mechs (user requests, 2026-10-20: 5 more aliens in World 1-1, 8 more in each of 1-2 to 1-4), as enemy()
// arguments: 2-column patrols on floor or planks, picked one at a time as far as possible from every enemy (max-min
// distance), away from blocks, pickups, checkpoints, movers, spikes, the start and the door. Added after the star,
// flamethrower and rocket spots are found, so those don't move.
const MORE_ENEMIES = {
  Jungle: [[112, 114, 10], [124, 126, 10], [152, 154, 7], [203, 205, 11], [261, 263, 8]],
  'Jungle 2': [[43, 45, 10], [99, 101, 9], [149, 151, 8], [200, 202, 11], [318, 320, 8], [332, 334, 12], [343, 345, 13], [368, 370, 8]],
  'Jungle 3': [[42, 44, 7], [89, 91, 11], [138, 140, 12], [201, 203, 11], [321, 323, 12], [361, 363, 8], [378, 380, 13], [422, 424, 11]],
  'Jungle 4': [[22, 24, 7], [60, 62, 10], [128, 130, 9], [142, 144, 13], [222, 224, 8], [237, 239, 6], [290, 292, 5], [393, 395, 6]],
  // Mechs in World 3 (user request, 2026-10-20: 4-7 more each), the same way, but also at least 3 tiles from any enemy, 12
  // columns from each other and 10 from a checkpoint: as many as fit, 5, 5, 4 and 6
  City: [[31, 33, 10], [54, 56, 13], [163, 165, 13], [324, 326, 10], [395, 397, 13]],
  'City 2': [[128, 130, 11], [238, 240, 6], [309, 311, 8], [367, 369, 5], [394, 396, 13]],
  'City 3': [[52, 54, 7], [84, 86, 6], [123, 125, 10], [303, 305, 5]],
  'City 4': [[104, 106, 9], [195, 197, 12], [217, 219, 12], [312, 314, 9], [403, 405, 12], [421, 423, 13]],
};
// Flying demons (user request, 2026-10-20: 7-10 more enemies in each of Worlds 2-1 to 2-4, flying, 2 HP, Gothicvania's
// demon art): how many per level. GBA-only; not builder calls, so the web game and the checkers don't see them. Each is
// [a, b, row]: it patrols columns a to b with its middle on row 'row' (main.cpp FOE_DEMON).
const FLYERS = { Graveyard: 8, 'Graveyard 2': 9, 'Graveyard 3': 9, 'Graveyard 4': 10,
  'Underworld 1': 6, 'Underworld 2': 7, 'Underworld 3': 7, Hell: 8 };   // World 4 too (user request, 2026-10-20: 6-8 each)
// Spread evenly from the start to the exit door (or boss gate): the level is cut into n equal stretches and each gets one,
// as near the stretch's middle as there's room: a 4-column patrol 4 rows above the highest floor under it (so Mario can
// walk under it and has to shoot up at it), open air one tile around it, not over a pit (it could knock Mario in), not
// over a checkpoint, not near the start.
function flyerSpots(def, calls, n) {
  const L = mod.exports.build({ ...def, build: b => { for (const [m, a] of calls) b[m](...a); } }), g = L.grid, w = def.w;
  const exit = L.boss ? L.boss.gate : L.door ? Math.floor(L.door.x / 16) : w;
  const top = c => { for (let r = 0; r < 17; r++) if (g[r][c] !== 0) return r; return 17; };   // highest floor in a column
  const start = Math.floor(L.start.x / 16) + 14, end = exit - 6, out = [];
  const fits = (a, b, row) => {
    if (row < 4) return false;   // (higher is under the HUD)
    for (let c = a - 1; c <= b + 2; c++) for (let r = row - 1; r <= row + 1; r++) if (c < 0 || c >= w || g[r][c] !== 0) return false;
    return ! L.checks.some(k => k.x / 16 >= a - 4 && k.x / 16 <= b + 5);
  };
  for (let i = 0; i < n; i++) {
    const lo = start + Math.floor((end - start) * i / n), hi = start + Math.floor((end - start) * (i + 1) / n) - 5, mid = Math.floor((lo + hi) / 2);
    let spot = null;
    for (let d = 0; ! spot && mid - d >= lo; d++) for (const a of d ? [mid + d, mid - d] : [mid]) {
      if (a < lo || a > hi) continue;
      let floor = 17, pit = false; for (let c = a; c <= a + 5; c++) { floor = Math.min(floor, top(c)); pit = pit || top(c) === 17; }
      if (! pit && fits(a, a + 4, floor - 4)) { spot = [a, a + 4, floor - 4]; break; }
    }
    if (! spot) throw new Error(`${def.name}: no room for flying demon ${i + 1} between columns ${lo} and ${hi}`);
    out.push(spot);
  }
  return out;
}
// Fewer checkpoints (user requests, 2026-10-17): a third fewer in World 4 (9 -> 6 each), two fewer in each level of Worlds
// 1-3; by column. Those kept are the most evenly spaced from the start to the door (a boss level: to its arena, always
// keeping the checkpoint before it).
const DROP_CHECKS = {
  Jungle: [216, 392], 'Jungle 2': [58, 216], 'Jungle 3': [58, 216], 'Jungle 4': [60, 410],
  Graveyard: [44, 196], 'Graveyard 2': [43, 196], 'Graveyard 3': [66, 196], 'Graveyard 4': [42, 368],
  City: [55, 216], 'City 2': [54, 216], 'City 3': [63, 216], 'City 4': [108, 316],
  'Underworld 1': [47, 402, 550], 'Underworld 2': [46, 181, 392], 'Underworld 3': [40, 176, 398], Hell: [48, 178, 430],
};
// Coins per world (user request, 2026-10-17): Worlds 1-3 have 40% fewer, World 4 has 20% more, both the loose coins and
// the coins in each cracked block (5 in the web game; blockCoins: 3 and 6). By internal name prefix. World 1 then got
// 20% more in all (user request, 2026-10-18): blocks hold 4 (3 * 1.2 rounded up), so the loose coins only go 0.6 -> 0.66
// to keep the total at +20%. Then 10% fewer in World 1 (user request, 2026-10-19): blocks stay at 4, so the loose coins
// go 0.66 -> 0.54 to take the 10% off the total. An optional third entry sets the coins per block (else round(5 * scale)).
const COIN_SCALE = [['Jungle', 0.54, 4], ['Graveyard', 0.6], ['City', 0.6], ['Underworld', 1.2], ['Hell', 1.2]];
// Extra loose coins on top of the scaled count, by exact internal name (user request, 2026-10-20: World 1-1..1-4 +10 each).
// They're spread over the level's coin groups like the scaling (error diffusion), so each group grows a little.
const COIN_EXTRA = { Jungle: 10, 'Jungle 2': 10, 'Jungle 3': 10, 'Jungle 4': 10 };
// Rewrites a level's coin() and coins() calls as single coin() calls, with round(scale * n) (+ extra) coins. Coins are taken in
// groups (each coins() run, and coin() calls next to each other in a line), and each group's share is spread along the
// level by error diffusion, so the change is even. A thinned group keeps its ends and evenly spaced coins between; a
// grown group gets coins on its ends in line with it, in empty cells (out of a boss arena), alternately right then left.
function scaleCoins(def, calls, scale, extra = 0) {
  const groups = [], rest = [];
  for (const c of calls) {
    const [m, a] = c;
    if (m === 'coins') { const s = a[3] || 1, g = []; for (let x = a[0]; x <= a[1]; x += s) g.push([x, a[2]]); groups.push({ cells: g, dx: s, dy: 0 }); }
    else if (m === 'coin') {
      const [x, y] = a, g = groups.find(g => g.single && g.cells.some(([cx, cy]) => (cx === x || cy === y) && Math.abs(cx - x) <= 2 && Math.abs(cy - y) <= 2));
      if (g) g.cells.push([x, y]); else groups.push({ cells: [[x, y]], single: true });
    } else rest.push(c);
  }
  for (const g of groups) if (g.single) {
    g.cells.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const [a, b] = [g.cells[0], g.cells[g.cells.length - 1]], n = g.cells.length;
    g.dx = n > 1 ? Math.round((b[0] - a[0]) / (n - 1)) : 1; g.dy = n > 1 ? Math.round((b[1] - a[1]) / (n - 1)) : 0;
  }
  const N = groups.reduce((n, g) => n + g.cells.length, 0);
  if (extra) scale = (Math.round(scale * N) + extra) / N;   // exactly extra more coins in all
  groups.sort((p, q) => p.cells[0][0] - q.cells[0][0]);
  const L = mod.exports.build({ ...def, build: b => { for (const [m, a] of rest) b[m](...a); } });
  const taken = new Set(groups.flatMap(g => g.cells.map(c => c + ''))), gate = L.boss ? L.boss.gate : def.w;
  const cell = (x, y) => taken.add(Math.floor(x / 16) + ',' + Math.floor(y / 16));   // embers, mushrooms, posts and the door keep their cells
  for (const e of L.embers) cell(e.x, e.y);
  for (const m of L.mush) cell(m.x, m.y);
  for (const c of L.checks) { cell(c.x, c.y); cell(c.x, c.y - 16); }
  if (L.door) { cell(L.door.x, L.door.y); cell(L.door.x, L.door.y + 16); }
  const free = ([x, y]) => x >= 0 && x < gate && y >= 0 && y < 17 && L.grid[y][x] === 0 && ! taken.has(x + ',' + y);
  // Grows a group's cells to k coins where there's room; returns how many it couldn't place
  const grow = (g, cells, k) => {
    for (let i = 0, misses = 0; cells.length < k && misses < 2; i++) {
      const end = i % 2 ? cells[0] : cells[cells.length - 1], sgn = i % 2 ? -1 : 1, c = [end[0] + sgn * g.dx, end[1] + sgn * g.dy];
      if (free(c)) { taken.add(c + ''); if (sgn > 0) cells.push(c); else cells.unshift(c); misses = 0; } else misses++;
    }
    return k - cells.length;
  };
  let acc = 0, owed = 0;
  const kept = groups.map(g => {
    const n = g.cells.length, k = Math.round(acc + scale * n) - Math.round(acc) + owed;
    acc += scale * n; owed = 0;
    if (k < n) return k ? Array.from({ length: k }, (_, i) => g.cells[Math.round((i + 0.5) * n / k - 0.5)]) : [];
    const cells = [...g.cells];
    owed = grow(g, cells, k);
    return cells;
  });
  // Coins the last groups had no room for go to the nearest earlier group that has
  for (let i = groups.length - 1; owed && i >= 0; i--) owed = grow(groups[i], kept[i], kept[i].length + owed);
  if (owed) throw new Error(`${def.name}: no room for ${owed} more coins`);
  return [...rest, ...kept.flat().map(c => ['coin', c])];
}

// The star block (user request, 2026-10-18): one more cracked block per level, in the middle third of the level, that
// holds a star (10 s of invincibility; see main.cpp) instead of coins. Picked here, as near the level's centre as there's
// a spot where it can't get in the way: on the ground or a plank with a tile of floor each side and two tiles of open air
// over all three (room to jump onto it or over it), no moving platform, checkpoint or door within two tiles, no enemy
// patrol, spikes or other block next to it, and no coin, ember or mushroom in its cell. The star pops up and lands back where the block
// was, so it's never lost down a pit. STAR_AT moves a level's target off the centre, as a fraction of its width.
const STAR_AT = { 'City 2': 0.57,   // World 3-2: ~7% later (user request, 2026-10-19)
  'Underworld 1': 0.7,               // World 4-1: 70% (user request, 2026-10-19)
  // A [col, row] is used as it is: World 3-4's star sits right after the moving platform at cols 239-245, on the landing
  // ledge's first tile (user request, 2026-10-20; it was at (223, 10), just before it). No spot there passes the rules
  // above: the ledge starts at a pit and a mech patrols the rest of it (250-257).
  'City 4': [249, 7] };
function starBlock(def, calls) {
  const L = mod.exports.build({ ...def, build: b => { for (const [m, a] of calls) b[m](...a); } }), g = L.grid, w = def.w;
  const at = (x, y) => x < 0 || x >= w || y < 0 ? -1 : y >= 17 ? 1 : g[y][x];
  // Cells to keep two tiles from; one tile from; cells the block can't take
  const near = new Set(), beside = new Set(), items = new Set();
  const mark = (set, px, py, pw = 1, ph = 1) => {
    for (let x = Math.floor(px / 16); x <= Math.floor((px + pw - 1) / 16); x++) for (let y = Math.floor(py / 16); y <= Math.floor((py + ph - 1) / 16); y++) set.add(x + ',' + y);
  };
  for (const e of L.enemies) mark(beside, e.a, e.y, e.b + e.w - e.a, e.h);   // the whole patrol
  for (const m of L.movers) mark(near, Math.min(m.x0, m.x1), Math.min(m.y0, m.y1) - 32, Math.abs(m.x1 - m.x0) + m.w, Math.abs(m.y1 - m.y0) + 48);
  for (const c of L.checks) mark(near, c.x, c.y - 16, 16, 32);
  if (L.door) mark(near, L.door.x, L.door.y, 16, 32);
  for (const c of L.coins) mark(items, c.x, c.y);
  for (const e of L.embers) mark(items, e.x, e.y);
  for (const m of L.mush) mark(items, m.x, m.y, 12, 12);
  // Why a spot won't do, or '' if it will
  const misfit = (c, r) => {
    for (let x = c - 1; x <= c + 1; x++) {
      if (at(x, r + 1) !== 1 && at(x, r + 1) !== 2) return 'floor';
      for (let y = r - 2; y <= r; y++) if (at(x, y) !== 0) return 'room';
    }
    if (items.has(c + ',' + r)) return 'items';
    for (let x = c - 2; x <= c + 2; x++) for (let y = r - 2; y <= r + 1; y++) if (near.has(x + ',' + y)) return 'near';
    for (let x = c - 1; x <= c + 1; x++) for (let y = r - 1; y <= r + 1; y++) {
      if (beside.has(x + ',' + y)) return 'enemies';
      if (at(x, y) === 3 || at(x, y) === 4) return 'spikes/blocks';
    }
    return '';
  };
  // (a STAR_AT target is searched within a sixth of the level either side of it instead of the middle third)
  if (Array.isArray(STAR_AT[def.name])) return STAR_AT[def.name];
  const at_ = STAR_AT[def.name], mid = Math.round((at_ ?? 0.5) * w), why = {};
  const lo = at_ == null ? Math.ceil(w / 3) : Math.max(0, mid - Math.floor(w / 6)), hi = at_ == null ? Math.floor(2 * w / 3) : Math.min(w - 1, mid + Math.floor(w / 6));
  for (let d = 0; mid - d >= lo || mid + d <= hi; d++)
    for (const c of d ? [mid + d, mid - d] : [mid]) {
      if (c < lo || c > hi) continue;
      for (let r = 1; r < 16; r++) { const m = misfit(c, r); if (! m) return [c, r]; if (m !== 'floor') why[m] = (why[m] || 0) + 1; }
    }
  throw new Error(`${def.name}: no room for the star block between columns ${lo} and ${hi} (${JSON.stringify(why)})`);
}

// The levels in game order. The GBA-only levels go straight after the web level they follow on from: World 1-2, 1-3 and
// 1-4 ("Jungle n") after the Jungle (World 1-1), World 2-2, 2-3 and 2-4 ("Graveyard n") after the Graveyard (World 2-1),
// then the levels that name it in `after`, in file order (World 3-1 to 3-4, "City" to "City 4", then World 4-1 to 4-3,
// "Underworld 1" to "Underworld 3", after the Graveyard's group)
const webDefs = mod.exports.LEVELS, gbaDefs = require('./gba-levels.js'), HALVES = require('./gba-halves.js');
const ordered = webDefs.flatMap(d => [d, ...gbaDefs.filter(g => g.name.startsWith(d.name + ' ')), ...gbaDefs.filter(g => g.after === d.name)]);
const LEVELS = ordered.map(d => {
  let calls = record(b => { d.build(b); if (GBA_EXTRAS[d.name]) GBA_EXTRAS[d.name](b); });
  let w = d.w;
  const half = process.env.SMHB_NO_HALVES ? null : HALVES[d.name];
  if (half) {
    // The second half goes in at column `at`: the end of a level with a door (its door becomes a checkpoint, "where the
    // door used to be", as the web game did when its levels grew), or the start of a boss level's run-up to its arena
    const boss = calls.some(([m]) => m === 'boss');
    if (boss) calls = openGap(calls, half.at, half.len);
    else {
      if (half.at !== d.w) throw new Error(`${d.name}: a level with a door gets its second half at its end (${d.w})`);
      // (unless the half says dropDoor: then it just goes)
      calls = half.dropDoor ? calls.filter(([m]) => m !== 'door') : calls.map(([m, a]) => m === 'door' ? ['check', a] : [m, a]);
    }
    calls.push(...record(half.build).map(c => moved(c, half.at)));
    w += half.len;
  }
  // Nothing to collect past the exit door (user request, 2026-10-17): coins, embers, cracked and 1-up blocks beyond its
  // column are dropped (it was a cracked block just right of the door in the levels that end in one)
  const exit = calls.find(([m]) => m === 'door' || m === 'boss'), doorCol = exit[0] === 'door' ? exit[1][0] : exit[1][1];
  calls = calls.filter(([m, a]) => ! (['coin', 'coins', 'ember', 'row', 'crack', 'oneup'].includes(m) && a[0] > doorCol));
  if (DROP_CHECKS[d.name]) calls = calls.filter(([m, a]) => ! (m === 'check' && DROP_CHECKS[d.name].includes(a[0])));
  const [, scale, perBlock] = COIN_SCALE.find(([pre]) => d.name.startsWith(pre));
  calls = scaleCoins({ ...d, w }, calls, scale, COIN_EXTRA[d.name] || 0);
  // Moving platforms 20% faster (user request, 2026-10-17): each cycle takes 1/1.2 of the web game's frames
  calls = calls.map(([m, a]) => m === 'mover' ? [m, [...a.slice(0, 5), Math.round(a[5] / 1.2)]] : [m, a]);
  // The extra 1-up blocks go in after scaleCoins, so no coin moves
  calls.push(...(EXTRA_ONEUPS[d.name] || []).map(a => ['oneup', a]));
  calls.push(...(EXTRA_ENEMIES[d.name] || []).map(a => ['enemy', a]));
  // The star block goes in last, as a crack() to the web builder and the checkers (its coins are left out of the game's
  // coin total: main.cpp knows it by level_info::star_block)
  let star = starBlock({ ...d, w }, calls);
  const starCall = ['crack', star];
  calls.push(starCall);
  // (the flamethrower's spot is found with every star block in place, as it was before some were removed, so it stays put)
  const fl = FLAMETHROWERS[d.name], flame = Array.isArray(fl) ? fl : fl ? flameSpot({ ...d, w }, calls, fl) : null;
  // No star in the levels with a flamethrower, except World 4-4 (user request, 2026-10-18): its block goes too
  if (flame && d.name !== 'Hell') { calls.pop(); star = null; }
  const rk = ROCKETS[d.name], rocket = Array.isArray(rk) ? rk : rk ? flameSpot({ ...d, w }, calls, rk, true) : null;
  // No star in the levels with a rocket launcher either, except World 4-1 (user request, 2026-10-19). It goes after the
  // launcher's spot is found (with the block still there), so the launchers stay put.
  if (rocket && star && d.name !== 'Underworld 1') { calls = calls.filter(c => c !== starCall); star = null; }
  const drop = DROP_ENEMIES[d.name] || [];
  calls = calls.filter(([m, a]) => ! (m === 'enemy' && drop.some(x => x.join() === a.join())));
  calls.push(...(MORE_ENEMIES[d.name] || []).map(a => ['enemy', a]));
  const flyers = FLYERS[d.name] ? flyerSpots({ ...d, w }, calls, FLYERS[d.name]) : [];
  const build = b => { for (const [m, a] of calls) b[m](...a); };
  return { ...d, w, calls, build, star, flame, rocket, flyers, blockCoins: perBlock ?? Math.round(5 * scale), half: half ? { at: half.at, len: half.len } : null };
});

// One level as source for a stand-in LEVELS array (check-levels.js), with its build() spelled out call by call
function defSource(def, name = def.name, prelude = '') {
  const body = def.calls.map(([m, a]) => `b.${m}(${a.join(', ')});`).join(' ');
  return `{ name: ${JSON.stringify(name)}, w: ${def.w}, foe: ${JSON.stringify(def.foe)}, build: function (b) { ${prelude}${body} } }`;
}

module.exports = { LEVELS, build: mod.exports.build, buildSrc, defSource, WEB };

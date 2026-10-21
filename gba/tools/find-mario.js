// Finds the Mario frames on Goldenfrank0's sheet (first white panel): background = white reachable from the panel edge.
const fs = require('fs'), { PNG } = require('pngjs');
const SHEET = 'C:/Users/Nate/Desktop/Personal/Game Creations/Super Mario Run and Gun/Sprites/super_mario_world_gun_sprites_by_goldenfranko_d1d7uwj.png';
const p = PNG.sync.read(fs.readFileSync(SHEET));
const px = (x, y) => { const o = (y * p.width + x) * 4; return [p.data[o], p.data[o + 1], p.data[o + 2]]; };
const isWhite = (x, y) => { const [r, g, b] = px(x, y); return r > 240 && g > 240 && b > 240; };
// Panel 1: the white rectangle starting near (12,102) in sheet pixels
let x0 = 12, y0 = 102; while (isWhite(x0 - 1, y0)) x0--; while (isWhite(x0, y0 - 1)) y0--;
let x1 = x0, y1 = y0; while (isWhite(x1 + 1, y0)) x1++; while (isWhite(x0, y1 + 1)) y1++;
console.log(`panel ${x0},${y0} - ${x1},${y1}`);
// Background flood from the panel border
const W = x1 - x0 + 1, H = y1 - y0 + 1, bg = new Uint8Array(W * H), st = [];
for (let x = 0; x < W; x++) { st.push([x, 0], [x, H - 1]); } for (let y = 0; y < H; y++) { st.push([0, y], [W - 1, y]); }
while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= W || y >= H || bg[y * W + x] || !isWhite(x0 + x, y0 + y)) continue; bg[y * W + x] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
// Connected components of foreground (8-connected)
const lab = new Int32Array(W * H).fill(-1), boxes = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (bg[y * W + x] || lab[y * W + x] >= 0) continue;
  const b = { x0: x, y0: y, x1: x, y1: y, n: 0 }, s = [[x, y]]; lab[y * W + x] = boxes.length;
  while (s.length) { const [cx, cy] = s.pop(); b.n++; b.x0 = Math.min(b.x0, cx); b.x1 = Math.max(b.x1, cx); b.y0 = Math.min(b.y0, cy); b.y1 = Math.max(b.y1, cy);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || bg[ny * W + nx] || lab[ny * W + nx] >= 0) continue; lab[ny * W + nx] = boxes.length; s.push([nx, ny]); } }
  boxes.push(b);
}
const cols = new Set();
for (const b of boxes.filter(b => b.n > 30)) {
  console.log(`frame at sheet ${x0 + b.x0},${y0 + b.y0} size ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1} (${b.n} px)`);
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (!bg[y * W + x]) cols.add(px(x0 + x, y0 + y).join(','));
}
console.log(`small specks: ${boxes.filter(b => b.n <= 30).length}; colours across frames: ${cols.size}`);

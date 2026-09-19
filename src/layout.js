// src/layout.js — a starter sketch for each page: a gently winding lane from the hero's
// doorstep to the right edge, a sparse ground-aware edge line, a pond beside the lane when
// the story wants water, a cottage facing the road, and a few suggested props with spacing.
// Deterministic per (story, page, variant). Path cells never get props, so the hero can
// always walk to the right edge.
import { GRID_W, GRID_H, TILE_BY_ID, SPAWN } from './palette.js';

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
function rng(seed) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNTS = { flowers: 4, tallgrass: 4, mushroom: 2, bush: 2, rock: 2, lantern: 2, bench: 1, signpost: 1, stump: 1 };
const BESIDE_PATH = new Set(['lantern', 'bench', 'signpost']);
const MAX_DECOR = 12;   // suggested props, not counting the edge line
const MAX_EDGE = 8;     // trees (or dune plants on sand) along the top and bottom

export function starterLayout(page, seed) {
  const r = rng(seed);
  const W = GRID_W, H = GRID_H;
  const grid = (v) => Array.from({ length: H }, () => Array(W).fill(v));
  const ground = grid(page.ground), props = grid(null), onPath = grid(false), reserved = grid(false);
  const sug = new Set((page.suggestedProps || []).filter((id) => Object.hasOwn(TILE_BY_ID, id)));
  const sandy = page.ground === 'sand', snowy = page.ground === 'snow', dark = page.time === 'night';

  const safe = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const isTall = (id) => !!(id && TILE_BY_ID[id]?.tall);
  const blocks = (id) => !!(id && TILE_BY_ID[id]?.walkable === false);
  const nearSpawn = (x, y) => x <= 2 && Math.abs(y - SPAWN.y) <= 1;
  const empty = (x, y) => safe(x, y) && !props[y][x] && ground[y][x] === page.ground && !onPath[y][x] && !nearSpawn(x, y);
  // Can `id` go at (x, y)? Keeps blocking props off reserved cells, keeps small props from being
  // hidden under a canopy, and keeps canopies off the row above a small prop.
  const canPlace = (x, y, id) => {
    if (!empty(x, y)) return false;
    if (blocks(id) && reserved[y][x]) return false;
    if (isTall(id)) { if (y === 0 || (safe(x, y - 1) && props[y - 1][x])) return false; }
    else if (safe(x, y + 1) && isTall(props[y + 1][x])) return false;
    return true;
  };

  // 1. the lane: drift toward a nearby target row, then hold the line for a few columns
  let y = SPAWN.y, target = y, hold = 3;
  for (let x = 0; x < W; x++) {
    ground[y][x] = 'path'; onPath[y][x] = true;
    if (x >= W - 3) continue; // straight run into the exit
    if (hold <= 0) {
      target = Math.min(H - 3, Math.max(2, y + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))));
      hold = 4 + Math.floor(r() * 4);
    }
    hold--;
    if (x > 1 && y !== target) {
      const ny = y + Math.sign(target - y);
      ground[ny][x] = 'path'; onPath[ny][x] = true;
      reserved[y][x + 1] = true; // the cell straight ahead of the bend stays open
      y = ny;
    }
  }
  const exitY = y;
  for (let yy = exitY - 1; yy <= exitY + 1; yy++) for (let xx = W - 3; xx < W; xx++) if (safe(xx, yy)) reserved[yy][xx] = true;

  // distance from every cell to the lane (BFS, 4-neighbours)
  const dist = grid(Infinity);
  const q = [];
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (onPath[yy][xx]) { dist[yy][xx] = 0; q.push([xx, yy]); }
  for (let i = 0; i < q.length; i++) {
    const [cx, cy] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (safe(nx, ny) && dist[ny][nx] === Infinity) { dist[ny][nx] = dist[cy][cx] + 1; q.push([nx, ny]); }
    }
  }

  // 2. a pond one cell off the lane, never in the edge rows
  if (sug.has('water') || sug.has('pond')) {
    const fits = (px, py, pw, ph) => {
      for (let yy = py - 1; yy <= py + ph; yy++) for (let xx = px - 1; xx <= px + pw; xx++) {
        if (!safe(xx, yy) || onPath[yy][xx] || nearSpawn(xx, yy)) return false;
      }
      return true;
    };
    const paintPond = (px, py, pw, ph) => {
      for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) {
        const corner = (yy === py || yy === py + ph - 1) && (xx === px || xx === px + pw - 1);
        if (corner && r() < 0.6) continue;
        ground[yy][xx] = 'water';
      }
      if (sug.has('pond')) {
        let n = 1 + Math.floor(r() * 2);
        for (let t = 0; t < 40 && n > 0; t++) {
          const xx = px + Math.floor(r() * pw), yy = py + Math.floor(r() * ph);
          if (ground[yy][xx] === 'water' && !props[yy][xx]) { props[yy][xx] = 'pond'; n--; }
        }
      }
    };
    let placed = false;
    for (let tries = 0; tries < 90 && !placed; tries++) {
      const reach = tries < 40 ? 2 : tries < 70 ? 3 : 99; // relax "beside the lane" if the lane leaves no room
      const pw = 3 + Math.floor(r() * 2), ph = 2 + Math.floor(r() * 2);
      const px = 3 + Math.floor(r() * (W - pw - 6)), py = 2 + Math.floor(r() * (H - ph - 3));
      if (!fits(px, py, pw, ph)) continue;
      let touches = false;
      for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) if (dist[yy][xx] <= reach) touches = true;
      if (!touches) continue;
      paintPond(px, py, pw, ph); placed = true;
    }
    if (!placed) { // random tries missed: enumerate every spot that clears the lane and pick one
      const cands = [];
      for (const pw of [3, 4]) for (const ph of [2, 3]) for (let px = 3; px < W - pw - 3; px++) for (let py = 2; py < H - ph - 1; py++) if (fits(px, py, pw, ph)) cands.push([px, py, pw, ph]);
      if (cands.length) paintPond(...pick(cands));
    }
  }
  const nearWater = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => safe(x + dx, y + dy) && ground[y + dy][x + dx] === 'water');

  let decor = 0;
  const scatter = (ids, n, pred = () => true) => {
    for (let placed = 0, tries = 0; placed < n && tries < 80 && decor < MAX_DECOR; tries++) {
      const x = Math.floor(r() * W), yy = Math.floor(r() * H);
      const id = pick(ids);
      if (canPlace(x, yy, id) && pred(x, yy, id)) { props[yy][x] = id; placed++; decor++; }
    }
  };

  // 3. the cottage first, facing the lane, with breathing room
  let house = null;
  if (sug.has('house')) {
    for (let tries = 0; tries < 80 && !house; tries++) {
      const x = 3 + Math.floor(r() * (W - 6)), yy = 1 + Math.floor(r() * 3);
      if (!canPlace(x, yy, 'house') || dist[yy + 1]?.[x] > 2 || nearWater(x, yy)) continue;
      props[yy][x] = 'house'; house = { x, y: yy }; decor++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (safe(x + dx, yy + dy)) reserved[yy + dy][x + dx] = true;
    }
  }

  // 4. the edge line: trees in the woods, dune grass and driftwood-ish rocks on a beach, pines in snow or at night
  const woods = sug.has('pine') && sug.has('tree') ? ['tree', 'pine'] : sug.has('pine') ? ['pine'] : sug.has('tree') ? ['tree'] : (snowy || dark) ? ['pine'] : ['tree'];
  const edgeIds = sandy ? ['tallgrass', 'tallgrass', 'bush', 'rock'] : woods;
  let edge = 0;
  for (const yy of [1, H - 1]) for (let x = 0; x < W && edge < MAX_EDGE; x++) {
    if (r() >= 0.22) continue;
    const id = pick(edgeIds);
    const runOfSame = x > 1 && props[yy][x - 1] === id && props[yy][x - 2] === id;
    if (!runOfSame && canPlace(x, yy, id)) { props[yy][x] = id; edge++; }
  }
  if (!sandy) scatter(woods, 2, (x, yy) => yy > 1 && yy < H - 1 && dist[yy][x] >= 2);

  // 5. a short fence: beside the cottage's doorstep, or along a straight stretch of lane
  if (sug.has('fence')) {
    let done = false;
    if (house) {
      const yy = house.y + 1, x0 = house.x + 1;
      if (!onPath[yy][house.x] && [0, 1, 2].every((i) => canPlace(x0 + i, yy, 'fence') || (empty(x0 + i, yy) && reserved[yy][x0 + i] && !isTall(props[yy + 1]?.[x0 + i])))) { for (let i = 0; i < 3; i++) props[yy][x0 + i] = 'fence'; done = true; decor += 3; }
    }
    for (let tries = 0; tries < 60 && !done; tries++) {
      const x0 = 3 + Math.floor(r() * (W - 7)), yy = 2 + Math.floor(r() * (H - 4));
      if ([0, 1, 2].every((i) => canPlace(x0 + i, yy, 'fence') && dist[yy][x0 + i] === 1 && !nearWater(x0 + i, yy))) {
        for (let i = 0; i < 3; i++) props[yy][x0 + i] = 'fence';
        done = true; decor += 3;
      }
    }
  }

  // 6. lanterns, benches and signposts sit beside the lane, spread out along it
  const placedBeside = [];
  for (const id of sug) {
    if (!BESIDE_PATH.has(id)) continue;
    scatter([id], COUNTS[id], (x, yy) => dist[yy][x] === 1 && !nearWater(x, yy) && placedBeside.every(([bx, by]) => Math.max(Math.abs(bx - x), Math.abs(by - yy)) >= 4) && placedBeside.push([x, yy]));
  }

  // 7. the rest of the suggested props: small decor may hug the lane, blocking decor keeps a cell back
  let decorated = !!house || placedBeside.length > 0;
  for (const id of sug) {
    if (!(id in COUNTS) || BESIDE_PATH.has(id)) continue;
    decorated = true;
    scatter([id], COUNTS[id], (x, yy) => (blocks(id) ? dist[yy][x] >= 2 : dist[yy][x] >= 1));
  }
  if (!decorated) {
    if (sandy) scatter(['tallgrass', 'tallgrass', 'rock'], 4);
    else if (snowy) scatter(['rock', 'stump'], 3, (x, yy) => dist[yy][x] >= 2);
    else scatter(['flowers'], 4);
  }

  return { ground, props };
}

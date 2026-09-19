// src/tiles.js — every pixel of art, generated procedurally with Canvas 2D.
// Follows the texture-key conventions in palette.js.
import { C, GROUNDS, TILES, TILE_BY_ID, HERO_KINDS } from './palette.js';

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------
export function shade(hex, percent) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const ch = (c) => {
    const v = percent > 0 ? c + (255 - c) * (percent / 100) : c * (1 + percent / 100);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// ---------------------------------------------------------------------------
// Tiny drawing toolkit (hard pixels only)
// ---------------------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').imageSmoothingEnabled = false;
  return c;
}
function px(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

// Adds a 1px outline on every transparent pixel that touches a solid pixel.
function outline(ctx, color = C.outline) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= 128;
  const pts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) pts.push([x, y]);
    }
  }
  for (const [x, y] of pts) px(ctx, x, y, color);
}

// Soft ground shadow, painted *under* existing pixels (call after outline).
function shadow(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'rgba(58,49,69,0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function flipH(src) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// Rows of an ellipse as [y, x0, x1]; cx/cy may be fractional (e.g. 8 = between px 7 and 8).
function ellipseRows(cx, cy, rx, ry) {
  const rows = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const ny = (y + 0.5 - cy) / ry;
    if (Math.abs(ny) >= 1) continue;
    const hw = rx * Math.sqrt(1 - ny * ny);
    const x0 = Math.ceil(cx - hw - 0.5), x1 = Math.floor(cx + hw - 0.5);
    if (x1 >= x0) rows.push([y, x0, x1]);
  }
  return rows;
}

// Fills rows with 3-tone shading: light towards top-left, dark towards bottom-right.
function blob(ctx, rows, [light, base, dark], cx, cy, lo, hi) {
  for (const [y, x0, x1] of rows) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) + (y - cy);
      px(ctx, x, y, d < lo ? light : d > hi ? dark : base);
    }
  }
}

// Seeded PRNG so a given tile always looks the same.
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rng(key) {
  const r = mulberry32(hashStr(key));
  return (n) => Math.floor(r() * n);
}

// ---------------------------------------------------------------------------
// Ground tiles (seamless, no outline)
// ---------------------------------------------------------------------------
export function drawGroundToCanvas(groundKey) {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d');
  const ri = rng('ground:' + groundKey);
  const dots = (n, col) => { for (let i = 0; i < n; i++) px(ctx, ri(16), ri(16), col); };
  const dashes = (n, col) => { for (let i = 0; i < n; i++) rect(ctx, ri(15), ri(16), 2, 1, col); };
  const blades = (n, col) => { for (let i = 0; i < n; i++) rect(ctx, ri(16), ri(15), 1, 2, col); };

  switch (groundKey) {
    case 'dark_grass':
      rect(ctx, 0, 0, 16, 16, C.moss);
      blades(5, C.mossDark); dots(4, C.mossLight); dashes(2, C.mossLight);
      break;
    case 'sand':
      rect(ctx, 0, 0, 16, 16, C.sand);
      dots(6, C.sandLight); dots(3, C.sandDark); dashes(2, C.sandLight);
      break;
    case 'snow':
      rect(ctx, 0, 0, 16, 16, C.snow);
      dots(6, C.snowDark); dashes(2, C.snowDark); dots(2, C.snowLight);
      break;
    case 'grass':
    default:
      rect(ctx, 0, 0, 16, 16, C.grass);
      blades(5, C.grassDark); dots(4, C.grassLight); dashes(2, C.grassLight);
      break;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Prop / ground-layer tiles
// ---------------------------------------------------------------------------
const TILE_DRAWERS = {
  path(ctx) {
    const ri = rng('tile:path');
    rect(ctx, 0, 0, 16, 16, C.path);
    for (let i = 0; i < 3; i++) rect(ctx, ri(15), ri(16), 2, 1, C.pathDark);
    for (let i = 0; i < 3; i++) px(ctx, ri(16), ri(16), C.pathDark);
    for (let i = 0; i < 5; i++) px(ctx, ri(16), ri(16), C.pathLight);
    rect(ctx, ri(15), ri(16), 2, 1, C.pathLight);
  },

  water(ctx, frame) {
    rect(ctx, 0, 0, 16, 16, C.water);
    const s = frame ? 2 : 0;
    const dash = (x, y, w, col) => { for (let i = 0; i < w; i++) px(ctx, (x + i + s) & 15, y, col); };
    dash(2, 3, 4, C.waterLight);
    dash(9, 7, 3, C.waterLight);
    dash(4, 12, 4, C.waterLight);
    dash(10, 4, 3, C.waterDark);
    dash(1, 9, 3, C.waterDark);
    dash(13, 13, 1, C.waterLight);
    dash(7, 0, 1, C.waterLight);
  },

  flowers(ctx, frame) {
    const spots = [[3, 10, C.rose], [10, 4, C.butter], [12, 11, C.lavender], [6, 5, C.rose]];
    spots.forEach(([cx, cy, col], i) => {
      const dy = frame && (i === 0 || i === 2) ? -1 : 0;
      const y = cy + dy;
      px(ctx, cx, y + 1, C.leafDark);
      px(ctx, cx, y + 2, C.leafDark);
      px(ctx, cx + 1, y + 2, C.leaf);
      rect(ctx, cx - 1, y, 3, 1, col);
      px(ctx, cx, y - 1, col);
      px(ctx, cx, y, C.white);
    });
  },

  tallgrass(ctx) {
    const tufts = [[2, 4], [5, 3], [8, 4], [11, 3], [13, 4], [4, 2]];
    for (const [x, h] of tufts) {
      rect(ctx, x, 15 - h, 1, h, C.grassDark);
      px(ctx, x, 15 - h, C.leaf);
      if (h > 2) {
        rect(ctx, x + 1, 15 - (h - 2), 1, h - 2, C.grassDark);
        px(ctx, x + 1, 15 - (h - 2), C.leaf);
      }
    }
  },

  tree(ctx) {
    // trunk (bottom cell)
    rect(ctx, 6, 17, 4, 12, C.bark);
    rect(ctx, 8, 17, 2, 12, C.barkDark);
    rect(ctx, 6, 17, 1, 12, C.barkLight);
    px(ctx, 5, 28, C.bark); px(ctx, 10, 28, C.barkDark);
    // canopy
    blob(ctx, ellipseRows(8, 11.5, 7, 7.5), [C.leafLight, C.leaf, C.leafDark], 8, 11, -5, 5);
    for (const [x, y] of [[6, 9], [10, 7], [4, 13], [11, 12], [8, 15], [3, 8]]) px(ctx, x, y, C.leafLight);
    for (const [x, y] of [[12, 10], [9, 14], [7, 12]]) px(ctx, x, y, C.leafDark);
    outline(ctx);
    shadow(ctx, 4, 29, 8, 1);
    shadow(ctx, 3, 30, 10, 1);
  },

  pine(ctx) {
    const tier = (apexY, baseY, maxHw) => {
      for (let y = apexY; y <= baseY; y++) {
        const t = (y - apexY + 1) / (baseY - apexY + 1);
        const w = Math.max(1, Math.round(maxHw * t));
        const x0 = 8 - w, x1 = 7 + w;
        for (let x = x0; x <= x1; x++) {
          const rel = (x - x0) / Math.max(1, x1 - x0);
          const col = y === baseY ? C.pineDark : rel < 0.3 ? C.pineLight : rel > 0.7 ? C.pineDark : C.pine;
          px(ctx, x, y, col);
        }
      }
    };
    rect(ctx, 7, 22, 2, 7, C.bark);
    rect(ctx, 8, 22, 1, 7, C.barkDark);
    tier(12, 21, 7);
    tier(6, 14, 6);
    tier(1, 8, 4);
    outline(ctx);
    shadow(ctx, 4, 29, 8, 1);
    shadow(ctx, 3, 30, 10, 1);
  },

  bush(ctx) {
    blob(ctx, ellipseRows(8, 10.5, 6, 4.5), [C.leafLight, C.leaf, C.leafDark], 8, 10, -5, 4);
    px(ctx, 4, 8, C.leafLight); px(ctx, 9, 8, C.leafLight);
    for (const [x, y] of [[5, 9], [9, 12], [11, 9]]) px(ctx, x, y, C.rose);
    outline(ctx);
    shadow(ctx, 3, 15, 10, 1);
  },

  rock(ctx) {
    const rows = [[6, 5, 10], [7, 3, 12], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 2, 13], [12, 2, 13], [13, 3, 12], [14, 4, 11]];
    blob(ctx, rows, [C.stoneLight, C.stone, C.stoneDark], 8, 10, -5, 4);
    px(ctx, 7, 10, C.stoneDark); px(ctx, 8, 11, C.stoneDark); px(ctx, 8, 12, C.stoneDark);
    for (const [x, y] of [[4, 8], [9, 7], [6, 12]]) px(ctx, x, y, C.leaf);
    outline(ctx);
    shadow(ctx, 3, 15, 10, 1);
  },

  mushroom(ctx) {
    const stemDark = shade(C.stem, -18);
    // big mushroom
    const cap = [[4, 5, 8], [5, 4, 9], [6, 3, 10], [7, 2, 11], [8, 2, 11]];
    for (const [y, x0, x1] of cap) rect(ctx, x0, y, x1 - x0 + 1, 1, C.capRed);
    rect(ctx, 3, 9, 8, 1, C.capDark);
    rect(ctx, 9, 6, 2, 3, C.capDark);
    for (const [x, y] of [[4, 7], [7, 5], [8, 7], [5, 5]]) px(ctx, x, y, C.spot);
    rect(ctx, 5, 10, 4, 4, C.stem);
    rect(ctx, 8, 10, 1, 4, stemDark);
    // small mushroom
    rect(ctx, 11, 9, 3, 1, C.capRed);
    rect(ctx, 10, 10, 5, 1, C.capRed);
    px(ctx, 14, 10, C.capDark);
    px(ctx, 12, 9, C.spot);
    rect(ctx, 11, 11, 3, 1, C.capDark);
    rect(ctx, 11, 12, 2, 2, C.stem);
    px(ctx, 12, 12, stemDark); px(ctx, 12, 13, stemDark);
    outline(ctx);
    shadow(ctx, 3, 14, 8, 1);
  },

  house(ctx) {
    const roofLight = shade(C.roof, 15);
    // wall (bottom cell)
    rect(ctx, 1, 17, 14, 13, C.wall);
    rect(ctx, 12, 17, 3, 13, C.wallDark);
    rect(ctx, 1, 29, 14, 1, C.wallDark);
    // chimney
    rect(ctx, 11, 5, 2, 5, C.stone);
    rect(ctx, 11, 5, 2, 1, C.stoneDark);
    // roof (top cell)
    for (let y = 4; y <= 16; y++) {
      const spread = Math.min(y - 4, 6);
      const x0 = y === 16 ? 0 : 7 - spread, x1 = y === 16 ? 15 : 8 + spread;
      for (let x = x0; x <= x1; x++) {
        const rel = (x - x0) / Math.max(1, x1 - x0);
        const col = y === 16 ? C.roofDark : rel < 0.16 ? roofLight : rel > 0.7 ? C.roofDark : C.roof;
        px(ctx, x, y, col);
      }
    }
    // door
    rect(ctx, 3, 23, 4, 7, C.door);
    rect(ctx, 3, 23, 1, 7, shade(C.door, 15));
    px(ctx, 5, 26, C.butter);
    // window
    rect(ctx, 8, 20, 5, 5, C.woodDark);
    rect(ctx, 9, 21, 3, 3, C.butter);
    px(ctx, 10, 22, C.lanternGlow);
    outline(ctx);
    shadow(ctx, 1, 30, 14, 1);
    shadow(ctx, 2, 31, 12, 1);
  },

  lantern(ctx, frame) {
    rect(ctx, 7, 7, 2, 8, C.woodDark);
    rect(ctx, 7, 7, 1, 8, C.wood);
    rect(ctx, 6, 14, 4, 1, C.woodDark);
    rect(ctx, 6, 1, 4, 1, C.woodDark);
    rect(ctx, 5, 2, 6, 5, C.woodDark);
    rect(ctx, 6, 3, 4, 3, C.lantern);
    if (frame) {
      rect(ctx, 7, 3, 2, 2, C.lanternGlow);
      px(ctx, 7, 4, C.white);
      px(ctx, 9, 5, C.lanternGlow);
    } else {
      px(ctx, 7, 4, C.lanternGlow);
      px(ctx, 8, 4, C.lanternGlow);
    }
    outline(ctx);
  },

  bench(ctx) {
    rect(ctx, 2, 4, 12, 1, C.woodLight);
    rect(ctx, 2, 5, 12, 1, C.wood);
    rect(ctx, 3, 6, 1, 2, C.woodDark);
    rect(ctx, 12, 6, 1, 2, C.woodDark);
    rect(ctx, 2, 8, 12, 1, C.woodLight);
    rect(ctx, 2, 9, 12, 1, C.wood);
    rect(ctx, 3, 10, 2, 3, C.woodDark);
    rect(ctx, 11, 10, 2, 3, C.woodDark);
    outline(ctx);
  },

  fence(ctx) {
    for (const x of [2, 7, 12]) {
      rect(ctx, x, 4, 2, 10, C.wood);
      rect(ctx, x + 1, 4, 1, 10, C.woodDark);
      px(ctx, x, 3, C.woodLight);
    }
    rect(ctx, 1, 8, 14, 1, C.woodLight);
    rect(ctx, 1, 9, 14, 1, C.wood);
    outline(ctx);
  },

  signpost(ctx) {
    rect(ctx, 7, 9, 2, 5, C.wood);
    rect(ctx, 8, 9, 1, 5, C.woodDark);
    const board = [[4, 3, 10], [5, 3, 11], [6, 3, 13], [7, 3, 11], [8, 3, 10]];
    for (const [y, x0, x1] of board) {
      rect(ctx, x0, y, x1 - x0 + 1, 1, y === 4 ? C.woodLight : y === 8 ? C.woodDark : C.wood);
    }
    for (const x of [5, 6, 8, 9]) px(ctx, x, 6, C.woodDark);
    outline(ctx);
  },

  stump(ctx) {
    rect(ctx, 3, 9, 10, 5, C.bark);
    rect(ctx, 3, 9, 1, 5, C.barkLight);
    rect(ctx, 10, 9, 3, 5, C.barkDark);
    px(ctx, 2, 13, C.barkDark); px(ctx, 13, 13, C.barkDark);
    const top = [[5, 4, 11], [6, 3, 12], [7, 3, 12], [8, 4, 11]];
    for (const [y, x0, x1] of top) rect(ctx, x0, y, x1 - x0 + 1, 1, C.woodLight);
    for (const [x, y] of [[7, 5], [8, 5], [5, 6], [10, 6], [5, 7], [10, 7], [7, 8], [8, 8]]) px(ctx, x, y, C.wood);
    rect(ctx, 7, 6, 2, 2, C.wood);
    outline(ctx);
    shadow(ctx, 2, 14, 12, 1);
  },

  pond(ctx) {
    blob(ctx, ellipseRows(8, 8.5, 6, 4.5), [C.leafLight, C.leaf, C.leafDark], 8, 8, -4, 4);
    ctx.clearRect(10, 8, 4, 1);
    ctx.clearRect(12, 7, 2, 1);
    ctx.clearRect(12, 9, 2, 1);
    px(ctx, 7, 8, C.leafDark); px(ctx, 8, 8, C.leafDark); px(ctx, 9, 8, C.leafDark);
    rect(ctx, 4, 6, 3, 1, C.rose);
    px(ctx, 5, 5, C.rose); px(ctx, 5, 7, C.rose);
    px(ctx, 5, 6, C.white);
  },
};

export function drawTileToCanvas(id, frame = 0) {
  const t = TILE_BY_ID[id];
  const tall = !!(t && t.tall);
  const c = makeCanvas(16, tall ? 32 : 16);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const draw = TILE_DRAWERS[id];
  if (draw) draw(ctx, frame);
  return c;
}

// ---------------------------------------------------------------------------
// Hero (chibi critter, 16x16)
// ---------------------------------------------------------------------------
export function drawHeroToCanvas(kind, color, dir = 'down', frame = 0) {
  if (!HERO_KINDS.includes(kind)) kind = 'fox';
  if (dir === 'right') return flipH(drawHeroToCanvas(kind, color, 'left', frame));

  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const base = color, dark = shade(color, -25), light = shade(color, 20);
  const hair = shade(color, -30);
  const bob = frame ? -1 : 0;
  const P = (x, y, col) => px(ctx, x, y + bob, col);
  const R = (x, y, w, h, col) => rect(ctx, x, y + bob, w, h, col);
  const CL = (x, y, w, h) => ctx.clearRect(x, y + bob, w, h);

  const isOwl = kind === 'owl', isBear = kind === 'bear', isChild = kind === 'child';
  const ht = kind === 'rabbit' ? 4 : 3;       // head top row
  const hh = 6;                               // head height
  const hx0 = isOwl ? 3 : 4, hw = isOwl ? 10 : 8;
  const bx0 = isBear ? 4 : 5, bw = isBear ? 8 : 6;
  const by = ht + hh, bh = 4;
  const legY = by + bh;

  // legs / feet (frame 1: left foot planted, right foot lifted)
  const footCol = isChild ? C.door : dark;
  const lx = bx0, rx = bx0 + bw - 2;
  if (frame) {
    rect(ctx, lx, legY - 1, 2, 2, footCol);
    rect(ctx, rx, legY - 1, 2, 1, footCol);
  } else {
    rect(ctx, lx, legY, 2, 1, footCol);
    rect(ctx, rx, legY, 2, 1, footCol);
  }

  // tails behind the body (down / left)
  if (dir !== 'up') {
    if (kind === 'fox') {
      if (dir === 'down') { R(11, by + 1, 3, 2, light); R(13, by + 1, 1, 2, C.cream); }
      else { R(11, by, 3, 2, light); R(13, by, 1, 2, C.cream); }
    } else if (kind === 'cat') {
      P(11, by + 2, dark); P(12, by + 1, dark); P(12, by, dark); P(13, by - 1, dark);
    } else if (kind === 'rabbit' && dir === 'left') {
      R(11, by + 1, 2, 2, C.cream);
    }
  }

  // body
  R(bx0, by, bw, bh, base);
  R(bx0 + bw - 2, by, 2, bh, dark);
  P(bx0, by, light);
  if (kind === 'fox' && dir === 'down') R(bx0 + 1, by, bw - 2, 2, C.cream);
  if (isOwl) { R(bx0, by, 1, 3, dark); R(bx0 + bw - 1, by, 1, 3, dark); }

  // head
  R(hx0, ht, hw, hh, base);
  R(hx0 + hw - 1, ht + 1, 1, hh - 2, dark);
  R(hx0 + 1, ht + hh - 1, hw - 2, 1, dark);
  R(hx0 + 1, ht, 2, 1, light);
  P(hx0, ht + 1, light);
  if (isChild) {
    R(hx0, ht, hw, 3, hair);
    if (dir === 'up') {
      R(hx0, ht + 3, hw, 3, hair);
    } else {
      R(hx0, ht + 3, hw, 3, C.cream);
      P(hx0, ht + 3, hair); P(hx0 + hw - 1, ht + 3, hair);
      P(hx0 + 1, ht + 3, hair); P(hx0 + 4, ht + 3, hair);
      if (dir === 'left') R(hx0 + hw - 3, ht + 3, 3, 3, hair);
    }
  }
  // knock out corners for a rounder head
  CL(hx0, ht, 1, 1); CL(hx0 + hw - 1, ht, 1, 1);
  CL(hx0, ht + hh - 1, 1, 1); CL(hx0 + hw - 1, ht + hh - 1, 1, 1);

  // ears / hair tufts
  switch (kind) {
    case 'fox':
      R(hx0 + 1, ht - 1, 2, 1, base); P(hx0 + 1, ht - 2, base);
      R(hx0 + hw - 3, ht - 1, 2, 1, base); P(hx0 + hw - 2, ht - 2, base);
      if (dir === 'down') { P(hx0 + 2, ht - 1, dark); P(hx0 + hw - 3, ht - 1, dark); }
      break;
    case 'cat':
      R(hx0 + 1, ht - 2, 1, 2, base); R(hx0 + hw - 2, ht - 2, 1, 2, base);
      if (dir === 'down') { P(hx0 + 1, ht - 1, C.rose); P(hx0 + hw - 2, ht - 1, C.rose); }
      break;
    case 'rabbit':
      R(hx0 + 1, ht - 3, 2, 5, base); R(hx0 + hw - 3, ht - 3, 2, 5, base);
      if (dir !== 'up') { R(hx0 + 2, ht - 2, 1, 3, C.rose); R(hx0 + hw - 3, ht - 2, 1, 3, C.rose); }
      break;
    case 'bear':
      R(hx0, ht - 1, 2, 2, base); R(hx0 + hw - 2, ht - 1, 2, 2, base);
      if (dir === 'down') { P(hx0 + 1, ht - 1, dark); P(hx0 + hw - 2, ht - 1, dark); }
      break;
    case 'owl':
      P(hx0 + 1, ht - 1, base); P(hx0 + hw - 2, ht - 1, base);
      break;
    case 'child':
      P(hx0 + 3, ht - 1, hair);
      break;
  }

  // face
  if (dir === 'down') {
    if (isOwl) {
      R(hx0 + 1, ht + 1, 4, 4, C.white); R(hx0 + 5, ht + 1, 4, 4, C.white);
      R(hx0 + 2, ht + 2, 2, 2, C.outline); R(hx0 + 6, ht + 2, 2, 2, C.outline);
      P(7, ht + 5, C.lanternGlow); P(8, ht + 5, C.lanternGlow);
      P(hx0 + hw - 2, ht + 5, C.rose);
    } else if (isChild) {
      P(hx0 + 2, ht + 4, C.outline); P(hx0 + hw - 3, ht + 4, C.outline);
      P(hx0 + hw - 2, ht + 5, C.rose);
    } else {
      P(hx0 + 2, ht + 3, C.outline); P(hx0 + hw - 3, ht + 3, C.outline);
      P(hx0 + hw - 2, ht + 4, C.rose);
      if (kind === 'fox') { P(7, ht + 4, C.cream); P(8, ht + 4, C.cream); P(8, ht + 5, C.outline); }
      if (isBear) { R(7, ht + 4, 2, 1, light); P(8, ht + 5, C.outline); }
    }
  } else if (dir === 'left') {
    if (isOwl) {
      R(hx0 + 1, ht + 1, 4, 4, C.white);
      R(hx0 + 2, ht + 2, 2, 2, C.outline);
      P(hx0 + 1, ht + 5, C.lanternGlow);
    } else if (isChild) {
      P(hx0 + 1, ht + 4, C.outline);
      P(hx0 + 2, ht + 5, C.rose);
    } else {
      P(hx0 + 1, ht + 3, C.outline);
      P(hx0 + 2, ht + 4, C.rose);
      if (kind === 'fox' || isBear) P(hx0, ht + 4, kind === 'fox' ? C.cream : light);
    }
  } else {
    // up: back view — tails in front of the body
    if (kind === 'fox') { R(6, by + 1, 4, 2, light); R(6, by + 3, 4, 1, C.cream); }
    else if (kind === 'cat') { P(8, by + 3, dark); P(9, by + 2, dark); P(10, by + 1, dark); P(10, by, dark); }
    else if (kind === 'rabbit') R(7, by + 2, 2, 2, C.cream);
    else if (isOwl) { P(7, by + 1, dark); P(8, by + 2, dark); }
  }

  outline(ctx);
  return c;
}

// ---------------------------------------------------------------------------
// Soft textures (the only place gradients are allowed)
// ---------------------------------------------------------------------------
function drawSoftBlob(size) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// ---------------------------------------------------------------------------
// Phaser registration
// ---------------------------------------------------------------------------
export function generateTextures(scene) {
  const add = (key, canvas) => {
    if (scene.textures.exists(key)) return;
    scene.textures.addCanvas(key, canvas);
  };
  for (const g of Object.keys(GROUNDS)) add(GROUNDS[g].tex, drawGroundToCanvas(g));
  for (const t of TILES) {
    const n = t.frames || 1;
    for (let f = 0; f < n; f++) {
      add(n > 1 ? `t_${t.id}_${f}` : `t_${t.id}`, drawTileToCanvas(t.id, f));
    }
  }
  add('glow', drawSoftBlob(32));
  add('dot', drawSoftBlob(4));
}

export function generateHero(scene, kind, color) {
  for (const dir of ['down', 'up', 'left', 'right']) {
    for (let f = 0; f < 2; f++) {
      const key = `hero_${dir}_${f}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, drawHeroToCanvas(kind, color, dir, f));
    }
  }
}

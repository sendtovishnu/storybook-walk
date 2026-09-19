// src/palette.js — the shared contract for the whole game.
// Colors, times of day, ground types, the paintable tile registry, and the
// texture-key conventions that tiles.js must follow.

export const TILE = 16;      // px per tile (before camera zoom)
export const GRID_W = 20;    // tiles per page, horizontally
export const GRID_H = 12;    // tiles per page, vertically
export const ZOOM = 3;       // camera zoom → 960x576 canvas
export const SPAWN = { x: 1, y: Math.floor(GRID_H / 2) }; // where the hero enters each page

// Curated soothing pastel palette. Every pixel in the game comes from here.
export const C = {
  cream: '#f6efe3', white: '#ffffff', outline: '#3a3145', night: '#1d2340',
  // grounds
  grass: '#9ccc7a', grassDark: '#7bab5e', grassLight: '#b5dc93',
  moss: '#5f8a55', mossDark: '#476b41', mossLight: '#7aa46e',
  sand: '#e8d5a8', sandDark: '#d3ba86', sandLight: '#f3e6c4',
  snow: '#eef3f7', snowDark: '#cfdbe6', snowLight: '#ffffff',
  path: '#d9c39a', pathDark: '#bfa57c', pathLight: '#ead9b7',
  water: '#7fc4d6', waterDark: '#5aa3ba', waterLight: '#b6e4ee',
  // plants
  bark: '#8a6242', barkDark: '#5f4130', barkLight: '#a97c58',
  leaf: '#6fae6a', leafDark: '#4d8a52', leafLight: '#9bd08c',
  pine: '#4f8f74', pineDark: '#36685a', pineLight: '#77b494',
  // stone & wood
  stone: '#b9b3ac', stoneDark: '#8c8680', stoneLight: '#dcd7d0',
  wood: '#c99a6b', woodDark: '#9c7350', woodLight: '#e0b98c',
  // accents
  rose: '#f2a2b1', roseDark: '#d9788c', lavender: '#c9b6e8', butter: '#f7e08a',
  peach: '#f7c59f', mint: '#a8e6cf', sky: '#cfe9f7',
  lantern: '#ffd97a', lanternGlow: '#ffb347', ember: '#ff8c5a',
  // buildings
  wall: '#f0e2c8', wallDark: '#d6c4a4', roof: '#d97c8a', roofDark: '#a95a67', door: '#7b4f36',
  // mushroom
  capRed: '#e8705f', capDark: '#b84f43', spot: '#fff3e0', stem: '#f1e4cf',
};

// Time of day → full-screen MULTIPLY tint over the world, plus ambient particles.
export const TIMES = {
  dawn:  { label: 'Dawn',  tint: 0xffc9a8, alpha: 0.28, sky: '#f9d7c2', particles: 'pollen' },
  day:   { label: 'Day',   tint: 0xffffff, alpha: 0.0,  sky: '#cfe9f7', particles: 'pollen' },
  dusk:  { label: 'Dusk',  tint: 0xb48fe0, alpha: 0.38, sky: '#d8b8e8', particles: 'leaves' },
  night: { label: 'Night', tint: 0x3a4478, alpha: 0.52, sky: '#1d2340', particles: 'fireflies' },
};

// Ground fill for a page. Texture keys are what tiles.js generates.
export const GROUNDS = {
  grass:      { tex: 'g_grass', name: 'Grass',      snow: false },
  dark_grass: { tex: 'g_moss',  name: 'Dark grass', snow: false },
  sand:       { tex: 'g_sand',  name: 'Sand',       snow: false },
  snow:       { tex: 'g_snow',  name: 'Snow',       snow: true  },
};

// Paintable tiles. layer 'ground' tiles replace the ground cell; 'props' sit on top.
// frames>1 → animated (500ms swap). tall → texture is 16x32 with the base on the
// bottom tile (draw with origin (0,1) so it overlaps the cell above).
// sway → gentle scale tween in the world. glow → additive glow sprite at night.
export const TILES = [
  { id: 'path',      name: 'Path',       layer: 'ground', walkable: true,  desc: 'worn dirt path with lighter pebbles' },
  { id: 'water',     name: 'Water',      layer: 'ground', walkable: false, frames: 2, desc: 'calm water with drifting highlight bands' },
  { id: 'flowers',   name: 'Flowers',    layer: 'props',  walkable: true,  frames: 2, desc: 'cluster of 3–4 small flowers, rose/butter/lavender, bobbing' },
  { id: 'tallgrass', name: 'Tall grass', layer: 'props',  walkable: true,  desc: 'tufts of tall grass, slightly darker than ground' },
  { id: 'tree',      name: 'Tree',       layer: 'props',  walkable: false, tall: true, sway: true, desc: 'round canopy tree, 3-tone leaves, brown trunk' },
  { id: 'pine',      name: 'Pine',       layer: 'props',  walkable: false, tall: true, sway: true, desc: 'triangular pine in blue-green tones' },
  { id: 'bush',      name: 'Bush',       layer: 'props',  walkable: false, sway: true, desc: 'low round bush with a few berry dots' },
  { id: 'rock',      name: 'Rock',       layer: 'props',  walkable: false, desc: 'mossy grey boulder' },
  { id: 'mushroom',  name: 'Mushroom',   layer: 'props',  walkable: true,  desc: 'two red-capped mushrooms with cream spots' },
  { id: 'house',     name: 'House',      layer: 'props',  walkable: false, tall: true, desc: 'tiny cottage, cream wall, rose roof, warm window' },
  { id: 'lantern',   name: 'Lantern',    layer: 'props',  walkable: false, frames: 2, glow: true, desc: 'wooden post lantern with a warm flickering light' },
  { id: 'bench',     name: 'Bench',      layer: 'props',  walkable: false, desc: 'small wooden bench' },
  { id: 'fence',     name: 'Fence',      layer: 'props',  walkable: false, desc: 'short wooden picket fence segment' },
  { id: 'signpost',  name: 'Signpost',   layer: 'props',  walkable: false, desc: 'wooden signpost with an arrow board' },
  { id: 'stump',     name: 'Stump',      layer: 'props',  walkable: false, desc: 'tree stump with visible rings' },
  { id: 'pond',      name: 'Lily pad',   layer: 'props',  walkable: false, desc: 'lily pad with a tiny pink flower, place on water' },
];
export const TILE_BY_ID = Object.fromEntries(TILES.map((t) => [t.id, t]));

export const HERO_KINDS = ['fox', 'rabbit', 'bear', 'cat', 'owl', 'child'];
export const DEFAULT_HERO = { name: 'Pip', kind: 'fox', color: '#e8925a' };

// ---- Texture key conventions (tiles.js generates exactly these) ----
//  ground : GROUNDS[g].tex                                   16x16
//  tile   : `t_${id}`            (frames undefined)          16x16 or 16x32 (tall)
//           `t_${id}_${frame}`   (frames > 1, frame 0..n-1)
//  hero   : `hero_${dir}_${frame}`  dir ∈ down|up|left|right, frame ∈ 0|1   16x16
//  glow   : 'glow' — 32x32 soft radial white blob for ADD-blend lights
//  particle: 'dot' — 3x3 soft white dot for particle emitters
export const texKey = (id, frame = 0) => {
  const t = TILE_BY_ID[id];
  return t && t.frames > 1 ? `t_${id}_${frame}` : `t_${id}`;
};

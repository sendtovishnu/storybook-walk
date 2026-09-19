// src/world.js — builds a painted page into Phaser images; shared by Paint and Explore.
import { GROUNDS, TILE_BY_ID, TILE, GRID_W, GRID_H, texKey } from './palette.js';

export const groundTex = (cell) => (GROUNDS[cell] ? GROUNDS[cell].tex : texKey(cell, 0));
export const isBlocking = (cell) => !!cell && TILE_BY_ID[cell] && TILE_BY_ID[cell].walkable === false;

export function buildPage(scene, page, { animate = true } = {}) {
  const ground = [];
  const props = [];
  const animated = new Set();
  let frame = 0;

  const setGround = (x, y) => {
    const cell = page.cells.ground[y][x];
    let img = ground[y][x];
    if (!img) { img = scene.add.image(x * TILE, y * TILE).setOrigin(0).setDepth(0); ground[y][x] = img; }
    img.setTexture(GROUNDS[cell] ? GROUNDS[cell].tex : texKey(cell, frame));
    img.tileId = cell;
    if (TILE_BY_ID[cell]?.frames > 1) animated.add(img); else animated.delete(img);
  };

  const setProp = (x, y) => {
    const id = page.cells.props[y][x];
    const old = props[y][x];
    if (old) { animated.delete(old); old.swayTween?.stop(); old.destroy(); props[y][x] = null; }
    if (!id) return;
    const t = TILE_BY_ID[id];
    const img = scene.add.image(x * TILE + 8, (y + 1) * TILE, texKey(id, frame)).setOrigin(0.5, 1).setDepth((y + 1) * TILE);
    img.tileId = id;
    props[y][x] = img;
    if (t.frames > 1) animated.add(img);
    if (animate && t.sway) {
      img.swayTween = scene.tweens.add({
        targets: img, scaleX: 1.035, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: Math.random() * 1500,
      });
    }
  };

  for (let y = 0; y < GRID_H; y++) {
    ground.push([]); props.push([]);
    for (let x = 0; x < GRID_W; x++) { ground[y][x] = null; props[y][x] = null; setGround(x, y); setProp(x, y); }
  }

  const timer = scene.time.addEvent({
    delay: 500, loop: true,
    callback: () => { frame ^= 1; animated.forEach((img) => img.setTexture(texKey(img.tileId, frame))); },
  });

  return { ground, props, setGround, setProp, timer };
}

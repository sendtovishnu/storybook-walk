// src/scenes/Paint.js — the page editor: stamp tiles onto the grid.
import Phaser from 'phaser';
import { TILE, GRID_W, GRID_H, TILE_BY_ID, TIMES, SPAWN } from '../palette.js';
import { generateHero } from '../tiles.js';
import { buildPage } from '../world.js';
import { app, save, moodLabel, goExplore, resketch } from '../app.js';
import { $ } from '../ui.js';
import { markSuggested, selectSwatch } from '../main.js';

export default class Paint extends Phaser.Scene {
  constructor() { super('Paint'); }

  create() {
    const page = app.pages[app.pageIndex];
    this.page = page;
    this.undo = [];
    this.cameras.main.setZoom(1).setScroll(0, 0);
    this.cameras.main.setBackgroundColor(TIMES[page.time].sky);

    this.world = buildPage(this, page, { animate: true });

    // subtle grid + tint so the mood reads while painting
    const t = TIMES[page.time];
    this.add.rectangle(0, 0, GRID_W * TILE, GRID_H * TILE, t.tint, t.alpha * 0.6).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(3000);
    const g = this.add.graphics().setDepth(3001).setAlpha(0.06);
    g.lineStyle(1, 0x3a3145, 1);
    for (let x = 0; x <= GRID_W; x++) g.lineBetween(x * TILE, 0, x * TILE, GRID_H * TILE);
    for (let y = 0; y <= GRID_H; y++) g.lineBetween(0, y * TILE, GRID_W * TILE, y * TILE);

    // hero preview at the spawn point
    const hero = app.story.hero;
    generateHero(this, hero.kind, hero.color);
    this.add.image(SPAWN.x * TILE + 8, (SPAWN.y + 1) * TILE, 'hero_right_0').setOrigin(0.5, 1).setDepth((SPAWN.y + 1) * TILE + 1);

    // hover cursor
    this.cursor = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0).setStrokeStyle(1, 0xf7e08a, 0.9).setDepth(3002).setVisible(false);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p) => { this.pushUndo(); this.stroke(p); });
    this.input.on('pointermove', (p) => { this.hover(p); if (p.isDown) this.stroke(p); });
    this.input.on('pointerout', () => this.cursor.setVisible(false));
    this.input.keyboard?.on('keydown-Z', (e) => { if (e.ctrlKey || e.metaKey) this.popUndo(); });

    // sidebar
    $('#side-page').textContent = `Page ${app.pageIndex + 1} of ${app.pages.length}`;
    $('#side-mood').textContent = moodLabel(page);
    $('#side-text').textContent = page.text;
    const suggested = page.suggestedProps || [];
    markSuggested(suggested);
    if (suggested[0] && TILE_BY_ID[suggested[0]]) selectSwatch(suggested[0]);
    $('#btn-undo').onclick = () => this.popUndo();
    $('#btn-clear').onclick = () => { this.pushUndo(); this.clearAll(); };
    $('#btn-sketch').onclick = () => { this.pushUndo(); resketch(app.pageIndex); this.redrawAll(); };
    $('#btn-walk').onclick = () => goExplore(app.pageIndex);
  }

  cellAt(p) {
    const x = Math.floor(p.worldX / TILE), y = Math.floor(p.worldY / TILE);
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
    return { x, y };
  }
  hover(p) {
    const c = this.cellAt(p);
    if (!c) { this.cursor.setVisible(false); return; }
    this.cursor.setPosition(c.x * TILE, c.y * TILE).setVisible(true);
  }
  stroke(p) {
    const c = this.cellAt(p);
    if (!c) return;
    const erase = p.rightButtonDown() || app.selected === 'eraser';
    this.paint(c.x, c.y, erase ? null : app.selected);
  }
  paint(x, y, id) {
    const { ground, props } = this.page.cells;
    const isSpawn = x === SPAWN.x && y === SPAWN.y;
    if (!id) {
      props[y][x] = null;
      if (TILE_BY_ID[ground[y][x]]) ground[y][x] = this.page.ground;
    } else {
      const t = TILE_BY_ID[id];
      if (!t) return;
      if (isSpawn && t.walkable === false) return; // keep the hero's doorstep clear
      if (t.layer === 'ground') {
        ground[y][x] = id;
        if (t.walkable === false) props[y][x] = null;
      } else {
        props[y][x] = id;
        if (TILE_BY_ID[ground[y][x]]?.walkable === false && id !== 'pond') ground[y][x] = this.page.ground;
      }
    }
    this.world.setGround(x, y);
    this.world.setProp(x, y);
    save();
  }
  clearAll() {
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      this.page.cells.ground[y][x] = this.page.ground; this.page.cells.props[y][x] = null;
      this.world.setGround(x, y); this.world.setProp(x, y);
    }
    save();
  }
  pushUndo() {
    this.undo.push(JSON.stringify({ cells: this.page.cells, sketch: this.page.sketch || 0 }));
    if (this.undo.length > 40) this.undo.shift();
  }
  popUndo() {
    const s = this.undo.pop();
    if (!s) return;
    const snap = JSON.parse(s);
    this.page.cells = snap.cells;
    this.page.sketch = snap.sketch;
    this.redrawAll();
    save();
  }
  redrawAll() {
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) { this.world.setGround(x, y); this.world.setProp(x, y); }
  }
}

// src/scenes/Explore.js — walk the hero through the painted page.
import Phaser from 'phaser';
import { TILE, GRID_W, GRID_H, ZOOM, TILE_BY_ID, TIMES, GROUNDS, C, SPAWN } from '../palette.js';
import { generateHero } from '../tiles.js';
import { buildPage, isBlocking } from '../world.js';
import { GENERIC_LINES } from '../story.js';
import { app, goPaint, goEnd } from '../app.js';
import { $, show, typewriter, setBubble, hideBubble } from '../ui.js';
import { startPad, stopPad, chime, toggleMute } from '../audio.js';

const W = GRID_W * TILE, H = GRID_H * TILE;
const hex = (h) => parseInt(h.slice(1), 16);

export default class Explore extends Phaser.Scene {
  constructor() { super('Explore'); }

  create() {
    const page = app.pages[app.pageIndex];
    this.page = page;
    this.turning = false;
    this.hotspot = null;
    this.hotspotCell = null;
    const t = TIMES[page.time];

    this.cameras.main.setBackgroundColor(t.sky);
    this.world = buildPage(this, page, { animate: true });

    // collision bodies
    this.blocks = this.physics.add.staticGroup();
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const prop = page.cells.props[y][x];
      const ground = page.cells.ground[y][x];
      let z = null;
      if (isBlocking(ground)) {
        z = this.add.zone(x * TILE + 8, y * TILE + 8, TILE, TILE); // water stays fully solid even under a lily pad
      } else if (prop && isBlocking(prop)) {
        z = TILE_BY_ID[prop].tall ? this.add.zone(x * TILE + 8, y * TILE + 11, 8, 8) : this.add.zone(x * TILE + 8, y * TILE + 9, 12, 10);
      }
      if (z) { this.physics.add.existing(z, true); this.blocks.add(z); }
    }

    // hero
    const hero = app.story.hero;
    generateHero(this, hero.kind, hero.color);
    this.hero = this.physics.add.sprite(SPAWN.x * TILE + 8, SPAWN.y * TILE + 8, 'hero_right_0');
    this.hero.body.setSize(10, 7).setOffset(3, 9);
    this.hero.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, W + 24, H);
    this.physics.world.setBoundsCollision(true, false, true, true);
    this.physics.add.collider(this.hero, this.blocks);
    this.dir = 'right'; this.frame = 0; this.stepTimer = 0;

    // lights & tint
    this.add.rectangle(0, 0, W, H, t.tint, t.alpha).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(3000);
    const glowAlpha = { night: 0.55, dusk: 0.32, dawn: 0.14, day: 0.08 }[page.time];
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const id = page.cells.props[y][x];
      if (id && TILE_BY_ID[id].glow) {
        const g = this.add.image(x * TILE + 8, y * TILE + 5, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(hex(C.lanternGlow)).setAlpha(glowAlpha).setScale(1.6).setDepth(3500);
        this.tweens.add({ targets: g, alpha: glowAlpha * 0.7, scale: 1.45, duration: 900 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      if (id === 'house') {
        this.add.image(x * TILE + 8, y * TILE + 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(hex(C.butter)).setAlpha(glowAlpha * 0.6).setScale(1.2).setDepth(3500);
      }
    }
    if (page.time === 'night' || page.time === 'dusk') {
      this.heroGlow = this.add.image(this.hero.x, this.hero.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(hex(C.butter)).setAlpha(page.time === 'night' ? 0.28 : 0.15).setScale(1.3).setDepth(3500);
    }

    // ambient particles
    const kind = GROUNDS[page.ground].snow ? 'snow' : t.particles;
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, -8, W, H + 8) };
    const configs = {
      fireflies: { tint: hex(C.butter), alpha: { start: 0, end: 1, ease: 'Sine.easeInOut', yoyo: true }, scale: { start: 0.7, end: 1.1 }, lifespan: 3600, frequency: 80, speedX: { min: -6, max: 6 }, speedY: { min: -5, max: 5 }, blendMode: 'ADD' },
      pollen:    { tint: 0xffffff, alpha: { start: 0, end: 0.55, yoyo: true }, scale: { start: 0.35, end: 0.6 }, lifespan: 4500, frequency: 220, speedX: { min: 2, max: 8 }, speedY: { min: -3, max: 4 } },
      leaves:    { tint: [hex(C.roseDark), hex(C.butter), hex(C.peach)], alpha: { start: 0.9, end: 0 }, scale: { start: 0.9, end: 0.5 }, lifespan: 5000, frequency: 260, speedX: { min: 3, max: 10 }, speedY: { min: 4, max: 10 }, rotate: { start: 0, end: 180 } },
      snow:      { tint: 0xffffff, alpha: { start: 0.95, end: 0.2 }, scale: { start: 0.5, end: 0.8 }, lifespan: 6000, frequency: 90, speedX: { min: -3, max: 3 }, speedY: { min: 6, max: 12 } },
    };
    this.add.particles(0, 0, 'dot', { ...configs[kind], emitZone: zone }).setDepth(3400);

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.setZoom(1.6);
    cam.startFollow(this.hero, true, 0.08, 0.08);
    try { cam.postFX.addVignette(0.5, 0.5, 0.92, 0.32); cam.postFX.addBloom(0xffffff, 1, 1, 0.9, 0.35, 4); } catch (e) { /* canvas renderer */ }

    // input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    // narration
    const n = $('#narration');
    show(n); n.classList.remove('tucked');
    $('#narration-page').textContent = `Page ${app.pageIndex + 1} of ${app.pages.length} · ${TIMES[page.time].label}`;
    this.typer = typewriter($('#narration-text'), page.text, 30);
    n.onclick = () => { if (n.classList.contains('tucked')) n.classList.remove('tucked'); else this.typer.skip(); };
    this.typer.done.then(() => setTimeout(() => { if (this.scene.isActive()) n.classList.add('tucked'); }, 3500));
    this.introTimer = 0; this.introUntil = 0;

    // ambience
    startPad(page.time);
    this.input.keyboard.on('keydown-M', () => toggleMute());
    this.events.once('shutdown', () => stopPad());
  }

  lineFor(id) {
    return this.page.propLines?.[id] || GENERIC_LINES[id] || GENERIC_LINES.default || '…';
  }

  toScreen(wx, wy) {
    const cam = this.cameras.main;
    return { x: (wx - cam.worldView.x) * cam.zoom * ZOOM, y: (wy - cam.worldView.y) * cam.zoom * ZOOM };
  }

  update(time, delta) {
    if (this.turning) return;
    const h = this.hero;
    const c = this.cursors, k = this.wasd;
    const left = c.left.isDown || k.A.isDown, right = c.right.isDown || k.D.isDown;
    const up = c.up.isDown || k.W.isDown, down = c.down.isDown || k.S.isDown;
    const speed = 58;
    let vx = (right ? 1 : 0) - (left ? 1 : 0), vy = (down ? 1 : 0) - (up ? 1 : 0);
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }
    h.setVelocity(vx * speed, vy * speed);
    const moving = vx || vy;
    if (Math.abs(vx) > Math.abs(vy)) this.dir = vx > 0 ? 'right' : 'left'; else if (vy) this.dir = vy > 0 ? 'down' : 'up';
    if (moving) { this.stepTimer += delta; if (this.stepTimer > 150) { this.stepTimer = 0; this.frame ^= 1; } } else { this.frame = 0; }
    h.setTexture(`hero_${this.dir}_${this.frame}`);
    h.setDepth(h.y + 8);
    if (this.heroGlow) this.heroGlow.setPosition(h.x, h.y);

    // page turn at the right edge
    if (h.x > W + 6) {
      this.turning = true;
      h.setVelocity(0, 0);
      hideBubble();
      if (app.pageIndex + 1 < app.pages.length) goPaint(app.pageIndex + 1); else goEnd();
      return;
    }

    // hero intro line from Claude, once it arrives
    this.introTimer += delta;
    if (this.page.narrationIntro && !this.page.introShown && this.introTimer > 1500) {
      this.page.introShown = true;
      this.introUntil = time + 4500;
      this.hotspotCell = null;
    }
    if (this.introUntil > time) {
      const s = this.toScreen(h.x, h.y - 12);
      setBubble(this.page.narrationIntro, s.x, s.y);
      return;
    }

    // hotspots: nearest prop within reach
    const cx = Math.floor(h.x / TILE), cy = Math.floor((h.y + 4) / TILE);
    let best = null, bestD = 24;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
      const g = this.page.cells.ground[y][x];
      const id = this.page.cells.props[y][x] || (TILE_BY_ID[g] && TILE_BY_ID[g].walkable === false ? g : null); // water speaks, the lane does not
      if (!id) continue;
      const d = Phaser.Math.Distance.Between(h.x, h.y + 4, x * TILE + 8, y * TILE + 8);
      if (d < bestD) { bestD = d; best = { id, x, y }; }
    }
    if (!best) { if (this.hotspotCell) { this.hotspotCell = null; hideBubble(); } return; }
    const key = `${best.x},${best.y}`;
    if (this.hotspotCell !== key) { this.hotspotCell = key; this.hotspot = best; chime(); }
    const tall = TILE_BY_ID[best.id]?.tall;
    const s = this.toScreen(best.x * TILE + 8, best.y * TILE - (tall ? 14 : 2));
    setBubble(this.lineFor(best.id), s.x, s.y);
  }
}

// src/main.js — boots Phaser, wires the DOM overlays, builds the paint palette.
import Phaser from 'phaser';
import { TILES } from './palette.js';
import { drawTileToCanvas } from './tiles.js';
import { generateStory, diagnostics } from './story.js';
import { app, newPages, save, load, clearSaved, loadKey, saveKey, loadWorkspace, saveWorkspace, goPaint, goExplore } from './app.js';
import { $, show, hide, typewriter, makeFireflies, fitBoard } from './ui.js';
import Boot from './scenes/Boot.js';
import Paint from './scenes/Paint.js';
import Explore from './scenes/Explore.js';

app.game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 320, height: 192, zoom: 3,
  pixelArt: true, roundPixels: true, backgroundColor: '#1d2340',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [Boot, Paint, Explore],
});

// ---- palette sidebar ----
export function selectSwatch(id) {
  app.selected = id;
  document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('selected', b.dataset.id === id));
}
function buildPalette() {
  const pal = $('#palette');
  pal.innerHTML = '';
  const add = (id, name, canvas, tall) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (tall ? ' tall' : '');
    b.dataset.id = id;
    b.append(canvas);
    const l = document.createElement('span'); l.textContent = name; b.append(l);
    const star = document.createElement('span'); star.className = 'star hidden'; star.textContent = '✦'; b.append(star);
    b.onclick = () => selectSwatch(id);
    pal.append(b);
  };
  const eraser = document.createElement('canvas'); eraser.width = 16; eraser.height = 16;
  const ex = eraser.getContext('2d'); ex.fillStyle = '#f2a2b1'; ex.fillRect(3, 6, 10, 6); ex.fillStyle = '#fbf6ec'; ex.fillRect(3, 6, 5, 6);
  add('eraser', 'Erase', eraser, false);
  for (const t of TILES) add(t.id, t.name, drawTileToCanvas(t.id, 0), !!t.tall);
  selectSwatch('tree');
}
export function markSuggested(ids) {
  document.querySelectorAll('.swatch').forEach((b) => b.querySelector('.star').classList.toggle('hidden', !ids.includes(b.dataset.id)));
}

// ---- title screen ----
async function begin(seed) {
  seed = (seed || '').trim() || 'a fox who is afraid of the dark';
  $('#seed').value = seed;
  show($('#loading'));
  $('#loading-text').textContent = app.apiKey ? 'Dreaming up your story…' : 'Opening a favourite story…';
  $('#seed-form button').disabled = true;
  const { story, source, error, model } = await generateStory(seed, app.apiKey, app.workspaceId);
  hide($('#loading'));
  $('#seed-form button').disabled = false;
  app.story = story; app.source = source; app.pages = newPages(story); app.pageIndex = 0;
  save();
  const why = !error ? '' : /401|authentication/i.test(error) ? 'the API key was rejected' : /timeout|timed out/i.test(error) ? 'Claude took too long' : /refus/i.test(error) ? 'Claude declined this one' : /workspace/i.test(error) ? 'this API key needs a workspace ID (add it under the gear)' : 'Claude was unreachable';
  $('#source-note').textContent = source === 'claude' ? `written just now by ${model || 'Claude'}` : (error ? `${why} — using a built-in story (${error})` : 'built-in story (add a key for a new one)');
  revealStory();
}

async function revealStory() {
  hide($('#title'));
  const box = $('#reveal-pages');
  box.innerHTML = '';
  $('#reveal-title').textContent = app.story.title;
  $('#reveal-hero').textContent = `a story about ${app.story.hero.name} the ${app.story.hero.kind}`;
  show($('#storyreveal'));
  let current = null;
  let skipAll = false;
  box.onclick = () => { skipAll = true; current?.skip(); };
  for (let i = 0; i < app.pages.length; i++) {
    const p = document.createElement('p');
    const pg = document.createElement('span'); pg.className = 'pg'; pg.textContent = `Page ${i + 1}`;
    const txt = document.createElement('span');
    p.append(pg, txt); box.append(p);
    if (skipAll) { txt.textContent = app.pages[i].text; continue; }
    current = typewriter(txt, app.pages[i].text, 55);
    await current.done;
    box.scrollTop = box.scrollHeight;
  }
}

function wireTitle() {
  makeFireflies($('#title'), 18);
  document.addEventListener('storybook:log', (e) => { if (!$('#loading').classList.contains('hidden')) $('#loading-text').textContent = String(e.detail).replace('[storybook] ', ''); });
  makeFireflies($('#storyreveal'), 10);
  makeFireflies($('#end'), 14);
  $('#seed-form').addEventListener('submit', (e) => { e.preventDefault(); begin($('#seed').value); });
  document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => begin(c.textContent)));
  const refreshGear = () => {
    const has = !!app.apiKey;
    $('#gear').textContent = has ? '⚙ API key saved · Claude writes new stories' : '⚙ Add API key (optional)';
    $('#gear').classList.toggle('has-key', has);
  };
  $('#gear').addEventListener('click', () => { $('#keybox').classList.toggle('hidden'); if (!$('#keybox').classList.contains('hidden')) $('#apikey').focus(); });
  $('#apikey').value = loadKey();
  refreshGear();
  $('#apikey').addEventListener('change', (e) => { saveKey(e.target.value); refreshGear(); });
  $('#apikey').addEventListener('input', (e) => { saveKey(e.target.value); refreshGear(); });
  $('#workspace').value = loadWorkspace();
  $('#workspace').addEventListener('input', (e) => saveWorkspace(e.target.value));
  $('#btn-paint').addEventListener('click', () => { hide($('#storyreveal')); goPaint(0); });
  $('#btn-again').addEventListener('click', () => { hide($('#end')); goExplore(0); });
  $('#btn-new').addEventListener('click', () => { hide($('#end')); clearSaved(); $('#source-note').textContent = ''; show($('#title')); });
  if (load()) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'chip'; c.textContent = `↩ continue “${app.story.title}”`;
    c.addEventListener('click', () => { hide($('#title')); goPaint(app.pageIndex); });
    $('#chips').prepend(c);
  }
}

buildPalette();
wireTitle();
fitBoard(app.game);
window.addEventListener('resize', () => fitBoard(app.game));
window.storybook = { app, goPaint, goExplore, diagnostics }; // handy for demos and debugging
// Cross-world hook for tooling: document.dispatchEvent(new CustomEvent('storybook:page', { detail: { mode: 'paint', index: 1 } }))
document.addEventListener('storybook:page', (e) => {
  const { mode, index } = e.detail || {};
  (mode === 'explore' ? goExplore : goPaint)(Number(index) || 0);
});

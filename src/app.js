// src/app.js — shared app state, persistence, and the page flow (paint → explore → next).
import { GRID_W, GRID_H, TILE_BY_ID, TIMES, GROUNDS } from './palette.js';
import { generatePropLines } from './story.js';
import { starterLayout } from './layout.js';
import { $, show, hide, fade, hideBubble, fitBoard } from './ui.js';

const KEY = 'storybook-walk-v1';
const KEY_API = 'storybook-walk-key';
const KEY_WS = 'storybook-walk-workspace';

export const app = {
  game: null,
  story: null,
  source: 'canned',
  pages: [],
  pageIndex: 0,
  apiKey: '',
  workspaceId: '',
  selected: 'tree',
};

const grid = (fill) => Array.from({ length: GRID_H }, () => Array(GRID_W).fill(fill));

export function newPages(story) {
  return story.pages.map((p, i) => {
    const page = {
      text: p.text, time: p.time, ground: p.ground, suggestedProps: p.suggestedProps || [],
      cells: { ground: grid(p.ground), props: grid(null) }, sketch: 0,
      propLines: {}, narrationIntro: '', linesFor: null, introShown: false,
    };
    page.cells = starterLayout(page, `${story.title}:${i}:0`);
    return page;
  });
}

// Reroll a page's starter sketch (the player can still erase or add on top).
export function resketch(i) {
  const page = app.pages[i];
  page.sketch = (page.sketch || 0) + 1;
  page.cells = starterLayout(page, `${app.story.title}:${i}:${page.sketch}`);
  save();
  return page.cells;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ story: app.story, source: app.source, pages: app.pages, pageIndex: app.pageIndex }));
  } catch (e) { /* private mode etc. */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.story || !d.pages?.length) return false;
    Object.assign(app, { story: d.story, source: d.source || 'canned', pages: d.pages, pageIndex: d.pageIndex || 0 });
    return true;
  } catch (e) { return false; }
}
export function clearSaved() { try { localStorage.removeItem(KEY); } catch (e) {} }
export function loadKey() { try { app.apiKey = localStorage.getItem(KEY_API) || ''; } catch (e) {} return app.apiKey; }
export function saveKey(k) { app.apiKey = k.trim(); try { localStorage.setItem(KEY_API, app.apiKey); } catch (e) {} }
export function loadWorkspace() { try { app.workspaceId = localStorage.getItem(KEY_WS) || ''; } catch (e) {} return app.workspaceId; }
export function saveWorkspace(w) { app.workspaceId = w.trim(); try { localStorage.setItem(KEY_WS, app.workspaceId); } catch (e) {} }

export const moodLabel = (page) => `${TIMES[page.time].label} · ${GROUNDS[page.ground].name}`;

// Distinct prop ids painted on a page (plus water, which also speaks).
export function paintedIds(page) {
  const ids = new Set();
  page.cells.props.forEach((row) => row.forEach((id) => id && ids.add(id)));
  page.cells.ground.forEach((row) => row.forEach((c) => TILE_BY_ID[c] && TILE_BY_ID[c].walkable === false && ids.add(c)));
  return [...ids];
}

function requestPropLines(i) {
  const page = app.pages[i];
  const ids = paintedIds(page);
  const sig = [...ids].sort().join(',');
  if (page.linesFor === sig) return;
  page.linesFor = sig;
  generatePropLines(app.story, i, ids, app.apiKey, app.workspaceId).then(({ narrationIntro, lines }) => {
    page.propLines = lines || {};
    page.narrationIntro = narrationIntro || '';
    page.introShown = false;
    save();
  }).catch(() => {});
}

export async function goPaint(i) {
  app.pageIndex = i; save();
  await fade(true);
  hide($('#narration')); hideBubble();
  app.game.scene.stop('Explore');
  app.game.scene.start('Paint');
  show($('#sidebar'));
  fitBoard(app.game);
  await fade(false);
}

export async function goExplore(i) {
  app.pageIndex = i; save();
  requestPropLines(i);
  await fade(true);
  hide($('#sidebar'));
  fitBoard(app.game);
  app.game.scene.stop('Paint');
  app.game.scene.start('Explore');
  await fade(false);
}

export async function goEnd() {
  await fade(true);
  hide($('#narration')); hideBubble();
  app.game.scene.stop('Explore');
  $('#end-title').textContent = 'The End';
  $('#end-text').textContent = `${app.story.hero.name}'s story, painted by you.`;
  show($('#end'));
  await fade(false);
}

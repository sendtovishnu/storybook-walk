// src/ui.js — small DOM helpers: overlays, fades, typewriter, bubbles, fireflies.
export const $ = (s) => document.querySelector(s);
export const show = (el) => el.classList.remove('hidden');
export const hide = (el) => el.classList.add('hidden');

export function fade(on, ms = 600) {
  const f = $('#fade');
  f.style.transitionDuration = ms + 'ms';
  f.classList.toggle('on', on);
  return new Promise((r) => setTimeout(r, ms));
}

// Types text into el. Returns { done: Promise, skip() }.
export function typewriter(el, text, cps = 32) {
  let i = 0;
  let stopped = false;
  el.textContent = '';
  const step = 1000 / cps;
  const done = new Promise((resolve) => {
    const tick = () => {
      if (stopped) { el.textContent = text; resolve(); return; }
      i++;
      el.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(tick, step); else resolve();
    };
    tick();
  });
  return { done, skip: () => { stopped = true; } };
}

export function setBubble(text, x, y) {
  const b = $('#bubble');
  if (b.textContent !== text) b.textContent = text;
  b.style.left = x + 'px';
  b.style.top = y + 'px';
  b.classList.add('on');
}
export function hideBubble() { $('#bubble').classList.remove('on'); }

export function makeFireflies(container, n = 16) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'fly';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    s.style.setProperty('--dy', (Math.random() * 120 - 60) + 'px');
    s.style.animationDelay = (-Math.random() * 9) + 's';
    s.style.animationDuration = (7 + Math.random() * 6) + 's';
    container.appendChild(s);
  }
}

// Scale the game board (stage + sidebar) to fit the window, so the 960px stage works on small screens.
export function fitBoard(game) {
  const board = $('#board');
  const sidebarShown = !$('#sidebar').classList.contains('hidden');
  const w = 960 + (sidebarShown ? 18 + 250 : 0);
  const s = Math.min(1, (window.innerWidth - 24) / w, (window.innerHeight - 24) / 576);
  board.style.transform = `scale(${s.toFixed(4)})`;
  try { game?.scale?.refresh(); } catch (e) {}
}

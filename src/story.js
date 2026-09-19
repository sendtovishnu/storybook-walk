// src/story.js — Claude writes the storybook (and the little lines props say).
// Everything here degrades gracefully: no API key or any failure → canned story
// and generic prop lines, so the game never blocks on the network.

import { z } from 'zod/v4';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { TILES, GROUNDS, TIMES, HERO_KINDS, DEFAULT_HERO } from './palette.js';

// ---------------------------------------------------------------------------
// Schemas (kept strict-output friendly: plain z.object, z.enum, no defaults,
// no .min/.max on arrays — those constraints live in the prompts instead).
// ---------------------------------------------------------------------------

const TILE_IDS = TILES.map((t) => t.id);
const GROUND_KEYS = Object.keys(GROUNDS);
const TIME_KEYS = Object.keys(TIMES);

const TileIdEnum = z.enum(TILE_IDS);
const GroundEnum = z.enum(GROUND_KEYS);
const TimeEnum = z.enum(TIME_KEYS);
const HeroKindEnum = z.enum(HERO_KINDS);

export const StorySchema = z.object({
  title: z.string(),
  hero: z.object({
    name: z.string(),
    kind: HeroKindEnum,
    color: z.string(),
  }),
  pages: z.array(
    z.object({
      text: z.string(),
      time: TimeEnum,
      ground: GroundEnum,
      suggestedProps: z.array(TileIdEnum),
    }),
  ),
});

export const PropLinesSchema = z.object({
  narrationIntro: z.string(),
  lines: z.array(
    z.object({
      prop: TileIdEnum,
      line: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Canned stories — used when there is no key, or when Claude can't answer.
// ---------------------------------------------------------------------------

export const CANNED_STORIES = [
  {
    title: 'Pip and the Gentle Lights',
    hero: { name: 'Pip', kind: 'fox', color: '#e8925a' },
    pages: [
      {
        text:
          'Pip is a small fox with a big fluffy tail. The sun is sinking low, and the sky turns the color of peaches. ' +
          'Pip does not like the dark. "It is too big and too quiet," Pip whispers. But a little path leads away from home, ' +
          'and something is twinkling at the end of it.',
        time: 'dusk',
        ground: 'grass',
        suggestedProps: ['house', 'path', 'flowers', 'fence', 'tree'],
      },
      {
        text:
          'Now it is night. The grass is cool and soft under Pip\'s paws. A lantern glows on a wooden post, warm and yellow, ' +
          'humming a tiny song. Mushrooms peek out with their red caps. "Oh," says Pip. "The dark has lights in it." ' +
          'Further on, something is blinking between the pines.',
        time: 'night',
        ground: 'dark_grass',
        suggestedProps: ['lantern', 'mushroom', 'pine', 'path', 'rock'],
      },
      {
        text:
          'Fireflies! Hundreds of them, floating like sleepy stars. They drift around the tall grass and settle on a stump ' +
          'as if to say hello. Pip sits very still and listens. The night is not quiet after all. It is full of soft sounds ' +
          'and gentle glows. Somewhere ahead, the sky is turning pink.',
        time: 'night',
        ground: 'dark_grass',
        suggestedProps: ['tallgrass', 'stump', 'pine', 'lantern', 'bush', 'signpost'],
      },
      {
        text:
          'Dawn comes slowly, like a yawn. The birds start to sing. Pip trots back home along the path, past the bench and the ' +
          'flowers, with fireflies still blinking in the fluffy tail. Pip is not afraid of the dark anymore. Tonight, Pip will ' +
          'go out and say goodnight to every little light.',
        time: 'dawn',
        ground: 'grass',
        suggestedProps: ['house', 'bench', 'flowers', 'path', 'tree'],
      },
    ],
  },
  {
    title: 'Clover Goes to See the Sea',
    hero: { name: 'Clover', kind: 'rabbit', color: '#d9c9b8' },
    pages: [
      {
        text:
          'Clover is a small grey rabbit who has never seen the sea. "It is big and blue and it sings," says Grandmother, ' +
          'nibbling a daisy. Clover\'s ears go straight up. The morning is bright and the flowers are nodding. A signpost ' +
          'points down the path, and Clover hops after it.',
        time: 'day',
        ground: 'grass',
        suggestedProps: ['flowers', 'signpost', 'path', 'bush', 'house', 'tree'],
      },
      {
        text:
          'The grass gives way to warm golden sand. It squishes between Clover\'s toes. Big smooth rocks sit in the sun like ' +
          'sleeping turtles. There is a salty smell in the air, and a soft whooshing sound, coming closer with every hop. ' +
          '"Is that the sea?" Clover whispers. "Almost," says the wind.',
        time: 'day',
        ground: 'sand',
        suggestedProps: ['rock', 'tallgrass', 'path', 'fence', 'signpost'],
      },
      {
        text:
          'And there it is. The sea! Blue and wide and glittering, with little waves that hush and hush. Lily pads float ' +
          'near the shore with tiny pink flowers. The sun slides down and paints everything gold. Clover sits on a bench and ' +
          'watches until the first star peeks out.',
        time: 'dusk',
        ground: 'sand',
        suggestedProps: ['water', 'pond', 'bench', 'rock', 'tallgrass'],
      },
      {
        text:
          'Night settles over the beach like a soft blanket. A lantern glows beside the water, and the waves whisper a lullaby. ' +
          'Clover curls up warm and sleepy. "I saw the sea," Clover says to the stars. "And it sang to me." Tomorrow, ' +
          'there will be so much to tell Grandmother.',
        time: 'night',
        ground: 'sand',
        suggestedProps: ['lantern', 'water', 'pond', 'rock', 'bench', 'stump'],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Generic prop lines — one per tile id, shown until Claude's lines arrive.
// ---------------------------------------------------------------------------

export const GENERIC_LINES = {
  path: 'The path knows the way. Follow it a little further.',
  water: 'The water hushes and hushes, keeping every secret safe.',
  flowers: 'The flowers nod hello, bobbing on the softest breeze.',
  tallgrass: 'The tall grass whispers and tickles as you pass.',
  tree: 'The old tree sways gently, humming a very slow song.',
  pine: 'The pine smells of winter and keeps you cool and shaded.',
  bush: 'The bush rustles. Something small and shy is hiding inside.',
  rock: 'The rock has been sitting here for a thousand quiet years.',
  mushroom: 'Two little mushrooms tip their red caps at you.',
  house: 'A warm window glows. Someone is baking something sweet.',
  lantern: 'The lantern hums a small warm song for you.',
  bench: 'The bench says: sit a while, and watch the sky.',
  fence: 'The fence leans in, friendly and a little crooked.',
  signpost: 'The signpost points the way, though it never says where.',
  stump: 'The stump remembers being a tree, and does not mind.',
  pond: 'A lily pad floats by, carrying one tiny pink flower.',
  default: 'Something small and gentle is waiting here for you.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function pickCanned(seed) {
  const s = String(seed || '').toLowerCase();
  if (s.includes('rabbit') || s.includes('bunny') || s.includes('sea')) return CANNED_STORIES[1];
  if (s.includes('fox') || s.includes('dark')) return CANNED_STORIES[0];
  return CANNED_STORIES[hashString(s) % CANNED_STORIES.length];
}

function sanitizeStory(raw) {
  const story = StorySchema.parse(raw);
  const color = typeof story.hero.color === 'string' && HEX_RE.test(story.hero.color.trim())
    ? story.hero.color.trim().toLowerCase()
    : DEFAULT_HERO.color;
  const pages = story.pages.slice(0, 4).map((p) => ({
    ...p,
    suggestedProps: Array.from(new Set((p.suggestedProps || []).filter((id) => TILE_IDS.includes(id)))),
  }));
  if (pages.length !== 4) throw new Error(`expected 4 pages, got ${pages.length}`);
  return { ...story, hero: { ...story.hero, color }, pages };
}

function makeClient(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 20000, maxRetries: 1 });
}

function tileListForPrompt() {
  return TILES.map((t) => `- ${t.id}: ${t.desc}`).join('\n');
}

function errorMessage(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  return msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const STORY_SYSTEM_PROMPT = `You are a gentle children's author writing an illustrated storybook for ages 4 to 8. Someone gives you a one-line idea and you write a tiny, warm story to read aloud at bedtime.

Write EXACTLY 4 pages. Each page is at most 60 words, in present tense, with concrete sensory details (what things look, sound, smell and feel like). Give the story a tiny arc: a wish or a worry, a small journey, a gentle discovery, and a cozy ending. End each page in a way that makes a child want to walk into the next one.

Name the hero. Choose hero.kind from: ${HERO_KINDS.join(', ')}. Give hero.color as a soft, friendly hex color like #e8925a.

For each page choose a time of day from: ${TIME_KEYS.join(', ')} and a ground from: ${GROUND_KEYS.join(', ')} that suit the scene, and vary them across the pages so the journey feels like it moves.

For each page choose suggestedProps: 3 to 6 ids from this tile list, things a child could paint into that scene. Use only these ids exactly as written:
${tileListForPrompt()}

Rules: no violence, nothing scary, no brand names, no meanness. Everything is kind, cozy and a little bit magical.`;

const LINES_SYSTEM_PROMPT = `You are a gentle children's author, the same voice that wrote the storybook below. The player has painted things into the current page, and the hero is about to walk through it.

For EACH prop id in the provided list, write ONE line of at most 18 words: what that thing says, or what the narrator whispers, when the hero walks up to it. Stay in the story's voice and mood, and mention the hero by name sometimes. Also write narrationIntro: one sentence of at most 25 words greeting the hero as they step into this page, mentioning one or two of the painted things.

Only use prop ids from the provided list, exactly as written. Write one entry per prop, no more. Keep everything warm, kind and cozy; nothing scary, no brand names.`;

// ---------------------------------------------------------------------------
// generateStory
// ---------------------------------------------------------------------------

export async function generateStory(seed, apiKey) {
  const cleanSeed = String(seed || '').trim();
  if (!apiKey) return { story: pickCanned(cleanSeed), source: 'canned' };

  try {
    const client = makeClient(apiKey);
    const userPrompt =
      `Story idea: ${cleanSeed || 'a small animal goes on a gentle adventure'}\n\n` +
      'Write the 4-page storybook now.';

    const res = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: STORY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { effort: 'low', format: zodOutputFormat(StorySchema) },
    });

    if (res.stop_reason === 'refusal') throw new Error('refused');
    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    const story = sanitizeStory(JSON.parse(text));
    return { story, source: 'claude' };
  } catch (err) {
    return { story: pickCanned(cleanSeed), source: 'canned', error: errorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// generatePropLines
// ---------------------------------------------------------------------------

function genericLinesFor(propIds) {
  const lines = {};
  for (const id of propIds) lines[id] = GENERIC_LINES[id] || GENERIC_LINES.default;
  return lines;
}

export async function generatePropLines(story, pageIndex, propIds, apiKey) {
  const ids = Array.from(new Set((propIds || []).filter((id) => TILE_IDS.includes(id))));
  const fallback = { narrationIntro: '', lines: genericLinesFor(ids) };
  if (!apiKey || ids.length === 0 || !story || !story.pages || !story.pages[pageIndex]) return fallback;

  try {
    const client = makeClient(apiKey);
    const page = story.pages[pageIndex];
    const allPages = story.pages.map((p, i) => `Page ${i + 1}: ${p.text}`).join('\n\n');
    const propDescs = ids
      .map((id) => {
        const t = TILES.find((tile) => tile.id === id);
        return `- ${id}: ${t ? t.desc : ''}`;
      })
      .join('\n');

    const userPrompt =
      `Storybook title: ${story.title}\n` +
      `Hero: ${story.hero.name} the ${story.hero.kind}\n\n` +
      `Full story:\n${allPages}\n\n` +
      `Current page (${pageIndex + 1} of ${story.pages.length}), time: ${page.time}, ground: ${page.ground}:\n${page.text}\n\n` +
      `Props the player painted into this page (use ONLY these ids):\n${propDescs}\n\n` +
      'Write narrationIntro and one line per prop now.';

    const res = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: LINES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { effort: 'low', format: zodOutputFormat(PropLinesSchema) },
    });

    if (res.stop_reason === 'refusal') throw new Error('refused');
    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    const parsed = PropLinesSchema.parse(JSON.parse(text));

    const lines = genericLinesFor(ids);
    for (const entry of parsed.lines) {
      if (ids.includes(entry.prop) && entry.line && entry.line.trim()) lines[entry.prop] = entry.line.trim();
    }
    return { narrationIntro: (parsed.narrationIntro || '').trim(), lines };
  } catch {
    return fallback;
  }
}

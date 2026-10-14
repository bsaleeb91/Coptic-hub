// scripts/gen-roadmap.mjs
// Generates lib/roadmap-data.ts from the "Next Up" block of ../ROADMAP.md.
//
// ROADMAP.md is the single source of truth for both roadmaps it carries: the
// Poimen "Next Up" list (parsed here) and the Coptic Hub commit plan below it
// (not shown in the app — a different product's build plan). The admin
// Roadmap screen renders the generated file, so the list is never typed twice.
//
// Run: npm run gen:roadmap   (also runs via prestart / prebuild)
//
// Parse rules, matching how the block is already written:
//   ### Queued <date>        → a phase
//   - text                   (col 0)  → a simple item, label only
//   **Bold text.**           → an item label; prose beneath it becomes `note`,
//                              and indented "  - " bullets become `detail`
// Continuation lines of a bullet are indented further and are joined onto it.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'ROADMAP.md');
const OUT = join(here, '..', 'lib', 'roadmap-data.ts');

// Strip markdown that has no meaning in a React Native <Text>.
const clean = (s) =>
  s.replace(/`([^`]*)`/g, '$1')          // inline code
   .replace(/\*\*([^*]*)\*\*/g, '$1')    // bold
   .replace(/\s+/g, ' ')
   .trim();

const slug = (s) =>
  clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function parse(md) {
  // Isolate the "## Next Up" section: everything up to the next top-level "##".
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Next Up/.test(l));
  if (start === -1) throw new Error('gen-roadmap: no "## Next Up" heading in ROADMAP.md');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) && !/^###/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start + 1, end);

  const phases = [];
  let phase = null;
  let item = null;
  let prose = [];          // prose lines under a bold label, before its bullets
  let sawDetail = false;

  const flushProse = () => {
    if (!item) { prose = []; return; }
    const text = clean(prose.join(' '));
    if (text) {
      // Prose before the bullets is the item's note; prose after them is a
      // trailing remark, which reads better as one more bullet.
      if (sawDetail) (item.detail ??= []).push(text);
      else item.note = text.replace(/[:.]$/, '');
    }
    prose = [];
  };
  const closeItem = () => { flushProse(); item = null; sawDetail = false; };

  for (const raw of body) {
    const line = raw.trimEnd();

    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      closeItem();
      phase = { id: slug(h3[1]), title: clean(h3[1]), items: [] };
      phases.push(phase);
      continue;
    }
    if (!phase) continue;                                  // intro prose

    const bold = /^\*\*(.+?)\.?\*\*\s*$/.exec(line);       // **Label.**
    if (bold) {
      closeItem();
      item = { id: `${phase.id}-${phase.items.length + 1}`, label: clean(bold[1]) };
      phase.items.push(item);
      continue;
    }

    const top = /^-\s+(.*)$/.exec(line);                   // "- " at column 0
    if (top) {
      closeItem();
      phase.items.push({ id: `${phase.id}-${phase.items.length + 1}`, label: clean(top[1]) });
      continue;
    }

    const sub = /^\s+-\s+(.*)$/.exec(line);                // indented bullet
    if (sub && item) {
      flushProse();
      sawDetail = true;
      (item.detail ??= []).push(clean(sub[1]));
      continue;
    }

    if (!line.trim()) { continue; }

    // A continuation of the bullet above, or prose under the label.
    if (item && sawDetail && item.detail?.length && /^\s{3,}\S/.test(raw) && !prose.length) {
      const d = item.detail;
      d[d.length - 1] = clean(`${d[d.length - 1]} ${line}`);
      continue;
    }
    if (item) prose.push(line);
  }
  closeItem();

  return phases.filter((p) => p.items.length);
}

const phases = parse(readFileSync(SRC, 'utf8'));
const total = phases.reduce((n, p) => n + p.items.length, 0);

const banner = `// lib/roadmap-data.ts
// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: ROADMAP.md ("Next Up" block) · regenerate with: npm run gen:roadmap
// Item ids are derived from position, so reordering the markdown resets the
// admin screen's check state for the items that moved.

export type RoadmapItem = { id: string; label: string; note?: string; detail?: string[] };
export type RoadmapPhase = { id: string; title: string; items: RoadmapItem[] };

export const PHASES: RoadmapPhase[] = `;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${banner}${JSON.stringify(phases, null, 2)};\n`, 'utf8');
console.log(`gen-roadmap: ${phases.length} groups, ${total} items → lib/roadmap-data.ts`);

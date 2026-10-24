// npm run validate
// Checks the content files. Fails (exit code 1) on any error.
// Quote checks need the extracted texts in sources/ (see README). If they are
// missing, quote checks are skipped with a warning so the build still works.
import { readFileSync, existsSync } from "node:fs";

type Quote = { text: string; work: "csmv" | "orations"; discourse?: number; section: number } | null;
type Card = {
  id: string; name: string; type: string; cost: number; power: number;
  text: string; flavor: string; scriptureRef: string | null; themes: string[];
  explanation: string; quote: Quote; citation: string;
  verify: boolean; isTradition: boolean; approved: boolean;
  counters?: string[]; unlocksSlot?: string;
};
type Slot = { id: string; order: number; phrase: string; guardsAgainst: string; approved: boolean };

const load = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
const player: Card[] = load("data/cards.json").cards;
const arius: Card[] = load("data/arius-deck.json").cards;
const creed = load("data/creed.json");
const slots: Slot[] = creed.slots;

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

// --- required fields -------------------------------------------------------
const required = ["id", "name", "type", "cost", "power", "text", "flavor", "themes",
  "explanation", "citation", "verify", "isTradition", "approved"] as const;
for (const c of [...player, ...arius]) {
  for (const f of required) {
    const v = (c as any)[f];
    if (v === undefined || v === null || v === "") err(`${c.id ?? "?"}: missing ${f}`);
  }
  if (!("scriptureRef" in c)) err(`${c.id}: missing scriptureRef (use null for none)`);
  if (!("quote" in c)) err(`${c.id}: missing quote (use null for none)`);
  if (c.cost < 0 || c.cost > 8) err(`${c.id}: cost ${c.cost} outside 0-8`);
  if (c.power < 1 || c.power > 10) err(`${c.id}: power ${c.power} outside 1-10`);
  if (c.isTradition && !/^Tradition holds/i.test(c.flavor))
    err(`${c.id}: tradition cards must have flavor starting "Tradition holds…"`);
  const sentences = c.explanation.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length;
  if (sentences > 3) warnings.push(`${c.id}: explanation has ${sentences} sentences (aim for 2-3)`);
}

// --- duplicate ids ---------------------------------------------------------
const ids = new Set<string>();
for (const x of [...player, ...arius, ...slots]) {
  if (ids.has(x.id)) err(`duplicate id: ${x.id}`);
  ids.add(x.id);
}

// --- counters and creed slots -----------------------------------------------
const playerIds = new Set(player.map((c) => c.id));
const slotIds = new Set(slots.map((s) => s.id));
for (const a of arius) {
  const valid = (a.counters ?? []).filter((id) => playerIds.has(id));
  if (valid.length === 0) err(`${a.id}: no valid counter in the player pool`);
  for (const id of a.counters ?? []) if (!playerIds.has(id)) err(`${a.id}: counter "${id}" is not a player card`);
  if (a.unlocksSlot && !slotIds.has(a.unlocksSlot)) err(`${a.id}: unlocksSlot "${a.unlocksSlot}" is not a Creed slot`);
}
for (const s of slots) {
  const by = arius.filter((a) => a.unlocksSlot === s.id);
  if (by.length === 0) err(`creed slot "${s.id}" has no Arius card that unlocks it`);
  if (by.length > 1) err(`creed slot "${s.id}" is unlocked by more than one card: ${by.map((a) => a.id).join(", ")}`);
  if (!creed.fullText.includes(s.phrase)) err(`creed slot "${s.id}": phrase not found word-for-word in the 325 text`);
}

// --- quotes against the source texts ---------------------------------------
// Compare letters only, so line breaks, OCR spacing and punctuation don't matter.
// British/American spelling (honour/honor, recognise/recognize) is folded too.
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z]/g, "").replace(/our/g, "or").replace(/z/g, "s");

const haveSources = existsSync("sources/csmv-sections.json") && existsSync("sources/orations-sections.json");
if (!haveSources) {
  warnings.push("sources/ not found: quote checks skipped (run scripts/export_sources.py)");
} else {
  const csmv: Record<string, string> = load("sources/csmv-sections.json");
  const csmvPrint = norm(readFileSync("sources/csmv-svs.txt", "utf-8"));
  const orations: Record<string, Record<string, string>> = load("sources/orations-sections.json");
  for (const c of [...player, ...arius]) {
    const q = c.quote;
    if (!q) continue;
    const nq = norm(q.text);
    if (q.work === "csmv") {
      const sec = csmv[String(q.section)];
      if (!sec) { err(`${c.id}: On the Incarnation has no §${q.section}`); continue; }
      if (!norm(sec).includes(nq)) {
        const elsewhere = Object.entries(csmv).find(([, t]) => norm(t).includes(nq));
        err(`${c.id}: quote not found in §${q.section}` + (elsewhere ? ` (it is in §${elsewhere[0]})` : " (not found anywhere)"));
      } else if (!csmvPrint.includes(nq)) {
        warnings.push(`${c.id}: quote matches the web copy but not the printed SVS edition; check wording`);
      }
    } else if (q.work === "orations") {
      const sec = orations[String(q.discourse)]?.[String(q.section)];
      if (!sec) { err(`${c.id}: Orations has no ${q.discourse}.${q.section}`); continue; }
      if (!norm(sec).includes(nq)) err(`${c.id}: quote not found in Orations ${q.discourse}.${q.section}`);
    } else err(`${c.id}: unknown quote work "${(q as any).work}"`);
  }
}

// --- Scripture text against the saved NKJV verses --------------------------
// A card may show part of a verse; "..." marks a skipped stretch. Each piece
// must appear word for word in the NKJV text of that reference.
if (!existsSync("sources/nkjv-verses.json")) {
  warnings.push("sources/nkjv-verses.json not found: Scripture checks skipped (run scripts/fetch_nkjv.py)");
} else {
  const nkjv: Record<string, string> = load("sources/nkjv-verses.json");
  const plain = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  for (const c of [...player, ...arius]) {
    if (!c.scriptureRef) continue;
    if (c.scriptureRef.includes("(")) continue; // e.g. "(Greek Septuagint)": not NKJV text
    const verse = nkjv[c.scriptureRef];
    if (!verse) { err(`${c.id}: ${c.scriptureRef} is not in sources/nkjv-verses.json (add it to scripts/fetch_nkjv.py)`); continue; }
    for (const piece of c.flavor.split(/\.\.\.|…/)) {
      if (piece.trim() && !plain(verse).includes(plain(piece)))
        err(`${c.id}: verse text "${piece.trim()}" does not match NKJV ${c.scriptureRef}`);
    }
  }
}

// --- report -----------------------------------------------------------------
for (const w of warnings) console.log("warn  " + w);
const flagged = [...player, ...arius].filter((c) => c.verify);
const unapproved = [...player, ...arius, ...slots].filter((c) => !c.approved);
console.log(`\n${player.length} player cards, ${arius.length} Arius cards, ${slots.length} Creed slots`);
console.log(`Citations flagged verify: ${flagged.length}${flagged.length ? "\n  " + flagged.map((c) => c.id).join("\n  ") : ""}`);
console.log(`Awaiting teacher approval: ${unapproved.length} of ${player.length + arius.length + slots.length}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("\nValidation passed.");

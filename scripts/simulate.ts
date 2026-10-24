// npx tsx scripts/simulate.ts : plays many matches with simple bots to check balance.
import { advance, canAfford, canSearch, classify, newMatch, respond, search } from "../src/engine/match";
import { content as base } from "../src/content";
import type { Content, MatchState } from "../src/engine/types";

type Bot = (c: Content, s: MatchState) => MatchState;
const aff = (c: Content, s: MatchState) => s.hand.filter((id) => canAfford(c, s, id));
const find = (c: Content, s: MatchState, o: string) => aff(c, s).find((id) => classify(c, s.current!, id) === o);
// Knows every answer; searches while it lacks one and can still afford something.
const expert: Bot = (c, s) => {
  while (!find(c, s, "correct") && canSearch(c, s) && s.grace > 2) s = search(c, s);
  return respond(c, s, find(c, s, "correct") ?? find(c, s, "partial") ?? null);
};
const random: Bot = (c, s) => { const o = aff(c, s); return respond(c, s, o.length ? o[(s.rng >>> 0) % o.length] : null); };

function run(label: string, c: Content) {
  for (const [name, bot] of [["expert", expert], ["random", random]] as const) {
    const res = { perfect: 0, win: 0, loss: 0 }; let slots = 0; const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      let s = newMatch(c, seed);
      while (s.phase !== "over") { s = bot(c, s); if (s.phase === "resolved") s = advance(c, s); }
      res[s.result!]++; slots += s.creed.length;
    }
    const pct = (v: number) => (100 * v / N).toFixed(0).padStart(3) + "%";
    console.log(`${label.padEnd(28)} ${name.padEnd(6)} perfect ${pct(res.perfect)} win ${pct(res.win)} loss ${pct(res.loss)}  slots ${(slots / N).toFixed(1)}`);
  }
}
const variant = (ai: number, searchCost: number, draw = 2): Content =>
  ({ ...base, config: { ...base.config, ai: { preferUnanswerable: ai }, search: { cost: searchCost }, hand: { ...base.config.hand, drawPerRound: draw } } });
const only = process.argv[2] === "current";
if (only) run("current config", base);
else for (const ai of [1, 0.5, 0.25]) for (const sc of [99, 1]) run(`ai ${ai} search ${sc === 99 ? "off" : sc}`, variant(ai, sc));

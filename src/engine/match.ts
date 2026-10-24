import type { Bishops, Challenge, Clash, Content, MatchState, Outcome } from "./types";
import { randomInt, shuffle } from "./rng";

// ---------------------------------------------------------------- helpers

export const challengesInRound = (c: Content, round: number) =>
  c.config.doubleChallengeRounds.includes(round) ? 2 : 1;

export const graceForRound = (c: Content, round: number) =>
  Math.min(c.config.grace.start + c.config.grace.perRound * (round - 1), c.config.grace.max);

export const totalClashes = (c: Content) => {
  let n = 0;
  for (let r = 1; r <= c.config.rounds; r++) n += challengesInRound(c, r);
  return n;
};

const cardById = (c: Content, id: string) => {
  const card = c.cards.find((x) => x.id === id);
  if (!card) throw new Error(`unknown card ${id}`);
  return card;
};

export const challengeById = (c: Content, id: string): Challenge => {
  const ch = c.challenges.find((x) => x.id === id);
  if (!ch) throw new Error(`unknown challenge ${id}`);
  return ch;
};

/** How a card answers a challenge. */
export function classify(c: Content, challengeId: string, cardId: string | null): Outcome {
  if (!cardId) return "miss";
  const ch = challengeById(c, challengeId);
  if (ch.counters.includes(cardId)) return "correct";
  const card = cardById(c, cardId);
  return card.themes.some((t) => ch.themes.includes(t)) ? "partial" : "miss";
}

/** Move up to n bishops to one side: undecided first, then from the other side. */
export function moveBishops(b: Bishops, to: "player" | "arius", n: number): [Bishops, number] {
  const from = to === "player" ? "arius" : "player";
  const out = { ...b };
  const fromUndecided = Math.min(n, out.undecided);
  out.undecided -= fromUndecided;
  const fromOther = Math.min(n - fromUndecided, out[from]);
  out[from] -= fromOther;
  const moved = fromUndecided + fromOther;
  out[to] += moved;
  return [out, moved];
}

function draw(c: Content, s: MatchState, n: number, max = c.config.hand.max): MatchState {
  let { hand, deck, discard, rng } = s;
  hand = hand.slice(); deck = deck.slice(); discard = discard.slice();
  for (let i = 0; i < n && hand.length < max; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      [deck, rng] = shuffle(discard, rng);
      discard = [];
    }
    hand.push(deck.pop()!);
  }
  return { ...s, hand, deck, discard, rng };
}

// ---------------------------------------------------------------- Arius (Normal)

/**
 * Normal AI: some of the time (config.ai.preferUnanswerable), pick a challenge
 * the player can't answer right now (no affordable correct counter in hand).
 * Then the strongest; ties are broken by the seeded random number generator.
 */
export function pickChallenge(c: Content, s: MatchState): MatchState {
  const affordable = s.hand.filter((id) => cardById(c, id).cost <= s.grace);
  const answerable = (id: string) => challengeById(c, id).counters.some((x) => affordable.includes(x));
  let rng = s.rng, roll: number;
  [roll, rng] = randomInt(rng, 1000);
  let pool = s.remaining;
  if (roll < c.config.ai.preferUnanswerable * 1000) {
    const hard = s.remaining.filter((id) => !answerable(id));
    if (hard.length) pool = hard;
  }
  const top = Math.max(...pool.map((id) => challengeById(c, id).power));
  const best = pool.filter((id) => challengeById(c, id).power === top);
  let i: number;
  [i, rng] = randomInt(rng, best.length);
  return { ...s, current: best[i], rng };
}

// ---------------------------------------------------------------- match flow

export function newMatch(c: Content, seed: number): MatchState {
  const { bishops } = c.config;
  const [deck, rng] = shuffle(c.cards.map((x) => x.id), (seed >>> 0) || 1);
  let s: MatchState = {
    seed, rng, round: 1, clashInRound: 1, grace: graceForRound(c, 1),
    hand: [], deck, discard: [],
    bishops: {
      player: bishops.startPlayer,
      arius: bishops.startArius,
      undecided: bishops.total - bishops.startPlayer - bishops.startArius,
    },
    creed: [], remaining: c.challenges.map((x) => x.id),
    current: null, phase: "respond", last: null, history: [], result: null,
  };
  s = draw(c, s, c.config.hand.start);
  return pickChallenge(c, s);
}

export const canAfford = (c: Content, s: MatchState, cardId: string) =>
  cardById(c, cardId).cost <= s.grace;

/** Search the Scriptures: spend Grace to draw one extra card (may go over the hand limit). */
export function canSearch(c: Content, s: MatchState) {
  return s.phase === "respond" && s.grace >= c.config.search.cost && (s.deck.length > 0 || s.discard.length > 0);
}
export function search(c: Content, s: MatchState): MatchState {
  if (!canSearch(c, s)) throw new Error("can't search now");
  return draw(c, { ...s, grace: s.grace - c.config.search.cost }, 1, Infinity);
}

/** The player answers the current challenge with a card, or passes (null). */
export function respond(c: Content, s: MatchState, cardId: string | null): MatchState {
  if (s.phase !== "respond" || !s.current) throw new Error("not waiting for a response");
  if (cardId !== null) {
    if (!s.hand.includes(cardId)) throw new Error(`card ${cardId} is not in hand`);
    if (!canAfford(c, s, cardId)) throw new Error(`not enough Grace for ${cardId}`);
  }
  const ch = challengeById(c, s.current);
  const outcome = classify(c, ch.id, cardId);
  const card = cardId ? cardById(c, cardId) : null;
  const { swing } = c.config;

  let bishops = s.bishops, playerGain = 0, ariusGain = 0;
  if (outcome === "correct") [bishops, playerGain] = moveBishops(bishops, "player", swing.correctBase + swing.correctPerPower * card!.power);
  else if (outcome === "partial") [bishops, playerGain] = moveBishops(bishops, "player", swing.partialPerPower * card!.power);
  else [bishops, ariusGain] = moveBishops(bishops, "arius", swing.ariusPerPower * ch.power);

  const slotFilled = outcome === "correct" && !s.creed.includes(ch.unlocksSlot) ? ch.unlocksSlot : null;
  const clash: Clash = { challengeId: ch.id, cardId, outcome, playerGain, ariusGain, slotFilled };

  let next: MatchState = {
    ...s,
    grace: s.grace - (card?.cost ?? 0),
    hand: cardId ? s.hand.filter((x) => x !== cardId) : s.hand,
    discard: cardId ? [...s.discard, cardId] : s.discard,
    bishops,
    creed: slotFilled ? [...s.creed, slotFilled] : s.creed,
    remaining: s.remaining.filter((x) => x !== ch.id),
    last: clash,
    history: [...s.history, clash],
    phase: "resolved",
  };

  const toWin = c.config.bishops.toWin;
  const finalClash = next.remaining.length === 0 ||
    (next.round === c.config.rounds && next.clashInRound === challengesInRound(c, next.round));
  if (next.creed.length === c.slots.length) next = { ...next, phase: "over", result: "perfect" };
  else if (next.bishops.arius >= toWin) next = { ...next, phase: "over", result: "loss" };
  else if (finalClash) next = { ...next, phase: "over", result: next.bishops.player >= toWin ? "win" : "loss" };
  return next;
}

/** After the explanation popup: the next challenge in this round, or the next round. */
export function advance(c: Content, s: MatchState): MatchState {
  if (s.phase !== "resolved") throw new Error("nothing to advance");
  let next: MatchState = { ...s, phase: "respond", current: null };
  if (s.clashInRound < challengesInRound(c, s.round)) {
    next.clashInRound += 1;
  } else {
    next.round += 1;
    next.clashInRound = 1;
    next.grace = graceForRound(c, next.round);
    next = draw(c, next, c.config.hand.drawPerRound);
  }
  return pickChallenge(c, next);
}

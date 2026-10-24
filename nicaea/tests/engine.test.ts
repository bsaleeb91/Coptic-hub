import { describe, expect, it } from "vitest";
import {
  advance, canAfford, canSearch, challengeById, classify, graceForRound, moveBishops, search,
  newMatch, respond, totalClashes,
} from "../src/engine/match";
import type { Card, Challenge, Config, Content, MatchState } from "../src/engine/types";
import { content as real } from "../src/content";

// ---------------------------------------------------------------- fixture

const config: Config = {
  scriptureTranslation: "TEST", scriptureNotice: "",
  rounds: 3, doubleChallengeRounds: [3],
  grace: { start: 3, perRound: 1, max: 4 },
  bishops: { total: 318, startPlayer: 30, startArius: 30, toWin: 160 },
  swing: { correctBase: 20, correctPerPower: 2, partialPerPower: 2, ariusPerPower: 4 },
  hand: { start: 5, drawPerRound: 2, max: 7 },
  search: { cost: 1 },
  ai: { preferUnanswerable: 1 },
};
const card = (id: string, cost: number, power: number, themes: string[]): Card => ({
  id, name: id, type: "scripture", cost, power, text: "", flavor: "", scriptureRef: null,
  themes, explanation: "", quote: null, citation: "x", verify: false, isTradition: false, approved: true,
});
const challenge = (id: string, power: number, themes: string[], counters: string[], slot: string): Challenge => ({
  id, name: id, type: "challenge", kind: "slogan", cost: 0, power, text: "", flavor: "",
  scriptureRef: null, themes, counters, unlocksSlot: slot, explanation: "", quote: null,
  citation: "x", verify: false, isTradition: false, approved: true,
});
const fixture: Content = {
  config,
  cards: [
    card("a", 2, 4, ["eternity"]), card("b", 2, 4, ["creator"]), card("c", 2, 4, ["divinity"]),
    card("d", 2, 4, ["incarnation"]), card("e", 1, 3, ["eternity"]), card("pricey", 9, 9, ["none"]),
  ],
  challenges: [
    challenge("x1", 5, ["eternity"], ["a"], "s1"),
    challenge("x2", 5, ["creator"], ["b"], "s2"),
    challenge("x3", 5, ["divinity"], ["c"], "s3"),
    challenge("x4", 5, ["incarnation"], ["d"], "s4"),
  ],
  slots: ["s1", "s2", "s3", "s4"].map((id, i) => ({ id, order: i + 1, phrase: id, guardsAgainst: "", approved: true })),
};

/** Put a known hand in place so tests don't depend on the shuffle. */
const withHand = (s: MatchState, hand: string[], current = s.current): MatchState => ({ ...s, hand, current });

const total = (s: MatchState) => s.bishops.player + s.bishops.arius + s.bishops.undecided;

// ---------------------------------------------------------------- tests

describe("Grace", () => {
  it("starts at 3, grows by 1 each round, and caps at the max", () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => graceForRound(real, r))).toEqual([3, 4, 5, 6, 7, 8]);
    expect(graceForRound(real, 20)).toBe(8);
  });

  it("is spent when a card is played and refills next round", () => {
    let s = withHand(newMatch(fixture, 1), ["a", "b"], "x1");
    s = respond(fixture, s, "a");
    expect(s.grace).toBe(1);
    s = advance(fixture, s);
    expect(s.grace).toBe(4);
  });

  it("won't let you play a card you can't afford", () => {
    const s = withHand(newMatch(fixture, 1), ["pricey"], "x1");
    expect(canAfford(fixture, s, "pricey")).toBe(false);
    expect(() => respond(fixture, s, "pricey")).toThrow(/Grace/);
  });
});

describe("Clash resolution", () => {
  it("classifies correct, partial and miss", () => {
    expect(classify(fixture, "x1", "a")).toBe("correct");
    expect(classify(fixture, "x1", "e")).toBe("partial"); // shares 'eternity'
    expect(classify(fixture, "x1", "b")).toBe("miss");
    expect(classify(fixture, "x1", null)).toBe("miss");
  });

  it("a correct counter wins 20 + 2×power bishops and fills the Creed slot", () => {
    const s = respond(fixture, withHand(newMatch(fixture, 1), ["a"], "x1"), "a");
    expect(s.last).toMatchObject({ outcome: "correct", playerGain: 28, ariusGain: 0, slotFilled: "s1" });
    expect(s.bishops.player).toBe(58);
    expect(s.creed).toEqual(["s1"]);
  });

  it("a partial counter wins 2×power bishops and no slot", () => {
    const s = respond(fixture, withHand(newMatch(fixture, 1), ["e"], "x1"), "e");
    expect(s.last).toMatchObject({ outcome: "partial", playerGain: 6, slotFilled: null });
    expect(s.creed).toEqual([]);
  });

  it("passing gives Arius 4×power bishops", () => {
    const s = respond(fixture, withHand(newMatch(fixture, 1), ["a"], "x1"), null);
    expect(s.last).toMatchObject({ outcome: "miss", ariusGain: 20, cardId: null });
    expect(s.bishops.arius).toBe(50);
    expect(s.hand).toEqual(["a"]);
  });

  it("takes bishops from the undecided first, then from the other side", () => {
    const [b, moved] = moveBishops({ player: 100, arius: 10, undecided: 5 }, "player", 12);
    expect(b).toEqual({ player: 112, arius: 3, undecided: 0 });
    expect(moved).toBe(12);
  });

  it("never creates or loses bishops", () => {
    let s = newMatch(real, 7);
    while (s.phase !== "over") {
      s = respond(real, s, s.hand.find((id) => canAfford(real, s, id)) ?? null);
      expect(total(s)).toBe(318);
      if (s.phase === "resolved") s = advance(real, s);
    }
  });
});

describe("Rounds", () => {
  it("plays one challenge per round, two in the double rounds", () => {
    let s = newMatch(fixture, 3);
    const seen: [number, number][] = [];
    while (s.phase !== "over") {
      seen.push([s.round, s.clashInRound]);
      s = respond(fixture, s, null);
      if (s.phase === "resolved") s = advance(fixture, s);
    }
    expect(seen).toEqual([[1, 1], [2, 1], [3, 1], [3, 2]]);
  });

  it("the real config gives exactly one clash per Arius card", () => {
    expect(totalClashes(real)).toBe(real.challenges.length);
  });

  it("each challenge appears exactly once", () => {
    let s = newMatch(real, 11);
    const ids: string[] = [];
    while (s.phase !== "over") {
      ids.push(s.current!);
      s = respond(real, s, null);
      if (s.phase === "resolved") s = advance(real, s);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws 5 to start, then 2 per round, up to 7", () => {
    let s = newMatch(real, 5);
    expect(s.hand.length).toBe(5);
    s = advance(real, respond(real, s, null));
    expect(s.hand.length).toBe(7);
    s = advance(real, respond(real, s, null));
    expect(s.hand.length).toBe(7);
  });
});

describe("Win and loss", () => {
  it("filling every Creed slot is an immediate perfect win", () => {
    let s = newMatch(fixture, 1);
    while (s.phase !== "over") {
      const answer = challengeById(fixture, s.current!).counters[0];
      s = respond(fixture, { ...s, hand: [answer], grace: 9 }, answer);
      if (s.phase === "resolved") s = advance(fixture, s);
    }
    expect(s.result).toBe("perfect");
    expect(s.creed.length).toBe(4);
  });

  it("Arius reaching 160 is an immediate loss", () => {
    const strong: Content = { ...fixture, challenges: fixture.challenges.map((x) => ({ ...x, power: 40 })) };
    const s = respond(strong, newMatch(strong, 1), null);
    expect(s.phase).toBe("over");
    expect(s.result).toBe("loss");
  });

  it("at the end, 160+ bishops is a win and fewer is a loss", () => {
    const run = (startPlayer: number) => {
      const c: Content = { ...fixture, config: { ...config, bishops: { ...config.bishops, startPlayer, startArius: 0 },
        swing: { ...config.swing, ariusPerPower: 0 } } };
      let s = newMatch(c, 1);
      while (s.phase !== "over") { s = respond(c, s, null); if (s.phase === "resolved") s = advance(c, s); }
      return s.result;
    };
    expect(run(160)).toBe("win");
    expect(run(159)).toBe("loss");
  });
});

describe("Arius (Normal)", () => {
  it("prefers a challenge the player can't answer right now", () => {
    const s0 = newMatch(fixture, 1);
    // Hand answers x1, x2, x3 but not x4.
    const s = advance(fixture, { ...s0, phase: "resolved", hand: ["a", "b", "c"], remaining: ["x1", "x2", "x3", "x4"], deck: [] });
    expect(s.current).toBe("x4");
  });

  it("is deterministic for a given seed", () => {
    const play = (seed: number) => {
      let s = newMatch(real, seed);
      const ids: string[] = [];
      while (s.phase !== "over") {
        ids.push(s.current!);
        s = respond(real, s, s.hand.find((id) => canAfford(real, s, id)) ?? null);
        if (s.phase === "resolved") s = advance(real, s);
      }
      return ids.join(",");
    };
    expect(play(42)).toBe(play(42));
    expect(play(42)).not.toBe(play(43));
  });
});

describe("Search the Scriptures", () => {
  it("spends Grace to draw one card, even past the hand limit", () => {

    let s = { ...newMatch(fixture, 1), hand: ["a", "b", "c", "d", "e", "pricey", "a"], deck: ["b"], grace: 3 };
    expect(canSearch(fixture, s)).toBe(true);
    s = search(fixture, s);
    expect(s.hand.length).toBe(8);
    expect(s.grace).toBe(2);
  });

  it("isn't allowed without enough Grace or with nothing left to draw", () => {

    const s = newMatch(fixture, 1);
    expect(canSearch(fixture, { ...s, grace: 0 })).toBe(false);
    expect(canSearch(fixture, { ...s, deck: [], discard: [] })).toBe(false);
  });
});

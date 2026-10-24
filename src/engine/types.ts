export type Quote = {
  text: string;
  work: "csmv" | "orations";
  discourse?: number;
  section: number;
} | null;

export type Card = {
  id: string;
  name: string;
  type: "scripture" | "argument";
  cost: number;
  power: number;
  text: string;
  flavor: string;
  scriptureRef: string | null;
  themes: string[];
  explanation: string;
  quote: Quote;
  citation: string;
  verify: boolean;
  isTradition: boolean;
  approved: boolean;
};

export type Challenge = Omit<Card, "type"> & {
  type: "challenge";
  kind: "scripture" | "slogan";
  counters: string[];
  unlocksSlot: string;
  note?: string;
};

export type Slot = {
  id: string;
  order: number;
  phrase: string;
  guardsAgainst: string;
  approved: boolean;
};

export type Config = {
  scriptureTranslation: string;
  scriptureNotice: string;
  rounds: number;
  doubleChallengeRounds: number[];
  grace: { start: number; perRound: number; max: number };
  bishops: { total: number; startPlayer: number; startArius: number; toWin: number };
  swing: { correctBase: number; correctPerPower: number; partialPerPower: number; ariusPerPower: number };
  hand: { start: number; drawPerRound: number; max: number };
  search: { cost: number };
  ai: { preferUnanswerable: number };
};

export type Content = {
  cards: Card[];
  challenges: Challenge[];
  slots: Slot[];
  config: Config;
};

export type Outcome = "correct" | "partial" | "miss";

export type Clash = {
  challengeId: string;
  cardId: string | null; // null = passed
  outcome: Outcome;
  playerGain: number;
  ariusGain: number;
  slotFilled: string | null;
};

export type Bishops = { player: number; arius: number; undecided: number };

export type Result = "perfect" | "win" | "loss";

export type MatchState = {
  seed: number;
  rng: number;
  round: number;
  clashInRound: number;
  grace: number;
  hand: string[];
  deck: string[];
  discard: string[];
  bishops: Bishops;
  creed: string[];
  remaining: string[];
  current: string | null;
  phase: "respond" | "resolved" | "over";
  last: Clash | null;
  history: Clash[];
  result: Result | null;
};

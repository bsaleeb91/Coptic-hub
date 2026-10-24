import cardsFile from "../../data/cards.json";
import ariusFile from "../../data/arius-deck.json";
import creedFile from "../../data/creed.json";
import configFile from "../../data/config.json";
import type { Card, Challenge, Config, Content, Quote, Slot } from "../engine/types";

export const content: Content = {
  cards: cardsFile.cards as Card[],
  challenges: ariusFile.cards as Challenge[],
  slots: (creedFile.slots as Slot[]).slice().sort((a, b) => a.order - b.order),
  config: configFile as Config,
};

export const creed = {
  fullText: creedFile.fullText,
  source: creedFile.source,
  laterNote: creedFile.laterNote,
};

/** True while any card or slot still waits for the teacher's approval. */
export const isDraft = [...content.cards, ...content.challenges, ...content.slots].some((x) => !x.approved);

export function quoteSource(q: NonNullable<Quote>): string {
  if (q.work === "csmv") return `St. Athanasius, On the Incarnation §${q.section}`;
  return `St. Athanasius, Against the Arians ${["", "I", "II", "III", "IV"][q.discourse ?? 0]}.${q.section}`;
}

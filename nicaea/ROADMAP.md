# Roadmap

Last updated 2026-10-23. Live (draft): https://nicaea-iota.vercel.app

## Where things stand

| Phase | Status |
|---|---|
| 0. Plan | Done. MVP scope agreed (see Decisions). |
| 1. Content | Built: 21 player cards, 8 Arius challenges, 8 Creed slots. **Awaiting teacher review: 0 of 37 approved.** |
| 2. Playable prototype | Done. Full match on a phone, rules engine with 20 tests, deployed. |
| 3. Polish | Not started. |
| 4. Leaderboard / two-player | Only when asked. |

## Next up (in order)

### 1. Make the answers match Arius's claims (proposed, awaiting OK)
Playtest feedback: what Arius says doesn't clearly line up with the cards that
answer him. The cards say what they are about, not how they answer. Audit:

**Clear:** Firstborn → By Him All Things / The Only-Begotten. Once He Was Not →
In the Beginning / Light and Its Shine. The Only True God → This Is the True God.
Not Even the Son Knows → Spoken as Man. Greater Than I → I and My Father Are One.
From Nothing → All Things Through Him.

**Unclear or weak:**
| Arius says | Answer card | Problem |
|---|---|---|
| "The Lord created me" | The Word Became Flesh | The point ("created" = His body) isn't on the card |
| "God made Him Lord" | Radiance of His Glory | Nothing links "shine" to "made Lord" |
| "God made Him Lord" | The King in the City | Same |
| Greater Than I | The Restored Portrait | Hard to see how it answers "greater" |
| From Nothing | Death Trampled | About death, not where the Son came from |
| Not Even the Son Knows | God Became Man | Works only if you already know the answer |

Also: Arius's Proverbs card assumes players know the Son is "Wisdom" (add
1 Cor 1:24), and the NKJV's "firstborn *over* all creation" argues against
Arius on his own card.

Proposed fix:
- [ ] Rewrite each answer card's `text` to state the point it makes against Arius
      (e.g. Word Became Flesh: "'Created'? That's His human body, not His Godhead.")
- [ ] Death Trampled and Restored Portrait: partial credit only, not correct answers
- [ ] Add the 1 Corinthians 1:24 line to the Proverbs challenge
- [ ] Show the new text in CONTENT_REVIEW.md before it goes in the game

### 2. Teacher content review
- [ ] Read CONTENT_REVIEW.md, set `"approved": true` card by card
- [ ] Settle the judgment calls listed at the top of CONTENT_REVIEW.md
      (John 14:28 reading, Proverbs 8:22, Acts 2:36 slot, §54 wording, Colossians NKJV)
- The DRAFT banner disappears automatically once everything is approved.

### 3. Balance decisions (after a few playtests)
Simulation, 2000 matches per bot (`npm run simulate`):
- A player who always knows the answer wins 90%, perfect Creed 2%.
- A player who plays random cards wins 0%.
- [ ] Starting Grace 3 (brief) or 4? With 4, expert losses drop 9% → 2% and
      perfect games rise to 5%. One number in `data/config.json`.
- [ ] Is a 2% perfect-Creed rate too rare?

### 4. Who can open the link
- [ ] https://nicaea-iota.vercel.app is public (Vercel made the first deploy
      production). Keep it, or lock it behind Vercel login until content is approved.

## Phase 3: Polish
Cut from the MVP, to bring back based on how the boys respond:
- [ ] Art direction: richer card frames, Coptic border patterns, figure art for Witness cards
- [ ] Witness cards (Alexander, Hosius, Paphnutius, Spyridon; St. Nicholas labeled as tradition)
- [ ] Event cards (Constantine demands unity, a wavering bishop, a late delegation)
- [ ] Interactive tutorial (one guided round, under 2 minutes) to replace the 3 how-to screens
- [ ] Codex: library of every card's explanation and citation, unlocked by playing, plus the full 325 Creed
- [ ] Campaign: Act 1 Alexandria, Act 2 Opening of the Council, Act 3 The Vote, with short story text
- [ ] End-of-campaign screen on the 381 Creed of Constantinople
- [ ] Hard AI: tracks the counters you've used and plays around them
- [ ] Installable app (PWA), fully playable offline
- [ ] Save progress (campaign, Codex unlocks) on the phone
- [ ] Optional sound effects, off by default

Small polish noticed while testing:
- [ ] When you tap a card, scroll it fully into view in the hand
- [ ] Make it more obvious that the hand scrolls sideways
- [ ] Explanation popup is long on small phones; consider trimming

## Phase 4: Only when asked
- Shared leaderboard (fastest Creed victory, most bishops)
- Pass-and-play or online two-player

## Decisions so far
| Date | Decision |
|---|---|
| 2026-10-23 | For kids to play on their own time (not a classroom). MVP first: Quick Match only. |
| 2026-10-23 | Exact quotes from the C.S.M.V. translation of *On the Incarnation*; *Against the Arians* (NPNF) for answers to specific verses. Quotes verified word for word by `npm run validate`. |
| 2026-10-23 | Scripture in the NKJV, fetched from Bible Gateway and verified by the validator. Thomas Nelson notice shown in the game. |
| 2026-10-23 | Cite *On the Incarnation* by section (§1-57), not chapter. |
| 2026-10-23 | Rounds 5-6 have two challenges each, so 8 clashes fill 8 Creed slots. |
| 2026-10-23 | Citations flagged `verify` are hidden in the game. |
| 2026-10-23 | Only the teacher sets `approved: true`. Machine checks cover quotes and verses, not theology. |
| 2026-10-23 | Added "Search" (1 Grace: draw a card) after simulation showed luck outweighed knowledge. |

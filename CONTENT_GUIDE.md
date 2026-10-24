# How to edit the cards

All game content is in four files in `data/`. You can edit them in any text
editor. After any change, run `npm run validate`, then `npm run review` to
refresh `CONTENT_REVIEW.md`.

| File | What's in it |
|---|---|
| `data/cards.json` | Your cards: Scripture and Athanasius arguments |
| `data/arius-deck.json` | Arius's challenges, their correct counters, and the popup explanation |
| `data/creed.json` | The 325 Creed text and the 8 board slots |
| `data/config.json` | Game numbers: rounds, Grace, bishops, swing sizes |

## Approving a card

Every card and Creed slot has `"approved": false`. When you've read it and it's
right, change it to `"approved": true`. Only you do this. Claude never sets it.
`npm run validate` prints how many items are still waiting.

## Card fields

| Field | Meaning |
|---|---|
| `id` | Unique name the game uses internally. Don't change it once cards point to it. |
| `name` | Title shown on the card |
| `type` | `scripture` or `argument` (Arius's cards are `challenge`) |
| `cost` | Grace needed to play it (0-8) |
| `power` | How strong it is (1-10). For Arius, how many bishops he wins if unanswered. |
| `text` | One short line of game text |
| `flavor` | The italic line: the verse (NKJV, checked against `sources/nkjv-verses.json`) or the exact Athanasius quote |
| `scriptureRef` | e.g. `"John 1:3"`, or `null` for arguments and slogans |
| `themes` | Tags like `eternity`, `creator`, `divinity`, `incarnation`, `essence`, `sonship`, `salvation`. A card sharing a theme with Arius's challenge, without being the right answer, earns partial credit. |
| `explanation` | 2-3 short sentences, 8th-grade level |
| `quote` | The exact Athanasius line backing the card, or `null`. `work` is `csmv` (On the Incarnation, with `section` 1-57) or `orations` (Against the Arians, with `discourse` 1-4 and `section`). The validator checks the words are really in that section. |
| `citation` | The reference shown to players |
| `verify` | `true` if a citation still needs checking. The game hides citations flagged this way. |
| `isTradition` | `true` for legends; flavor must then start with "Tradition holds…" |
| `approved` | Your sign-off (see above) |

Arius cards also have `counters` (list of player card `id`s that answer it
correctly), `unlocksSlot` (the Creed slot `id` it unlocks), and an optional
`note` for you that players never see.

## Adding a card

Copy an existing card in the same file, give it a new `id`, change the fields,
and run `npm run validate`. If a quote is wrong or in the wrong section, the
validator says so and tells you which section it's actually in.

# Bible Feud

A Family Feud–style Bible game for a classroom, built as one self-contained HTML file.
No internet, no install, no dependencies — open `bible-feud.html` in any browser.

## Running it

1. Download `bible-feud.html` onto the classroom laptop.
2. Double-click it. Any browser works.
3. Click **Fullscreen** and mirror to the projector.

It works offline, so a dead Wi-Fi connection can't take the lesson down.

## Hosting the game

- Click a team's name to rename it (e.g. "St. Mary" vs "St. Mark").
- Press **Q** or **W** to give a team control after the face-off.
- Click an answer tile — or press its number — to reveal it.
- Press **X** for a strike. Three strikes opens the steal.
- Press **A** or **S** to bank the pot for a team, then **N** for the next question.
- **Undo** (**Z**) reverses the last reveal, strike, or award.
- **Reveal rest** shows the answers nobody got. Those tiles are dimmed and never
  add to the pot.

Questions 1–5 score ×1, 6–10 score ×2, 11–14 score ×3. Override with the ×1 / ×2 / ×3 buttons.

**Answer key** opens a full list of every question, answer, point value, and scripture
reference. It covers the whole screen, so close it before the class looks up.

## Fast Money

Five rapid questions, two students. Player 1 answers, then Player 2. Click the answer
the student gave, or "No match / pass" for zero. Player 1's column stays blurred while
Player 2 plays, and any answer Player 1 already used is greyed out as a duplicate.
Target is 200 combined. Timers are 20 seconds and 25 seconds.

## Content

Fourteen main boards and five Fast Money questions, covering the disciples, the plagues,
Jesus' miracles, Noah's ark, the Ten Commandments, the fruit of the Spirit, the armor of
God, women of the Bible, New Testament books, animals, angel encounters, Moses, the words
from the cross, and the kings.

Every board's answers total 100 points. Point values are a scoring scheme for the game,
not results of a real survey. Each question carries a scripture reference in the answer key
so a disputed answer can be settled from the text.

To change the questions, edit the `ROUNDS` and `FAST` arrays near the top of the `<script>`
block. Each answer is `["Answer text", points]`. Keep each board's points summing to 100,
and use six to eight answers per board.

import { useState } from "preact/hooks";
import { content, creed, isDraft } from "../content";
import type { MatchState } from "../engine/types";
import { CreedBoard } from "./Modals";

/** An original Coptic-style cross: equal arms, each ending in three gold balls. */
export function CopticCross({ size = 72 }: { size?: number }) {
  const arm = (r: number) => (
    <g transform={`rotate(${r} 50 50)`}>
      <path d="M43 50 L43 18 L57 18 L57 50 Z" fill="currentColor" />
      <circle cx="50" cy="11" r="5" /><circle cx="40" cy="15" r="4" /><circle cx="60" cy="15" r="4" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ color: "var(--gold)", fill: "var(--gold)" }}>
      {[0, 90, 180, 270].map(arm)}
      <circle cx="50" cy="50" r="9" fill="var(--red)" stroke="var(--gold)" stroke-width="3" />
    </svg>
  );
}

const Draft = () => (isDraft ? <div class="draft">DRAFT: cards are still awaiting the teacher's review.</div> : null);

export function Title({ onPlay, onHowTo }: { onPlay: () => void; onHowTo: () => void }) {
  return (
    <div class="title-screen">
      <Draft />
      <div style={{ marginTop: 24 }}><CopticCross /></div>
      <h1>NICAEA</h1>
      <div class="year">A.D. 325</div>
      <div class="band" />
      <p class="tag">Arius quotes Scripture. You answer it rightly. Win the council and build the Creed.</p>
      <div class="stack">
        <button class="btn primary" onClick={onPlay}>Play</button>
        <button class="btn" onClick={onHowTo}>How to play</button>
      </div>
      <div class="credits">
        <p>{content.config.scriptureNotice}</p>
        <p>Quotations from St. Athanasius, <i>On the Incarnation</i>, translated by a Religious of C.S.M.V.; and <i>Against the Arians</i> and the Creed of 325 from the <i>Nicene and Post-Nicene Fathers</i>.</p>
      </div>
    </div>
  );
}

const pages = [
  {
    title: "Arius speaks first",
    body: (
      <ul>
        <li>The year is 325. You are Athanasius, a young deacon at the Council of Nicaea.</li>
        <li>Arius teaches that the Son of God was <b>created</b>, that "once He was not."</li>
        <li>He quotes real verses. Each round he plays a challenge card. Read it carefully.</li>
      </ul>
    ),
  },
  {
    title: "Answer him rightly",
    body: (
      <ul>
        <li>Play one card from your hand. Cards cost <b>Grace</b> (the gold number).</li>
        <li><b>The right answer</b> wins about 28 bishops and fills a line of the Creed.</li>
        <li><b>A related card</b> wins a few. <b>A wrong card or a pass</b> lets Arius win bishops.</li>
        <li>Don't have the answer? <b>Search the Scriptures</b>: spend 1 Grace to draw a card.</li>
      </ul>
    ),
  },
  {
    title: "Win the council",
    body: (
      <ul>
        <li>There are 318 bishops. Win <b>160</b> by the end of round 6.</li>
        <li>If Arius reaches 160 first, he wins.</li>
        <li>Fill all <b>8 lines of the Creed</b> for a perfect victory.</li>
        <li>After every clash you'll see why the answer is right, from Scripture and St. Athanasius.</li>
      </ul>
    ),
  },
];

export function HowTo({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const page = pages[i];
  return (
    <div class="howto">
      <div class="panel">
        <h2>{page.title}</h2>
        {page.body}
      </div>
      <div class="dots" aria-label={`Page ${i + 1} of ${pages.length}`}>
        {pages.map((_, k) => <span key={k} class={k === i ? "on" : ""} />)}
      </div>
      <div class="row">
        {i > 0 ? <button class="btn ghost" onClick={() => setI(i - 1)}>Back</button> : <button class="btn ghost" onClick={onDone}>Skip</button>}
        {i < pages.length - 1
          ? <button class="btn primary" onClick={() => setI(i + 1)}>Next</button>
          : <button class="btn primary" onClick={onDone}>Start</button>}
      </div>
    </div>
  );
}

export function End({ state: s, onAgain, onTitle }: { state: MatchState; onAgain: () => void; onTitle: () => void }) {
  const head = {
    perfect: ["The Creed Is Complete!", "Every line filled. The faith of the Apostles is confessed."],
    win: ["The Council Is Won", `${s.bishops.player} bishops stand with the faith of the Church.`],
    loss: ["Arius Carried the Council", `You won ${s.bishops.player} bishops. You needed ${content.config.bishops.toWin}.`],
  }[s.result!];
  const correct = s.history.filter((h) => h.outcome === "correct").length;
  return (
    <div class="end">
      <Draft />
      <CopticCross size={56} />
      <h1 class={s.result === "loss" ? "loss" : ""}>{head[0]}</h1>
      <p class="sub">{head[1]}</p>
      <p>You answered {correct} of {s.history.length} challenges rightly.</p>
      <div class="band" />
      <h2 style={{ color: "var(--gold)", fontSize: 20, margin: "10px 0" }}>Your Creed</h2>
      <CreedBoard filled={s.creed} />
      <div class="note">{creed.laterNote}</div>
      <div class="row">
        <button class="btn" onClick={onTitle}>Title</button>
        <button class="btn primary" onClick={onAgain}>Play again</button>
      </div>
      <div class="seed">Match #{s.seed}</div>
    </div>
  );
}

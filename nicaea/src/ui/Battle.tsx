import { useState } from "preact/hooks";
import { content } from "../content";
import { advance, canAfford, canSearch, challengeById, challengesInRound, respond, search } from "../engine/match";
import type { MatchState } from "../engine/types";
import { CardView } from "./CardView";
import { ClashPopup, CreedBoard, Modal } from "./Modals";

type Props = { state: MatchState; setState: (s: MatchState) => void; onEnd: () => void; onQuit: () => void };

export function Battle({ state: s, setState, onEnd, onQuit }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [showCreed, setShowCreed] = useState(false);
  const { config } = content;

  const ch = s.current ? challengeById(content, s.current) : null;
  const sel = selected && s.hand.includes(selected) ? content.cards.find((c) => c.id === selected)! : null;

  const play = (cardId: string | null) => { setSelected(null); setState(respond(content, s, cardId)); };
  const doSearch = () => {
    const next = search(content, s);
    const drawn = next.hand.find((id) => !s.hand.includes(id)) ?? null;
    setFresh(drawn); setSelected(drawn); setState(next);
  };
  const cont = () => {
    if (s.phase === "over") onEnd();
    else { setFresh(null); setState(advance(content, s)); }
  };

  const total = config.bishops.total;
  const pct = (n: number) => `${(100 * n) / total}%`;
  const goal = config.bishops.toWin;
  const double = challengesInRound(content, s.round) === 2;

  return (
    <div>
      <div class="topbar">
        <span class="who">ARIUS</span>
        <span class="round">Round {s.round} of {config.rounds}{double ? ` · challenge ${s.clashInRound} of 2` : ""}</span>
        <button class="icon-btn" onClick={onQuit} aria-label="Quit to title">✕</button>
      </div>

      {ch && (
        <section class="challenge" aria-live="polite">
          <div class="label">Arius challenges</div>
          <h3>{ch.name}</h3>
          <div class="verse">“{ch.flavor}”</div>
          <div class="ref">{ch.scriptureRef ?? "Arian slogan"}</div>
          <div class="claim">{ch.text}</div>
        </section>
      )}

      <div class="meter" aria-label={`Bishops: you ${s.bishops.player}, undecided ${s.bishops.undecided}, Arius ${s.bishops.arius}. ${goal} needed to win.`}>
        <div class="bar">
          <div class="you" style={{ width: pct(s.bishops.player) }} />
          <div class="undecided" />
          <div class="arius" style={{ width: pct(s.bishops.arius) }} />
          <div class="goal" style={{ left: pct(goal) }} />
        </div>
        <div class="nums">
          <span>You <b class="you-n">{s.bishops.player}</b> / {goal}</span>
          <span>{s.bishops.undecided} undecided</span>
          <span><b class="ar-n">{s.bishops.arius}</b> Arius</span>
        </div>
      </div>

      <div class="status">
        <button class="creed-strip" onClick={() => setShowCreed(true)} aria-label={`Creed: ${s.creed.length} of ${content.slots.length} lines filled. Open the Creed board.`}>
          <span>Creed</span>
          {content.slots.map((slot) => <span key={slot.id} class={"pip" + (s.creed.includes(slot.id) ? " on" : "")} />)}
        </button>
      </div>

      <div class="hand-label">
        <span>Your hand ({s.hand.length})</span>
        <div class="grace" aria-label={`${s.grace} Grace`}>
          Grace <b>{s.grace}</b> {Array.from({ length: config.grace.max }, (_, i) => <span key={i} class={"gem" + (i < s.grace ? " on" : "")} />)}
        </div>
      </div>
      <div class="hand" role="group" aria-label="Your hand">
        {s.hand.map((id) => {
          const card = content.cards.find((c) => c.id === id)!;
          return (
            <CardView key={id} card={card} selected={selected === id} fresh={fresh === id}
              affordable={canAfford(content, s, id)} onSelect={() => setSelected(selected === id ? null : id)} />
          );
        })}
      </div>

      <div class="detail">
        {sel ? (
          <>
            <div class="q">“{sel.flavor}”</div>
            {!canAfford(content, s, sel.id) && <div class="muted">Needs {sel.cost} Grace. You have {s.grace}.</div>}
          </>
        ) : (
          <div class="muted">Tap a card to read it. Find the card that answers Arius.</div>
        )}
      </div>

      <div class="actions">
        <button class="btn" onClick={doSearch} disabled={!canSearch(content, s) || s.phase !== "respond"}>
          Search<small class="sub">draw a card · {config.search.cost} Grace</small>
        </button>
        <button class="btn ghost" onClick={() => play(null)} disabled={s.phase !== "respond"}>Pass</button>
        <button class="btn primary play" onClick={() => sel && play(sel.id)}
          disabled={!sel || !canAfford(content, s, sel.id) || s.phase !== "respond"}>
          {sel ? `Play ${sel.name}` : "Choose a card"}
        </button>
      </div>

      {s.phase !== "respond" && s.last && <ClashPopup clash={s.last} onContinue={cont} last={s.phase === "over"} />}

      {showCreed && (
        <Modal label="The Creed">
          <h2 style={{ color: "var(--gold)" }}>The Creed of Nicaea</h2>
          <p class="cite">Each line is won by answering one of Arius's challenges.</p>
          <CreedBoard filled={s.creed} />
          <button class="btn primary wide" onClick={() => setShowCreed(false)}>Back to the council</button>
        </Modal>
      )}
    </div>
  );
}

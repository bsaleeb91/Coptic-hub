import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { content, quoteSource } from "../content";
import { challengeById } from "../engine/match";
import type { Clash, Quote } from "../engine/types";

export function Modal({ children, label }: { children: ComponentChildren; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div class="modal-back">
      <div class="modal" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        {children}
      </div>
    </div>
  );
}

const cardName = (id: string) => content.cards.find((c) => c.id === id)?.name ?? id;
const cardRef = (id: string) => {
  const c = content.cards.find((x) => x.id === id);
  return c?.scriptureRef ? `${c.name} (${c.scriptureRef})` : `${c?.name} (Athanasius)`;
};

/** Citation line; hidden while the card is flagged verify (unconfirmed). */
function Citation({ quote, citation, verify }: { quote: Quote; citation: string; verify: boolean }) {
  return (
    <>
      {quote && <blockquote>"{quote.text}"</blockquote>}
      {quote && <div class="cite">— {quoteSource(quote)}</div>}
      {!quote && !verify && <div class="cite">{citation}</div>}
    </>
  );
}

export function ClashPopup({ clash, onContinue, last }: { clash: Clash; onContinue: () => void; last: boolean }) {
  const ch = challengeById(content, clash.challengeId);
  const slot = clash.slotFilled ? content.slots.find((s) => s.id === clash.slotFilled) : null;
  const heading = { correct: "The council is moved!", partial: "A good point…", miss: clash.cardId ? "That doesn't answer him." : "You stayed silent." }[clash.outcome];
  return (
    <Modal label={heading}>
      <h2 class={clash.outcome}>{heading}</h2>
      <div class="swing">
        {clash.playerGain > 0 && <span style={{ color: "var(--lapis-hi)" }}>+{clash.playerGain} bishops to you</span>}
        {clash.ariusGain > 0 && <span style={{ color: "var(--red-hi)" }}>+{clash.ariusGain} bishops to Arius</span>}
      </div>

      {slot && (
        <div class="creed-fill" role="status">
          <div class="kicker">The Creed grows</div>
          <div class="phrase">"{slot.phrase}"</div>
          <div class="guards">{slot.guardsAgainst}</div>
        </div>
      )}

      {clash.outcome !== "correct" && (
        <div class="answer">
          <b>{clash.outcome === "partial" ? "Close, but the best answer was: " : "The answer: "}</b>
          {ch.counters.map(cardRef).join(" · ")}
        </div>
      )}

      <p><b>{ch.scriptureRef ?? "“" + ch.flavor + "”"}</b>{ch.scriptureRef ? " — " : " "}{ch.explanation}</p>
      <Citation quote={ch.quote} citation={ch.citation} verify={ch.verify} />

      <div class="sticky-foot">
        <button class="btn primary wide" onClick={onContinue}>{last ? "See the result" : "Continue"}</button>
      </div>
    </Modal>
  );
}

export function CreedBoard({ filled }: { filled: string[] }) {
  return (
    <ol class="board">
      {content.slots.map((s) => {
        const on = filled.includes(s.id);
        const by = content.challenges.find((c) => c.unlocksSlot === s.id);
        return (
          <li class={on ? "on" : ""} key={s.id}>
            <span class="n">{s.order}.</span><span class="p">{s.phrase}</span>
            <div class="g">{on ? s.guardsAgainst : `Answer “${by?.name}” correctly to fill this line.`}</div>
          </li>
        );
      })}
    </ol>
  );
}

export { cardName };

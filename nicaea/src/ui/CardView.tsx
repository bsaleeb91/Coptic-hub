import type { Card } from "../engine/types";

type Props = {
  card: Card;
  selected: boolean;
  affordable: boolean;
  fresh: boolean;
  onSelect: () => void;
};

export function CardView({ card, selected, affordable, fresh, onSelect }: Props) {
  const cls = ["card", card.type, selected && "selected", !affordable && "poor", fresh && "fresh"].filter(Boolean).join(" ");
  return (
    <button
      class={cls}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${card.name}, ${card.type}, costs ${card.cost} Grace, power ${card.power}${affordable ? "" : ", not enough Grace"}`}
    >
      <div class="head">
        <span class="kind">{card.type === "scripture" ? "Scripture" : "Athanasius"}</span>
        <span class="cost" aria-hidden="true">{card.cost}</span>
      </div>
      <div class="body">
        <div class="name">{card.name}</div>
        {card.scriptureRef && <div class="ref">{card.scriptureRef}</div>}
        <div class="txt">{card.text}</div>
        <div class="pow">Power {card.power}</div>
      </div>
    </button>
  );
}

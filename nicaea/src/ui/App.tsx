import { useState } from "preact/hooks";
import { content } from "../content";
import { newMatch } from "../engine/match";
import type { MatchState } from "../engine/types";
import { Battle } from "./Battle";
import { End, HowTo, Title } from "./Screens";

type Screen = "title" | "howto" | "battle" | "end";

const SEEN_KEY = "nicaea.seenHowTo";
const seenHowTo = () => { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode: fine */ } };

/** ?seed=123 replays a specific match (for bug reports). */
function pickSeed(): number {
  const fromUrl = Number(new URLSearchParams(location.search).get("seed"));
  if (Number.isInteger(fromUrl) && fromUrl > 0) return fromUrl;
  return 1 + Math.floor(Math.random() * 999999);
}

export function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [match, setMatch] = useState<MatchState | null>(null);

  const start = () => {
    if (!seenHowTo()) { setScreen("howto"); return; }
    setMatch(newMatch(content, pickSeed()));
    setScreen("battle");
    window.scrollTo(0, 0);
  };

  if (screen === "howto") return <HowTo onDone={() => { markSeen(); start(); }} />;
  if (screen === "battle" && match)
    return <Battle state={match} setState={setMatch} onEnd={() => { setScreen("end"); window.scrollTo(0, 0); }} onQuit={() => setScreen("title")} />;
  if (screen === "end" && match)
    return <End state={match} onAgain={start} onTitle={() => setScreen("title")} />;
  return <Title onPlay={start} onHowTo={() => setScreen("howto")} />;
}

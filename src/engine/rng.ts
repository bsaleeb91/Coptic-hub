// Small seeded random number generator (mulberry32). The state is a plain
// number kept in the match state, so a match replays exactly from its seed.
export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(next ^ (next >>> 15), 1 | next);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, next];
}

export function randomInt(state: number, n: number): [value: number, next: number] {
  const [v, next] = nextRandom(state);
  return [Math.floor(v * n), next];
}

export function shuffle<T>(items: T[], state: number): [T[], number] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = randomInt(s, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}

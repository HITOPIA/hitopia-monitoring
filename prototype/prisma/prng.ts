/** Deterministic PRNG (mulberry32) so the mock dataset is identical on every
 *  build — required for stable static-export params and reproducible demos. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number, dp = 1) => {
      const v = next() * (max - min) + min;
      const p = Math.pow(10, dp);
      return Math.round(v * p) / p;
    },
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

/** Deterministic pseudo-UUID generator (stable, demo-only — not RFC4122 random). */
export function uuidFactory(seed: number) {
  const rng = makeRng(seed);
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(rng.next() * 16).toString(16)).join("");
  return () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

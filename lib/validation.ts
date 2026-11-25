// Meridian Token Launch Radar — offline blind cross-validation (LOO, 10-fold, walk-forward) & 200-refit bootstrap.
// Runs in main.ts (Node 22, zero deps) using the exact fitSizeCurve() and fitLaunchOdds() from dashboard/model.js.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

interface ModelApi {
  ageDays(asOf: string, dt: string | null): number | null;
  hasTok(p: Protocol): boolean;
  median(a: number[]): number;
  cQuant(a: number[], q: number): number;
  placebo(slug: string): number;
  clamp(v: number, lo: number, hi: number): number;
  solveRidge(X: number[][], y: number[], lams: number[]): number[];
  fitSizeCurve(comps: Protocol[]): { alpha: number; betaTvl: number; capAt100M: number; predictLog(tvl: number): number };
  fitLaunchOdds(peers: Protocol[], asOf: string, med7d: number, cfg?: Record<string, number>): {
    predictProb(p: Protocol): number;
    conditionalOdds(p: Protocol, hYr?: number): { pNow: number; pFuture: number; odds: number };
  };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Leave-One-Out & strict Walk-Forward blind ablation ladder on conditional launch value. */
export function runValueValidation(model: ModelApi, comps: Protocol[], asOf: string, med7d: number) {
  const dated = comps
    .filter((p) => p.listed_at)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : cmp(a.slug, b.slug)));
  const sp = Math.floor(dated.length * 0.55);
  const wfTr = dated.slice(0, sp);
  const wfTe = dated.slice(sp);
  const specs: [string, string, string, Record<string, number>][] = [
    ['flat', 'Flat median cap / TVL', 'baseline', { flat: 1 }],
    ['size', '+ size curve (ln TVL)', 'kept', {}],
    ['cat', '+ category EB shrinkage', 'tested, not kept', { cat: 48 }],
    ['chains', '+ chain count (ln)', 'tested, not kept', { chains: 1 }],
    ['growth', '+ 7-day excess growth', 'tested, not kept', { growth: 1 }],
    ['age', '+ years listed (ln)', 'tested, not kept', { age: 1 }],
    ['placebo', '+ control: slug hash', 'must not help', { placebo: 1 }],
  ];
  const mkPred = (o: Record<string, number>) => (tr: Protocol[], te: Protocol) => {
    if (o.flat) return Math.log(te.tvl_usd * model.median(tr.map((p) => p.mcap_usd! / p.tvl_usd)));
    const dt = tr.map((p) => model.ageDays(asOf, p.listed_at)).filter((v): v is number => v !== null);
    const mA = model.median(dt.length ? dt : [365]);
    const f = (p: Protocol) => [
      1,
      Math.log(p.tvl_usd / 1e8),
      ...(o.chains ? [Math.log(Math.max(1, p.chains.length))] : []),
      ...(o.age ? [Math.log(((model.ageDays(asOf, p.listed_at) || mA) + 30) / 365)] : []),
      ...(o.growth ? [model.clamp(p.change_7d === null ? 0 : (p.change_7d - med7d) / 100, -0.5, 0.5)] : []),
      ...(o.placebo ? [model.placebo(p.slug)] : []),
    ];
    const lams = [0, 0.01, ...(o.chains ? [4] : []), ...(o.age ? [2] : []), ...(o.growth ? [2] : []), ...(o.placebo ? [0.5] : [])];
    const b = model.solveRidge(tr.map(f), tr.map((p) => Math.log(p.mcap_usd!)), lams);
    const pb = (p: Protocol) => f(p).reduce((s, v, i) => s + v * b[i]!, 0);
    let out = pb(te);
    if (o.cat) {
      const rs = tr.filter((p) => p.category === te.category).map((p) => Math.log(p.mcap_usd!) - pb(p));
      if (rs.length) out += (rs.length / (rs.length + o.cat)) * (rs.reduce((a, c) => a + c, 0) / rs.length);
    }
    return out;
  };
  const ladder = [];
  const looPredBySlug: Record<string, number> = {};
  let sLoo: number[] = [];
  let sWf: number[] = [];
  let wfTrLoo: number[] = [];
  for (const [id, label, status, o] of specs) {
    const fn = mkPred(o);
    const loo = comps.map((p, i) => {
      const pr = fn(comps.filter((_, j) => j !== i), p);
      if (id === 'size') looPredBySlug[p.slug] = Math.round(Math.exp(pr));
      return Math.log(p.mcap_usd!) - pr;
    });
    const wf = wfTe.map((p) => Math.log(p.mcap_usd!) - fn(wfTr, p));
    if (id === 'size') {
      sLoo = loo;
      sWf = wf;
      wfTrLoo = wfTr.map((p, t) => Math.log(p.mcap_usd!) - fn(wfTr.filter((_, j) => j !== t), p));
    }
    ladder.push({
      id,
      label,
      status,
      looMiss: Math.round(Math.exp(model.median(loo.map(Math.abs))) * 100) / 100,
      wfMiss: Math.round(Math.exp(model.median(wf.map(Math.abs))) * 100) / 100,
      looWithin3: Math.round((loo.filter((e) => Math.abs(e) <= Math.log(3)).length / loo.length) * 1000) / 1000,
      wfWithin3: Math.round((wf.filter((e) => Math.abs(e) <= Math.log(3)).length / wf.length) * 1000) / 1000,
    });
  }
  const q = (a: number[]) => ({
    q10: Math.round(model.cQuant(a, 0.1) * 10000) / 10000,
    q25: Math.round(model.cQuant(a, 0.25) * 10000) / 10000,
    q75: Math.round(model.cQuant(a, 0.75) * 10000) / 10000,
    q90: Math.round(model.cQuant(a, 0.9) * 10000) / 10000,
  });
  const bands = q(sLoo);
  const wfb = q(wfTrLoo);
  const cov = (e: number[], lo: number, hi: number) => Math.round((e.filter((x) => x >= lo && x <= hi).length / e.length) * 1000) / 1000;
  return {
    ladder,
    compsCount: comps.length,
    bands,
    looPredBySlug,
    honesty: {
      looWithin3: ladder[1]!.looWithin3,
      wfWithin3: ladder[1]!.wfWithin3,
      looCov50: cov(sLoo, bands.q25, bands.q75),
      wfCov50: cov(sWf, wfb.q25, wfb.q75),
      looCov80: cov(sLoo, bands.q10, bands.q90),
      wfCov80: cov(sWf, wfb.q10, wfb.q90),
    },
  };
}

/** 10-Fold and Walk-Forward blind ablation ladder on launch-odds terms + age cohorts. */
export function runOddsValidation(model: ModelApi, peers: Protocol[], asOf: string, med7d: number) {
  const sorted = [...peers].sort((a, b) => cmp(a.slug, b.slug));
  const dated = sorted
    .filter((p) => p.listed_at)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : cmp(a.slug, b.slug)));
  const sp = Math.floor(dated.length * 0.6);
  const wfTr = dated.slice(0, sp);
  const wfTe = dated.slice(sp);
  const specs: [string, string, string, Record<string, number>][] = [
    ['base', 'Base rate of peers', 'baseline', { base: 1 }],
    ['years', '+ years listed + undated', 'kept', { years: 1 }],
    ['secCat', '+ sector/category EB share', 'kept', { years: 1, secCat: 1 }],
    ['tvl', '+ size (ln TVL)', 'kept', { years: 1, secCat: 1, tvl: 1 }],
    ['growth', '+ 7-day excess TVL growth', 'kept', { years: 1, secCat: 1, tvl: 1, growth: 1 }],
    ['chains', '+ chain count (ln)', 'tested, not kept', { years: 1, secCat: 1, tvl: 1, growth: 1, chains: 1 }],
    ['placebo', '+ control: slug hash', 'must not help', { years: 1, secCat: 1, tvl: 1, growth: 1, placebo: 1 }],
  ];
  const ladder = specs.map(([id, label, status, o]) => {
    const salts = o.placebo ? ['s0:', 's1:', 's2:', 's3:', 's4:'] : [''];
    let b10 = 0;
    let a10 = 0;
    let bWf = 0;
    let aWf = 0;
    for (const salt of salts) {
      const cfg = o.placebo ? { ...o, salt } : o;
      for (let f = 0; f < 10; f++) {
        const tr = sorted.filter((_, i) => i % 10 !== f);
        const te = sorted.filter((_, i) => i % 10 === f);
        const m = cfg.base ? null : model.fitLaunchOdds(tr, asOf, med7d, cfg);
        const br = tr.filter(model.hasTok).length / tr.length;
        for (const p of te) {
          const pr = m ? m.predictProb(p) : br;
          const y = model.hasTok(p) ? 1 : 0;
          b10 += (pr - y) ** 2;
          if ((pr >= 0.5 ? 1 : 0) === y) a10++;
        }
      }
      const wm = cfg.base ? null : model.fitLaunchOdds(wfTr, asOf, med7d, cfg);
      const wbr = wfTr.filter(model.hasTok).length / wfTr.length;
      for (const p of wfTe) {
        const pr = wm ? wm.predictProb(p) : wbr;
        const y = model.hasTok(p) ? 1 : 0;
        bWf += (pr - y) ** 2;
        if ((pr >= 0.5 ? 1 : 0) === y) aWf++;
      }
    }
    const k = salts.length;
    return {
      id,
      label,
      status,
      cvBrier: Math.round((b10 / (sorted.length * k)) * 10000) / 10000,
      cvAcc: Math.round((a10 / (sorted.length * k)) * 1000) / 1000,
      wfBrier: Math.round((bWf / (wfTe.length * k)) * 10000) / 10000,
      wfAcc: Math.round((aWf / (wfTe.length * k)) * 1000) / 1000,
    };
  });
  const cohorts = [
    ['0–6m', 0, 183],
    ['6–12m', 183, 365],
    ['1–2y', 365, 730],
    ['2–3y', 730, 1095],
    ['3y+', 1095, 99999],
  ].map(([label, min, max]) => ({ label: String(label), min: Number(min), max: Number(max), n: 0, k: 0 }));
  for (const p of dated) {
    const d = model.ageDays(asOf, p.listed_at)!;
    const co = cohorts.find((c) => d >= c.min && d < c.max);
    if (co) {
      co.n++;
      co.k += model.hasTok(p) ? 1 : 0;
    }
  }
  return {
    ladder,
    peersCount: sorted.length,
    datedCount: dated.length,
    cohorts: cohorts.map((c) => ({ label: c.label, n: c.n, k: c.k, rate: c.n ? Math.round((c.k / c.n) * 1000) / 1000 : 0 })),
  };
}

/** 200-refit deterministic bootstrap for parameter standard errors & rank stability ranges. */
export function runBootstrap(model: ModelApi, comps: Protocol[], peers: Protocol[], ranked: Protocol[], asOf: string, med7d: number, B = 200) {
  const rng = mulberry32(0x5eed2026);
  const nC = comps.length;
  const nP = peers.length;
  const betas: number[] = [];
  const hist: Record<string, number[]> = Object.fromEntries(ranked.map((r) => [r.slug, []]));
  for (let b = 0; b < B; b++) {
    const bC = Array.from({ length: nC }, () => comps[Math.floor(rng() * nC)]!);
    const bP = Array.from({ length: nP }, () => peers[Math.floor(rng() * nP)]!);
    const vc = model.fitSizeCurve(bC);
    const oc = model.fitLaunchOdds(bP, asOf, med7d);
    betas.push(vc.betaTvl);
    const sc = ranked
      .map((p) => ({ slug: p.slug, val: Math.exp(vc.predictLog(p.tvl_usd)) * oc.conditionalOdds(p, 2).odds }))
      .sort((a, c) => c.val - a.val || cmp(a.slug, c.slug));
    for (let m = 0; m < sc.length; m++) hist[sc[m]!.slug]!.push(m + 1);
  }
  const mu = betas.reduce((a, b) => a + b, 0) / betas.length;
  const seBeta = Math.sqrt(betas.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, betas.length - 1));
  const rankRangeBySlug: Record<string, [number, number]> = {};
  for (const r of ranked) {
    const h = hist[r.slug]!.sort((a, c) => a - c);
    rankRangeBySlug[r.slug] = [h[Math.floor(h.length * 0.05)]!, h[Math.min(h.length - 1, Math.floor(h.length * 0.95))]!];
  }
  return { refits: B, seBeta: Math.round(seBeta * 1000) / 1000, rankRangeBySlug };
}

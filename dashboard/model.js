/* Meridian v5 — empirical pricing, log1p 24m hazard, blind validation, bootstrap SEs & farm plans. */
((root) => {
 'use strict';
 const { log, exp, abs, round, max, min, sqrt, floor, ceil, imul } = Math;
 const VER = 'meridian-5', DROP = 0.09, CAP_APR = 0.01, TBILL_APR = 0.04, HURDLE = 25;
 const BRIDGES = new Set(['Bridge', 'Canonical Bridge']), STAKING = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
 const CEX = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
 const VER_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/, WRAP_RE = /\b(wrapped|staked|staking)\b/i;
 const GENERIC = new Set('defi,open,meta,super,hyper,crypto,chain,yield,liquid,smart,alpha,prime,delta,sigma,omega,multi,cross,first,stable,global,token,protocol'.split(','));
 const FEES = Object.fromEntries('Solana:.02:.5:SOL|Base:.04:.75:ETH|Arbitrum:.06:.75:ETH|Optimism:.05:.75:ETH|Ink:.03:.85:ETH|Plasma:.04:.9:XPL|Monad:.03:.9:MON|Sui:.02:.6:SUI|Stellar:.01:.5:XLM|Flare:.02:.75:FLR|Algorand:.01:.5:ALGO|Polygon:.05:.75:POL|Binance:.12:.6:BNB|Avalanche:.15:.9:AVAX|Mantle:.04:.85:MNT|Scroll:.08:1:ETH|Linea:.08:1:ETH|Sonic:.03:.8:S|Berachain:.05:.9:BERA|Hyperliquid L1:.04:1:HYPE|Plume Mainnet:.05:1:PLUME|Unichain:.04:.85:ETH|Katana:.05:1:ETH|Mezo:.04:.9:BTC|Tron:1.35:1:TRX|Bitcoin:2.4:2.5:BTC|Bittensor:1.8:2:TAO|Ethereum:3.2:1:ETH'.split('|').map((s) => { const [c, g, b, sym] = s.split(':'); return [c, [+g, +b, sym]]; }));
 const DEF_FEE = [0.25, 1.25, 'gas'];

 const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0), clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v), rTo = (x, k) => round(x * k) / k;
 const zeros = (d) => Array.from({ length: d }, () => Array(d).fill(0)), sum = (a) => a.reduce((s, x) => s + x, 0), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
 const stdDev = (a) => { const m = sum(a) / a.length; return sqrt(sum(a.map((v) => (v - m) ** 2)) / max(1, a.length - 1)); };
 const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]); };
 const confQ = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), n = s.length; return s[clamp((q < 0.5 ? floor(q * (n + 1)) : ceil(q * (n + 1))) - 1, 0, n - 1)]; };
 const fnv1a = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
 const makeRng = (a) => () => { a = (a + 0x6d2b79f5) >>> 0; let t = imul(a ^ (a >>> 15), 1 | a); t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
 const pHash = (slug, salt = '') => (fnv1a(salt + slug) / 4294967295) * 2 - 1, hasToken = (p) => p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
 const ageDays = (asOf, at) => { if (!at) return null; const d = (Date.parse(asOf + 'T00:00:00Z') - Date.parse(at + 'T00:00:00Z')) / 864e5; return Number.isFinite(d) ? max(1, floor(d)) : null; };
 const carryOf = (ch7, med7) => (ch7 == null ? 1 : 1 + clamp((ch7 - med7) / 100, -0.25, 0.25));
 const sectorOf = (cat) => { const c = (cat || '').toLowerCase(); return /dex|deriv|option|predict|otc|synth|nft|launch/.test(c) ? 'Trading' : /lend|cdp|stable|collateral|basis|reserve/.test(c) ? 'Credit & Stables' : /curator|allocator|yield|farm|liquidity manager|index|cedefi/.test(c) ? 'Yield & Vaults' : /rwa|card|pay|insur/.test(c) ? 'RWA & Payments' : 'Staking & Infra'; };
 const stemOf = (name) => { const w = (String(name || '').trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return w.length < 4 || GENERIC.has(w) ? '' : w; };
 const houseExcl = (p) => (p.category === 'CEX' || CEX.some((e) => p.name.startsWith(e))) ? 'oc' : BRIDGES.has(p.category) ? 'ob' : STAKING.has(p.category) ? 'os' : VER_RE.test(p.name) ? 'ov' : WRAP_RE.test(p.name) ? 'ow' : null;

 // Partition snapshot into 11 mutually exclusive buckets.
 function classifyUniverse(snap) {
  const wlSet = new Set(snap.watchlist), stems = {}, kinNote = {};
  for (const p of snap.protocols) if (hasToken(p)) { const s = stemOf(p.name); if (s) stems[s] = p.symbol || p.name; }
  const g = Object.fromEntries('rw,ro,re,tp,tn,ob,os,oc,ov,ow,ok'.split(',').map((k) => [k, []]));
  for (const p of snap.protocols) {
   const tok = hasToken(p), ex = houseExcl(p), kin = stems[stemOf(p.name)] || null;
   if (wlSet.has(p.slug)) { g.rw.push(p); if (kin) kinNote[p.slug] = kin; }
   else if (tok) g[ex || (p.mcap_usd > 0 ? 'tp' : 'tn')].push(p);
   else if (ex) g[ex].push(p);
   else if (kin) { g.ok.push(p); kinNote[p.slug] = kin; }
   else g[p.tvl_usd >= snap.floor_usd ? 'ro' : 're'].push(p);
  }
  const ranked = [...g.rw, ...g.ro, ...g.re], traded = [...g.tp, ...g.tn], aside = [...g.ob, ...g.os, ...g.oc, ...g.ov, ...g.ow, ...g.ok];
  return { wlSet, groups: g, ranked, peers: [...ranked, ...traded], comps: g.tp, traded, aside, kinNote };
 }

 function solveLin(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
   let piv = c;
   for (let r = c + 1; r < n; r++) if (abs(M[r][c]) > abs(M[piv][c])) piv = r;
   [M[c], M[piv]] = [M[piv], M[c]];
   const d = M[c][c] || 1e-12;
   for (let k = c; k <= n; k++) M[c][k] /= d;
   for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r) => r[n]);
 }

 function solveRidge(X, y, pen) {
  const d = X[0].length, A = zeros(d), b = Array(d).fill(0);
  for (let i = 0; i < X.length; i++) for (let j = 0; j < d; j++) { b[j] += X[i][j] * y[i]; for (let k = j; k < d; k++) A[j][k] += X[i][j] * X[i][k]; }
  for (let j = 0; j < d; j++) { A[j][j] += pen[j] || 0; for (let k = 0; k < j; k++) A[j][k] = A[k][j]; }
  return solveLin(A, b);
 }

 function fitLogistic(X, y, pen, steps = 25) {
  const d = X[0].length, beta = Array(d).fill(0);
  for (let it = 0; it < steps; it++) {
   const H = zeros(d), g = Array(d).fill(0);
   for (let i = 0; i < X.length; i++) {
    const p = 1 / (1 + exp(-clamp(dot(X[i], beta), -28, 28))), w = max(1e-6, p * (1 - p)), e = y[i] - p;
    for (let j = 0; j < d; j++) { g[j] += X[i][j] * e; for (let k = j; k < d; k++) H[j][k] += w * X[i][j] * X[i][k]; }
   }
   for (let j = 0; j < d; j++) { g[j] -= (pen[j] || 0) * beta[j]; H[j][j] += (pen[j] || 0) + 1e-6; for (let k = 0; k < j; k++) H[j][k] = H[k][j]; }
   solveLin(H, g).forEach((s, j) => { beta[j] += s; });
  }
  return beta;
 }

 // Conditional launch cap: ln(cap) = a + b * ln(TVL * 7d carry / $100M) on traded comps.
 function fitSizeCurve(comps, med7, useCarry = true) {
  const eff = (tvl, ch7) => max(1, tvl * (useCarry ? carryOf(ch7, med7) : 1));
  const b = solveRidge(comps.map((p) => [1, log(eff(p.tvl_usd, p.change_7d) / 1e8)]), comps.map((p) => log(p.mcap_usd)), [0, 0.01]);
  return { a: b[0], beta: b[1], cap100: exp(b[0]), predLog: (tvl, ch7) => b[0] + b[1] * log(eff(tvl, ch7) / 1e8) };
 }

 function buildRates(peers) {
  let tok = 0; const sec = {}, cat = {};
  for (const p of peers) {
   const y = hasToken(p) ? 1 : 0, s = sectorOf(p.category), c = p.category || '__none__';
   tok += y; (sec[s] ||= { n: 0, k: 0 }).n++; sec[s].k += y; (cat[c] ||= { n: 0, k: 0 }).n++; cat[c].k += y;
  }
  const base = clamp(tok / max(1, peers.length), 0.05, 0.95), bLogit = log(base / (1 - base));
  return { cat, offset: (c) => { const se = sec[sectorOf(c)] || { n: 0, k: 0 }, ce = cat[c || '__none__'] || { n: 0, k: 0 }, sh = clamp((ce.k + 6 * ((se.k + 8 * base) / (se.n + 8))) / (ce.n + 6), 0.02, 0.98); return log(sh / (1 - sh)) - bLogit; } };
 }

 // L2 logistic launch-odds (ln(1+age), lambda=2.0) + decaying 24m hazard over peers.
 function fitLaunchOdds(peers, asOf, med7, cfg = { age: 1, cat: 1, tvl: 1, gr: 1 }) {
  const rates = buildRates(peers);
  const yrs = peers.map((p) => ageDays(asOf, p.listed_at)).filter((d) => d !== null).map((d) => d / 365);
  const medYr = median(yrs.length ? yrs : [1.2]);
  const feat = (p, oYr, oTvl, oGr) => {
   const d = ageDays(asOf, p.listed_at), yr = oYr !== undefined ? max(0.02, oYr) : (d === null ? medYr : d / 365), gv = oGr !== undefined ? oGr : p.change_7d;
   return [1, ...(cfg.age ? [log(1 + min(6, yr)), d === null ? 1 : 0] : []), ...(cfg.cat ? [rates.offset(p.category)] : []), ...(cfg.tvl ? [log(max(1, oTvl ?? p.tvl_usd) / 1e8)] : []), ...(cfg.gr ? [clamp(gv == null ? 0 : (gv - med7) / 100, -0.5, 0.5)] : []), ...(cfg.ch ? [log(max(1, p.chains.length))] : []), ...(cfg.plc ? [pHash(p.slug, 'p1:'), pHash(p.slug, 'p2:'), pHash(p.slug, 'p3:')] : [])];
  };
  const X = peers.map((p) => feat(p));
  const beta = fitLogistic(X, peers.map((p) => (hasToken(p) ? 1 : 0)), X[0].map((_, i) => (i ? (cfg.plc && i >= X[0].length - 3 ? 0.25 : 2.0) : 0)), 25);
  const prob = (p, oYr, oTvl, oGr) => 1 / (1 + exp(-clamp(dot(feat(p, oYr, oTvl, oGr), beta), -28, 28)));
  const condOdds = (p, hYr = 2, oYr, oTvl, oGr) => {
   const d = ageDays(asOf, p.listed_at), cur = oYr ?? (d === null ? medYr : d / 365);
   const pNow = prob(p, cur, oTvl, oGr), pMax = prob(p, max(5.5, cur + hYr), oTvl, oGr);
   return { pNow, pMax, odds: clamp(clamp((pMax - pNow) / max(0.06, 1 - pNow), 0.05, 0.96) * (1 - exp(-0.62 * hYr)), 0.05, 0.88) };
  };
  return { beta, medYr, rates, prob, condOdds };
 }

 /** Blind LOO & Walk-Forward ablation on launch value. */
 function runValueValidation(comps, asOf, med7) {
  const dated = comps.filter((p) => p.listed_at).sort((a, b) => cmp(a.listed_at, b.listed_at) || cmp(a.slug, b.slug));
  const sp = floor(dated.length * 0.5), wfTr = dated.slice(0, sp), wfTe = dated.slice(sp);
  const specs = [['flat', 'Flat median cap / TVL', 'baseline', { flat: 1 }], ['size', '+ size curve (ln TVL)', 'kept', {}], ['carry', '+ 7-day TVL carry (±25%)', 'kept', { carry: 1 }], ['cat', '+ category EB (ridge 64)', 'tested, not kept', { carry: 1, cat: 64 }], ['chains', '+ chain count (ln)', 'tested, not kept', { carry: 1, ch: 1 }], ['age', '+ years listed (ln)', 'tested, not kept', { carry: 1, age: 1 }], ['placebo', '+ control: slug hash', 'must not help', { carry: 1, plc: 1 }]];
  const mkPred = (o) => (tr, te) => {
   if (o.flat) return log(te.tvl_usd * median(tr.map((p) => p.mcap_usd / p.tvl_usd)));
   if (!o.ch && !o.age && !o.plc && !o.cat) return fitSizeCurve(tr, med7, !!o.carry).predLog(te.tvl_usd, te.change_7d);
   const mAge = median(tr.map((p) => ageDays(asOf, p.listed_at)).filter((v) => v !== null));
   const f = (p) => [1, log(max(1, p.tvl_usd * carryOf(p.change_7d, med7)) / 1e8), ...(o.ch ? [log(max(1, p.chains.length))] : []), ...(o.age ? [log(((ageDays(asOf, p.listed_at) || mAge || 365) + 30) / 365)] : []), ...(o.plc ? [pHash(p.slug)] : [])];
   const b = solveRidge(tr.map(f), tr.map((p) => log(p.mcap_usd)), [0, 0.01, ...(o.ch ? [4] : []), ...(o.age ? [2] : []), ...(o.plc ? [0.5] : [])]);
   let out = dot(f(te), b);
   if (o.cat) { const res = tr.filter((p) => p.category === te.category).map((p) => log(p.mcap_usd) - dot(f(p), b)); if (res.length) out += (res.length / (res.length + o.cat)) * (sum(res) / res.length); }
   return out;
  };
  const ladder = [], looPred = {}, cov = (e, lo, hi) => rTo(e.filter((x) => x >= lo && x <= hi).length / e.length, 1e3);
  let kLoo = [], kWf = [], wfTrLoo = [];
  for (const [id, label, status, o] of specs) {
   const pred = mkPred(o), loo = comps.map((p, i) => { const pr = pred(comps.filter((_, j) => j !== i), p); if (id === 'carry') looPred[p.slug] = round(exp(pr)); return log(p.mcap_usd) - pr; }), wf = wfTe.map((p) => log(p.mcap_usd) - pred(wfTr, p));
   if (id === 'carry') { kLoo = loo; kWf = wf; wfTrLoo = wfTr.map((p, t) => log(p.mcap_usd) - pred(wfTr.filter((_, j) => j !== t), p)); }
   ladder.push({ id, label, status, loo: rTo(exp(median(loo.map(abs))), 100), wf: rTo(exp(median(wf.map(abs))), 100) });
  }
  const qs = (a) => ({ q10: rTo(confQ(a, 0.1), 1e4), q25: rTo(confQ(a, 0.25), 1e4), q75: rTo(confQ(a, 0.75), 1e4), q90: rTo(confQ(a, 0.9), 1e4) });
  const bands = qs(kLoo), wfB = qs(wfTrLoo), l3 = log(3);
  return { ladder, n: comps.length, wfSplit: [wfTr.length, wfTe.length], bands, looPred, hon: { loo3: cov(kLoo, -l3, l3), wf3: cov(kWf, -l3, l3), loo50: cov(kLoo, bands.q25, bands.q75), wf50: cov(kWf, wfB.q25, wfB.q75), loo80: cov(kLoo, bands.q10, bands.q90), wf80: cov(kWf, wfB.q10, wfB.q90) } };
 }

 /** Blind 10-Fold & Walk-Forward ablation on launch-odds terms + OOF ECE. */
 function runOddsValidation(peers, asOf, med7) {
  const sorted = [...peers].sort((a, b) => cmp(a.slug, b.slug)), dated = sorted.filter((p) => p.listed_at).sort((a, b) => cmp(a.listed_at, b.listed_at) || cmp(a.slug, b.slug));
  const sp = floor(dated.length * 0.6), wfTr = dated.slice(0, sp), wfTe = dated.slice(sp), full = { age: 1, cat: 1, tvl: 1, gr: 1 }, oof = [];
  const evalSp = (tr, te, cfg, col) => {
   const fm = cfg.base ? null : fitLaunchOdds(tr, asOf, med7, cfg), base = tr.filter(hasToken).length / tr.length;
   let br = 0, ac = 0;
   for (const p of te) { const pr = fm ? fm.prob(p) : base, y = hasToken(p) ? 1 : 0; br += (pr - y) ** 2; if ((pr >= 0.5 ? 1 : 0) === y) ac++; if (col) col.push([pr, y]); }
   return [br, ac];
  };
  const specs = [['base', 'Base rate of peers', 'baseline', { base: 1 }], ['age', '+ ln(1 + age) + undated', 'kept', { age: 1 }], ['cat', '+ sector/category EB share', 'kept', { age: 1, cat: 1 }], ['tvl', '+ size (ln TVL)', 'kept', { age: 1, cat: 1, tvl: 1 }], ['growth', '+ 7-day excess TVL growth', 'kept', full], ['chains', '+ chain count (ln)', 'tested, not kept', { ...full, ch: 1 }], ['placebo', '+ control: 3-hash slug noise', 'must not help', { ...full, plc: 1 }]];
  const ladder = specs.map(([id, label, status, cfg]) => {
   let cB = 0, cA = 0;
   for (let f = 0; f < 10; f++) { const [b, a] = evalSp(sorted.filter((_, i) => i % 10 !== f), sorted.filter((_, i) => i % 10 === f), cfg, id === 'growth' ? oof : null); cB += b; cA += a; }
   const [wB, wA] = evalSp(wfTr, wfTe, cfg);
   return { id, label, status, cvB: rTo(cB / sorted.length, 1e4), cvA: rTo(cA / sorted.length, 1e3), wfB: rTo(wB / wfTe.length, 1e4), wfA: rTo(wA / wfTe.length, 1e3) };
  });
  oof.sort((a, b) => a[0] - b[0]);
  const ece = rTo(sum(Array.from({ length: 5 }, (_, i) => { const sl = oof.slice(floor((i * oof.length) / 5), floor(((i + 1) * oof.length) / 5)); return abs(sum(sl.map((x) => x[1] - x[0]))); })) / max(1, oof.length), 1e3);
  return { ladder, n: sorted.length, ece };
 }

 /** 200-refit deterministic bootstrap for coefficient SEs and 90% rank intervals. */
 function runBootstrap(comps, peers, ranked, asOf, med7, refits = 200) {
  const rng = makeRng(0x5eed2026), nC = comps.length, nP = peers.length;
  const vB = [], oA = [], oC = [], oT = [], oG = [], rHist = Object.fromEntries(ranked.map((x) => [x.slug, []]));
  for (let b = 0; b < refits; b++) {
   const vc = fitSizeCurve(Array.from({ length: nC }, () => comps[floor(rng() * nC)]), med7, true);
   const oc = fitLaunchOdds(Array.from({ length: nP }, () => peers[floor(rng() * nP)]), asOf, med7);
   vB.push(vc.beta); oA.push(oc.beta[1]); oC.push(oc.beta[3]); oT.push(oc.beta[4]); oG.push(oc.beta[5]);
   const sc = ranked.map((p) => ({ slug: p.slug, val: exp(vc.predLog(p.tvl_usd, p.change_7d)) * oc.condOdds(p, 2).odds })).sort((a, c) => c.val - a.val || cmp(a.slug, c.slug));
   sc.forEach((x, i) => rHist[x.slug].push(i + 1));
  }
  const rankRange = Object.fromEntries(ranked.map((x) => { const h = rHist[x.slug].sort((a, c) => a - c); return [x.slug, [h[floor(h.length * 0.05)], h[min(h.length - 1, floor(h.length * 0.95))]]]; }));
  return { refits, seBeta: rTo(stdDev(vB), 1e3), seAge: rTo(stdDev(oA), 1e2), seCat: rTo(stdDev(oC), 1e2), seTvl: rTo(stdDev(oT), 1e2), seGr: rTo(stdDev(oG), 1e2), rankRange };
 }

 function pickChain(chains) {
  if (!chains?.length) return { chain: 'Ethereum', fee: FEES.Ethereum };
  let best = chains[0], bf = FEES[best] || DEF_FEE, bc = bf[0] * 14 + bf[1] * 2;
  for (let i = 1; i < chains.length; i++) { const f = FEES[chains[i]] || DEF_FEE, c = f[0] * 14 + f[1] * 2; if (c < bc) { best = chains[i]; bf = f; bc = c; } }
  return { chain: best, fee: bf };
 }

 const PLAY_TYPES = [
  [/curator|allocator/, 'Curated vault', (p, at) => `Test $100, deploy ${p} USDC in ${at} flagship vault; un-looped.`],
  [/dex|liquidity manager/, 'Liquidity & swaps', (p, at) => `LP ${p} in ${at} deepest stable/blue-chip pool; swap $250.`],
  [/lend|uncollateral/, 'Supply & borrow', (p, at) => `Supply ${p} USDC on ${at}; borrow 15% (health > 2.5).`],
  [/cdp|stable/, 'Collateral mint', (p, at) => `Deposit ${p} on ${at}; mint 35% stablecoin (> 2.2x cushion).`],
  [/deriv|option|otc/, 'Margin & volume', (_p, at, k) => `Deposit ${k} USDC margin on ${at}; run hedged low-leverage perp.`],
  [/rwa|card|pay/, 'Tokenized asset', (p, at) => `Complete onboarding; subscribe ${p} into ${at} yield RWA.`],
  [/basis/, 'Delta-neutral stake', (p, at) => `Mint ${p} ${at} basis stablecoin, stake natively; peg < 0.5%.`],
  [/predict/, 'Market volume', (_p, at, k) => `Fund ${k} USDC on ${at}; provide two-sided market liquidity.`],
  [/restak|stak|btc/, 'Stake & delegate', (p, at) => `Stake ${p} via ${at} with high-uptime operator; check unbonding.`],
  [/insur/, 'Cover pool', (p, at) => `Deposit ${p} in ${at} cover pool; check claims & exit queue.`],
 ];
 const fmtUsd = (v) => { const a = abs(v), s = v < 0 ? '-' : ''; return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${round(a).toLocaleString('en-US')}` : `${s}$${a.toFixed(a < 10 ? 2 : 0)}`; };
 const fmtMoney = (v) => { const a = abs(v), s = v < 0 ? '-' : ''; return a >= 1e3 ? `${s}$${round(a).toLocaleString('en-US')}` : a >= 100 ? `${s}$${a.toFixed(0)}` : `${s}$${a.toFixed(2)}`; };

 // Evaluate farm scenario: nets gas/bridge + 1% capital spread; tracks 4% T-bill benchmark.
 function evaluateFarm(r, o = {}) {
  const capital = o.capital > 0 ? o.capital : 5000, drop = o.drop || DROP, wk = o.wk || 12, holdDays = wk * 7;
  const { chain, fee: [gas, br, sym] } = pickChain(r.chains), { tvl_usd: tvl, implied_value_usd: imp, launch_value_usd: lv } = r;
  const scs = [rTo(max(0.5, gas + 0.5), 100), br, rTo(gas * 3, 100), rTo(gas * 2, 100), rTo(gas * wk, 100), rTo(gas * 2 + br, 100)];
  const fees = rTo(sum(scs), 100), mins = 66 + wk * 3, hrs = mins / 60, yr = holdDays / 365;
  const capCost = capital * CAP_APR * yr, tbill = capital * TBILL_APR * yr, cost = fees + capCost;
  const tw = clamp(holdDays / min(180, max(42, (r.age_days || 140) * 0.22 + holdDays)), 0.38, 1);
  const sh = capital / (tvl + capital), expDrop = imp * drop * sh * tw, ifLaunch = lv * drop * sh * tw;
  const netAllIn = expDrop - cost, netPerHour = netAllIn / hrs;
  const verdict = netAllIn > 0 && netPerHour >= HURDLE ? 'FARM' : netAllIn > 0 ? 'MARGINAL' : 'SKIP';
  const dpd = expDrop / capital, drag = CAP_APR * yr;
  return { chain, sym, gas, capital, drop, wk, holdDays, expDrop, ifLaunch, fees, capCost, tbill, cost, netAllIn, mins, hrs, netPerHour, verdict, beDrop: imp > 0 ? cost / max(1e-9, imp * sh * tw) : 1, beOdds: ifLaunch > 0 ? cost / ifLaunch : 1, beDep: dpd > drag ? ceil(fees / (dpd - drag)) : null, scs };
 }

 // Pick smallest capital (<= min($25K, 0.05% TVL)) clearing FARM, else highest net/hour.
 function optimalFarm(r, o = {}) {
  const drop = o.drop || DROP, maxCap = min(25000, max(2000, round((r.tvl_usd * 0.0005) / 500) * 500));
  const caps = o.capital > 0 ? [o.capital] : [1000, 2500, 5000, 10000, 15000, 25000].filter((c) => c <= maxCap);
  const wks = o.wk > 0 ? [o.wk] : [6, 8, 12, 16, 20, 26];
  let bestF = null, bestA = null;
  for (const capital of (caps.length ? caps : [2000])) for (const wk of wks) {
   const ev = evaluateFarm(r, { capital, drop, wk });
   if (ev.verdict === 'FARM' && (!bestF || ev.capital < bestF.capital || (ev.capital === bestF.capital && ev.netPerHour > bestF.netPerHour))) bestF = ev;
   if (!bestA || ev.netPerHour > bestA.netPerHour) bestA = ev;
  }
  return bestF || bestA;
 }

 // Build 8 concrete, risk-aware, costed & timed chronological farm steps.
 function buildFarmPlan(r, sc) {
  sc ||= optimalFarm(r); const capS = `$${sc.capital.toLocaleString('en-US')}`, cLo = (r.category || '').toLowerCase();
  const hit = PLAY_TYPES.find(([re]) => re.test(cLo)), kind = hit ? hit[1] : 'Vault & activity';
  const pos = `${capS} (${((sc.capital / max(1, r.tvl_usd)) * 100).toFixed(3)}% TVL)`, exTvl = fmtUsd(round(r.tvl_usd * 0.75)), ch2 = r.chains.find((c) => c !== sc.chain);
  const gBuf = max(5, ceil((sc.fees + 4) / 5) * 5), ch7 = r.change_7d == null ? 'n/a' : `${r.change_7d >= 0 ? '+' : ''}${r.change_7d.toFixed(1)}%`;
  const chL = r.name.toLowerCase() === sc.chain.toLowerCase() ? `${sc.chain} network` : sc.chain, at = `${r.name} (${chL})`, fm = fmtMoney;
  const fNote = r.chains.length <= 1 ? `only listed chain, ~${fm(sc.gas)}/tx` : `cheapest of ${r.chains.length} chains, ~${fm(sc.gas)}/tx`;
  const core = hit ? hit[2](pos, at, capS) : `Test $100, deploy ${pos} USDC into ${at} and confirm accrual.`;
  const c = sc.scs, steps = [
   ['Day 0 · Setup', 'Isolate wallet', `Fresh wallet for ${at}; fund $${gBuf} ${sc.sym} gas.`, fm(c[0]), 8],
   ['Day 0 · Verify', 'Verify contracts', `Open ${r.name} via DefiLlama "${r.slug}", bookmark URL, match contracts vs docs.`, '$0.00', 8],
   ['Day 0 · Fund', `Route ${capS}`, `Bridge ${capS} USDC to ${chL} (${fNote}).`, fm(c[1]), 10],
   ['Day 1 · Core', kind, core, fm(c[2]), 14],
   ['Day 2 · Deepen', 'Footprint', ch2 ? `Hold un-looped; add one touch on ${ch2} for multi-chain credit.` : 'Hold un-looped; confirm points on official rewards page.', fm(c[3]), 8],
   [`Weekly ×${sc.wk}`, 'Cadence', `Touch weekly for ${sc.wk}w (top-up, harvest, or vote) across ${sc.wk} epochs.`, fm(c[4]), sc.wk * 3],
   ['Any day · Risk', 'Drawdown stop', `Exit if TVL drops 25% to ${exTvl} (7d ${ch7}), queues > 7d, or snapshot lands.`, fm(c[5]), 10],
   [`Day ${sc.holdDays} · Claim`, 'Unwind', `Log hashes & ${capS} basis; unwind Day ${sc.holdDays}, claim officially. Net ${fm(sc.netAllIn)} (${fm(sc.netPerHour)}/h; 4% T-bill ${fm(sc.tbill)}).`, `${fm(sc.capCost)} spread`, 8],
  ].map(([when, title, text, cost, m]) => ({ when, title, text, cost, time: `${m} min` }));
  return { kind, steps, boardStrings: steps.map((s) => `${s.when} — ${s.text} Cost: ${s.cost}. Time: ${s.time}.`.slice(0, 596)) };
 }

 function computeSensitivity(r, sc, om) {
  const { tvl_usd: t0, change_7d: g0, implied_value_usd: imp0 } = r, y0 = (r.age_days || round(om.medYr * 365)) / 365;
  return [['As recorded (baseline)', t0, y0, g0], ['TVL 30% lower', t0 * 0.7, y0, g0], ['TVL doubles (2x)', t0 * 2, y0, g0], ['7-day growth +20 pp', t0, y0, (g0 || 0) + 20], ['+12 months, still no token', t0, y0 + 1, g0]]
   .map(([label, t, y, g]) => { const lv = exp(sc.predLog(t, g)), odds = om.condOdds(r, 2, y, t, g).odds, imp = max(1, round(lv * odds)); return { label, lv: round(lv), odds, imp, ratio: imp / max(1, imp0) }; });
 }

 function nearestComps(r, comps, sc, looPred, lim = 5) {
  const lt = log(max(1, r.tvl_usd)), sec = sectorOf(r.category);
  return comps.map((c) => {
   const pen = c.category === r.category ? 0 : sectorOf(c.category) === sec ? 0.8 : 1.8, blind = looPred?.[c.slug] || exp(sc.predLog(c.tvl_usd, c.change_7d));
   return { slug: c.slug, name: c.name, sym: c.symbol, cat: c.category, tvl: c.tvl_usd, mcap: c.mcap_usd, mult: c.mcap_usd / c.tvl_usd, miss: c.mcap_usd / blind, d: abs(log(max(1, c.tvl_usd)) - lt) + pen };
  }).sort((a, b) => a.d - b.d || cmp(a.slug, b.slug)).slice(0, lim);
 }

 function verifyBoard(rows, snap, ref) {
  let totalImpliedUsd = 0, mono = true; const slugs = new Set(), parts = [];
  rows.forEach((x, i) => { if (x.rank !== i + 1 || (i > 0 && x.implied_value_usd > rows[i - 1].implied_value_usd)) mono = false; totalImpliedUsd += x.implied_value_usd; slugs.add(x.slug); parts.push(`${x.rank}:${x.slug}:${x.implied_value_usd}`); });
  const checksum = fnv1a(parts.join('|')).toString(16).padStart(8, '0');
  return { rowCount: rows.length, mono, totalImpliedUsd, checksum, watchlistCovered: snap.watchlist.filter((s) => slugs.has(s)).length, watchlistTotal: snap.watchlist.length, matchesMain: ref ? (checksum === ref.checksum && totalImpliedUsd === ref.total_implied_usd && rows.length === ref.row_count) : true };
 }

 // Deterministic pipeline: refits curves, ablation ladders, ECE, bootstrap & farm plans live.
 function buildRadar(snap) {
  const uni = classifyUniverse(snap), med7 = median(snap.protocols.map((p) => p.change_7d).filter((v) => v !== null));
  const sizeCurve = fitSizeCurve(uni.comps, med7, true), oddsModel = fitLaunchOdds(uni.peers, snap.as_of, med7);
  const valCheck = runValueValidation(uni.comps, snap.as_of, med7), oddsCheck = runOddsValidation(uni.peers, snap.as_of, med7);
  const boot = runBootstrap(uni.comps, uni.peers, uni.ranked, snap.as_of, med7, 200), b = valCheck.bands, bnd = (v, q) => max(1, round(v * exp(q)));
  const rows = uni.ranked.map((p) => {
   const age = ageDays(snap.as_of, p.listed_at), cf = carryOf(p.change_7d, med7), lv = exp(sizeCurve.predLog(p.tvl_usd, p.change_7d));
   const od = oddsModel.condOdds(p, 2), imp = max(1, round(lv * od.odds)), cs = oddsModel.rates.cat[p.category || '__none__'] || { n: 0, k: 0 };
   return { ...p, sector: sectorOf(p.category), tier: uni.wlSet.has(p.slug) ? 'watchlist' : p.tvl_usd >= snap.floor_usd ? 'offlist' : 'early', kin_caution: uni.kinNote[p.slug] || null, age_days: age, carry: cf, launch_value_usd: round(lv), p_now: od.pNow, p_max: od.pMax, launch_odds: od.odds, cat_n: cs.n, cat_k: cs.k, implied_value_usd: imp, p10_usd: bnd(imp, b.q10), p25_usd: bnd(imp, b.q25), p75_usd: bnd(imp, b.q75), p90_usd: bnd(imp, b.q90) };
  }).sort((a, c) => c.implied_value_usd - a.implied_value_usd || cmp(a.slug, c.slug)).map((r, i) => {
   r.rank = i + 1; [r.rank_low, r.rank_high] = boot.rankRange[r.slug] || [r.rank, r.rank];
   r.farm = optimalFarm(r); r.farm_steps = buildFarmPlan(r, r.farm).boardStrings; return r;
  });
  const g = uni.groups, ledger = 'rw:Watchlist:#4CC9F0|ro:Off-list:#80D8FF|re:Early (<$50M):#2EE59D|tp:Traded comps:#F5B041|tn:Token no cap:#A57B32|ob:Bridge:#64748B|os:Staking:#526077|ov:Versioned:#475569|oc:Exchange:#3B485C|ow:Wrapped:#334155|ok:Traded kin:#F97066'.split('|').map((s) => { const [key, label, color] = s.split(':'); return { key, label, count: g[key].length, color }; });
  return { ver: VER, as_of: snap.as_of, med7, uni, ledger, sizeCurve, oddsModel, valCheck, oddsCheck, boot, rows, verification: verifyBoard(rows, snap) };
 }

 const api = { VER, DROP, classifyUniverse, fitSizeCurve, fitLaunchOdds, runValueValidation, runOddsValidation, runBootstrap, evaluateFarm, optimalFarm, buildFarmPlan, computeSensitivity, nearestComps, verifyBoard, buildRadar, fmtUsd, fmtMoney };
 root.MeridianModel = api;
 if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

/* Meridian Token Launch Radar — empirical pricing, 24m launch hazard & farm economics.
 * Zero deps, zero network. Shared by main.ts (Node 22) and dashboard/index.html (browser). */
((root) => {
  'use strict';
  const MODEL_VERSION = 'meridian-1', DAY_MS = 86400000;
  const BRIDGES = new Set(['Bridge', 'Canonical Bridge']);
  const STAKING = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
  const CEX_PFX = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
  const VER_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/, WRAP_RE = /\b(wrapped|staked|staking)\b/i;
  const GENERIC = new Set('defi,open,meta,super,hyper,crypto,chain,yield,liquid,smart,alpha,prime,delta,sigma,omega,multi,cross,first,stable,global,token,protocol'.split(','));
  const FEE_MAP = Object.fromEntries(
    'Solana:.02:.5:SOL|Base:.04:.75:ETH|Arbitrum:.06:.75:ETH|Optimism:.05:.75:ETH|Ink:.03:.85:ETH|Plasma:.04:.9:XPL|Monad:.03:.9:MON|Sui:.02:.6:SUI|Stellar:.01:.5:XLM|Flare:.02:.75:FLR|Algorand:.01:.5:ALGO|Polygon:.05:.75:POL|Binance:.12:.6:BNB|Avalanche:.15:.9:AVAX|Mantle:.04:.85:MNT|Scroll:.08:1:ETH|Linea:.08:1:ETH|Sonic:.03:.8:S|Berachain:.05:.9:BERA|Hyperliquid L1:.04:1:HYPE|Plume Mainnet:.05:1:PLUME|Unichain:.04:.85:ETH|Katana:.05:1:ETH|Tron:1.35:1:TRX|Bitcoin:2.4:2.5:BTC|Bittensor:1.8:2:TAO|Ethereum:3.2:1:ETH'
      .split('|').map((s) => { const [k, a, b, g] = s.split(':'); return [k, [+a, +b, +b, g]]; })
  );
  const DEF_FEE = [0.25, 1.25, 1.25, 'gas'];

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const r2 = (x) => Math.round(x * 100) / 100;
  const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]); };
  const cQuant = (a, q) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? s[clamp(q < 0.5 ? Math.floor(q * (n + 1)) - 1 : Math.ceil(q * (n + 1)) - 1, 0, n - 1)] : 0; };
  const fnv1a = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
  const placebo = (slug, salt = '') => (fnv1a(`${salt}${slug}`) / 4294967295) * 2 - 1;
  const hasTok = (p) => p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
  const ageDays = (asOf, dt) => { if (!dt) return null; const a = Date.parse(`${asOf}T00:00:00Z`), b = Date.parse(`${dt}T00:00:00Z`); return Number.isFinite(a) && Number.isFinite(b) ? Math.max(1, Math.floor((a - b) / DAY_MS)) : null; };
  const sectorOf = (cat) => {
    const c = (cat || '').toLowerCase();
    return /dex|deriv|option|predict|otc|synth|nft|launch/.test(c) ? 'Trading'
      : /lend|cdp|stable|collateral|basis|reserve/.test(c) ? 'Credit & Stables'
      : /curator|allocator|yield|farm|liquidity manager|index|cedefi/.test(c) ? 'Yield & Vaults'
      : /rwa|card|pay|insur/.test(c) ? 'RWA & Payments' : 'Staking & Infra';
  };
  const stemOf = (n) => { const c = (String(n || '').trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return c.length < 4 || GENERIC.has(c) ? '' : c; };
  const houseExcl = (p) => (p.category === 'CEX' || CEX_PFX.some((e) => p.name.startsWith(e))) ? 'out_cex'
    : BRIDGES.has(p.category) ? 'out_bridge' : STAKING.has(p.category) ? 'out_staking'
    : VER_RE.test(p.name) ? 'out_versioned' : WRAP_RE.test(p.name) ? 'out_wrapped' : null;

  /** Partition all 758 snapshot protocols into 11 mutually exclusive buckets. */
  function classifyUniverse(snap) {
    const wlSet = new Set(snap.watchlist), stems = {}, kinNoteBySlug = {};
    for (const tp of snap.protocols) if (hasTok(tp)) { const st = stemOf(tp.name); if (st) stems[st] = tp.symbol || tp.name; }
    const g = { ranked_watchlist: [], ranked_offlist: [], ranked_early: [], traded_priced: [], traded_nocap: [], out_bridge: [], out_staking: [], out_cex: [], out_versioned: [], out_wrapped: [], out_kin: [] };
    for (const p of snap.protocols) {
      const tok = hasTok(p), excl = houseExcl(p), kin = stems[stemOf(p.name)] || null;
      if (wlSet.has(p.slug)) { g.ranked_watchlist.push(p); if (kin) kinNoteBySlug[p.slug] = kin; }
      else if (tok) g[excl || (p.mcap_usd > 0 ? 'traded_priced' : 'traded_nocap')].push(p);
      else if (excl) g[excl].push(p);
      else if (kin) { g.out_kin.push(p); kinNoteBySlug[p.slug] = kin; }
      else g[p.tvl_usd >= snap.floor_usd ? 'ranked_offlist' : 'ranked_early'].push(p);
    }
    const ranked = [...g.ranked_watchlist, ...g.ranked_offlist, ...g.ranked_early];
    const tradedAll = [...g.traded_priced, ...g.traded_nocap];
    const setAside = [...g.out_bridge, ...g.out_staking, ...g.out_cex, ...g.out_versioned, ...g.out_wrapped, ...g.out_kin];
    return { wlSet, groups: g, ranked, peers: [...ranked, ...tradedAll], comps: g.traded_priced, tradedAll, setAside, kinNoteBySlug };
  }

  function solveLin(A, b) {
    const d = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < d; c++) {
      let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const dg = M[c][c] || 1e-12;
      for (let k = c; k <= d; k++) M[c][k] /= dg;
      for (let r = 0; r < d; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= d; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r) => r[d]);
  }
  function solveRidge(X, y, lams) {
    const d = X[0].length, A = Array.from({ length: d }, () => Array(d).fill(0)), b = Array(d).fill(0);
    for (let i = 0; i < X.length; i++) for (let j = 0; j < d; j++) { b[j] += X[i][j] * y[i]; for (let k = j; k < d; k++) A[j][k] += X[i][j] * X[i][k]; }
    for (let j = 0; j < d; j++) { A[j][j] += lams[j] || 0; for (let k = 0; k < j; k++) A[j][k] = A[k][j]; }
    return solveLin(A, b);
  }
  function fitLogit(X, y, lams, steps = 25) {
    const d = X[0].length, b = Array(d).fill(0);
    for (let it = 0; it < steps; it++) {
      const H = Array.from({ length: d }, () => Array(d).fill(0)), g = Array(d).fill(0);
      for (let i = 0; i < X.length; i++) {
        let z = 0; for (let j = 0; j < d; j++) z += X[i][j] * b[j];
        const p = 1 / (1 + Math.exp(-clamp(z, -28, 28))), w = Math.max(1e-6, p * (1 - p)), df = y[i] - p;
        for (let j = 0; j < d; j++) { g[j] += X[i][j] * df; for (let k = j; k < d; k++) H[j][k] += w * X[i][j] * X[i][k]; }
      }
      for (let j = 0; j < d; j++) { g[j] -= (lams[j] || 0) * b[j]; H[j][j] += (lams[j] || 0) + 1e-6; for (let k = 0; k < j; k++) H[j][k] = H[k][j]; }
      const st = solveLin(H, g); for (let j = 0; j < d; j++) b[j] += st[j];
    }
    return b;
  }

  /** Power-law conditional launch value ln(cap) = alpha + beta * ln(TVL / $100M) on 92 traded comps. */
  function fitSizeCurve(comps) {
    const b = solveRidge(comps.map((p) => [1, Math.log(p.tvl_usd / 1e8)]), comps.map((p) => Math.log(p.mcap_usd)), [0, 0.01]);
    return { alpha: b[0], betaTvl: b[1], capAt100M: Math.exp(b[0]), predictLog: (tvl) => b[0] + b[1] * Math.log(Math.max(1, tvl) / 1e8) };
  }

  function buildHierRates(peers) {
    let tok = 0; const sec = {}, cat = {};
    for (const p of peers) { const y = hasTok(p) ? 1 : 0, s = sectorOf(p.category), c = p.category || '__none__'; tok += y; (sec[s] ||= { n: 0, k: 0 }).n++; sec[s].k += y; (cat[c] ||= { n: 0, k: 0 }).n++; cat[c].k += y; }
    const br = clamp(tok / Math.max(1, peers.length), 0.05, 0.95), bLog = Math.log(br / (1 - br));
    const shrunk = (cn) => { const se = sec[sectorOf(cn)] || { n: 0, k: 0 }, ce = cat[cn || '__none__'] || { n: 0, k: 0 }; return clamp((ce.k + 6 * ((se.k + 8 * br) / (se.n + 8))) / (ce.n + 6), 0.02, 0.98); };
    return { catStats: cat, shrunkRate: shrunk, logitOffset: (c) => { const r = shrunk(c); return Math.log(r / (1 - r)) - bLog; } };
  }

  /** L2-regularized logistic launch-odds model & 24-month conditional hazard on 437 standalone peers. */
  function fitLaunchOdds(peers, asOf, med7d, cfg = { years: 1, secCat: 1, tvl: 1, growth: 1 }) {
    const rates = buildHierRates(peers);
    const yrs = peers.map((p) => { const d = ageDays(asOf, p.listed_at); return d === null ? null : Math.min(5, d / 365); }).filter((v) => v !== null);
    const medYr = median(yrs.length ? yrs : [1.2]);
    const feat = (p, oY, oT, oG) => {
      const d = ageDays(asOf, p.listed_at), yr = oY !== undefined ? Math.min(5, oY) : (d === null ? medYr : Math.min(5, d / 365));
      const und = oY !== undefined ? 0 : (d === null ? 1 : 0), gv = oG !== undefined ? oG : p.change_7d;
      return [1, ...(cfg.years ? [yr, und] : []), ...(cfg.secCat ? [rates.logitOffset(p.category)] : []),
        ...(cfg.tvl ? [Math.log(Math.max(1, oT !== undefined ? oT : p.tvl_usd) / 1e8)] : []),
        ...(cfg.growth ? [clamp(gv === null ? 0 : (gv - med7d) / 100, -0.5, 0.5)] : []),
        ...(cfg.chains ? [Math.log(Math.max(1, p.chains.length))] : []), ...(cfg.placebo ? [placebo(p.slug, cfg.salt || '')] : [])];
    };
    const X = peers.map((p) => feat(p)), beta = fitLogit(X, peers.map((p) => (hasTok(p) ? 1 : 0)), X[0].map((_, i) => (i === 0 ? 0 : 1.5)), 25);
    const predictProb = (p, oY, oT, oG) => 1 / (1 + Math.exp(-clamp(feat(p, oY, oT, oG).reduce((s, v, i) => s + v * beta[i], 0), -28, 28)));
    const conditionalOdds = (p, hYr = 2, oY, oT, oG) => {
      const d = ageDays(asOf, p.listed_at), cur = oY !== undefined ? oY : (d === null ? medYr : d / 365);
      const pNow = predictProb(p, cur, oT, oG), pLat = predictProb(p, Math.min(5.5, cur + hYr), oT, oG);
      const ceil = clamp(0.15 + 0.8 * rates.shrunkRate(p.category), 0.2, 0.94);
      const pFut = Math.max(pLat, Math.min(ceil, pNow + (ceil - pNow) * (1 - Math.exp(-0.22 * hYr))));
      return { pNow, pFuture: pFut, odds: clamp((pFut - pNow) / Math.max(0.05, 1 - pNow), 0.05, 0.9) };
    };
    return { beta, medYr, rates, predictProb, conditionalOdds };
  }

  function pickExecutionChain(chains) {
    if (!chains?.length) return { chain: 'Ethereum', fee: FEE_MAP.Ethereum };
    let best = chains[0], bf = FEE_MAP[best] || DEF_FEE, bs = bf[0] * 14 + bf[1] + bf[2];
    for (let i = 1; i < chains.length; i++) { const f = FEE_MAP[chains[i]] || DEF_FEE, s = f[0] * 14 + f[1] + f[2]; if (s < bs) { best = chains[i]; bf = f; bs = s; } }
    return { chain: best, fee: bf };
  }

  const playKindOf = (cat) => {
    const c = (cat || '').toLowerCase();
    return /curator|allocator/.test(c) ? 'Curated vault' : /dex|liquidity manager/.test(c) ? 'Liquidity & swaps'
      : /lend|uncollateral/.test(c) ? 'Supply & borrow' : /cdp|stable/.test(c) ? 'Collateral mint'
      : /deriv|option|otc/.test(c) ? 'Margin & volume' : /rwa|card|pay/.test(c) ? 'Tokenized asset'
      : /basis/.test(c) ? 'Delta-neutral stake' : /predict/.test(c) ? 'Market volume'
      : /restak|stak|btc/.test(c) ? 'Stake & delegate' : /insur/.test(c) ? 'Cover pool' : 'Vault & activity';
  };
  const fmtUsd = (v) => { const a = Math.abs(v), s = v < 0 ? '-' : ''; return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${Math.round(a).toLocaleString('en-US')}` : `${s}$${a.toFixed(a < 10 ? 2 : 0)}`; };
  const fmtMoney2 = (v) => { const a = Math.abs(v), s = v < 0 ? '-' : ''; return a >= 1000 ? `${s}$${Math.round(a).toLocaleString('en-US')}` : a >= 100 ? `${s}$${a.toFixed(0)}` : `${s}$${a.toFixed(2)}`; };

  /** Evaluate one farm scenario: chain gas, bridge, 1.5% capital spread & 4% T-bill benchmark. */
  function evaluateFarmScenario(row, o = {}) {
    const capital = o.capital > 0 ? o.capital : 5000, dropShare = o.dropShare || 0.085, dragApr = o.dragApr ?? 0.015, weeks = o.weeks || 12, holdDays = weeks * 7;
    const ex = pickExecutionChain(row.chains), [txGas, bIn, wOut, gasSym] = ex.fee;
    const sc = [r2(Math.max(0.5, txGas + 0.5)), bIn, r2(txGas * 3), r2(txGas * 2), r2(txGas * weeks), r2(txGas * 2 + wOut)];
    const cashFees = r2(sc.reduce((a, b) => a + b, 0)), totalMin = 64 + weeks * 2, hours = totalMin / 60;
    const capitalDrag = capital * dragApr * (holdDays / 365), tbillBench = capital * 0.04 * (holdDays / 365);
    const tw = clamp(holdDays / Math.min(180, Math.max(45, (row.age_days || 150) * 0.25 + holdDays)), 0.35, 1);
    const sh = capital / (row.tvl_usd + capital), expectedDrop = row.implied_value_usd * dropShare * sh * tw, dropIfLaunches = row.launch_value_usd * dropShare * sh * tw;
    const netAfterFees = expectedDrop - cashFees, netAllIn = expectedDrop - cashFees - capitalDrag, netPerHour = netAllIn / hours, totalCost = cashFees + capitalDrag;
    const verdict = netAllIn > 0 && netPerHour >= 25 ? 'FARM' : (netAfterFees > 0 ? 'MARGINAL' : 'SKIP');
    const dpd = expectedDrop / capital, dragPd = dragApr * (holdDays / 365);
    const breakEvenDrop = row.implied_value_usd > 0 ? totalCost / Math.max(1e-9, row.implied_value_usd * sh * tw) : 1;
    const breakEvenOdds = dropIfLaunches > 0 ? totalCost / dropIfLaunches : 1;
    const breakEvenDeposit = dpd > dragPd ? Math.ceil(cashFees / (dpd - dragPd)) : null;
    return { chain: ex.chain, gasSym, txGas, capital, dropShare, weeks, holdDays, expectedDrop, dropIfLaunches, cashFees, capitalDrag, tbillBench, totalCost, netAllIn, totalMin, hours, netPerHour, verdict, breakEvenDrop, breakEvenOdds, breakEvenDeposit, sc };
  }

  /** Pick smallest capital (<= min($25k, 0.05% TVL)) & best horizon clearing FARM, else best $/h. */
  function optimalFarmScenario(row, o = {}) {
    const dropShare = o.dropShare || 0.085, dragApr = o.dragApr ?? 0.015;
    const maxCap = Math.min(25000, Math.max(2000, Math.round((row.tvl_usd * 0.0005) / 500) * 500));
    const caps = o.capital > 0 ? [o.capital] : [1500, 3000, 5000, 10000, 15000, 25000].filter((c) => c <= maxCap);
    const wks = o.weeks > 0 ? [o.weeks] : [6, 8, 12, 16, 20, 26];
    let bestF = null, bestA = null;
    for (const capital of (caps.length ? caps : [2000])) for (const weeks of wks) {
      const ev = evaluateFarmScenario(row, { capital, dropShare, dragApr, weeks });
      if (ev.verdict === 'FARM' && (!bestF || ev.capital < bestF.capital || (ev.capital === bestF.capital && ev.netPerHour > bestF.netPerHour))) bestF = ev;
      if (!bestA || ev.netPerHour > bestA.netPerHour) bestA = ev;
    }
    return bestF || bestA;
  }

  /** Build 8 concrete, costed & timed chronological farm steps for UI and board.json. */
  function buildFarmPlan(row, scIn) {
    const sc = scIn || optimalFarmScenario(row, { dropShare: 0.085 });
    const cap = `$${sc.capital.toLocaleString('en-US')}`, kind = playKindOf(row.category), exTvl = fmtUsd(Math.round(row.tvl_usd * 0.75));
    const sec = row.chains.find((c) => c !== sc.chain), gasBuf = Math.max(5, Math.ceil((sc.cashFees + 4) / 5) * 5);
    const ch7 = row.change_7d === null ? 'n/a' : `${row.change_7d >= 0 ? '+' : ''}${row.change_7d.toFixed(1)}%`, n = row.name, ch = sc.chain;
    const core = ({
      'Curated vault': `Deposit ${cap} USDC into ${n}'s flagship vault on ${ch} after a $100 test; hold shares.`,
      'Liquidity & swaps': `Add ${cap} to ${n}'s deepest stable/blue-chip pool on ${ch} and swap $250.`,
      'Supply & borrow': `Supply ${cap} USDC to ${n} (${ch}) and borrow 15% (health > 2.5).`,
      'Collateral mint': `Deposit ${cap} collateral on ${n} (${ch}) and mint 35% stablecoin (> 2.2x cushion).`,
      'Margin & volume': `Deposit ${cap} USDC margin on ${n} (${ch}) and run a small hedged perp.`,
      'Tokenized asset': `Complete onboarding if needed and subscribe ${cap} into ${n} on ${ch}.`,
      'Delta-neutral stake': `Mint ${cap} of ${n}'s basis stablecoin on ${ch} and stake natively.`,
      'Market volume': `Fund ${cap} on ${n} (${ch}) and place balanced liquidity across active markets.`,
      'Stake & delegate': `Stake ${cap} via ${n} on ${ch} and delegate to an active operator.`,
      'Cover pool': `Deposit ${cap} into ${n}'s underwriting pool on ${ch}; note exit cooldown.`
    })[kind] || `Deposit ${cap} USDC into ${n} on ${ch} after a $100 test.`;
    const S = (when, title, text, cost, min) => ({ when, title, text, cost, time: `${min} min` }), c = sc.sc, F = fmtMoney2;
    const steps = [
      S('Day 0 · Setup', 'Isolate wallet', `Fresh wallet on ${ch} for ${n}; fund $${gasBuf} ${sc.gasSym} gas.`, F(c[0]), 8),
      S('Day 0 · Verify', 'Audit contracts', `Open ${n} via DefiLlama slug "${row.slug}", bookmark app, check contracts.`, '$0.00', 6),
      S('Day 0 · Fund', `Route ${cap}`, `Withdraw ${cap} USDC to ${ch} (cheapest of ${row.chains.length} chain${row.chains.length === 1 ? '' : 's'}, ~${F(sc.txGas)}/tx).`, F(c[1]), 10),
      S('Day 1 · Core', kind, core, F(c[2]), 12),
      S('Day 2 · Deepen', 'Qualifying footprint', sec ? `Hold un-looped and make one touch on ${sec} for multi-chain credit.` : 'Hold un-looped and verify accrual on the official points page.', F(c[3]), 8),
      S(`Weekly ×${sc.weeks}`, 'Weekly cadence', `Touch position weekly for ${sc.weeks}w (top-up, rebalance, or vote).`, F(c[4]), sc.weeks * 2),
      S('Any day · Risk', 'Drawdown exit', `Exit early if TVL drops 25% to ${exTvl} (7d ${ch7}), queues > 7d, or snapshot lands.`, F(c[5]), 12),
      S(`Day ${sc.holdDays} · Claim`, 'Unwind & log', `Log wallet, hashes & ${cap} basis; unwind Day ${sc.holdDays}, claim via official link. Net ${F(sc.netAllIn)} (${F(sc.netPerHour)}/h).`, `${F(sc.capitalDrag)} drag`, 8),
    ];
    return { playKind: kind, steps, boardStrings: steps.map((s) => `${s.when} — ${s.text} Cost: ${s.cost}. Time: ${s.time}.`.slice(0, 596)) };
  }

  function computeSensitivity(row, sizeCurve, oddsModel) {
    const t = row.tvl_usd, y = (row.age_days || Math.round(oddsModel.medYr * 365)) / 365, g = row.change_7d;
    return [['As recorded (baseline)', t, y, g], ['TVL 30% lower', t * 0.7, y, g], ['TVL doubles (2x)', t * 2, y, g], ['7-day growth +20 pp', t, y, (g || 0) + 20], ['+12 months, still no token', t, y + 1, g]]
      .map(([label, tvl, yr, gr]) => { const lv = Math.exp(sizeCurve.predictLog(tvl)), odds = oddsModel.conditionalOdds(row, 2, yr, tvl, gr).odds, implied = Math.max(1, Math.round(lv * odds)); return { label, launchValue: Math.round(lv), odds, implied, ratio: implied / Math.max(1, row.implied_value_usd) }; });
  }

  function nearestComps(row, comps, sizeCurve, looPredBySlug, limit = 6) {
    const lt = Math.log(Math.max(1, row.tvl_usd));
    return comps.map((c) => {
      const same = c.category === row.category ? 0 : (sectorOf(c.category) === sectorOf(row.category) ? 0.8 : 1.8);
      const blind = looPredBySlug?.[c.slug] || Math.exp(sizeCurve.predictLog(c.tvl_usd));
      return { slug: c.slug, name: c.name, symbol: c.symbol, category: c.category, tvl_usd: c.tvl_usd, mcap_usd: c.mcap_usd, capPerTvl: c.mcap_usd / c.tvl_usd, missRatio: c.mcap_usd / blind, dist: Math.abs(Math.log(Math.max(1, c.tvl_usd)) - lt) + same };
    }).sort((a, b) => a.dist - b.dist || cmp(a.slug, b.slug)).slice(0, limit);
  }

  function verifyBoard(rows, snap, ref) {
    let sum = 0, mono = true; const wl = new Set(), parts = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; if (r.rank !== i + 1 || (i > 0 && r.implied_value_usd > rows[i - 1].implied_value_usd)) mono = false;
      sum += r.implied_value_usd; wl.add(r.slug); parts.push(`${r.rank}:${r.slug}:${r.implied_value_usd}`);
    }
    const checksum = fnv1a(parts.join('|')).toString(16).padStart(8, '0');
    return { rowCount: rows.length, monotonic: mono, totalImpliedUsd: sum, checksum, watchlistCovered: snap.watchlist.filter((s) => wl.has(s)).length, watchlistTotal: snap.watchlist.length, matchesMain: ref ? (checksum === ref.checksum && sum === ref.total_implied_usd && rows.length === ref.row_count) : true };
  }

  /** End-to-end deterministic pipeline: snapshot -> live-fitted models, ranked board & farm plans. */
  function buildRadar(snap, pre = null) {
    const uni = classifyUniverse(snap), med7d = median(snap.protocols.map((p) => p.change_7d).filter((v) => v !== null));
    const sizeCurve = fitSizeCurve(uni.comps), oddsModel = fitLaunchOdds(uni.peers, snap.as_of, med7d);
    const res = uni.comps.map((p) => Math.log(p.mcap_usd) - sizeCurve.predictLog(p.tvl_usd));
    const b = pre?.valCheck?.bands || { q10: cQuant(res, 0.1), q25: cQuant(res, 0.25), q75: cQuant(res, 0.75), q90: cQuant(res, 0.9) };
    const band = (v, q) => Math.max(1, Math.round(v * Math.exp(q)));
    const rows = uni.ranked.map((p) => {
      const age = ageDays(snap.as_of, p.listed_at), lv = Math.exp(sizeCurve.predictLog(p.tvl_usd)), od = oddsModel.conditionalOdds(p, 2);
      const imp = Math.max(1, Math.round(lv * od.odds)), cs = oddsModel.rates.catStats[p.category || '__none__'] || { n: 0, k: 0 };
      const tier = uni.wlSet.has(p.slug) ? 'watchlist' : (p.tvl_usd >= snap.floor_usd ? 'offlist' : 'early');
      return { ...p, sector: sectorOf(p.category), tier, kin_caution: uni.kinNoteBySlug[p.slug] || null, age_days: age, launch_value_usd: Math.round(lv), p_token_now: od.pNow, p_token_24m: od.pFuture, launch_odds: od.odds, cat_peers_total: cs.n, cat_peers_token: cs.k, implied_value_usd: imp, p10_usd: band(imp, b.q10), p25_usd: band(imp, b.q25), p75_usd: band(imp, b.q75), p90_usd: band(imp, b.q90) };
    }).sort((a, c) => c.implied_value_usd - a.implied_value_usd || cmp(a.slug, c.slug)).map((r, i) => {
      r.rank = i + 1; const rr = pre?.bootstrap?.rankRangeBySlug?.[r.slug] || [r.rank, r.rank];
      r.rank_low = rr[0]; r.rank_high = rr[1];
      const sc = optimalFarmScenario(r, { dropShare: 0.085 });
      r.farm = sc; r.farm_steps = buildFarmPlan(r, sc).boardStrings; return r;
    });
    const g = uni.groups;
    const ledger = [['ranked_watchlist','Watchlist','#4CC9F0'],['ranked_offlist','Off-list','#80D8FF'],['ranked_early','Early (<$50M)','#2EE59D'],['traded_priced','Traded comps','#F5B041'],['traded_nocap','Token no cap','#A57B32'],['out_bridge','Bridge','#64748B'],['out_staking','Staking','#526077'],['out_versioned','Versioned','#475569'],['out_cex','Exchange','#3B485C'],['out_wrapped','Wrapped','#334155'],['out_kin','Traded kin','#F97066']].map(([key, label, color]) => ({ key, label, count: g[key].length, color }));
    return { model_version: MODEL_VERSION, as_of: snap.as_of, universe: uni, ledger, sizeCurve, oddsModel, rows, verification: verifyBoard(rows, snap) };
  }

  const api = { MODEL_VERSION, ageDays, hasTok, median, cQuant, placebo, clamp, solveRidge, sectorOf, classifyUniverse, fitSizeCurve, fitLaunchOdds, evaluateFarmScenario, optimalFarmScenario, buildFarmPlan, computeSensitivity, nearestComps, verifyBoard, buildRadar, fmtUsd, fmtMoney2 };
  root.MeridianModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

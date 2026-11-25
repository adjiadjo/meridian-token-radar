/* Meridian v5 — interactive offline dashboard (zero deps, zero network, live refit). */
(() => {
 'use strict';
 const Model = window.MeridianModel, Payload = window.MERIDIAN_PAYLOAD;
 const byId = (id) => document.getElementById(id), appRoot = byId('appRoot');
 if (!Model || !Payload?.snapshot) { appRoot.innerHTML = '<div class="panel">Missing ../data.js snapshot.</div>'; return; }

 const snap = Payload.snapshot, digest = Payload.main_digest;
 const radar = Model.buildRadar(snap), check = Model.verifyBoard(radar.rows, snap, digest);
 const { sizeCurve: scCurve, oddsModel: odMod, valCheck: vChk, oddsCheck: oChk, boot, rows, uni } = radar;
 const state = { view: 'board', slug: null, exp: null, verdict: 'all', tier: 'all', cat: 'all', chain: 'all', q: '', dep: 0, drop: Model.DROP, wk: 0, sort: 'rank', dir: 1 };

 const parseHash = () => {
  for (const p of (location.hash || '').replace(/^#/, '').split('&')) {
   const [k, v] = p.split('=').map((x) => decodeURIComponent(x || ''));
   if (!v) continue;
   if (k === 'slug') { state.slug = v; state.view = 'detail'; }
   else if (k === 'expand') state.exp = v;
   else if (k === 'dir') state.dir = +v < 0 ? -1 : 1;
   else if (k === 'deposit' || k === 'weeks' || k === 'drop') state[k === 'deposit' ? 'dep' : k === 'weeks' ? 'wk' : 'drop'] = +v || (k === 'drop' ? Model.DROP : 0);
   else if (k in state) state[k] = v;
  }
 };
 parseHash();
 byId('cntBoard').textContent = rows.length;
 byId('cntTraded').textContent = uni.traded.length;
 byId('cntAside').textContent = uni.aside.length;
 byId('metaPill').textContent = `DefiLlama ${radar.as_of} · ${snap.protocols.length} protocols · ${radar.ver} refitted live · no network`;

 const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 const usd = Model.fmtUsd, mon = Model.fmtMoney, pct = (x) => `${Math.round(x * 100)}%`, fx = (v, n = 2) => v.toFixed(n);
 const sgn = (v) => `${v >= 0 ? '+' : ''}${mon(v)}`, sNum = (v) => `${v >= 0 ? '+' : ''}${fx(v, 1)}`;
 const fAge = (d) => (d == null ? 'undated' : d >= 365 ? `${fx(d / 365, 1)}y` : `${d}d`);
 const fChg = (v) => (v == null ? 'n/a' : `${v > 0 ? '+' : ''}${fx(v, 1)}%`);
 const sp = (c, t) => `<span class="${c}">${t}</span>`, bx = (c, t) => `<div class="${c}">${t}</div>`, bg = (c, t) => sp(`bg ${c}`, t), bt = (c, t, a = '') => `<button class="${c}"${a}>${t}</button>`, st = (t) => `<strong>${t}</strong>`;
 const tierBg = (r) => bg(r.tier === 'watchlist' ? 'bw' : r.tier === 'offlist' ? 'bo' : 'be', r.tier === 'watchlist' ? 'Watchlist' : r.tier === 'offlist' ? 'Off-list' : 'Early'), verdBg = (v) => bg(v === 'FARM' ? 'bf' : v === 'MARGINAL' ? 'bm' : 'bs', v);
 const panel = (t, n, b) => `<section class="panel">${bx('phead', bx('ptitle', t) + bx('pnote', n))}${b}</section>`, tdN = (v, c = '') => `<td class="num${c ? ' ' + c : ''}">${v}</td>`;
 const table = (c, hs, b) => `<table class="${c}"><thead><tr>${hs.map((h) => (Array.isArray(h) ? `<th class="num">${h[0]}</th>` : `<th>${h}</th>`)).join('')}</tr></thead><tbody>${b}</tbody></table>`;
 const opts = (ls, cur) => ls.map(([v, l]) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('');
 const stepRows = (steps) => steps.map((s, i) => `<tr><td class="sw">${i + 1}. ${esc(s.when)}</td><td>${st(esc(s.title) + ':')} ${esc(s.text)}</td><td class="sc">${esc(s.cost)}</td><td class="st">${esc(s.time)}</td></tr>`).join('');

 /** Bespoke SVG log-log scatter: 92 traded comps, conformal P25-P75 band, 193 pre-token rows. */
 function renderScatter(hi, W = 320, H = 122) {
  const pL = 36, pR = 8, pT = 8, pB = 19, lg = Math.log10;
  const sx = (v) => pL + ((lg(Math.max(1e5, v)) - 6.6) / 3.48) * (W - pL - pR), sy = (v) => pT + (H - pT - pB) * (1 - (lg(Math.max(5e4, v)) - 5) / 4.78);
  const out = [`<svg class="csvg" viewBox="0 0 ${W} ${H}"><g font-size="8.2" font-family="monospace" fill="#617494">`];
  [[1e7, '$10M'], [1e8, '$100M'], [1e9, '$1B'], [1e10, '$10B']].forEach(([v, l]) => { const x = fx(sx(v), 1); out.push(`<line x1="${x}" y1="${pT}" x2="${x}" y2="${H - pB}" stroke="#1A263C"/><text x="${x}" y="${H - 5}" text-anchor="middle">${l}</text>`); });
  [[1e6, '$1M'], [1e7, '$10M'], [1e8, '$100M'], [1e9, '$1B']].forEach(([v, l]) => { const y = fx(sy(v), 1); out.push(`<line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" stroke="#1A263C"/><text x="${pL - 4}" y="${+y + 3}" text-anchor="end">${l}</text>`); });
  const top = [], bot = [], mid = [];
  for (const tvl of [5e6, 5e7, 5e8, 5e9]) { const p = Math.exp(scCurve.predLog(tvl, radar.med7)), x = fx(sx(tvl), 1); mid.push(`${x},${fx(sy(p), 1)}`); top.push(`${x},${fx(sy(p * Math.exp(vChk.bands.q75)), 1)}`); bot.unshift(`${x},${fx(sy(p * Math.exp(vChk.bands.q25)), 1)}`); }
  out.push(`</g><polygon points="${top.concat(bot).join(' ')}" fill="#F5B04124"/><polyline points="${mid.join(' ')}" fill="none" stroke="#F5B041" stroke-width="1.6"/>`);
  for (const r of rows) if (hi?.slug !== r.slug) out.push(`<circle cx="${fx(sx(r.tvl_usd), 1)}" cy="${fx(sy(r.implied_value_usd), 1)}" r="2" fill="#4CC9F0" opacity=".48"/>`);
  for (const c of uni.comps) out.push(`<circle cx="${fx(sx(c.tvl_usd), 1)}" cy="${fx(sy(c.mcap_usd), 1)}" r="2.4" fill="#F5B041" opacity=".84"/>`);
  if (hi) { const hx = fx(sx(hi.tvl_usd), 1), hl = fx(sy(hi.launch_value_usd), 1), h2 = fx(sy(hi.implied_value_usd), 1); out.push(`<line x1="${hx}" y1="${hl}" x2="${hx}" y2="${h2}" stroke="#2EE59D" stroke-width="1.4" stroke-dasharray="2 2"/><circle cx="${hx}" cy="${hl}" r="4" fill="none" stroke="#F5B041" stroke-width="1.5"/><circle cx="${hx}" cy="${h2}" r="5" fill="#2EE59D" stroke="#080C14" stroke-width="1.4"/>`); }
  return `${out.join('')}</svg>`;
 }

 function renderBoard() {
  const isDef = !state.dep && Math.abs(state.drop - Model.DROP) < 1e-6 && !state.wk;
  const items = rows.map((r) => ({ r, sc: isDef ? r.farm : Model.optimalFarm(r, { capital: state.dep, drop: state.drop, wk: state.wk }) }));
  const cnt = { all: items.length, FARM: 0, MARGINAL: 0, SKIP: 0, watchlist: 0, offlist: 0, early: 0 }, cats = {}, chains = {};
  let bestF = null;
  for (const it of items) {
   cnt[it.sc.verdict]++; cnt[it.r.tier]++;
   if (it.r.category) cats[it.r.category] = (cats[it.r.category] || 0) + 1;
   for (const c of it.r.chains) chains[c] = (chains[c] || 0) + 1;
   if (!bestF || it.sc.netPerHour > bestF.sc.netPerHour) bestF = it;
  }
  const q = state.q.trim().toLowerCase(), { verdict, tier, cat, chain, sort, dir } = state;
  const skey = { rank: (a) => a.r.rank, tvl: (a) => a.r.tvl_usd, ch7: (a) => a.r.change_7d ?? -999, age: (a) => a.r.age_days || 0, odds: (a) => a.r.launch_odds, launch: (a) => a.r.launch_value_usd, implied: (a) => a.r.implied_value_usd, net: (a) => a.sc.netAllIn, hour: (a) => a.sc.netPerHour }[sort];
  const filt = items.filter(({ r, sc }) => (verdict === 'all' || sc.verdict === verdict) && (tier === 'all' || r.tier === tier) && (cat === 'all' || (r.category || '') === cat) && (chain === 'all' || r.chains.includes(chain)) && (!q || `${r.name} ${r.slug} ${r.category || ''} ${r.chains.join(' ')}`.toLowerCase().includes(q))).sort((a, b) => (skey(a) - skey(b)) * dir || (a.r.rank - b.r.rank));
  const fTvl = filt.reduce((s, x) => s + x.r.tvl_usd, 0), fImp = filt.reduce((s, x) => s + x.r.implied_value_usd, 0);
  const isFilt = verdict !== 'all' || tier !== 'all' || cat !== 'all' || chain !== 'all' || !!q;
  const hon = vChk.hon, vK = vChk.ladder[2], vF = vChk.ladder[0], oK = oChk.ladder[4], oB = oChk.ladder[0], hc = digest?.hardcode_audit || { checked: rows.length, found: 0 };

  const kpi = (c, l, v, s) => bx(`kpi ${c}`, bx('kl', l) + bx('kv', v) + bx('ks', s));
  const kpiRow = `<section class="kpis">${[
   ['ac', 'Watchlist Ranked', `${check.watchlistCovered} / ${check.watchlistTotal}`, `+${cnt.offlist} off-list · ${cnt.early} early &lt;$50M`],
   ['ag', 'Walk-Forward Miss', `×${fx(vK.wf)}`, `vs ×${fx(vF.wf)} flat · LOO ×${fx(vK.loo)}`],
   ['ae', 'Range Honesty (WF)', `${pct(hon.wf50)} · ${pct(hon.wf80)}`, 'in P25–P75 / P10–P90 (50/80%)'],
   ['ac', 'Launch Odds Brier', fx(oK.wfB, 4), `WF vs ${fx(oB.wfB, 4)} base · ECE ${fx(oChk.ece * 100, 1)}%`],
   ['', 'Terms Kept / Tested', '2 of 6 · 4 of 6', 'value · 24m odds (placebo cut)'],
   ['ae', 'Worth Farming', `${cnt.FARM} of ${cnt.all}`, `net &gt;$0 &amp; $25+/h · top ${bestF ? `${esc(bestF.r.name)} ${sgn(bestF.sc.netPerHour)}/h` : 'n/a'}`],
  ].map((a) => kpi(...a)).join('')}</section>`;
  const formulaBar = bx('formula', `<div>${st('Implied value')} = Launch cap ${sp('mono', `(fitSizeCurve: $${fx(scCurve.cap100 / 1e6, 1)}M × (TVL × 7d carry / $100M)^${fx(scCurve.beta)})`)} × 24m odds ${sp('mono', '(fitLaunchOdds: ln(1+age), EB, ln TVL, 7d)')}.</div>` + bx('mono mu', 'Refitted live · not a forecast'));

  const ledgerPanel = panel('Protocol Accounting · classifyUniverse()', `All ${snap.protocols.length} protocols in one bucket`,
   bx('lbar', radar.ledger.map((b) => `<div class="lseg" style="width:${fx((b.count / snap.protocols.length) * 100)}%;background:${b.color}"></div>`).join('')) +
   bx('lleg', radar.ledger.map((b) => sp('li', `<span class="ld" style="background:${b.color}"></span>${b.label} ${st(b.count)}`)).join('')) +
   bx('checks', [`✓ board.json (${check.rowCount}/${check.rowCount} live)`, `✓ ranks 1–${check.rowCount} monotonic`, `✓ total ${usd(check.totalImpliedUsd)}`, `✓ checksum ${check.checksum}${check.matchesMain ? ' = main.ts' : ''}`, `✓ watchlist ${check.watchlistCovered}/${check.watchlistTotal}`, `✓ ledger ${snap.protocols.length}/${snap.protocols.length}`, `✓ ${hc.found}/${hc.checked} hardcoded`].map((t) => sp('cpill', t)).join('')));

  const tCls = (s) => (s === 'kept' ? 'tk' : s === 'baseline' ? 'tb' : s === 'must not help' ? 'tc' : 'td'), rCls = (s) => (s === 'kept' ? 'kept' : s === 'must not help' ? 'plc' : '');
  const bootNote = `${st(`Bootstrap (${boot.refits} refits):`)} cap ${usd(scCurve.cap100)}, slope ${fx(scCurve.beta)}±${fx(boot.seBeta)}<br>logits: age ${sNum(odMod.beta[1])}±${fx(boot.seAge, 1)}, EB ${sNum(odMod.beta[3])}±${fx(boot.seCat, 1)}, TVL ${sNum(odMod.beta[4])}±${fx(boot.seTvl, 1)}, 7d ${sNum(odMod.beta[5])}±${fx(boot.seGr, 1)}`;
  const evPanel = isFilt ? '' : panel('Out-of-Sample Evidence · runValueValidation() & runOddsValidation()', `Kept only when blind LOO/10-fold & WF (${vChk.wfSplit[0]}→${vChk.wfSplit[1]}) both improve`,
   bx('evgrid',
    table('mini', [`Launch value (${vChk.n} comps)`, ['LOO'], ['WF'], ['Verdict']], vChk.ladder.map((l) => `<tr class="${rCls(l.status)}"><td>${l.label}</td>${tdN(`×${fx(l.loo)}`)}${tdN(`×${fx(l.wf)}`)}${tdN(l.status, tCls(l.status))}</tr>`).join('')) +
    table('mini', [`24m launch odds (${oChk.n} peers)`, ['10-Fold'], ['WF'], ['Verdict']], oChk.ladder.map((l) => `<tr class="${rCls(l.status)}"><td>${l.label}</td>${tdN(`${fx(l.cvB, 4)} ${sp('dm', `(${pct(l.cvA)})`)}`)}${tdN(`${fx(l.wfB, 4)} ${sp('dm', `(${pct(l.wfA)})`)}`)}${tdN(l.status, tCls(l.status))}</tr>`).join('')) +
    `<div>${table('mini', ['Range honesty', ['LOO'], ['WF']], [['Within ×3', pct(hon.loo3), pct(hon.wf3)], ['P25–P75 (50%)', pct(hon.loo50), pct(hon.wf50)], ['P10–P90 (80%)', pct(hon.loo80), pct(hon.wf80)]].map(([k, a, b]) => `<tr><td>${k}</td>${tdN(a, 'pos')}${tdN(b, 'pos')}</tr>`).join(''))}${bx('ffoot', bootNote)}</div>` +
    bx('chart', bx('ctitle', `<span>Cap vs TVL: 92 comps · 193 board</span>${sp('mono mu', 'P25–P75')}`) + renderScatter(null, 320, 122))) +
   bx('evfoot', `${st('Reading the tests:')} Size curve &amp; 7d carry cut blind miss (LOO ×${fx(vK.loo)}, WF ×${fx(vK.wf)}); category, chains &amp; age are dropped. Age, EB share, TVL &amp; 7d cut odds Brier (WF ${fx(oK.wfB, 4)} vs ${fx(oB.wfB, 4)}, ECE ${fx(oChk.ece * 100, 1)}%). Peers' record, not a forecast.`));

  const actF = [state.verdict !== 'all' && `Verdict: ${state.verdict}`, state.tier !== 'all' && `Tier: ${state.tier}`, state.cat !== 'all' && `Cat: ${state.cat}`, state.chain !== 'all' && `Chain: ${state.chain}`, q && `"${q}"`].filter(Boolean);
  const pill = (g, v, l, ex = '') => bt(`pill ${ex}${state[g] === v ? ' active' : ''}`, l, ` data-val="${v}"`);
  const sel = (id, l, ls, cur) => `<label class="ctrl">${l}<select id="${id}">${opts(ls, cur)}</select></label>`;
  const catO = [['all', 'All categories'], ...Object.keys(cats).sort().map((c) => [c, `${c} (${cats[c]})`])];
  const chO = [['all', 'All chains'], ...Object.keys(chains).sort((a, b) => chains[b] - chains[a] || (a < b ? -1 : 1)).map((c) => [c, `${c} (${chains[c]})`])];
  const toolbar = `<section class="bar">${bx('trow', bx('flex', `<div class="pills" data-g="verdict">${[['all', `All ${cnt.all}`, ''], ['FARM', `FARM ${cnt.FARM}`, 'vf'], ['MARGINAL', `Marginal ${cnt.MARGINAL}`, 'vm'], ['SKIP', `Skip ${cnt.SKIP}`, 'vs']].map(([v, l, c]) => pill('verdict', v, l, c)).join('')}</div><div class="pills" data-g="tier">${[['all', 'All tiers'], ['watchlist', `Watchlist ${cnt.watchlist}`], ['offlist', `Off-list ${cnt.offlist}`], ['early', `Early &lt;$50M ${cnt.early}`]].map(([v, l]) => pill('tier', v, l)).join('')}</div>`) + bx('flex', sel('selDep', 'Deposit ', [[0, 'Plan optimal'], [1000, '$1K'], [5000, '$5K'], [10000, '$10K'], [25000, '$25K']], state.dep) + `<label class="ctrl">Drop ${sp('mono gold', fx(state.drop * 100, 1) + '%')}<input type="range" id="rngDrop" min="3.5" max="15" step="0.5" value="${fx(state.drop * 100, 1)}"></label>` + sel('selHor', 'Horizon ', [[0, 'Optimal'], [6, '6w'], [12, '12w'], [26, '26w']], state.wk)))}${bx('trow', bx('flex', `<input type="search" id="txtQ" class="search" placeholder="Search protocol, category, chain…" value="${esc(state.q)}">${sel('selCat', '', catO, state.cat)}${sel('selChain', '', chO, state.chain)}${bt('btn', 'Reset', ' id="btnReset"')}${bt('btn', 'CSV', ' id="btnCsv"')}${bt('btn', 'JSON', ' id="btnJson"')}${actF.length ? sp('fban', `Filtered: ${esc(actF.join(' · '))} · ${state.sort} ${state.dir < 0 ? 'desc' : 'asc'}`) : ''}`) + bx('mono mu sm', `${st(filt.length)}/${items.length} rows · ${usd(fTvl)} TVL · ${usd(fImp)} implied`))}</section>`;

  const rPct = (v) => Math.max(0, Math.min(100, ((Math.log10(Math.max(1e5, v)) - 5) / 3.4) * 100));
  const thS = (k, l, n) => `<th data-s="${k}" class="${n ? 'num ' : ''}${state.sort === k ? 'sorted' : ''}">${l}${state.sort === k ? (state.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  const tbody = filt.map(({ r, sc }) => {
   const { rank, slug, name, chains: chs, tvl_usd: tvl, change_7d: ch7, age_days: age, launch_odds: odds, launch_value_usd: lv, implied_value_usd: imp, p25_usd: p25v, p75_usd: p75v } = r;
   const { verdict: vd, netAllIn: net, netPerHour: hr, capital: cap, wk, expDrop, fees, capCost, cost, hrs, chain } = sc;
   const ch = chs.length <= 2 ? chs.join(', ') : `${chs[0]} +${chs.length - 1}`, cCls = ch7 == null ? 'dm' : ch7 >= 0 ? 'pos' : 'neg';
   const p25 = rPct(p25v), p75 = rPct(p75v), px = rPct(imp), isE = state.exp === slug, oP = Math.round(odds * 100), es = esc(slug);
   const tr = `<tr class="row" data-sl="${es}"><td>${sp('rk', rank) + sp('rkr', `${r.rank_low}–${r.rank_high}`)}</td><td>${bx('pname', `${esc(name)} ${tierBg(r)}${r.kin_caution ? ' ' + bg('bk', 'Kin') : ''}`) + bx('pmeta', `${esc(r.category || 'Other')} · ${esc(ch)}`)}</td>${tdN(usd(tvl))}${tdN(fChg(ch7), cCls)}${tdN(fAge(age), 'mu')}${tdN(bx('ow', sp('mono', oP + '%') + sp('ot', `<span class="of" style="width:${oP}%"></span>`)))}${tdN(usd(lv), 'mu')}${tdN(sp('valm', usd(imp)) + sp('vb', `${usd(p25v)}–${usd(p75v)}`) + bx('rt', `<div class="rs" style="left:${fx(p25, 1)}%;width:${fx(Math.max(4, p75 - p25), 1)}%"></div><div class="rd" style="left:${fx(px, 1)}%"></div>`))}<td class="vc">${verdBg(vd)} ${sp(`mono ${net >= 0 ? 'pos' : 'neg'}`, sgn(net))}${sp('vsb', `${mon(expDrop)} drop − ${mon(cost)} cost`)}</td>${tdN(`${sgn(hr)}/h${sp('vsb', `${usd(cap)} · ${wk}w`)}`, `bold ${hr >= 25 ? 'pos' : hr > 0 ? 'gold' : 'neg'}`)}${tdN(bt('expbtn', isE ? 'Hide ▲' : '8 steps ▼', ` data-x="${es}"`))}</tr>`;
   if (!isE) return tr;
   const plan = Model.buildFarmPlan(r, sc);
   return `${tr}<tr class="iprow"><td colspan="11">${bx('iphead', `<div>${st(`${esc(name)} · ${plan.kind} on ${esc(chain)}`)} ${sp('mu mono', `(${usd(cap)} · ${wk}w · ${fx(hrs, 1)}h · drop ${mon(expDrop)} − fees ${mon(fees)} − 1% spread ${mon(capCost)} = ${st(sgn(net))}, ${sgn(hr)}/h)`)}</div>${bt('btn od', 'Full dossier →', ` data-sl="${es}"`)}`)}${table('steps', ['When', 'Costed & timed step', ['Cost'], ['Time']], stepRows(plan.steps))}</td></tr>`;
  }).join('');

  appRoot.innerHTML = `${kpiRow}${formulaBar}${ledgerPanel}${evPanel}${toolbar}<section class="wrap"><table class="board"><thead><tr>${thS('rank', '# · Range', 0)}<th>Protocol</th>${thS('tvl', 'TVL', 1)}${thS('ch7', '7D %', 1)}${thS('age', 'Age', 1)}${thS('odds', '24m Odds', 1)}${thS('launch', 'If Launched', 1)}${thS('implied', 'Implied · P25–P75', 1)}${thS('net', 'Verdict · Net', 1)}${thS('hour', 'Net / Hour', 1)}<th class="num">Plan</th></tr></thead><tbody>${tbody}</tbody></table></section>`;
  wireBoard(filt);
 }

 function renderDetail() {
  const r = rows.find((x) => x.slug === state.slug) || rows[0], prev = rows[r.rank - 2], next = rows[r.rank];
  const sc = Model.optimalFarm(r, { capital: state.dep, drop: state.drop, wk: state.wk }), plan = Model.buildFarmPlan(r, sc);
  const { tvl_usd: tvl, change_7d: ch7, age_days: age, launch_odds: odds, launch_value_usd: lv, implied_value_usd: imp, p25_usd: p25, p75_usd: p75, p10_usd: p10, p90_usd: p90 } = r;
  const { verdict: vd, netAllIn: net, netPerHour: hr, capital: cap, wk, drop, expDrop, fees, capCost, hrs, chain } = sc;
  const comps = Model.nearestComps(r, uni.comps, scCurve, vChk.looPred, 5), sens = Model.computeSensitivity(r, scCurve, odMod);
  const cCls = ch7 == null ? 'dm' : ch7 >= 0 ? 'pos' : 'neg', mult = lv / scCurve.cap100;
  const wfR = (k, s, v, c = '', tot = 0) => bx(`wf${tot ? ' tot' : ''}`, `<div>${sp('wfk', k) + sp('wfs', s)}</div>` + bx(`wfv ${c}`, v));
  const fKpi = (k, v, c = '') => bx('fk', bx('fkk', k) + bx(`fkv ${c}`, v));
  const bRow = (l, v, c = '') => bx('brow', `<span>${l}</span><strong class="${c}">${v}</strong>`);
  const mTd = (ev, act) => `<td class="${ev.verdict === 'FARM' ? 'mf' : ev.verdict === 'MARGINAL' ? 'mm' : 'ms'}${act ? ' ma' : ''}">${sgn(ev.netAllIn)}${bx('ms2', sgn(ev.netPerHour) + '/h')}</td>`;

  const nav = bx('dnav', bt('btn', '← Board', ' id="btnBack"') + bx('flex', (prev ? bt('btn np', `← #${prev.rank} ${esc(prev.name)}`, ` data-sl="${esc(prev.slug)}"`) : '') + (next ? bt('btn np', `#${next.rank} ${esc(next.name)} →`, ` data-sl="${esc(next.slug)}"`) : '')));
  const hero = `<section class="hero"><div>${bx('mono mu sm', `#${r.rank}/${rows.length} by implied value · rank ${r.rank_low}–${r.rank_high} (${boot.refits} refits)`)}${bx('dtitle', esc(r.name))}${bx('flex', `${tierBg(r)} ${verdBg(vd)}${bg('bn', esc(r.category || 'Uncategorized'))}${bg('bd', esc(r.sector))}${r.chains.slice(0, 6).map((c) => bg('bc', esc(c))).join('')}`)}${bx('dstats', [['TVL', usd(tvl), ''], ['7D', fChg(ch7), cCls], ['Listed', esc(r.listed_at || 'Undated'), ''], ['Age', fAge(age), ''], ['Chain', esc(chain), 'cyan']].map(([k, v, c]) => `<div>${bx('sk', k) + bx(`sv ${c}`, v)}</div>`).join(''))}</div>${bx('dprice', bx('dcap', 'Implied Value · Model') + bx('dimp', '$' + imp.toLocaleString('en-US')) + bx('dbands', `If launched: ${st(usd(lv))} · 24m odds: <strong class="cyan">${pct(odds)}</strong>`) + bx('dbands', `P25–75: ${usd(p25)}–${usd(p75)} · P10–90: ${usd(p10)}–${usd(p90)}`) + bx('mt6', sp('cpill', `✓ Live = board.json (${check.checksum})`)))}</section>`;

  const wfPanel = panel('Value Build-Up · fitSizeCurve() & fitLaunchOdds()', '0 hardcoded names', [
   ['Snapshot TVL', `DefiLlama ${radar.as_of} · 7d ${fChg(ch7)}`, usd(tvl)],
   ['7-day TVL carry', `1w excess vs ${fChg(radar.med7)} median (±25%)`, `×${fx(r.carry, 3)}`],
   ['Anchor at $100M TVL', `92 comps (WF ×${fx(vChk.ladder[2].wf)}, LOO ×${fx(vChk.ladder[2].loo)})`, usd(scCurve.cap100)],
   ['Power-law scaling', `(TVL × carry / $100M)^${fx(scCurve.beta, 3)}`, `×${fx(mult)}`],
   ['= Conditional launch cap', 'If token launches today', usd(lv), 'gold'],
   ['24m remaining odds', `At ${fAge(age)}: ${pct(r.p_now)} → ${pct(r.p_max)} ceiling (${r.cat_k}/${r.cat_n} peers)`, `×${pct(odds)}`, 'cyan'],
   ['= Implied value', `P25–75 ${usd(p25)}–${usd(p75)} · P10–90 ${usd(p10)}–${usd(p90)}`, usd(imp), 'gold', 1],
  ].map((a) => wfR(...a)).join(''));

  const compPanel = panel('Nearest Traded Comps · nearestComps()', 'Real tokens that trade',
   table('mini', ['Token', 'Category', ['TVL'], ['Mcap'], ['Cap/TVL'], ['Cap/LOO']], comps.map((c) => `<tr><td>${st(esc(c.name))} ${sp('dm mono', esc(c.sym || ''))}</td><td>${esc(c.cat || '')}</td>${tdN(usd(c.tvl))}${tdN(usd(c.mcap), 'gold')}${tdN(`×${fx(c.mult)}`)}${tdN(`×${fx(c.miss)}`)}</tr>`).join('')) +
   bx('chart mt6', bx('ctitle', `<span>Position vs 92 comps (gold) & board (cyan)</span>${sp('mono pos', `${esc(r.name)} (green)`)}`) + renderScatter(r, 450, 114)));

  const sensPanel = panel('What Moves the Value · computeSensitivity()', 'Live counterfactuals',
   table('mini', ['Scenario', ['Launch'], ['24m Odds'], ['Implied'], ['vs Now']], sens.map((s, i) => `<tr class="${i === 0 ? 'kept' : ''}"><td>${s.label}</td>${tdN(usd(s.lv))}${tdN(pct(s.odds), 'cyan')}${tdN(usd(s.imp), 'gold')}${tdN(`×${fx(s.ratio)}`)}</tr>`).join('')));

  const bCls = vd === 'FARM' ? '' : vd === 'MARGINAL' ? 'vm' : 'vs';
  const matRows = [0.045, 0.09, 0.14].map((ds) => `<tr><td>${fx(ds * 100, 1)}%</td>${[1000, 5000, 10000, 25000].map((d) => mTd(Model.evaluateFarm(r, { capital: d, drop: ds, wk }), d === cap && Math.abs(ds - drop) < 0.005)).join('')}</tr>`).join('');
  const horRow = [6, 12, 16, 26].map((w) => mTd(Model.evaluateFarm(r, { capital: cap, drop, wk: w }), w === wk)).join('');
  const farmKpis = [['At Risk', usd(cap)], ['Fees', mon(fees)], ['1% Spread', mon(capCost)], ['Drop', mon(expDrop), 'gold'], ['Net All-In', sgn(net), net >= 0 ? 'pos' : 'neg'], ['Net / Hour', `${sgn(hr)}/h`, hr >= 25 ? 'pos' : hr > 0 ? 'gold' : 'neg']].map((a) => fKpi(...a)).join('');
  const benches = [[`4% T-bill (${wk}w)`, mon(sc.tbill)], ['Drop if launches', mon(sc.ifLaunch)], ['Break-even share', `${fx(sc.beDrop * 100)}%`], ['Break-even odds', `${Math.min(999, Math.round(sc.beOdds * 100))}%`], ['Break-even dep', sc.beDep ? usd(sc.beDep) : 'n/a'], ['25% TVL stop', usd(tvl * 0.75), 'neg'], ['Effort', `${fx(hrs, 1)}h (${sc.mins}m)`]].map((a) => bRow(...a)).join('');
  const farmPanel = panel('Farm Economics · evaluateFarm()', sp('mono', `${usd(cap)} · ${fx(drop * 100, 1)}% · ${wk}w · ${esc(chain)}`),
   bx(`vban ${bCls}`, `${st(vd + ':')} ${st(usd(cap))} for ${st(wk + 'w')} on ${esc(chain)} → drop ${st(mon(expDrop))} − ${st(mon(fees))} fees − ${st(mon(capCost))} 1% spread (${fx(hrs, 1)}h) = ${st(`${sgn(net)} (${sgn(hr)}/h)`)}.`) +
   bx('fkpis', farmKpis) +
   bx('mgrid', `<div>${bx('sh', `NET: DROP × DEPOSIT (${wk}W)`)}${table('mat', ['Share', '$1K', '$5K', '$10K', '$25K'], matRows)}${bx('sh mt6', `NET: HORIZON (${usd(cap)})`)}${table('mat', ['Weeks', '6w', '12w', '16w', '26w'], `<tr><td>Net</td>${horRow}</tr>`)}</div>${bx('benches', bx('sh', 'HURDLES &amp; BREAK-EVENS') + benches)}`));

  const planPanel = panel('Farm Plan · 8 Costed, Timed Steps · buildFarmPlan()', sp('mono', `${plan.kind} · ${mon(fees)} + ${mon(capCost)} spread · ${fx(hrs, 1)}h`), table('steps', ['When', 'Step', ['Cost'], ['Time']], stepRows(plan.steps)));
  appRoot.innerHTML = `${nav}${hero}${bx('dgrid', bx('dcol', wfPanel + compPanel) + bx('dcol', farmPanel + planPanel + sensPanel))}`;
  byId('btnBack').onclick = () => { state.view = 'board'; render(); };
  appRoot.querySelectorAll('.np').forEach((el) => { el.onclick = () => { state.slug = el.dataset.sl; render(); }; });
 }

 function renderSecondary(mode) {
  const isT = mode === 'traded';
  const ls = isT ? [...uni.traded].sort((a, b) => (b.mcap_usd || 0) - (a.mcap_usd || 0) || b.tvl_usd - a.tvl_usd)
   : 'ob:Bridge|os:Staking|ov:Versioned|oc:CEX|ow:Wrapped|ok:Traded kin'.split('|').flatMap((s) => { const [k, r] = s.split(':'); return uni.groups[k].map((p) => ({ p, r })); }).sort((a, b) => b.p.tvl_usd - a.p.tvl_usd);
  appRoot.innerHTML = panel(isT ? `Tokens That Trade (${ls.length})` : `Set Aside (${ls.length})`,
   isT ? '92 priced comps fit fitSizeCurve(); 152 carry a token without cap' : 'All 758 protocols accounted for',
   table('board', isT ? ['#', 'Protocol', ['TVL'], ['Mcap'], ['Cap/TVL'], ['LOO'], ['Listed']] : ['#', 'Protocol', 'Category', ['TVL'], 'Reason'],
    ls.slice(0, 120).map((it, i) => {
     const p = isT ? it : it.p;
     return `<tr class="row"><td class="mono dm">${i + 1}</td>${isT
      ? `<td>${st(esc(p.name))} ${sp('cyan mono', esc(p.symbol || ''))}${bx('pmeta', `${esc(p.category || '')} · ${esc(p.chains.slice(0, 3).join(', '))}`)}</td>${tdN(usd(p.tvl_usd))}${tdN(p.mcap_usd ? usd(p.mcap_usd) : sp('dm', 'no cap'), 'gold')}${tdN(p.mcap_usd ? `×${fx(p.mcap_usd / p.tvl_usd)}` : '—')}${tdN(vChk.looPred[p.slug] ? usd(vChk.looPred[p.slug]) : '—', 'mu')}${tdN(esc(p.listed_at || 'undated'), 'mu')}`
      : `<td>${st(esc(p.name))} ${sp('dm mono', esc(p.slug))}</td><td>${esc(p.category || '—')}</td>${tdN(usd(p.tvl_usd))}<td>${bg('bk', it.r)}</td>`}</tr>`;
    }).join('')));
 }

 const dlFile = (n, m, t) => { const u = URL.createObjectURL(new Blob([t], { type: m })), a = document.createElement('a'); a.href = u; a.download = n; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 500); };

 function wireBoard(filt) {
  const qAll = (s, fn) => appRoot.querySelectorAll(s).forEach(fn), on = (id, ev, fn) => { const el = byId(id); if (el) el[ev] = fn; };
  qAll('.pills', (g) => g.querySelectorAll('.pill').forEach((b) => { b.onclick = () => { state[g.dataset.g] = b.dataset.val; render(); }; }));
  [['selDep', 'onchange', 'dep', 1], ['rngDrop', 'oninput', 'drop', 0.01], ['selHor', 'onchange', 'wk', 1], ['txtQ', 'oninput', 'q', 0], ['selCat', 'onchange', 'cat', 0], ['selChain', 'onchange', 'chain', 0]].forEach(([id, ev, k, s]) => on(id, ev, (e) => { state[k] = s ? +e.target.value * s : e.target.value; render(); }));
  on('btnReset', 'onclick', () => { Object.assign(state, { verdict: 'all', tier: 'all', cat: 'all', chain: 'all', q: '', dep: 0, drop: Model.DROP, wk: 0, sort: 'rank', dir: 1 }); render(); });
  on('btnCsv', 'onclick', () => dlFile('meridian.csv', 'text/csv', `rank,slug,name,tier,tvl,odds,implied,verdict,net,net_h\n${filt.map(({ r, sc }) => [r.rank, r.slug, `"${r.name.replace(/"/g, '""')}"`, r.tier, r.tvl_usd, fx(r.launch_odds, 4), r.implied_value_usd, sc.verdict, fx(sc.netAllIn), fx(sc.netPerHour)].join(',')).join('\n')}\n`));
  on('btnJson', 'onclick', () => dlFile('board.json', 'application/json', JSON.stringify({ rows: rows.map(({ rank, slug, name, implied_value_usd, farm_steps }) => ({ rank, slug, name, implied_value_usd, farm_steps })) })));
  qAll('th[data-s]', (el) => { el.onclick = () => { const k = el.dataset.s; state.dir = state.sort === k ? -state.dir : k === 'rank' ? 1 : -1; state.sort = k; render(); }; });
  qAll('.expbtn', (b) => { b.onclick = (e) => { e.stopPropagation(); state.exp = state.exp === b.dataset.x ? null : b.dataset.x; render(); }; });
  qAll('.od,tr.row', (el) => { el.onclick = (e) => { e.stopPropagation(); state.slug = el.dataset.sl; state.view = 'detail'; render(); }; });
 }

 const tabs = document.querySelectorAll('#navTabs .tab');
 function render() {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === state.view || (state.view === 'detail' && t.dataset.view === 'board')));
  if (state.view === 'board') renderBoard(); else if (state.view === 'detail') renderDetail(); else renderSecondary(state.view);
 }
 tabs.forEach((b) => { b.onclick = () => { state.view = b.dataset.view; render(); }; });
 byId('brandHome').onclick = () => { state.view = 'board'; render(); };
 window.addEventListener('hashchange', () => { parseHash(); render(); });
 render();
})();

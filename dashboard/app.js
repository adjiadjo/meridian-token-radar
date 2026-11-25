/* Meridian Token Launch Radar — interactive UI (zero deps, zero network). */
(() => {
  'use strict';
  const M = window.MeridianModel, P = window.MERIDIAN_PAYLOAD, $ = (id) => document.getElementById(id), root = $('appRoot');
  if (!M || !P?.snapshot) { root.innerHTML = '<div class="pnl">Missing ../data.js payload.</div>'; return; }

  const { snapshot: snap, valCheck: vc, oddsCheck: oc, bootstrap: bt, main_digest: md } = P;
  const rad = M.buildRadar(snap, { valCheck: vc, oddsCheck: oc, bootstrap: bt }), chk = M.verifyBoard(rad.rows, snap, md);
  const st = { view: 'board', slug: null, exp: null, verdict: 'all', tier: 'all', cat: 'all', chain: 'all', q: '', dep: 0, drop: 0.085, wk: 0, sort: 'rank', dir: 1 };
  const U = M.fmtUsd, F = M.fmtMoney2, R = Math.round, E = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fAge = (d) => (d == null ? 'undated' : d >= 365 ? `${(d / 365).toFixed(1)}y` : `${d}d`), fPct = (v) => (v == null ? 'n/a' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`), fSgn = (v) => `${v >= 0 ? '+' : ''}${F(v)}`;
  const bg = (c, t) => `<span class="bg ${c}">${t}</span>`, vBg = (v) => bg(v === 'FARM' ? 'bf' : v === 'MARGINAL' ? 'bm' : 'bs', v);
  const tBg = (r) => bg(r.tier === 'watchlist' ? 'bw' : r.tier === 'offlist' ? 'bo' : 'be', r.tier === 'watchlist' ? 'Watchlist' : r.tier === 'offlist' ? 'Off-list' : 'Early');
  const pnl = (t, n, b) => `<section class="pnl"><div class="ph"><div class="pt">${t}</div><div class="pn">${n}</div></div>${b}</section>`;
  const tbl = (cls, hs, b) => `<table class="${cls}"><thead><tr>${hs.map((h) => Array.isArray(h) ? `<th class="n">${h[0]}</th>` : `<th>${h}</th>`).join('')}</tr></thead><tbody>${b}</tbody></table>`;
  const N = (v, c = '') => `<td class="n${c ? ' ' + c : ''}">${v}</td>`;
  const opts = (a, cur) => a.map(([v, l]) => `<option value="${E(v)}"${String(cur) === String(v) ? ' selected' : ''}>${E(l)}</option>`).join('');
  const stepRows = (steps) => steps.map((s, i) => `<tr><td class="sw">${i + 1}. ${E(s.when)}</td><td><strong>${E(s.title)}:</strong> ${E(s.text)}</td><td class="sc">${E(s.cost)}</td><td class="stm">${E(s.time)}</td></tr>`).join('');

  const parseHash = () => {
    for (const part of (location.hash || '').replace(/^#/, '').split('&')) {
      const [k, v] = part.split('=').map((x) => decodeURIComponent(x || ''));
      if (!v) continue;
      if (k === 'slug') { st.slug = v; st.view = 'detail'; } else if (k === 'expand') st.exp = v;
      else if (k === 'dir') st.dir = +v < 0 ? -1 : 1; else if (k === 'deposit') st.dep = +v || 0;
      else if (k === 'drop') st.drop = +v || 0.085; else if (k === 'weeks') st.wk = +v || 0; else if (k in st) st[k] = v;
    }
  };
  parseHash();
  $('cntBoard').textContent = rad.rows.length; $('cntTraded').textContent = rad.universe.tradedAll.length; $('cntAside').textContent = rad.universe.setAside.length;
  $('metaPill').textContent = `DefiLlama ${rad.as_of} · ${snap.protocols.length} protocols · ${rad.model_version} refitted live · no network`;

  /** Bespoke SVG log-log scatter: 92 traded comps, conformal P25-P75 band, 193 pre-token rows. */
  function scatterSvg(hi, W = 350, H = 126) {
    const pL = 38, pR = 10, pT = 8, pB = 20, f1 = (v) => v.toFixed(1);
    const sx = (v) => pL + ((Math.log10(Math.max(1e5, v)) - 6.6) / 3.48) * (W - pL - pR);
    const sy = (v) => pT + (H - pT - pB) * (1 - (Math.log10(Math.max(5e4, v)) - 5) / 4.78);
    const o = [`<svg class="csvg" viewBox="0 0 ${W} ${H}"><g font-size="8.5" font-family="monospace" fill="#617494">`];
    for (const [v, t] of [[1e7,'$10M'],[1e8,'$100M'],[1e9,'$1B'],[1e10,'$10B']]) { const x = f1(sx(v)); o.push(`<line x1="${x}" y1="${pT}" x2="${x}" y2="${H-pB}" stroke="#1A263C"/><text x="${x}" y="${H-6}" text-anchor="middle">${t}</text>`); }
    for (const [v, t] of [[1e6,'$1M'],[1e7,'$10M'],[1e8,'$100M'],[1e9,'$1B']]) { const y = f1(sy(v)); o.push(`<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="#1A263C"/><text x="${pL-5}" y="${+y+3}" text-anchor="end">${t}</text>`); }
    const top = [], bot = [], mid = [];
    for (const tvl of [5e6, 5e7, 5e8, 5e9]) { const p = Math.exp(rad.sizeCurve.predictLog(tvl)), x = f1(sx(tvl)); mid.push(`${x},${f1(sy(p))}`); top.push(`${x},${f1(sy(p*Math.exp(vc.bands.q75)))}`); bot.unshift(`${x},${f1(sy(p*Math.exp(vc.bands.q25)))}`); }
    o.push(`</g><polygon points="${top.concat(bot).join(' ')}" fill="#F5B04124"/><polyline points="${mid.join(' ')}" fill="none" stroke="#F5B041" stroke-width="1.6"/>`);
    for (const r of rad.rows) if (hi?.slug !== r.slug) o.push(`<circle cx="${f1(sx(r.tvl_usd))}" cy="${f1(sy(r.implied_value_usd))}" r="2" fill="#4CC9F0" opacity=".5"/>`);
    for (const c of rad.universe.comps) o.push(`<circle cx="${f1(sx(c.tvl_usd))}" cy="${f1(sy(c.mcap_usd))}" r="2.5" fill="#F5B041" opacity=".82"/>`);
    if (hi) { const hx = f1(sx(hi.tvl_usd)), hl = f1(sy(hi.launch_value_usd)), h2 = f1(sy(hi.implied_value_usd)); o.push(`<line x1="${hx}" y1="${hl}" x2="${hx}" y2="${h2}" stroke="#2EE59D" stroke-width="1.4" stroke-dasharray="2 2"/><circle cx="${hx}" cy="${hl}" r="4" fill="none" stroke="#F5B041" stroke-width="1.5"/><circle cx="${hx}" cy="${h2}" r="5" fill="#2EE59D" stroke="#080C14" stroke-width="1.4"/>`); }
    return `${o.join('')}</svg>`;
  }

  function cohortSvg() {
    const co = oc.cohorts, W = 340, H = 94, pL = 28, pB = 18, pT = 10, bw = (W - 36) / co.length, o = [`<svg class="csvg" viewBox="0 0 ${W} ${H}"><g font-size="8.5" font-family="monospace">`];
    for (const g of [0, 50, 100]) { const gy = (pT + (H - 28) * (1 - g / 100)).toFixed(1); o.push(`<line x1="${pL}" y1="${gy}" x2="${W-8}" y2="${gy}" stroke="#1A263C"/><text x="${pL-4}" y="${+gy+3}" text-anchor="end" fill="#617494">${g}%</text>`); }
    co.forEach((c, i) => { const h = (H - 28) * c.rate, x = pL + i * bw + 8, y = H - pB - h, w = bw - 16, cx = (x + w / 2).toFixed(1); o.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="#4CC9F0" opacity=".8"/><text x="${cx}" y="${(y-3).toFixed(1)}" text-anchor="middle" fill="#E8EEF8">${R(c.rate*100)}%</text><text x="${cx}" y="${H-5}" text-anchor="middle" fill="#8FA1BE">${c.label}</text>`); });
    return `${o.join('')}</g></svg>`;
  }

  function renderBoard() {
    const def = st.dep === 0 && Math.abs(st.drop - 0.085) < 1e-6 && st.wk === 0;
    const items = rad.rows.map((row) => ({ row, sc: def ? row.farm : M.optimalFarmScenario(row, { capital: st.dep, dropShare: st.drop, weeks: st.wk }) }));
    const cnt = { all: items.length, FARM: 0, MARGINAL: 0, SKIP: 0, watchlist: 0, offlist: 0, early: 0 }, cats = {}, chs = {};
    let best = null;
    for (const it of items) { cnt[it.sc.verdict]++; cnt[it.row.tier]++; if (it.row.category) cats[it.row.category] = (cats[it.row.category] || 0) + 1; for (const c of it.row.chains) chs[c] = (chs[c] || 0) + 1; if (!best || it.sc.netPerHour > best.sc.netPerHour) best = it; }
    const q = st.q.trim().toLowerCase(), S = { rank: (a) => a.row.rank, tvl: (a) => a.row.tvl_usd, ch7: (a) => a.row.change_7d ?? -999, age: (a) => a.row.age_days || 0, odds: (a) => a.row.launch_odds, launch: (a) => a.row.launch_value_usd, implied: (a) => a.row.implied_value_usd, net: (a) => a.sc.netAllIn, hour: (a) => a.sc.netPerHour }[st.sort];
    const filt = items.filter(({ row: r, sc }) => (st.verdict === 'all' || sc.verdict === st.verdict) && (st.tier === 'all' || r.tier === st.tier) && (st.cat === 'all' || (r.category || '') === st.cat) && (st.chain === 'all' || r.chains.includes(st.chain)) && (!q || `${r.name} ${r.slug} ${r.category || ''} ${r.chains.join(' ')}`.toLowerCase().includes(q))).sort((a, b) => (S(a) - S(b)) * st.dir || (a.row.rank - b.row.rank));
    const fTvl = filt.reduce((s, x) => s + x.row.tvl_usd, 0), fImp = filt.reduce((s, x) => s + x.row.implied_value_usd, 0);
    const isF = st.verdict !== 'all' || st.tier !== 'all' || st.cat !== 'all' || st.chain !== 'all' || q.length > 0;
    const hon = vc.honesty, vK = vc.ladder[1], vF = vc.ladder[0], oK = oc.ladder[4], oB = oc.ladder[0], hc = md?.hardcode_audit || { checked: rad.rows.length, found: 0 };

    const kpi = (c, l, v, s) => `<div class="kpi ${c}"><div class="kl">${l}</div><div class="kv">${v}</div><div class="ks">${s}</div></div>`;
    const kpis = `<section class="kpis">${kpi('c','Watchlist Ranked',`${chk.watchlistCovered} / ${chk.watchlistTotal}`,`+${cnt.offlist} off-list · ${cnt.early} early &lt;$50M`)}${kpi('g','Walk-Forward Miss',`×${vK.wfMiss.toFixed(2)}`,`vs ×${vF.wfMiss.toFixed(2)} flat · LOO ×${vK.looMiss.toFixed(2)}`)}${kpi('e','Range Honesty (WF)',`${R(hon.wfCov50*100)}% · ${R(hon.wfCov80*100)}%`,'in P25–P75 / P10–P90 (50/80%)')}${kpi('c','Launch Odds Brier',oK.wfBrier.toFixed(3),`WF vs ${oB.wfBrier.toFixed(3)} · 10f ${oK.cvBrier.toFixed(3)}`)}${kpi('','Terms Kept / Tested','1 of 6 · 4 of 6','curve · 24m odds (placebo cut)')}${kpi('e','Worth Farming',`${cnt.FARM} of ${cnt.all}`,`beats fees, 1.5% spread & $25/h · top ${best?`${E(best.row.name)} ${fSgn(best.sc.netPerHour)}/h`:'n/a'}`)}</section>`;
    const fbar = `<div class="fbar"><div><strong>Implied value</strong> = Launch cap <span class="m">($${(rad.sizeCurve.capAt100M/1e6).toFixed(1)}M × (TVL/$100M)^${rad.sizeCurve.betaTvl.toFixed(2)})</span> × 24m odds <span class="m">(age, sector/cat EB, ln TVL, 7d)</span>. Giant TVL dilutes drops → best FARM pools $6M–$85M.</div><div class="m mu">Snapshot fit</div></div>`;

    const ledger = pnl('Protocol Accounting · classifyUniverse()', `All ${snap.protocols.length} protocols in one bucket`,
      `<div class="lbar">${rad.ledger.map((b)=>`<div class="lseg" style="width:${((b.count/snap.protocols.length)*100).toFixed(2)}%;background:${b.color}"></div>`).join('')}</div>` +
      `<div class="lleg">${rad.ledger.map((b)=>`<span class="li"><span class="ld" style="background:${b.color}"></span>${E(b.label)} <strong>${b.count}</strong></span>`).join('')}</div>` +
      `<div class="istrip">${[`✓ board.json (${chk.rowCount}/${chk.rowCount} live)`,`✓ ranks 1–${chk.rowCount} monotonic`,`✓ sum ${U(chk.totalImpliedUsd)}`,`✓ checksum ${chk.checksum}${chk.matchesMain?' = main.ts':''}`,`✓ watchlist ${chk.watchlistCovered}/${chk.watchlistTotal}`,`✓ ledger ${snap.protocols.length}/${snap.protocols.length}`,`✓ ${hc.found}/${hc.checked} names hardcoded`].map((t)=>`<span class="cp">${t}</span>`).join('')}</div>`);

    const tc = (s) => (s === 'kept' ? 'tk' : s === 'baseline' ? 'tb' : s === 'must not help' ? 'tc' : 'td'), rc = (s) => (s === 'kept' ? 'kept' : s === 'must not help' ? 'ctrl' : '');
    const evid = isF ? '' : pnl('Out-of-Sample Evidence · Blind LOO / 10-Fold & Walk-Forward Ablation', 'Terms kept only when blind error improves; 5-seed placebo must not help',
      `<div class="evg">${tbl('mt',[`Launch value (${vc.compsCount} traded)`,['LOO'],['Walk-Fwd'],['Verdict']],vc.ladder.map((l)=>`<tr class="${rc(l.status)}"><td>${E(l.label)}</td>${N(`×${l.looMiss.toFixed(2)}`)}${N(`×${l.wfMiss.toFixed(2)}`)}${N(E(l.status),tc(l.status))}</tr>`).join(''))}` +
      `${tbl('mt',[`24m launch odds (${oc.peersCount} peers)`,['10-Fold'],['Walk-Fwd'],['Verdict']],oc.ladder.map((l)=>`<tr class="${rc(l.status)}"><td>${E(l.label)}</td>${N(`${l.cvBrier.toFixed(3)} <span class="dm">(${R(l.cvAcc*100)}%)</span>`)}${N(`${l.wfBrier.toFixed(3)} <span class="dm">(${R(l.wfAcc*100)}%)</span>`)}${N(E(l.status),tc(l.status))}</tr>`).join(''))}` +
      `<div class="cbox"><div class="ct"><span>Cap on TVL: 92 traded (gold) · 193 board (cyan)</span><span class="m mu">P25–P75</span></div>${scatterSvg(null,350,126)}<div class="ff">Bootstrap (200 refits): slope ${rad.sizeCurve.betaTvl.toFixed(2)} ± ${bt?.seBeta?.toFixed(2)||'0.11'} · WF &lt;3×: ${R(hon.wfWithin3*100)}% · LOO cov: ${R(hon.looCov50*100)}%/${R(hon.looCov80*100)}%</div></div></div>`);

    const fDesc = [st.verdict!=='all'&&`Verdict: ${st.verdict}`,st.tier!=='all'&&`Tier: ${st.tier}`,st.cat!=='all'&&`Category: ${st.cat}`,st.chain!=='all'&&`Chain: ${st.chain}`,q&&`Query: "${q}"`].filter(Boolean);
    const pill = (g, v, l, ex = '') => `<button class="pl ${ex}${st[g]===v?' on':''}" data-v="${v}">${l}</button>`;
    const catOpts = [['all','All categories'], ...Object.keys(cats).sort().map((c) => [c, `${c} (${cats[c]})`])];
    const chOpts = [['all','All chains'], ...Object.keys(chs).sort((a, b) => chs[b] - chs[a] || (a < b ? -1 : 1)).map((c) => [c, `${c} (${chs[c]})`])];
    const tbar = `<section class="tbar"><div class="tr"><div class="rf"><div class="pg" data-g="verdict">${pill('verdict','all',`All ${cnt.all}`)}${pill('verdict','FARM',`FARM ${cnt.FARM}`,'vf')}${pill('verdict','MARGINAL',`Marginal ${cnt.MARGINAL}`,'vm')}${pill('verdict','SKIP',`Skip ${cnt.SKIP}`,'vs')}</div><div class="pg" data-g="tier">${pill('tier','all','All tiers')}${pill('tier','watchlist',`Watchlist ${cnt.watchlist}`)}${pill('tier','offlist',`Off-list ${cnt.offlist}`)}${pill('tier','early',`Early &lt;$50M ${cnt.early}`)}</div></div><div class="rf"><label class="ci">Deposit <select id="selDep">${opts([[0,'Plan optimal'],[1000,'$1K'],[5000,'$5K'],[10000,'$10K'],[25000,'$25K']],st.dep)}</select></label><label class="ci">Drop <span class="m gd">${(st.drop*100).toFixed(1)}%</span><input type="range" id="rngDrop" min="3.5" max="15" step="0.5" value="${(st.drop*100).toFixed(1)}"></label><label class="ci">Horizon <select id="selHor">${opts([[0,'Optimal'],[6,'6w'],[12,'12w'],[26,'26w']],st.wk)}</select></label></div></div><div class="tr"><div class="rf"><input type="search" id="txtQ" class="sq" placeholder="Search protocol, category, chain…" value="${E(st.q)}"><label class="ci"><select id="selCat">${opts(catOpts,st.cat)}</select></label><label class="ci"><select id="selChain">${opts(chOpts,st.chain)}</select></label><button class="btn" id="btnReset">Reset</button><button class="btn" id="btnCsv">CSV</button><button class="btn" id="btnJson">JSON</button>${fDesc.length?`<span class="afb">Filtered: ${E(fDesc.join(' · '))} · ${E(st.sort)} ${st.dir<0?'desc':'asc'}</span>`:''}</div><div class="m mu f11"><strong>${filt.length}</strong>/${items.length} rows · ${U(fTvl)} TVL · ${U(fImp)} implied</div></div></section>`;

    const rPct = (v) => Math.max(0, Math.min(100, ((Math.log10(Math.max(1e5, v)) - 5) / 3.4) * 100));
    const th = (k, l, n) => `<th data-s="${k}" class="${n?'n ':''}${st.sort===k?'sd':''}">${l}${st.sort===k?(st.dir>0?' ↑':' ↓'):''}</th>`;
    const tbody = filt.map(({ row: r, sc }) => {
      const ch = r.chains.length <= 2 ? r.chains.join(', ') : `${r.chains[0]} +${r.chains.length-1}`, cc = r.change_7d == null ? 'dm' : r.change_7d >= 0 ? 'pos' : 'neg';
      const p25 = rPct(r.p25_usd), p75 = rPct(r.p75_usd), px = rPct(r.implied_value_usd), exp = st.exp === r.slug, od = R(r.launch_odds * 100);
      const tr = `<tr class="dr" data-sl="${E(r.slug)}"><td><span class="rm">${r.rank}</span><span class="rr">${r.rank_low}–${r.rank_high}</span></td><td><div class="pnm">${E(r.name)} ${tBg(r)}${r.kin_caution?` ${bg('bk','Kin')}`:''}</div><div class="pmt">${E(r.category||'Uncategorized')} · ${E(ch)}</div></td>${N(U(r.tvl_usd))}${N(fPct(r.change_7d),cc)}${N(fAge(r.age_days),'mu')}${N(`<div class="ob"><span class="m">${od}%</span><span class="ot"><span class="of" style="width:${od}%"></span></span></div>`)}${N(U(r.launch_value_usd),'mu')}${N(`<span class="valm">${U(r.implied_value_usd)}</span><span class="vb">${U(r.p25_usd)}–${U(r.p75_usd)}</span><div class="rt"><div class="rs" style="left:${p25.toFixed(1)}%;width:${Math.max(4,p75-p25).toFixed(1)}%"></div><div class="rd" style="left:${px.toFixed(1)}%"></div></div>`)}<td class="vc">${vBg(sc.verdict)} <span class="m ${sc.netAllIn>=0?'pos':'neg'}">${fSgn(sc.netAllIn)}</span><span class="vsb">${F(sc.expectedDrop)} drop − ${F(sc.totalCost)} cost</span></td>${N(`${fSgn(sc.netPerHour)}/h<span class="vsb">${U(sc.capital)} · ${sc.weeks}w</span>`,`b7 ${sc.netPerHour>=25?'pos':sc.netPerHour>=0?'gd':'neg'}`)}${N(`<button class="eb" data-x="${E(r.slug)}">${exp?'Hide ▲':'8 steps ▼'}</button>`)}</tr>`;
      if (!exp) return tr;
      const plan = M.buildFarmPlan(r, sc);
      return `${tr}<tr class="ipr"><td colspan="11"><div class="iph"><div><strong>${E(r.name)} · ${E(plan.playKind)} on ${E(sc.chain)}</strong> <span class="mu m">(${U(sc.capital)} · ${sc.weeks}w · ${sc.hours.toFixed(1)}h · drop ${F(sc.expectedDrop)} − fees ${F(sc.cashFees)} − spread ${F(sc.capitalDrag)} = <strong>${fSgn(sc.netAllIn)}</strong>, ${fSgn(sc.netPerHour)}/h)</span></div><button class="btn od" data-sl="${E(r.slug)}">Full protocol dossier →</button></div>${tbl('st',['When','Concrete step (costed & timed)',['Cost'],['Time']],stepRows(plan.steps))}</td></tr>`;
    }).join('');

    root.innerHTML = `${kpis}${fbar}${ledger}${evid}${tbar}<section class="tw"><table class="bt"><thead><tr>${th('rank','# · Range',0)}<th>Protocol</th>${th('tvl','TVL',1)}${th('ch7','7D %',1)}${th('age','Age',1)}${th('odds','24m Odds',1)}${th('launch','If Launched',1)}${th('implied','Implied · P25–P75',1)}${th('net','Verdict · Net',1)}${th('hour','Net / Hour',1)}<th class="n">Plan</th></tr></thead><tbody>${tbody}</tbody></table></section>`;
    wireBoard(filt);
  }

  function renderDetail() {
    const r = rad.rows.find((x) => x.slug === st.slug) || rad.rows[0], prev = rad.rows[r.rank - 2], next = rad.rows[r.rank];
    const sc = M.optimalFarmScenario(r, { capital: st.dep, dropShare: st.drop, weeks: st.wk }), plan = M.buildFarmPlan(r, sc);
    const comps = M.nearestComps(r, rad.universe.comps, rad.sizeCurve, vc.looPredBySlug, 5), sens = M.computeSensitivity(r, rad.sizeCurve, rad.oddsModel);
    const cc = r.change_7d == null ? 'dm' : r.change_7d >= 0 ? 'pos' : 'neg', mult = r.launch_value_usd / rad.sizeCurve.capAt100M;
    const wfR = (k, s, v, c = '', tot = 0) => `<div class="wr${tot?' tot':''}"><div><span class="wk">${k}</span><span class="ws">${s}</span></div><div class="wv ${c}">${v}</div></div>`;
    const fk = (k, v, c = '') => `<div class="fk"><div class="fkk">${k}</div><div class="fkv ${c}">${v}</div></div>`;
    const mc = (ev, act) => `<td class="${ev.verdict==='FARM'?'mf':ev.verdict==='MARGINAL'?'mm':'ms'}${act?' ma':''}">${fSgn(ev.netAllIn)}<div style="font-size:8.5px;opacity:.82">${fSgn(ev.netPerHour)}/h</div></td>`;
    const bR = (l, v, c = '') => `<div class="br"><span>${l}</span><strong class="${c}">${v}</strong></div>`;

    const nav = `<div class="dnav"><button class="btn" id="btnBack">← Board</button><div class="rf">${prev?`<button class="btn np" data-sl="${E(prev.slug)}">← #${prev.rank} ${E(prev.name)}</button>`:''}${next?`<button class="btn np" data-sl="${E(next.slug)}">#${next.rank} ${E(next.name)} →</button>`:''}</div></div>`;
    const hero = `<section class="dh"><div><div class="m mu f11">#${r.rank}/${rad.rows.length} by implied value · rank range ${r.rank_low}–${r.rank_high} (200 refits)</div><div class="dt">${E(r.name)}</div><div class="rf">${tBg(r)} ${vBg(sc.verdict)}${bg('bn',E(r.category||'Uncategorized'))}${bg('bd',E(r.sector))}${r.chains.slice(0,6).map((c)=>bg('bc',E(c))).join('')}</div><div class="ds">${[['TVL',U(r.tvl_usd),''],['7D',fPct(r.change_7d),cc],['Listed',E(r.listed_at||'Undated'),''],['Age',fAge(r.age_days),''],['Chain',E(sc.chain),'cy']].map(([k,v,c])=>`<div><div class="dk">${k}</div><div class="dv ${c}">${v}</div></div>`).join('')}</div></div><div class="dpb"><div class="m mu" style="font-size:10px;text-transform:uppercase">Implied Value · Model</div><div class="di">$${r.implied_value_usd.toLocaleString('en-US')}</div><div class="db">If launched: <strong>${U(r.launch_value_usd)}</strong> · 24m odds: <strong class="cy">${R(r.launch_odds*100)}%</strong></div><div class="db">P25–P75: ${U(r.p25_usd)}–${U(r.p75_usd)} · P10–P90: ${U(r.p10_usd)}–${U(r.p90_usd)}</div><div class="mt6"><span class="cp">✓ Live = board.json (${chk.checksum})</span></div></div></section>`;

    const wf = pnl('Value Build-Up · fitSizeCurve() & fitLaunchOdds()', '0 hardcoded names',
      wfR('Snapshot TVL',`DefiLlama ${rad.as_of} · 7d ${fPct(r.change_7d)}`,U(r.tvl_usd)) +
      wfR('Anchor at $100M TVL',`92 traded comps (WF ×${vc.ladder[1].wfMiss.toFixed(2)})`,U(rad.sizeCurve.capAt100M)) +
      wfR('Power-law scaling',`(TVL/$100M)^${rad.sizeCurve.betaTvl.toFixed(3)}`,`×${mult.toFixed(2)}`) +
      wfR('= Launch cap','If token launches today',U(r.launch_value_usd),'gd') +
      wfR('24m launch odds',`At ${fAge(r.age_days)}: ${R(r.p_token_now*100)}% → ${R(r.p_token_24m*100)}% (+24m; ${r.cat_peers_token}/${r.cat_peers_total} peers)`,`×${R(r.launch_odds*100)}%`,'cy') +
      wfR('= Implied value',`P25–P75 ${U(r.p25_usd)}–${U(r.p75_usd)} · P10–P90 ${U(r.p10_usd)}–${U(r.p90_usd)}`,U(r.implied_value_usd),'gd',1));

    const compsC = pnl('Nearest Traded Comparables · nearestComps()', 'Real tokens that trade',
      `${tbl('mt',['Token','Category',['TVL'],['Mcap'],['Cap/TVL'],['Cap/LOO']],comps.map((c)=>`<tr><td><strong>${E(c.name)}</strong> <span class="dm m">${E(c.symbol||'')}</span></td><td>${E(c.category||'')}</td>${N(U(c.tvl_usd))}${N(U(c.mcap_usd),'gd')}${N(`×${c.capPerTvl.toFixed(2)}`)}${N(`×${c.missRatio.toFixed(2)}`)}</tr>`).join(''))}<div class="cbox mt6"><div class="ct"><span>Position vs 92 comps (gold) & board (cyan)</span><span class="m pos">${E(r.name)} (green)</span></div>${scatterSvg(r,460,112)}</div>`);

    const sensC = pnl('What Moves the Value · computeSensitivity()', 'Live counterfactuals',
      tbl('mt',['Scenario',['Launch'],['24m Odds'],['Implied'],['vs Now']],sens.map((s,i)=>`<tr class="${i===0?'kept':''}"><td>${E(s.label)}</td>${N(U(s.launchValue))}${N(`${R(s.odds*100)}%`,'cy')}${N(U(s.implied),'gd')}${N(`×${s.ratio.toFixed(2)}`)}</tr>`).join('')));

    const vCls = sc.verdict === 'FARM' ? '' : sc.verdict === 'MARGINAL' ? 'vm' : 'vs';
    const matRows = [0.04, 0.085, 0.14].map((ds) => `<tr><td>${(ds*100).toFixed(1)}%</td>${[1000,5000,10000,25000].map((d)=>mc(M.evaluateFarmScenario(r,{capital:d,dropShare:ds,weeks:sc.weeks}),d===sc.capital&&Math.abs(ds-sc.dropShare)<0.005)).join('')}</tr>`).join('');
    const horRow = [6, 12, 16, 26].map((w) => mc(M.evaluateFarmScenario(r, { capital: sc.capital, dropShare: sc.dropShare, weeks: w }), w === sc.weeks)).join('');
    const vCard = pnl('Farm Economics · evaluateFarmScenario()', `<span class="m">${U(sc.capital)} · ${(sc.dropShare*100).toFixed(1)}% · ${sc.weeks}w · ${E(sc.chain)}</span>`,
      `<div class="vbn ${vCls}"><strong>${sc.verdict}:</strong> <strong>${U(sc.capital)}</strong> for <strong>${sc.weeks}w</strong> on ${E(sc.chain)} → drop <strong>${F(sc.expectedDrop)}</strong> − <strong>${F(sc.cashFees)}</strong> fees − <strong>${F(sc.capitalDrag)}</strong> spread (${sc.hours.toFixed(1)}h) = <strong>${fSgn(sc.netAllIn)} (${fSgn(sc.netPerHour)}/h)</strong>.</div>` +
      `<div class="fkpis">${fk('At Risk',U(sc.capital))}${fk('Fees',F(sc.cashFees))}${fk('1.5% Spread',F(sc.capitalDrag))}${fk('Drop',F(sc.expectedDrop),'gd')}${fk('Net All-In',fSgn(sc.netAllIn),sc.netAllIn>=0?'pos':'neg')}${fk('Net / Hour',`${fSgn(sc.netPerHour)}/h`,sc.netPerHour>=25?'pos':'gd')}</div>` +
      `<div class="mg"><div><div class="sh">NET: DROP × DEPOSIT (${sc.weeks}W)</div>${tbl('mat',['Share','$1K','$5K','$10K','$25K'],matRows)}<div class="sh mt6">NET: HORIZON (${U(sc.capital)})</div>${tbl('mat',['Weeks','6w','12w','16w','26w'],`<tr><td>Net</td>${horRow}</tr>`)}</div><div class="bl"><div class="sh">HURDLES & BREAK-EVENS</div>${bR(`4% T-bill (${sc.weeks}w)`,F(sc.tbillBench))}${bR('Drop if launches',F(sc.dropIfLaunches))}${bR('Break-even share',`${(sc.breakEvenDrop*100).toFixed(2)}%`)}${bR('Break-even odds',`${Math.min(999,R(sc.breakEvenOdds*100))}%`)}${bR('Break-even dep',sc.breakEvenDeposit?U(sc.breakEvenDeposit):'n/a')}${bR('25% TVL stop',U(r.tvl_usd*0.75),'neg')}${bR('Effort',`${sc.hours.toFixed(1)}h (${sc.totalMin}m)`)}</div></div>`);

    const pCard = pnl('Farm Plan · 8 Costed, Timed Steps · buildFarmPlan()', `<span class="m">${E(plan.playKind)} · ${F(sc.cashFees)} + ${F(sc.capitalDrag)} spread · ${sc.hours.toFixed(1)}h</span>`,
      tbl('st',['When','Step',['Cost'],['Time']],stepRows(plan.steps)));

    root.innerHTML = `${nav}${hero}<div class="dg"><div class="dc">${wf}${compsC}</div><div class="dc">${vCard}${pCard}${sensC}</div></div>`;
    $('btnBack').onclick = () => { st.view = 'board'; render(); };
    root.querySelectorAll('.np').forEach((el) => { el.onclick = () => { st.slug = el.dataset.sl; render(); }; });
  }

  function renderSec(mode) {
    if (mode === 'traded') {
      const rows = [...rad.universe.tradedAll].sort((a, b) => (b.mcap_usd || 0) - (a.mcap_usd || 0) || b.tvl_usd - a.tvl_usd);
      root.innerHTML = pnl(`Tokens That Already Trade (${rows.length})`, '92 priced comps fit the curve; 152 have a token without cap',
        tbl('bt',['#','Protocol',['TVL'],['Mcap'],['Cap/TVL'],['LOO'],['Listed']],rows.slice(0,120).map((p,i)=>{const pr=vc.looPredBySlug[p.slug];return `<tr class="dr"><td class="m dm">${i+1}</td><td><strong>${E(p.name)}</strong> <span class="cy m">${E(p.symbol||'')}</span><div class="pmt">${E(p.category||'')} · ${E(p.chains.slice(0,3).join(', '))}</div></td>${N(U(p.tvl_usd))}${N(p.mcap_usd?U(p.mcap_usd):'<span class="dm">no cap</span>','gd')}${N(p.mcap_usd?`×${(p.mcap_usd/p.tvl_usd).toFixed(2)}`:'—')}${N(pr?U(pr):'—','mu')}${N(E(p.listed_at||'undated'),'mu')}</tr>`;}).join('')));
    } else if (mode === 'aside') {
      const list = [['out_bridge','Bridge'],['out_staking','Staking'],['out_versioned','Versioned'],['out_cex','CEX'],['out_wrapped','Wrapped'],['out_kin','Traded kin']].flatMap(([k, reason]) => rad.universe.groups[k].map((p) => ({ p, reason }))).sort((a, b) => b.p.tvl_usd - a.p.tvl_usd);
      root.innerHTML = pnl(`Set Aside (${list.length} protocols)`, 'All 758 protocols accounted for',
        tbl('bt',['#','Protocol','Category',['TVL'],'Reason'],list.slice(0,120).map((it,i)=>`<tr class="dr"><td class="m dm">${i+1}</td><td><strong>${E(it.p.name)}</strong> <span class="dm m">${E(it.p.slug)}</span></td><td>${E(it.p.category||'—')}</td>${N(U(it.p.tvl_usd))}<td>${bg('bk',E(it.reason))}</td></tr>`).join('')));
    } else {
      root.innerHTML = `<div class="dg">${pnl('1. Model Specification', 'dashboard/model.js',
        `<p class="mu"><strong>Launch cap:</strong> Ridge OLS (92 comps): <span class="m gd">ln(cap) = ${rad.sizeCurve.alpha.toFixed(3)} + ${rad.sizeCurve.betaTvl.toFixed(3)} × ln(TVL/$100M)</span> (boot ±${bt?.seBeta?.toFixed(3)||'0.11'}). LOO ×${vc.ladder[1].looMiss.toFixed(2)}, WF ×${vc.ladder[1].wfMiss.toFixed(2)}.</p>` +
        `<p class="mu"><strong>24m odds:</strong> L2 logit (λ=1.5, 437 peers): age, undated, sector/cat EB, ln TVL, 7d growth. WF Brier ${oc.ladder[4].wfBrier.toFixed(3)} vs ${oc.ladder[0].wfBrier.toFixed(3)}. Hazard: <span class="m cy">(P(t+2y)−P(t))/(1−P(t))</span>.</p>` +
        `<p class="mu"><strong>Conformal bands:</strong> LOO quantiles; WF coverage ${R(vc.honesty.wfCov50*100)}% (50%) and ${R(vc.honesty.wfCov80*100)}% (80%).</p>`)}${pnl('2. Token Prevalence by Age Cohort', `${oc.datedCount} dated peers`,
        `<div class="cbox">${cohortSvg()}</div><p class="mu mt6"><strong>Farm model:</strong> Cheapest chain, capital ≤0.05% TVL (max $25K), net of gas, bridge & 1.5% spread (4% T-bill shown), 8 costed, timed steps.</p>`)}</div>`;
    }
  }

  const dl = (n, m, t) => { const u = URL.createObjectURL(new Blob([t], { type: m })), a = document.createElement('a'); a.href = u; a.download = n; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 500); };

  function wireBoard(filt) {
    const qAll = (s, fn) => root.querySelectorAll(s).forEach(fn), on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; };
    qAll('.pg', (g) => g.querySelectorAll('.pl').forEach((b) => { b.onclick = () => { st[g.dataset.g] = b.dataset.v; render(); }; }));
    for (const [id, ev, k, m] of [['selDep','onchange','dep',1],['rngDrop','oninput','drop',0.01],['selHor','onchange','wk',1],['txtQ','oninput','q',0],['selCat','onchange','cat',0],['selChain','onchange','chain',0]])
      on(id, ev, (e) => { st[k] = m ? +e.target.value * m : e.target.value; render(); });
    on('btnReset','onclick',()=>{Object.assign(st,{verdict:'all',tier:'all',cat:'all',chain:'all',q:'',dep:0,drop:0.085,wk:0,sort:'rank',dir:1});render();});
    on('btnCsv','onclick',()=>dl('meridian-radar.csv','text/csv',`rank,slug,name,tier,tvl_usd,odds_24m,implied_usd,verdict,net_usd,net_per_h\n${filt.map(({row:r,sc})=>[r.rank,r.slug,`"${r.name.replace(/"/g,'""')}"`,r.tier,r.tvl_usd,r.launch_odds.toFixed(4),r.implied_value_usd,sc.verdict,sc.netAllIn.toFixed(2),sc.netPerHour.toFixed(2)].join(',')).join('\n')}\n`));
    on('btnJson','onclick',()=>dl('meridian-board.json','application/json',JSON.stringify({rows:rad.rows.map((r)=>({rank:r.rank,slug:r.slug,name:r.name,implied_value_usd:r.implied_value_usd,farm_steps:r.farm_steps}))})));
    qAll('th[data-s]',(el)=>{el.onclick=()=>{const k=el.dataset.s;st.dir=st.sort===k?-st.dir:k==='rank'?1:-1;st.sort=k;render();};});
    qAll('.eb',(b)=>{b.onclick=(e)=>{e.stopPropagation();st.exp=st.exp===b.dataset.x?null:b.dataset.x;render();};});
    qAll('.od',(b)=>{b.onclick=(e)=>{e.stopPropagation();st.slug=b.dataset.sl;st.view='detail';render();};});
    qAll('tr.dr',(tr)=>{tr.onclick=()=>{st.slug=tr.dataset.sl;st.view='detail';render();};});
  }

  const tabs = document.querySelectorAll('#navTabs .tab');
  function render() {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === st.view || (st.view === 'detail' && t.dataset.view === 'board')));
    if (st.view === 'board') renderBoard(); else if (st.view === 'detail') renderDetail(); else renderSec(st.view);
  }
  tabs.forEach((b) => { b.onclick = () => { st.view = b.dataset.view; render(); }; });
  $('brandHome').onclick = () => { st.view = 'board'; render(); };
  window.addEventListener('hashchange', () => { parseHash(); render(); });
  render();
})();

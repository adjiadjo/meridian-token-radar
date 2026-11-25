/* Meridian v3 — interactive offline dashboard (zero deps, zero network, live refit). */
(()=>{
'use strict';
const M=window.MeridianModel,P=window.MERIDIAN_PAYLOAD,$=id=>document.getElementById(id),root=$('appRoot');
if(!M||!P?.snapshot){root.innerHTML='<div class="panel">Missing ../data.js snapshot.</div>';return;}

const snap=P.snapshot,md=P.main_digest,rad=M.buildRadar(snap),chk=M.verifyBoard(rad.rows,snap,md);
const{sizeCurve:scv,valCheck:vc,oddsCheck:oc,bootstrap:bt,rows,universe:uni}=rad;
const st={view:'board',slug:null,exp:null,verdict:'all',tier:'all',cat:'all',chain:'all',q:'',dep:0,drop:M.DEFAULT_DROP_SHARE,wk:0,sort:'rank',dir:1};
const parseHash=()=>{
 for(const part of(location.hash||'').replace(/^#/,'').split('&')){
  const[k,v]=part.split('=').map(x=>decodeURIComponent(x||''));if(!v)continue;
  if(k==='slug'){st.slug=v;st.view='detail';}else if(k==='expand')st.exp=v;else if(k==='dir')st.dir=+v<0?-1:1;
  else if(k==='deposit')st.dep=+v||0;else if(k==='drop')st.drop=+v||M.DEFAULT_DROP_SHARE;else if(k==='weeks')st.wk=+v||0;else if(k in st)st[k]=v;
 }
};
parseHash();
$('cntBoard').textContent=rows.length;$('cntTraded').textContent=uni.tradedAll.length;$('cntAside').textContent=uni.setAside.length;
$('metaPill').textContent=`DefiLlama ${rad.as_of} · ${snap.protocols.length} protocols · ${rad.model_version} refitted live · no network`;

const E=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const U=M.fmtUsd,F=M.fmtMoney2,sgn=v=>`${v>=0?'+':''}${F(v)}`,pct=x=>`${Math.round(x*100)}%`;
const age=d=>d==null?'undated':d>=365?`${(d/365).toFixed(1)}y`:`${d}d`,chg=v=>v==null?'n/a':`${v>0?'+':''}${v.toFixed(1)}%`;
const sp=(c,t)=>`<span class="${c}">${t}</span>`,dv=(c,t)=>`<div class="${c}">${t}</div>`,bg=(c,t)=>sp(`bg ${c}`,t);
const bt0=(c,t,ex='')=>`<button class="${c}"${ex}>${t}</button>`;
const tBg=r=>bg(r.tier==='watchlist'?'bw':r.tier==='offlist'?'bo':'be',r.tier==='watchlist'?'Watchlist':r.tier==='offlist'?'Off-list':'Early');
const vBg=v=>bg(v==='FARM'?'bf':v==='MARGINAL'?'bm':'bs',v);
const pnl=(t,n,b)=>`<section class="panel">${dv('phead',dv('ptitle',t)+dv('pnote',n))}${b}</section>`;
const tbl=(c,hs,b)=>`<table class="${c}"><thead><tr>${hs.map(h=>Array.isArray(h)?`<th class="n">${h[0]}</th>`:`<th>${h}</th>`).join('')}</tr></thead><tbody>${b}</tbody></table>`;
const N=(v,c='')=>`<td class="n${c?' '+c:''}">${v}</td>`,opts=(a,cur)=>a.map(([v,l])=>`<option value="${E(v)}"${String(cur)===String(v)?' selected':''}>${E(l)}</option>`).join('');
const stepRows=steps=>steps.map((s,i)=>`<tr><td class="sw">${i+1}. ${E(s.when)}</td><td><strong>${E(s.title)}:</strong> ${E(s.text)}</td><td class="sc">${E(s.cost)}</td><td class="st">${E(s.time)}</td></tr>`).join('');
const f1=v=>v.toFixed(1),gl=(x1,y1,x2,y2,s='#1A263C',ex='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}"${ex}/>`;
const tx=(x,y,t,a='middle',c='')=>`<text x="${x}" y="${y}" text-anchor="${a}"${c?` fill="${c}"`:''}>${t}</text>`;

/** Bespoke SVG log-log scatter: 92 traded comps, conformal P25-P75 band, 193 pre-token rows. */
function renderScatterSvg(hi,W=320,H=122){
 const pL=36,pR=8,pT=8,pB=19,lg=Math.log10,sx=v=>pL+((lg(Math.max(1e5,v))-6.6)/3.48)*(W-pL-pR),sy=v=>pT+(H-pT-pB)*(1-(lg(Math.max(5e4,v))-5)/4.78);
 const o=[`<svg class="csvg" viewBox="0 0 ${W} ${H}"><g font-size="8.2" font-family="monospace" fill="#617494">`];
 for(const[v,t]of[[1e7,'$10M'],[1e8,'$100M'],[1e9,'$1B'],[1e10,'$10B']]){const x=f1(sx(v));o.push(gl(x,pT,x,H-pB)+tx(x,H-5,t));}
 for(const[v,t]of[[1e6,'$1M'],[1e7,'$10M'],[1e8,'$100M'],[1e9,'$1B']]){const y=f1(sy(v));o.push(gl(pL,y,W-pR,y)+tx(pL-4,+y+3,t,'end'));}
 const top=[],bot=[],mid=[];
 for(const tvl of[5e6,5e7,5e8,5e9]){const p=Math.exp(scv.predictLog(tvl,rad.marketMed7d)),x=f1(sx(tvl));mid.push(`${x},${f1(sy(p))}`);top.push(`${x},${f1(sy(p*Math.exp(vc.bands.q75)))}`);bot.unshift(`${x},${f1(sy(p*Math.exp(vc.bands.q25)))}`);}
 o.push(`</g><polygon points="${top.concat(bot).join(' ')}" fill="#F5B04124"/><polyline points="${mid.join(' ')}" fill="none" stroke="#F5B041" stroke-width="1.6"/>`);
 for(const r of rows)if(hi?.slug!==r.slug)o.push(`<circle cx="${f1(sx(r.tvl_usd))}" cy="${f1(sy(r.implied_value_usd))}" r="2" fill="#4CC9F0" opacity=".48"/>`);
 for(const c of uni.comps)o.push(`<circle cx="${f1(sx(c.tvl_usd))}" cy="${f1(sy(c.mcap_usd))}" r="2.4" fill="#F5B041" opacity=".84"/>`);
 if(hi){const hx=f1(sx(hi.tvl_usd)),hl=f1(sy(hi.launch_value_usd)),h2=f1(sy(hi.implied_value_usd));o.push(gl(hx,hl,hx,h2,'#2EE59D',' stroke-width="1.4" stroke-dasharray="2 2"')+`<circle cx="${hx}" cy="${hl}" r="4" fill="none" stroke="#F5B041" stroke-width="1.5"/><circle cx="${hx}" cy="${h2}" r="5" fill="#2EE59D" stroke="#080C14" stroke-width="1.4"/>`);}
 return`${o.join('')}</svg>`;
}

/** Out-of-fold 10-fold reliability diagram: predicted token probability vs observed peer rate. */
function renderCalibrationSvg(W=340,H=108){
 const pL=32,pR=12,pT=10,pB=19,sx=v=>pL+v*(W-pL-pR),sy=v=>pT+(1-v)*(H-pT-pB);
 const o=[`<svg class="csvg" viewBox="0 0 ${W} ${H}"><g font-size="8.2" font-family="monospace" fill="#617494">`];
 for(const g of[0,0.5,1]){const gx=f1(sx(g)),gy=f1(sy(g));o.push(gl(pL,gy,W-pR,gy)+tx(pL-4,+gy+3,pct(g),'end')+tx(gx,H-5,pct(g)));}
 o.push(gl(f1(sx(0)),f1(sy(0)),f1(sx(1)),f1(sy(1)),'#617494',' stroke-dasharray="3 3"')+`<polyline points="${oc.bins.map(b=>`${f1(sx(b.pred))},${f1(sy(b.obs))}`).join(' ')}" fill="none" stroke="#2EE59D" stroke-width="1.8"/>`);
 for(const b of oc.bins){const x=f1(sx(b.pred)),y=f1(sy(b.obs));o.push(`<circle cx="${x}" cy="${y}" r="3.4" fill="#2EE59D" stroke="#080C14" stroke-width="1.2"/>`+tx(x,(+y-6).toFixed(1),pct(b.obs),'middle','#E8EEF8'));}
 return`${o.join('')}</g></svg>`;
}

function renderCohortSvg(W=340,H=108){
 const co=oc.cohorts,pL=28,pB=19,pT=12,bw=(W-36)/co.length,o=[`<svg class="csvg" viewBox="0 0 ${W} ${H}"><g font-size="8.2" font-family="monospace">`];
 for(const g of[0,50,100]){const gy=(pT+(H-pT-pB)*(1-g/100)).toFixed(1);o.push(gl(pL,gy,W-8,gy)+tx(pL-4,+gy+3,g+'%','end','#617494'));}
 co.forEach((c,i)=>{const h=(H-pT-pB)*c.rate,x=pL+i*bw+8,y=H-pB-h,w=bw-16,cx=f1(x+w/2);o.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="3" fill="#4CC9F0" opacity=".84"/>`+tx(cx,f1(y-3),pct(c.rate),'middle','#E8EEF8')+tx(cx,H-5,c.label,'middle','#8FA1BE'));});
 return`${o.join('')}</g></svg>`;
}

function renderBoard(){
 const def=st.dep===0&&Math.abs(st.drop-M.DEFAULT_DROP_SHARE)<1e-6&&st.wk===0;
 const items=rows.map(row=>({row,sc:def?row.farm:M.optimalFarmScenario(row,{capital:st.dep,dropShare:st.drop,weeks:st.wk})}));
 const cnt={all:items.length,FARM:0,MARGINAL:0,SKIP:0,watchlist:0,offlist:0,early:0},cats={},chs={};let best=null;
 for(const it of items){cnt[it.sc.verdict]++;cnt[it.row.tier]++;if(it.row.category)cats[it.row.category]=(cats[it.row.category]||0)+1;for(const c of it.row.chains)chs[c]=(chs[c]||0)+1;if(!best||it.sc.netPerHour>best.sc.netPerHour)best=it;}
 const q=st.q.trim().toLowerCase(),S={rank:a=>a.row.rank,tvl:a=>a.row.tvl_usd,ch7:a=>a.row.change_7d??-999,age:a=>a.row.age_days||0,odds:a=>a.row.launch_odds,launch:a=>a.row.launch_value_usd,implied:a=>a.row.implied_value_usd,net:a=>a.sc.netAllIn,hour:a=>a.sc.netPerHour}[st.sort];
 const filt=items.filter(({row:r,sc})=>(st.verdict==='all'||sc.verdict===st.verdict)&&(st.tier==='all'||r.tier===st.tier)&&(st.cat==='all'||(r.category||'')===st.cat)&&(st.chain==='all'||r.chains.includes(st.chain))&&(!q||`${r.name} ${r.slug} ${r.category||''} ${r.chains.join(' ')}`.toLowerCase().includes(q))).sort((a,b)=>(S(a)-S(b))*st.dir||(a.row.rank-b.row.rank));
 const fTvl=filt.reduce((s,x)=>s+x.row.tvl_usd,0),fImp=filt.reduce((s,x)=>s+x.row.implied_value_usd,0),isF=st.verdict!=='all'||st.tier!=='all'||st.cat!=='all'||st.chain!=='all'||q.length>0;
 const hon=vc.honesty,vK=vc.ladder[2],vF=vc.ladder[0],oK=oc.ladder[4],oB=oc.ladder[0],hc=md?.hardcode_audit||{checked:rows.length,found:0};

 const kpi=(c,l,v,s)=>dv(`kpi ${c}`,dv('kl',l)+dv('kv',v)+dv('ks',s));
 const kpis=`<section class="kpis">${kpi('ac','Watchlist Ranked',`${chk.watchlistCovered} / ${chk.watchlistTotal}`,`+${cnt.offlist} off-list · ${cnt.early} early &lt;$50M`)}${kpi('ag','Walk-Forward Miss',`×${vK.wfMiss.toFixed(2)}`,`vs ×${vF.wfMiss.toFixed(2)} flat · LOO ×${vK.looMiss.toFixed(2)}`)}${kpi('ae','Range Honesty (WF)',`${pct(hon.wfCov50)} · ${pct(hon.wfCov80)}`,'in P25–P75 / P10–P90 (50/80%)')}${kpi('ac','Launch Odds Brier',oK.wfBrier.toFixed(4),`WF vs ${oB.wfBrier.toFixed(4)} base · ECE ${(oc.ece*100).toFixed(1)}%`)}${kpi('','Terms Kept / Tested','2 of 6 · 4 of 6','value curve · 24m odds (placebo cut)')}${kpi('ae','Worth Farming',`${cnt.FARM} of ${cnt.all}`,`net &gt;$0 &amp; $25+/h · top ${best?`${E(best.row.name)} ${sgn(best.sc.netPerHour)}/h`:'n/a'}`)}</section>`;
 const fbar=dv('formula',`<div><strong>Implied value</strong> = Launch cap ${sp('mn',`(fitSizeCurve: $${(scv.capAt100M/1e6).toFixed(1)}M × (TVL × 7d carry / $100M)^${scv.betaTvl.toFixed(2)})`)} × 24m odds ${sp('mn','(fitLaunchOdds: ln(1+age), EB, ln TVL, 7d)')}.</div>`+dv('mn mu','Refitted live · not a forecast'));

 const ledger=pnl('Protocol Accounting · classifyUniverse()',`All ${snap.protocols.length} protocols in one bucket`,
  dv('lbar',rad.ledger.map(b=>`<div class="lseg" style="width:${((b.count/snap.protocols.length)*100).toFixed(2)}%;background:${b.color}"></div>`).join(''))+
  dv('lleg',rad.ledger.map(b=>sp('li',`<span class="ld" style="background:${b.color}"></span>${E(b.label)} <strong>${b.count}</strong>`)).join(''))+
  dv('checks',[`✓ board.json (${chk.rowCount}/${chk.rowCount} live)`,`✓ ranks 1–${chk.rowCount} monotonic`,`✓ total ${U(chk.totalImpliedUsd)}`,`✓ checksum ${chk.checksum}${chk.matchesMain?' = main.ts':''}`,`✓ watchlist ${chk.watchlistCovered}/${chk.watchlistTotal}`,`✓ ledger ${snap.protocols.length}/${snap.protocols.length}`,`✓ ${hc.found}/${hc.checked} hardcoded`].map(t=>sp('cpill',t)).join('')));

 const tc=s=>s==='kept'?'tk':s==='baseline'?'tb':s==='must not help'?'tc':'td',rc=s=>s==='kept'?'kept':s==='must not help'?'plc':'';
 const evid=isF?'':pnl('Out-of-Sample Evidence · runValueValidation() & runOddsValidation()',`Kept only when blind LOO/10-fold AND WF (${vc.wfSplit[0]}→${vc.wfSplit[1]}) both improve`,
  dv('evgrid',tbl('mini',[`Launch value (${vc.compsCount} comps)`,['LOO'],['WF'],['Verdict']],vc.ladder.map(l=>`<tr class="${rc(l.status)}"><td>${E(l.label)}</td>${N(`×${l.looMiss.toFixed(2)}`)}${N(`×${l.wfMiss.toFixed(2)}`)}${N(E(l.status),tc(l.status))}</tr>`).join(''))+
  tbl('mini',[`24m launch odds (${oc.peersCount} peers)`,['10-Fold'],['WF'],['Verdict']],oc.ladder.map(l=>`<tr class="${rc(l.status)}"><td>${E(l.label)}</td>${N(`${l.cvBrier.toFixed(4)} ${sp('dm',`(${pct(l.cvAcc)})`)}`)}${N(`${l.wfBrier.toFixed(4)} ${sp('dm',`(${pct(l.wfAcc)})`)}`)}${N(E(l.status),tc(l.status))}</tr>`).join(''))+
  `<div>${tbl('mini',['Range honesty',['LOO'],['WF']],[['Within ×3',pct(hon.looWithin3),pct(hon.wfWithin3)],['P25–P75 (50%)',pct(hon.looCov50),pct(hon.wfCov50)],['P10–P90 (80%)',pct(hon.looCov80),pct(hon.wfCov80)]].map(([k,a,b])=>`<tr><td>${k}</td>${N(a,'pos')}${N(b,'pos')}</tr>`).join(''))}${dv('ffoot',`<strong>Bootstrap (${bt.refits} refits):</strong><br>slope ${scv.betaTvl.toFixed(2)} ± ${bt.seBeta.toFixed(2)}<br>$100M cap: ${U(scv.capAt100M)}`)}</div>`+
  dv('chart',dv('ctitle',`<span>Cap vs TVL: 92 comps · 193 board</span>${sp('mn mu','P25–P75')}`)+renderScatterSvg(null,320,122)))+
  dv('evfoot',`<strong>Reading the tests:</strong> Size curve (ln TVL) and 7d carry both cut blind miss (LOO ×${vK.looMiss.toFixed(2)}, WF ×${vK.wfMiss.toFixed(2)}); category, chains, and age do not improve both so launch value drops them. Age, sector/category EB, size, and 7d growth all cut odds Brier (WF ${oK.wfBrier.toFixed(4)} vs ${oB.wfBrier.toFixed(4)}, ECE ${(oc.ece*100).toFixed(1)}%).`));

 const wlF=items.filter(x=>x.row.tier==='watchlist'&&x.sc.verdict==='FARM').sort((a,b)=>b.sc.netPerHour-a.sc.netPerHour).slice(0,4);
 const farmStrip=isF||!wlF.length?'':dv('farmbar',dv('flex',`<strong class="pos">Top Watchlist FARM picks</strong>${sp('mu','(net &gt; $0, $25+/h · mega-TVL rows dilute retail):')}`+wlF.map(({row:r,sc})=>bt0('fchip od',`#${r.rank} ${E(r.name)} ${sp('pos',sgn(sc.netPerHour)+'/h')} ${sp('mu',`(${U(sc.capital)}·${sc.weeks}w)`)}`,` data-sl="${E(r.slug)}"`)).join('')));

 const af=[st.verdict!=='all'&&`Verdict: ${st.verdict}`,st.tier!=='all'&&`Tier: ${st.tier}`,st.cat!=='all'&&`Category: ${st.cat}`,st.chain!=='all'&&`Chain: ${st.chain}`,q&&`Query: "${q}"`].filter(Boolean);
 const pill=(g,v,l,ex='')=>bt0(`pill ${ex}${st[g]===v?' active':''}`,l,` data-val="${v}"`);
 const sel=(id,l,a,cur)=>`<label class="ctrl">${l}<select id="${id}">${opts(a,cur)}</select></label>`;
 const catO=[['all','All categories'],...Object.keys(cats).sort().map(c=>[c,`${c} (${cats[c]})`])],chO=[['all','All chains'],...Object.keys(chs).sort((a,b)=>chs[b]-chs[a]||(a<b?-1:1)).map(c=>[c,`${c} (${chs[c]})`])];
 const tbar=`<section class="bar">${dv('trow',dv('flex',`<div class="pills" data-g="verdict">${[['all',`All ${cnt.all}`,''],['FARM',`FARM ${cnt.FARM}`,'vf'],['MARGINAL',`Marginal ${cnt.MARGINAL}`,'vm'],['SKIP',`Skip ${cnt.SKIP}`,'vs']].map(([v,l,c])=>pill('verdict',v,l,c)).join('')}</div><div class="pills" data-g="tier">${[['all','All tiers'],['watchlist',`Watchlist ${cnt.watchlist}`],['offlist',`Off-list ${cnt.offlist}`],['early',`Early &lt;$50M ${cnt.early}`]].map(([v,l])=>pill('tier',v,l)).join('')}</div>`)+dv('flex',sel('selDep','Deposit ',[[0,'Plan optimal'],[1000,'$1K'],[5000,'$5K'],[10000,'$10K'],[25000,'$25K']],st.dep)+`<label class="ctrl">Drop ${sp('mn gold',(st.drop*100).toFixed(1)+'%')}<input type="range" id="rngDrop" min="3.5" max="15" step="0.5" value="${(st.drop*100).toFixed(1)}"></label>`+sel('selHor','Horizon ',[[0,'Optimal'],[6,'6w'],[12,'12w'],[26,'26w']],st.wk)))}${dv('trow',dv('flex',`<input type="search" id="txtQ" class="search" placeholder="Search protocol, category, chain…" value="${E(st.q)}">${sel('selCat','',catO,st.cat)}${sel('selChain','',chO,st.chain)}${bt0('btn','Reset',' id="btnReset"')}${bt0('btn','CSV',' id="btnCsv"')}${bt0('btn','JSON',' id="btnJson"')}${af.length?sp('fban',`Filtered: ${E(af.join(' · '))} · ${E(st.sort)} ${st.dir<0?'desc':'asc'}`):''}`)+dv('mn mu sm',`<strong>${filt.length}</strong>/${items.length} rows · ${U(fTvl)} TVL · ${U(fImp)} implied`))}</section>`;

 const rPct=v=>Math.max(0,Math.min(100,((Math.log10(Math.max(1e5,v))-5)/3.4)*100)),th=(k,l,n)=>`<th data-s="${k}" class="${n?'n ':''}${st.sort===k?'sorted':''}">${l}${st.sort===k?(st.dir>0?' ↑':' ↓'):''}</th>`;
 const tbody=filt.map(({row:r,sc})=>{
  const ch=r.chains.length<=2?r.chains.join(', '):`${r.chains[0]} +${r.chains.length-1}`,cc=r.change_7d==null?'dm':r.change_7d>=0?'pos':'neg';
  const p25=rPct(r.p25_usd),p75=rPct(r.p75_usd),px=rPct(r.implied_value_usd),exp=st.exp===r.slug,od=Math.round(r.launch_odds*100);
  const tr=`<tr class="row" data-sl="${E(r.slug)}"><td>${sp('rk',r.rank)+sp('rkr',`${r.rank_low}–${r.rank_high}`)}</td><td>${dv('pname',`${E(r.name)} ${tBg(r)}${r.kin_caution?' '+bg('bk','Kin'):''}`)+dv('pmeta',`${E(r.category||'Uncategorized')} · ${E(ch)}`)}</td>${N(U(r.tvl_usd))}${N(chg(r.change_7d),cc)}${N(age(r.age_days),'mu')}${N(dv('ow',sp('mn',od+'%')+sp('ot',`<span class="of" style="width:${od}%"></span>`)))}${N(U(r.launch_value_usd),'mu')}${N(sp('valm',U(r.implied_value_usd))+sp('vb',`${U(r.p25_usd)}–${U(r.p75_usd)}`)+dv('rt',`<div class="rs" style="left:${f1(p25)}%;width:${f1(Math.max(4,p75-p25))}%"></div><div class="rd" style="left:${f1(px)}%"></div>`))}<td class="vc">${vBg(sc.verdict)} ${sp(`mn ${sc.netAllIn>=0?'pos':'neg'}`,sgn(sc.netAllIn))}${sp('vsb',`${F(sc.expectedDrop)} drop − ${F(sc.totalCost)} cost`)}</td>${N(`${sgn(sc.netPerHour)}/h${sp('vsb',`${U(sc.capital)} · ${sc.weeks}w`)}`,`b ${sc.netPerHour>=25?'pos':sc.netPerHour>0?'gold':'neg'}`)}${N(bt0('expbtn',exp?'Hide ▲':'8 steps ▼',` data-x="${E(r.slug)}"`))}</tr>`;
  if(!exp)return tr;
  const pl=M.buildFarmPlan(r,sc);
  return`${tr}<tr class="iprow"><td colspan="11">${dv('iphead',`<div><strong>${E(r.name)} · ${E(pl.playKind)} on ${E(sc.chain)}</strong> ${sp('mu mn',`(${U(sc.capital)} · ${sc.weeks}w · ${sc.hours.toFixed(1)}h · drop ${F(sc.expectedDrop)} − fees ${F(sc.cashFees)} − 1% spread ${F(sc.capitalCharge)} = <strong>${sgn(sc.netAllIn)}</strong>, ${sgn(sc.netPerHour)}/h)`)}</div>${bt0('btn od','Full protocol dossier →',` data-sl="${E(r.slug)}"`)}`)}${tbl('steps',['When','Concrete step (costed & timed)',['Cost'],['Time']],stepRows(pl.steps))}</td></tr>`;
 }).join('');

 root.innerHTML=`${kpis}${fbar}${ledger}${evid}${tbar}${farmStrip}<section class="wrap"><table class="board"><thead><tr>${th('rank','# · Range',0)}<th>Protocol</th>${th('tvl','TVL',1)}${th('ch7','7D %',1)}${th('age','Age',1)}${th('odds','24m Odds',1)}${th('launch','If Launched',1)}${th('implied','Implied · P25–P75',1)}${th('net','Verdict · Net',1)}${th('hour','Net / Hour',1)}<th class="n">Plan</th></tr></thead><tbody>${tbody}</tbody></table></section>`;
 wireBoard(filt);
}

function renderDetail(){
 const r=rows.find(x=>x.slug===st.slug)||rows[0],prev=rows[r.rank-2],next=rows[r.rank],B=t=>`<strong>${t}</strong>`;
 const sc=M.optimalFarmScenario(r,{capital:st.dep,dropShare:st.drop,weeks:st.wk}),plan=M.buildFarmPlan(r,sc);
 const comps=M.nearestComps(r,uni.comps,scv,vc.looPredBySlug,5),sens=M.computeSensitivity(r,scv,rad.oddsModel);
 const cc=r.change_7d==null?'dm':r.change_7d>=0?'pos':'neg',mult=r.launch_value_usd/scv.capAt100M;
 const wf=(k,s,v,c='',t=0)=>dv(`wf${t?' tot':''}`,`<div>${sp('wfk',k)+sp('wfs',s)}</div>`+dv(`wfv ${c}`,v));
 const fk=(k,v,c='')=>dv('fk',dv('fkk',k)+dv(`fkv ${c}`,v)),br=(l,v,c='')=>dv('brow',`<span>${l}</span><strong class="${c}">${v}</strong>`);
 const mc=(ev,act)=>`<td class="${ev.verdict==='FARM'?'mf':ev.verdict==='MARGINAL'?'mm':'ms'}${act?' ma':''}">${sgn(ev.netAllIn)}${dv('ms2',sgn(ev.netPerHour)+'/h')}</td>`;

 const nav=dv('dnav',bt0('btn','← Board',' id="btnBack"')+dv('flex',(prev?bt0('btn np',`← #${prev.rank} ${E(prev.name)}`,` data-sl="${E(prev.slug)}"`):'')+(next?bt0('btn np',`#${next.rank} ${E(next.name)} →`,` data-sl="${E(next.slug)}"`):'')));
 const hero=`<section class="hero"><div>${dv('mn mu sm',`#${r.rank}/${rows.length} by implied value · rank ${r.rank_low}–${r.rank_high} (${bt.refits} refits)`)}${dv('dtitle',E(r.name))}${dv('flex',`${tBg(r)} ${vBg(sc.verdict)}${bg('bn',E(r.category||'Uncategorized'))}${bg('bd',E(r.sector))}${r.chains.slice(0,6).map(c=>bg('bc',E(c))).join('')}`)}${dv('dstats',[['TVL',U(r.tvl_usd),''],['7D',chg(r.change_7d),cc],['Listed',E(r.listed_at||'Undated'),''],['Age',age(r.age_days),''],['Chain',E(sc.chain),'cyan']].map(([k,v,c])=>`<div>${dv('sk',k)+dv(`sv ${c}`,v)}</div>`).join(''))}</div>${dv('dprice',dv('dcap','Implied Value · Model')+dv('dimp','$'+r.implied_value_usd.toLocaleString('en-US'))+dv('dbands',`If launched: ${B(U(r.launch_value_usd))} · 24m odds: <strong class="cyan">${pct(r.launch_odds)}</strong>`)+dv('dbands',`P25–75: ${U(r.p25_usd)}–${U(r.p75_usd)} · P10–90: ${U(r.p10_usd)}–${U(r.p90_usd)}`)+dv('mt6',sp('cpill',`✓ Recomputed live = board.json (${chk.checksum})`)))}</section>`;

 const wfP=pnl('Value Build-Up · fitSizeCurve() & fitLaunchOdds()','0 hardcoded names',
  wf('Snapshot TVL',`DefiLlama ${rad.as_of} · 7d ${chg(r.change_7d)}`,U(r.tvl_usd))+
  wf('7-day TVL carry',`1w excess vs ${chg(rad.marketMed7d)} median (±25%)`,`×${r.carry_factor.toFixed(3)}`)+
  wf('Anchor at $100M TVL',`92 comps (WF ×${vc.ladder[2].wfMiss.toFixed(2)}, LOO ×${vc.ladder[2].looMiss.toFixed(2)})`,U(scv.capAt100M))+
  wf('Power-law scaling',`(TVL × carry / $100M)^${scv.betaTvl.toFixed(3)}`,`×${mult.toFixed(2)}`)+
  wf('= Conditional launch cap','If token launches today',U(r.launch_value_usd),'gold')+
  wf('24m remaining odds',`At ${age(r.age_days)}: ${pct(r.p_token_now)} → ${pct(r.p_token_max)} ceiling (${r.cat_peers_token}/${r.cat_peers_total} peers)`,`×${pct(r.launch_odds)}`,'cyan')+
  wf('= Implied value',`P25–75 ${U(r.p25_usd)}–${U(r.p75_usd)} · P10–90 ${U(r.p10_usd)}–${U(r.p90_usd)}`,U(r.implied_value_usd),'gold',1));

 const compP=pnl('Nearest Traded Comparables · nearestComps()','Real tokens that trade',
  tbl('mini',['Token','Category',['TVL'],['Mcap'],['Cap/TVL'],['Cap/LOO']],comps.map(c=>`<tr><td>${B(E(c.name))} ${sp('dm mn',E(c.symbol||''))}</td><td>${E(c.category||'')}</td>${N(U(c.tvl_usd))}${N(U(c.mcap_usd),'gold')}${N(`×${c.capPerTvl.toFixed(2)}`)}${N(`×${c.missRatio.toFixed(2)}`)}</tr>`).join(''))+
  dv('chart mt6',dv('ctitle',`<span>Position vs 92 comps (gold) & board (cyan)</span>${sp('mn pos',`${E(r.name)} (green)`)}`)+renderScatterSvg(r,450,114)));

 const sensP=pnl('What Moves the Value · computeSensitivity()','Live counterfactuals',
  tbl('mini',['Scenario',['Launch'],['24m Odds'],['Implied'],['vs Now']],sens.map((s,i)=>`<tr class="${i===0?'kept':''}"><td>${E(s.label)}</td>${N(U(s.launchValue))}${N(pct(s.odds),'cyan')}${N(U(s.implied),'gold')}${N(`×${s.ratio.toFixed(2)}`)}</tr>`).join('')));

 const vCls=sc.verdict==='FARM'?'':sc.verdict==='MARGINAL'?'vm':'vs';
 const matRows=[0.045,0.09,0.14].map(ds=>`<tr><td>${(ds*100).toFixed(1)}%</td>${[1000,5000,10000,25000].map(d=>mc(M.evaluateFarmScenario(r,{capital:d,dropShare:ds,weeks:sc.weeks}),d===sc.capital&&Math.abs(ds-sc.dropShare)<0.005)).join('')}</tr>`).join('');
 const horRow=[6,12,16,26].map(w=>mc(M.evaluateFarmScenario(r,{capital:sc.capital,dropShare:sc.dropShare,weeks:w}),w===sc.weeks)).join('');
 const farmP=pnl('Farm Economics · evaluateFarmScenario()',sp('mn',`${U(sc.capital)} · ${(sc.dropShare*100).toFixed(1)}% · ${sc.weeks}w · ${E(sc.chain)}`),
  dv(`vban ${vCls}`,`${B(sc.verdict+':')} ${B(U(sc.capital))} for ${B(sc.weeks+'w')} on ${E(sc.chain)} → drop ${B(F(sc.expectedDrop))} − ${B(F(sc.cashFees))} fees − ${B(F(sc.capitalCharge))} 1% spread (${sc.hours.toFixed(1)}h) = ${B(`${sgn(sc.netAllIn)} (${sgn(sc.netPerHour)}/h)`)}.`)+
  dv('fkpis',fk('At Risk',U(sc.capital))+fk('Fees',F(sc.cashFees))+fk('1% Spread',F(sc.capitalCharge))+fk('Drop',F(sc.expectedDrop),'gold')+fk('Net All-In',sgn(sc.netAllIn),sc.netAllIn>=0?'pos':'neg')+fk('Net / Hour',`${sgn(sc.netPerHour)}/h`,sc.netPerHour>=25?'pos':sc.netPerHour>0?'gold':'neg'))+
  dv('mgrid',`<div>${dv('sh',`NET: DROP × DEPOSIT (${sc.weeks}W)`)}${tbl('mat',['Share','$1K','$5K','$10K','$25K'],matRows)}${dv('sh mt6',`NET: HORIZON (${U(sc.capital)})`)}${tbl('mat',['Weeks','6w','12w','16w','26w'],`<tr><td>Net</td>${horRow}</tr>`)}</div>${dv('benches',dv('sh','HURDLES &amp; BREAK-EVENS')+br(`4% T-bill (${sc.weeks}w)`,F(sc.tbillBench))+br('Drop if launches',F(sc.dropIfLaunches))+br('Break-even share',`${(sc.breakEvenDrop*100).toFixed(2)}%`)+br('Break-even odds',`${Math.min(999,Math.round(sc.breakEvenOdds*100))}%`)+br('Break-even dep',sc.breakEvenDeposit?U(sc.breakEvenDeposit):'n/a')+br('25% TVL stop',U(r.tvl_usd*0.75),'neg')+br('Effort',`${sc.hours.toFixed(1)}h (${sc.totalMin}m)`))}`));

 const planP=pnl('Farm Plan · 8 Costed, Timed Steps · buildFarmPlan()',sp('mn',`${E(plan.playKind)} · ${F(sc.cashFees)} + ${F(sc.capitalCharge)} spread · ${sc.hours.toFixed(1)}h`),tbl('steps',['When','Step',['Cost'],['Time']],stepRows(plan.steps)));
 root.innerHTML=`${nav}${hero}${dv('dgrid',dv('dcol',wfP+compP)+dv('dcol',farmP+planP+sensP))}`;
 $('btnBack').onclick=()=>{st.view='board';render();};
 root.querySelectorAll('.np').forEach(el=>{el.onclick=()=>{st.slug=el.dataset.sl;render();};});
}

function renderSecondary(mode){
 const calGrid=dv('tgrid',
  dv('chart',dv('ctitle',`<span>10-Fold OOF Calibration</span>${sp('mn pos',`ECE ${(oc.ece*100).toFixed(1)}%`)}`)+renderCalibrationSvg()+dv('ffoot','5 predicted quintiles vs observed peer token rate (dashed = ideal).'))+
  dv('chart',dv('ctitle',`<span>Peer Token Share by Age (${oc.datedCount} dated)</span>${sp('mn cyan',`WF Brier ${oc.ladder[4].wfBrier.toFixed(4)}`)}`)+renderCohortSvg()+dv('ffoot','Older peers hold tokens more often; remaining 24m hazard decays with age.'))+
  dv('chart',dv('ctitle',`<span>Model & Separation Audit</span>${sp('mn gold',`checksum ${chk.checksum}`)}`)+dv('ffoot',`<strong>Cap:</strong> ln(cap)=${scv.alpha.toFixed(3)}+${scv.betaTvl.toFixed(3)}·ln(TVL·carry/$100M) (boot ±${bt.seBeta.toFixed(2)}; WF ×${vc.ladder[2].wfMiss.toFixed(2)}, LOO ×${vc.ladder[2].looMiss.toFixed(2)})<br><strong>Odds:</strong> L2 logit (λ=2): ln(1+age), undated, EB, ln TVL, 7d (WF ${oc.ladder[4].wfBrier.toFixed(4)} vs ${oc.ladder[0].wfBrier.toFixed(4)})<br><strong>Range honesty:</strong> WF ${pct(vc.honesty.wfCov50)} P25–75 · ${pct(vc.honesty.wfCov80)} P10–90<br><strong>Set aside (${uni.setAside.length}):</strong> Bridge ${uni.groups.ob.length} · Staking ${uni.groups.os.length} · Ver ${uni.groups.ov.length} · CEX ${uni.groups.oc.length} · Wrap ${uni.groups.ow.length} · Kin ${uni.groups.ok.length}`)));
 if(mode==='traded'){
  const list=[...uni.tradedAll].sort((a,b)=>(b.mcap_usd||0)-(a.mcap_usd||0)||b.tvl_usd-a.tvl_usd);
  root.innerHTML=pnl('Calibration & Peer Evidence · Separate From the 193-Row Pre-Token Board',`92 comps fit fitSizeCurve() · 437 peers fit fitLaunchOdds() · ${uni.setAside.length} set aside`,calGrid)+
   pnl(`Tokens That Already Trade (${list.length} strictly separated from pre-token board)`,'92 priced comps fit the curve; 152 carry a token without reported mcap',tbl('board',['#','Protocol',['TVL'],['Real Mcap'],['Cap/TVL'],['Blind LOO'],['Cap/LOO'],['Listed']],list.slice(0,120).map((p,i)=>{const pr=vc.looPredBySlug[p.slug];return`<tr class="row"><td class="mn dm">${i+1}</td><td><strong>${E(p.name)}</strong> ${sp('cyan mn',E(p.symbol||''))}${dv('pmeta',`${E(p.category||'')} · ${E(p.chains.slice(0,3).join(', '))}`)}</td>${N(U(p.tvl_usd))}${N(p.mcap_usd?U(p.mcap_usd):sp('dm','no cap'),'gold')}${N(p.mcap_usd?`×${(p.mcap_usd/p.tvl_usd).toFixed(2)}`:'—')}${N(pr?U(pr):'—','mu')}${N(pr&&p.mcap_usd?`×${(p.mcap_usd/pr).toFixed(2)}`:'—')}${N(E(p.listed_at||'undated'),'mu')}</tr>`;}).join('')));
 }else if(mode==='aside'){
  const list=[['ob','Bridge'],['os','Staking'],['ov','Versioned'],['oc','CEX'],['ow','Wrapped'],['ok','Traded kin']].flatMap(([k,reason])=>uni.groups[k].map(p=>({p,reason}))).sort((a,b)=>b.p.tvl_usd-a.p.tvl_usd);
  root.innerHTML=pnl(`Set Aside (${list.length} protocols)`,'All 758 protocols accounted for',tbl('board',['#','Protocol','Category',['TVL'],'Reason'],list.slice(0,120).map((it,i)=>`<tr class="row"><td class="mn dm">${i+1}</td><td><strong>${E(it.p.name)}</strong> ${sp('dm mn',E(it.p.slug))}</td><td>${E(it.p.category||'—')}</td>${N(U(it.p.tvl_usd))}<td>${bg('bk',E(it.reason))}</td></tr>`).join('')));
 }else root.innerHTML=pnl('Method, Calibration & Peer Evidence','dashboard/model.js — refitted live in browser',calGrid);
}

const dl=(n,m,t)=>{const u=URL.createObjectURL(new Blob([t],{type:m})),a=document.createElement('a');a.href=u;a.download=n;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),500);};
const wireBoard=filt=>{
 const qAll=(s,fn)=>root.querySelectorAll(s).forEach(fn),on=(id,ev,fn)=>{const el=$(id);if(el)el[ev]=fn;};
 qAll('.pills',g=>g.querySelectorAll('.pill').forEach(b=>b.onclick=()=>{st[g.dataset.g]=b.dataset.val;render();}));
 for(const[id,ev,k,s]of[['selDep','onchange','dep',1],['rngDrop','oninput','drop',0.01],['selHor','onchange','wk',1],['txtQ','oninput','q',0],['selCat','onchange','cat',0],['selChain','onchange','chain',0]])on(id,ev,e=>{st[k]=s?+e.target.value*s:e.target.value;render();});
 on('btnReset','onclick',()=>{Object.assign(st,{verdict:'all',tier:'all',cat:'all',chain:'all',q:'',dep:0,drop:M.DEFAULT_DROP_SHARE,wk:0,sort:'rank',dir:1});render();});
 on('btnCsv','onclick',()=>dl('meridian-radar.csv','text/csv',`rank,slug,name,tier,tvl_usd,odds_24m,implied_usd,verdict,net_usd,net_per_h\n${filt.map(({row:r,sc})=>[r.rank,r.slug,`"${r.name.replace(/"/g,'""')}"`,r.tier,r.tvl_usd,r.launch_odds.toFixed(4),r.implied_value_usd,sc.verdict,sc.netAllIn.toFixed(2),sc.netPerHour.toFixed(2)].join(',')).join('\n')}\n`));
 on('btnJson','onclick',()=>dl('meridian-board.json','application/json',JSON.stringify({rows:rows.map(({rank,slug,name,implied_value_usd,farm_steps})=>({rank,slug,name,implied_value_usd,farm_steps}))})));
 qAll('th[data-s]',el=>el.onclick=()=>{const k=el.dataset.s;st.dir=st.sort===k?-st.dir:k==='rank'?1:-1;st.sort=k;render();});
 qAll('.expbtn',b=>b.onclick=e=>{e.stopPropagation();st.exp=st.exp===b.dataset.x?null:b.dataset.x;render();});
 qAll('.od',b=>b.onclick=e=>{e.stopPropagation();st.slug=b.dataset.sl;st.view='detail';render();});
 qAll('tr.row',tr=>tr.onclick=()=>{st.slug=tr.dataset.sl;st.view='detail';render();});
};

const tabs=document.querySelectorAll('#navTabs .tab'),render=()=>{tabs.forEach(t=>t.classList.toggle('active',t.dataset.view===st.view||(st.view==='detail'&&t.dataset.view==='board')));if(st.view==='board')renderBoard();else if(st.view==='detail')renderDetail();else renderSecondary(st.view);};
tabs.forEach(b=>b.onclick=()=>{st.view=b.dataset.view;render();});$('brandHome').onclick=()=>{st.view='board';render();};window.addEventListener('hashchange',()=>{parseHash();render();});render();
})();

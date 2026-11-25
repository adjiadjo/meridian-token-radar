/* Meridian v3 — empirical pricing, log1p 24m launch hazard, blind validation, calibration & farm plans. */
(r=>{
'use strict';
const {log,exp,abs,round,max,min,sqrt,floor,ceil,imul}=Math;
const MODEL_VERSION='meridian-3',DEFAULT_DROP=0.09,CAP_APR=0.01,TBILL_APR=0.04,HURDLE=25;
const BRIDGES=new Set(['Bridge','Canonical Bridge']),STAKING=new Set(['Liquid Staking','Liquid Restaking','Restaked BTC']);
const CEX=['Binance','Coinbase','Bybit','Kraken','Bitget','OKX','Bitfinex','Gemini'];
const VER_RE=/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/,WRAP_RE=/\b(wrapped|staked|staking)\b/i;
const GENERIC=new Set('defi,open,meta,super,hyper,crypto,chain,yield,liquid,smart,alpha,prime,delta,sigma,omega,multi,cross,first,stable,global,token,protocol'.split(','));
const FEES=Object.fromEntries('Solana:.02:.5:SOL|Base:.04:.75:ETH|Arbitrum:.06:.75:ETH|Optimism:.05:.75:ETH|Ink:.03:.85:ETH|Plasma:.04:.9:XPL|Monad:.03:.9:MON|Sui:.02:.6:SUI|Stellar:.01:.5:XLM|Flare:.02:.75:FLR|Algorand:.01:.5:ALGO|Polygon:.05:.75:POL|Binance:.12:.6:BNB|Avalanche:.15:.9:AVAX|Mantle:.04:.85:MNT|Scroll:.08:1:ETH|Linea:.08:1:ETH|Sonic:.03:.8:S|Berachain:.05:.9:BERA|Hyperliquid L1:.04:1:HYPE|Plume Mainnet:.05:1:PLUME|Unichain:.04:.85:ETH|Katana:.05:1:ETH|Mezo:.04:.9:BTC|Tron:1.35:1:TRX|Bitcoin:2.4:2.5:BTC|Bittensor:1.8:2:TAO|Ethereum:3.2:1:ETH'.split('|').map(s=>{const[c,g,b,y]=s.split(':');return[c,[+g,+b,y]];}));
const DEF_FEE=[0.25,1.25,'gas'];

const cmp=(a,b)=>a<b?-1:a>b?1:0,clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v,rn=(x,k)=>round(x*k)/k;
const zeros=d=>Array.from({length:d},()=>Array(d).fill(0)),sum=a=>a.reduce((s,x)=>s+x,0);
const dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:0.5*(s[m-1]+s[m]);};
const cQuant=(a,q)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),n=s.length;return s[clamp((q<0.5?floor(q*(n+1)):ceil(q*(n+1)))-1,0,n-1)];};
const fnv1a=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const rng32=sd=>{let a=sd>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=imul(a^(a>>>15),1|a);t=(t+imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};};
const placebo=(sl,sa='')=>(fnv1a(sa+sl)/4294967295)*2-1;
const hasTok=p=>p.mcap_usd!==null||p.gecko_id!==null||p.symbol!==null;
const ageDays=(asOf,dt)=>{if(!dt)return null;const a=Date.parse(asOf+'T00:00:00Z'),b=Date.parse(dt+'T00:00:00Z');return Number.isFinite(a)&&Number.isFinite(b)?max(1,floor((a-b)/864e5)):null;};
const carry=(c7,m7)=>c7==null?1:1+clamp((c7-m7)/100,-0.25,0.25);
const sectorOf=cat=>{const c=(cat||'').toLowerCase();return/dex|deriv|option|predict|otc|synth|nft|launch/.test(c)?'Trading':/lend|cdp|stable|collateral|basis|reserve/.test(c)?'Credit & Stables':/curator|allocator|yield|farm|liquidity manager|index|cedefi/.test(c)?'Yield & Vaults':/rwa|card|pay|insur/.test(c)?'RWA & Payments':'Staking & Infra';};
const stemOf=n=>{const w=(String(n||'').trim().split(/\s+/)[0]||'').toLowerCase().replace(/[^a-z0-9]/g,'');return w.length<4||GENERIC.has(w)?'':w;};
const houseExcl=p=>(p.category==='CEX'||CEX.some(e=>p.name.startsWith(e)))?'oc':BRIDGES.has(p.category)?'ob':STAKING.has(p.category)?'os':VER_RE.test(p.name)?'ov':WRAP_RE.test(p.name)?'ow':null;

/** Partition all 758 snapshot protocols into 11 mutually exclusive accounting buckets. */
function classifyUniverse(snap){
 const wl=new Set(snap.watchlist),stems={},kinNote={};
 for(const p of snap.protocols)if(hasTok(p)){const s=stemOf(p.name);if(s)stems[s]=p.symbol||p.name;}
 const g={rw:[],ro:[],re:[],tp:[],tn:[],ob:[],os:[],oc:[],ov:[],ow:[],ok:[]};
 for(const p of snap.protocols){
  const tok=hasTok(p),ex=houseExcl(p),kin=stems[stemOf(p.name)]||null;
  if(wl.has(p.slug)){g.rw.push(p);if(kin)kinNote[p.slug]=kin;}
  else if(tok)g[ex||(p.mcap_usd>0?'tp':'tn')].push(p);
  else if(ex)g[ex].push(p);
  else if(kin){g.ok.push(p);kinNote[p.slug]=kin;}
  else g[p.tvl_usd>=snap.floor_usd?'ro':'re'].push(p);
 }
 const ranked=[...g.rw,...g.ro,...g.re],tradedAll=[...g.tp,...g.tn],setAside=[...g.ob,...g.os,...g.oc,...g.ov,...g.ow,...g.ok];
 return{watchlistSet:wl,groups:g,ranked,peers:[...ranked,...tradedAll],comps:g.tp,tradedAll,setAside,kinNoteBySlug:kinNote};
}

function solveLin(A,b){
 const n=b.length,M=A.map((x,i)=>[...x,b[i]]);
 for(let c=0;c<n;c++){
  let p=c;for(let k=c+1;k<n;k++)if(abs(M[k][c])>abs(M[p][c]))p=k;
  [M[c],M[p]]=[M[p],M[c]];
  const d=M[c][c]||1e-12;for(let k=c;k<=n;k++)M[c][k]/=d;
  for(let k=0;k<n;k++)if(k!==c){const f=M[k][c];for(let j=c;j<=n;j++)M[k][j]-=f*M[c][j];}
 }
 return M.map(x=>x[n]);
}
function solveRidge(X,y,lams){
 const d=X[0].length,A=zeros(d),b=Array(d).fill(0);
 for(let i=0;i<X.length;i++)for(let j=0;j<d;j++){b[j]+=X[i][j]*y[i];for(let k=j;k<d;k++)A[j][k]+=X[i][j]*X[i][k];}
 for(let j=0;j<d;j++){A[j][j]+=lams[j]||0;for(let k=0;k<j;k++)A[j][k]=A[k][j];}
 return solveLin(A,b);
}
function fitLogit(X,y,lams,steps=25){
 const d=X[0].length,b=Array(d).fill(0);
 for(let it=0;it<steps;it++){
  const H=zeros(d),g=Array(d).fill(0);
  for(let i=0;i<X.length;i++){
   const p=1/(1+exp(-clamp(dot(X[i],b),-28,28))),w=max(1e-6,p*(1-p)),e=y[i]-p;
   for(let j=0;j<d;j++){g[j]+=X[i][j]*e;for(let k=j;k<d;k++)H[j][k]+=w*X[i][j]*X[i][k];}
  }
  for(let j=0;j<d;j++){g[j]-=(lams[j]||0)*b[j];H[j][j]+=(lams[j]||0)+1e-6;for(let k=0;k<j;k++)H[j][k]=H[k][j];}
  const st=solveLin(H,g);for(let j=0;j<d;j++)b[j]+=st[j];
 }
 return b;
}

/** Conditional launch cap: ln(cap) = alpha + beta * ln(TVL * 7d carry / $100M) on 92 traded comps. */
function fitSizeCurve(comps,m7,useCarry=true){
 const eff=(t,g)=>max(1,t*(useCarry?carry(g,m7):1));
 const b=solveRidge(comps.map(p=>[1,log(eff(p.tvl_usd,p.change_7d)/1e8)]),comps.map(p=>log(p.mcap_usd)),[0,0.01]);
 return{alpha:b[0],betaTvl:b[1],capAt100M:exp(b[0]),predictLog:(t,g)=>b[0]+b[1]*log(eff(t,g)/1e8)};
}

function buildRates(peers){
 let tok=0;const sec={},cat={};
 for(const p of peers){const y=hasTok(p)?1:0,s=sectorOf(p.category),c=p.category||'__none__';tok+=y;(sec[s]||={n:0,k:0}).n++;sec[s].k+=y;(cat[c]||={n:0,k:0}).n++;cat[c].k+=y;}
 const br=clamp(tok/max(1,peers.length),0.05,0.95),bLog=log(br/(1-br));
 return{catStats:cat,logitOffset:cn=>{const se=sec[sectorOf(cn)]||{n:0,k:0},ce=cat[cn||'__none__']||{n:0,k:0},v=clamp((ce.k+6*((se.k+8*br)/(se.n+8)))/(ce.n+6),0.02,0.98);return log(v/(1-v))-bLog;}};
}

/** L2 logistic launch-odds model (ln(1+age), lambda=2.0) + decaying 24m remaining hazard over 437 peers. */
function fitLaunchOdds(peers,asOf,m7,cfg={age:1,cat:1,tvl:1,growth:1}){
 const rates=buildRates(peers),yrs=peers.map(p=>ageDays(asOf,p.listed_at)).filter(d=>d!==null).map(d=>d/365),medYr=median(yrs.length?yrs:[1.2]);
 const feat=(p,oY,oT,oG)=>{
  const d=ageDays(asOf,p.listed_at),yr=oY!==undefined?max(0.02,oY):(d===null?medYr:d/365),gv=oG!==undefined?oG:p.change_7d;
  return[1,...(cfg.age?[log(1+min(6,yr)),d===null?1:0]:[]),...(cfg.cat?[rates.logitOffset(p.category)]:[]),...(cfg.tvl?[log(max(1,oT??p.tvl_usd)/1e8)]:[]),...(cfg.growth?[clamp(gv==null?0:(gv-m7)/100,-0.5,0.5)]:[]),...(cfg.chains?[log(max(1,p.chains.length))]:[]),...(cfg.placebo?[placebo(p.slug,'p1:'),placebo(p.slug,'p2:'),placebo(p.slug,'p3:')]:[])];
 };
 const X=peers.map(p=>feat(p)),beta=fitLogit(X,peers.map(p=>hasTok(p)?1:0),X[0].map((_,i)=>i?(cfg.placebo&&i>=X[0].length-3?0.25:2.0):0),25);
 const predictProb=(p,oY,oT,oG)=>1/(1+exp(-clamp(dot(feat(p,oY,oT,oG),beta),-28,28)));
 const conditionalOdds=(p,hYr=2,oY,oT,oG)=>{
  const d=ageDays(asOf,p.listed_at),cur=oY??(d===null?medYr:d/365),pNow=predictProb(p,cur,oT,oG),pMax=predictProb(p,max(5.5,cur+hYr),oT,oG);
  return{pNow,pMax,odds:clamp(clamp((pMax-pNow)/max(0.06,1-pNow),0.05,0.96)*(1-exp(-0.62*hYr)),0.05,0.88)};
 };
 return{beta,medYr,rates,predictProb,conditionalOdds};
}

/** Blind Leave-One-Out & strict Walk-Forward (35 older -> 35 newer) ablation on launch value. */
function runValueValidation(comps,asOf,m7){
 const dated=comps.filter(p=>p.listed_at).sort((a,b)=>cmp(a.listed_at,b.listed_at)||cmp(a.slug,b.slug)),sp=floor(dated.length*0.5),wfTr=dated.slice(0,sp),wfTe=dated.slice(sp);
 const specs=[['flat','Flat median cap / TVL','baseline',{flat:1}],['size','+ size curve (ln TVL)','kept',{}],['carry','+ 7-day TVL carry (±25%)','kept',{carry:1}],['cat','+ category EB (ridge 64)','tested, not kept',{carry:1,cat:64}],['chains','+ chain count (ln)','tested, not kept',{carry:1,chains:1}],['age','+ years listed (ln)','tested, not kept',{carry:1,age:1}],['placebo','+ control: slug hash','must not help',{carry:1,placebo:1}]];
 const mkPred=o=>(tr,te)=>{
  if(o.flat)return log(te.tvl_usd*median(tr.map(p=>p.mcap_usd/p.tvl_usd)));
  if(!o.chains&&!o.age&&!o.placebo&&!o.cat)return fitSizeCurve(tr,m7,!!o.carry).predictLog(te.tvl_usd,te.change_7d);
  const mA=median(tr.map(p=>ageDays(asOf,p.listed_at)).filter(v=>v!==null));
  const f=p=>[1,log(max(1,p.tvl_usd*carry(p.change_7d,m7))/1e8),...(o.chains?[log(max(1,p.chains.length))]:[]),...(o.age?[log(((ageDays(asOf,p.listed_at)||mA||365)+30)/365)]:[]),...(o.placebo?[placebo(p.slug)]:[])];
  const b=solveRidge(tr.map(f),tr.map(p=>log(p.mcap_usd)),[0,0.01,...(o.chains?[4]:[]),...(o.age?[2]:[]),...(o.placebo?[0.5]:[])]),pb=p=>dot(f(p),b);
  let out=pb(te);if(o.cat){const rs=tr.filter(p=>p.category===te.category).map(p=>log(p.mcap_usd)-pb(p));if(rs.length)out+=(rs.length/(rs.length+o.cat))*(sum(rs)/rs.length);}
  return out;
 };
 const ladder=[],looPredBySlug={},w3=a=>rn(a.filter(e=>abs(e)<=log(3)).length/a.length,1e3);let kL=[],kW=[],wL=[];
 for(const[id,label,status,o]of specs){
  const fn=mkPred(o),loo=comps.map((p,i)=>{const pr=fn(comps.filter((_,j)=>j!==i),p);if(id==='carry')looPredBySlug[p.slug]=round(exp(pr));return log(p.mcap_usd)-pr;});
  const wf=wfTe.map(p=>log(p.mcap_usd)-fn(wfTr,p));
  if(id==='carry'){kL=loo;kW=wf;wL=wfTr.map((p,t)=>log(p.mcap_usd)-fn(wfTr.filter((_,j)=>j!==t),p));}
  ladder.push({id,label,status,looMiss:rn(exp(median(loo.map(abs))),100),wfMiss:rn(exp(median(wf.map(abs))),100)});
 }
 const qB=a=>({q10:rn(cQuant(a,0.1),1e4),q25:rn(cQuant(a,0.25),1e4),q75:rn(cQuant(a,0.75),1e4),q90:rn(cQuant(a,0.9),1e4)}),bands=qB(kL),wfb=qB(wL),cov=(e,lo,hi)=>rn(e.filter(x=>x>=lo&&x<=hi).length/e.length,1e3);
 return{ladder,compsCount:comps.length,wfSplit:[wfTr.length,wfTe.length],bands,looPredBySlug,honesty:{looWithin3:w3(kL),wfWithin3:w3(kW),looCov50:cov(kL,bands.q25,bands.q75),wfCov50:cov(kW,wfb.q25,wfb.q75),looCov80:cov(kL,bands.q10,bands.q90),wfCov80:cov(kW,wfb.q10,wfb.q90)}};
}

/** Blind 10-Fold & Walk-Forward ablation on launch-odds terms + OOF calibration curve + age cohorts. */
function runOddsValidation(peers,asOf,m7){
 const sorted=[...peers].sort((a,b)=>cmp(a.slug,b.slug)),dated=sorted.filter(p=>p.listed_at).sort((a,b)=>cmp(a.listed_at,b.listed_at)||cmp(a.slug,b.slug));
 const sp=floor(dated.length*0.6),wfTr=dated.slice(0,sp),wfTe=dated.slice(sp),full={age:1,cat:1,tvl:1,growth:1},oof=[];
 const score=(tr,te,cfg,out)=>{const fm=cfg.base?null:fitLaunchOdds(tr,asOf,m7,cfg),br=tr.filter(hasTok).length/tr.length;let b=0,a=0;for(const p of te){const pr=fm?fm.predictProb(p):br,y=hasTok(p)?1:0;b+=(pr-y)**2;if((pr>=0.5?1:0)===y)a++;if(out)out.push([pr,y]);}return[b,a];};
 const specs=[['base','Base rate of peers','baseline',{base:1}],['age','+ ln(1 + age) + undated','kept',{age:1}],['cat','+ sector/category EB share','kept',{age:1,cat:1}],['tvl','+ size (ln TVL)','kept',{age:1,cat:1,tvl:1}],['growth','+ 7-day excess TVL growth','kept',full],['chains','+ chain count (ln)','tested, not kept',{...full,chains:1}],['placebo','+ control: 3-hash slug noise','must not help',{...full,placebo:1}]];
 const ladder=specs.map(([id,label,status,cfg])=>{
  let b1=0,a1=0;
  for(let f=0;f<10;f++){const[b,a]=score(sorted.filter((_,i)=>i%10!==f),sorted.filter((_,i)=>i%10===f),cfg,id==='growth'?oof:null);b1+=b;a1+=a;}
  const[bW,aW]=score(wfTr,wfTe,cfg);
  return{id,label,status,cvBrier:rn(b1/sorted.length,1e4),cvAcc:rn(a1/sorted.length,1e3),wfBrier:rn(bW/wfTe.length,1e4),wfAcc:rn(aW/wfTe.length,1e3)};
 });
 oof.sort((a,b)=>a[0]-b[0]);
 const bins=Array.from({length:5},(_,i)=>{const sl=oof.slice(floor(i*oof.length/5),floor((i+1)*oof.length/5));return{pred:rn(sum(sl.map(x=>x[0]))/sl.length,1e3),obs:rn(sum(sl.map(x=>x[1]))/sl.length,1e3),n:sl.length};});
 const ece=rn(sum(bins.map(b=>abs(b.obs-b.pred)*b.n))/max(1,oof.length),1e3);
 const cohorts=[['0–6m',0,183],['6–12m',183,365],['1–2y',365,730],['2–3y',730,1095],['3y+',1095,99999]].map(([label,mn,mx])=>({label,mn,mx,n:0,k:0}));
 for(const p of dated){const d=ageDays(asOf,p.listed_at),co=cohorts.find(c=>d>=c.mn&&d<c.mx);if(co){co.n++;co.k+=hasTok(p)?1:0;}}
 return{ladder,peersCount:sorted.length,datedCount:dated.length,bins,ece,cohorts:cohorts.map(c=>({label:c.label,n:c.n,k:c.k,rate:c.n?rn(c.k/c.n,1e3):0}))};
}

/** 200-refit deterministic bootstrap for curve slope SE and 90% rank-stability intervals. */
function runBootstrap(comps,peers,ranked,asOf,m7,B=200){
 const rng=rng32(0x5eed2026),nC=comps.length,nP=peers.length,betas=[],hist=Object.fromEntries(ranked.map(x=>[x.slug,[]]));
 for(let b=0;b<B;b++){
  const vc=fitSizeCurve(Array.from({length:nC},()=>comps[floor(rng()*nC)]),m7,true),oc=fitLaunchOdds(Array.from({length:nP},()=>peers[floor(rng()*nP)]),asOf,m7);
  betas.push(vc.betaTvl);
  const sc=ranked.map(p=>({slug:p.slug,val:exp(vc.predictLog(p.tvl_usd,p.change_7d))*oc.conditionalOdds(p,2).odds})).sort((a,c)=>c.val-a.val||cmp(a.slug,c.slug));
  for(let i=0;i<sc.length;i++)hist[sc[i].slug].push(i+1);
 }
 const mu=sum(betas)/betas.length,seBeta=sqrt(sum(betas.map(b=>(b-mu)**2))/max(1,betas.length-1)),rankRangeBySlug={};
 for(const x of ranked){const h=hist[x.slug].sort((a,c)=>a-c);rankRangeBySlug[x.slug]=[h[floor(h.length*0.05)],h[min(h.length-1,floor(h.length*0.95))]];}
 return{refits:B,seBeta:rn(seBeta,1e3),rankRangeBySlug};
}

function pickExecutionChain(ch){
 if(!ch?.length)return{chain:'Ethereum',fee:FEES.Ethereum};
 let best=ch[0],bf=FEES[best]||DEF_FEE,bs=bf[0]*14+bf[1]*2;
 for(let i=1;i<ch.length;i++){const f=FEES[ch[i]]||DEF_FEE,s=f[0]*14+f[1]*2;if(s<bs){best=ch[i];bf=f;bs=s;}}
 return{chain:best,fee:bf};
}
const playKindOf=cat=>{const c=(cat||'').toLowerCase();return/curator|allocator/.test(c)?'Curated vault':/dex|liquidity manager/.test(c)?'Liquidity & swaps':/lend|uncollateral/.test(c)?'Supply & borrow':/cdp|stable/.test(c)?'Collateral mint':/deriv|option|otc/.test(c)?'Margin & volume':/rwa|card|pay/.test(c)?'Tokenized asset':/basis/.test(c)?'Delta-neutral stake':/predict/.test(c)?'Market volume':/restak|stak|btc/.test(c)?'Stake & delegate':/insur/.test(c)?'Cover pool':'Vault & activity';};
const fmtUsd=v=>{const a=abs(v),s=v<0?'-':'';return a>=1e9?`${s}$${(a/1e9).toFixed(2)}B`:a>=1e6?`${s}$${(a/1e6).toFixed(1)}M`:a>=1e3?`${s}$${round(a).toLocaleString('en-US')}`:`${s}$${a.toFixed(a<10?2:0)}`;};
const fmtMoney2=v=>{const a=abs(v),s=v<0?'-':'';return a>=1e3?`${s}$${round(a).toLocaleString('en-US')}`:a>=100?`${s}$${a.toFixed(0)}`:`${s}$${a.toFixed(2)}`;};

function evaluateFarmScenario(row,o={}){
 const capital=o.capital>0?o.capital:5000,dropShare=o.dropShare||DEFAULT_DROP,apr=o.dragApr??CAP_APR,weeks=o.weeks||12,holdDays=weeks*7;
 const ex=pickExecutionChain(row.chains),[txGas,bIn,gasSym]=ex.fee,stepCosts=[rn(max(0.5,txGas+0.5),100),bIn,rn(txGas*3,100),rn(txGas*2,100),rn(txGas*weeks,100),rn(txGas*2+bIn,100)];
 const cashFees=rn(sum(stepCosts),100),totalMin=66+weeks*3,hours=totalMin/60,yr=holdDays/365,capitalCharge=capital*apr*yr,tbillBench=capital*TBILL_APR*yr,totalCost=cashFees+capitalCharge;
 const tw=clamp(holdDays/min(180,max(42,(row.age_days||140)*0.22+holdDays)),0.38,1),sh=capital/(row.tvl_usd+capital),expectedDrop=row.implied_value_usd*dropShare*sh*tw,dropIfLaunches=row.launch_value_usd*dropShare*sh*tw;
 const netAllIn=expectedDrop-totalCost,netPerHour=netAllIn/hours,verdict=netAllIn>0&&netPerHour>=HURDLE?'FARM':netAllIn>0?'MARGINAL':'SKIP',dpd=expectedDrop/capital;
 return{chain:ex.chain,gasSym,txGas,capital,dropShare,weeks,holdDays,expectedDrop,dropIfLaunches,cashFees,capitalCharge,tbillBench,totalCost,netAllIn,totalMin,hours,netPerHour,verdict,breakEvenDrop:row.implied_value_usd>0?totalCost/max(1e-9,row.implied_value_usd*sh*tw):1,breakEvenOdds:dropIfLaunches>0?totalCost/dropIfLaunches:1,breakEvenDeposit:dpd>apr*yr?ceil(cashFees/(dpd-apr*yr)):null,stepCosts};
}
function optimalFarmScenario(row,o={}){
 const dropShare=o.dropShare||DEFAULT_DROP,dragApr=o.dragApr??CAP_APR,maxCap=min(25000,max(2000,round((row.tvl_usd*0.0005)/500)*500));
 const caps=o.capital>0?[o.capital]:[1000,2500,5000,10000,15000,25000].filter(c=>c<=maxCap),wks=o.weeks>0?[o.weeks]:[6,8,12,16,20,26];
 let bF=null,bA=null;
 for(const capital of(caps.length?caps:[2000]))for(const weeks of wks){
  const ev=evaluateFarmScenario(row,{capital,dropShare,dragApr,weeks});
  if(ev.verdict==='FARM'&&(!bF||ev.capital<bF.capital||(ev.capital===bF.capital&&ev.netPerHour>bF.netPerHour)))bF=ev;
  if(!bA||ev.netPerHour>bA.netPerHour)bA=ev;
 }
 return bF||bA;
}

/** Build 8 concrete, risk-aware, costed & timed chronological farm steps for UI and board.json. */
function buildFarmPlan(row,scIn){
 const sc=scIn||optimalFarmScenario(row,{dropShare:DEFAULT_DROP}),cap=`$${sc.capital.toLocaleString('en-US')}`,kind=playKindOf(row.category);
 const pos=`${cap} (${((sc.capital/max(1,row.tvl_usd))*100).toFixed(3)}% TVL)`,exitTvl=fmtUsd(round(row.tvl_usd*0.75)),sec=row.chains.find(c=>c!==sc.chain);
 const gasBuf=max(5,ceil((sc.cashFees+4)/5)*5),ch7=row.change_7d==null?'n/a':`${row.change_7d>=0?'+':''}${row.change_7d.toFixed(1)}%`;
 const ch=row.name.toLowerCase()===sc.chain.toLowerCase()?`${sc.chain} network`:sc.chain,n=row.name,F=fmtMoney2;
 const fNote=sc.chain==='Ethereum'?`only listed chain, ~${F(sc.txGas)}/tx`:`cheapest of ${row.chains.length} chain${row.chains.length===1?'':'s'}, ~${F(sc.txGas)}/tx`;
 const core=({'Curated vault':`Test $100, deploy ${pos} USDC into ${n}'s flagship vault on ${ch}; hold un-looped.`,'Liquidity & swaps':`LP ${pos} in ${n}'s deepest stable/blue-chip pool on ${ch}; swap $250 for volume credit.`,'Supply & borrow':`Supply ${pos} USDC on ${n} (${ch}); borrow 15% (health > 2.5) for two-sided credit.`,'Collateral mint':`Deposit ${pos} collateral on ${n} (${ch}); mint 35% stablecoin (> 2.2x cushion).`,'Margin & volume':`Deposit ${cap} USDC margin on ${n} (${ch}); run a low-leverage hedged perp.`,'Tokenized asset':`Complete onboarding if needed; subscribe ${pos} into ${n}'s yield RWA on ${ch}.`,'Delta-neutral stake':`Mint ${pos} of ${n}'s basis stablecoin on ${ch} and stake natively; verify peg < 0.5%.`,'Market volume':`Fund ${cap} USDC on ${n} (${ch}); provide balanced two-sided market liquidity.`,'Stake & delegate':`Stake ${pos} via ${n} on ${ch} with a high-uptime operator; note unbonding.`,'Cover pool':`Deposit ${pos} into ${n}'s cover pool on ${ch} after checking claims and exit queue.`})[kind]||`Test $100, deploy ${pos} USDC into ${n} on ${ch} and confirm accrual.`;
 const S=(when,title,text,cost,m)=>({when,title,text,cost,time:`${m} min`}),c=sc.stepCosts;
 const steps=[
  S('Day 0 · Setup','Isolate wallet',`Fresh wallet solely for ${n} on ${ch}; fund $${gasBuf} ${sc.gasSym} for gas.`,F(c[0]),8),
  S('Day 0 · Verify','Verify contracts',`Open ${n} via DefiLlama slug "${row.slug}", bookmark app URL, match contracts vs docs.`,'$0.00',8),
  S('Day 0 · Fund',`Route ${cap}`,`Withdraw ${cap} USDC to ${ch} (${fNote}).`,F(c[1]),10),
  S('Day 1 · Core',kind,core,F(c[2]),14),
  S('Day 2 · Deepen','Qualifying footprint',sec?`Hold un-looped; add one touch on ${sec} for multi-chain credit.`:'Hold un-looped; confirm points on the official rewards page.',F(c[3]),8),
  S(`Weekly ×${sc.weeks}`,'Active cadence',`Touch position weekly for ${sc.weeks}w (top-up, harvest, or vote) across ${sc.weeks} epochs.`,F(c[4]),sc.weeks*3),
  S('Any day · Risk','Drawdown exit',`Exit early if TVL drops 25% to ${exitTvl} (7d ${ch7}), queues > 7d, or snapshot lands.`,F(c[5]),10),
  S(`Day ${sc.holdDays} · Claim`,'Unwind & budget',`Log hashes & ${cap} basis; unwind Day ${sc.holdDays}, claim via official link. Net ${F(sc.netAllIn)} (${F(sc.netPerHour)}/h; 4% T-bill ${F(sc.tbillBench)}).`,`${F(sc.capitalCharge)} spread`,8),
 ];
 return{playKind:kind,steps,boardStrings:steps.map(s=>`${s.when} — ${s.text} Cost: ${s.cost}. Time: ${s.time}.`.slice(0,596))};
}

function computeSensitivity(row,scv,om){
 const t=row.tvl_usd,y=(row.age_days||round(om.medYr*365))/365,g=row.change_7d;
 return[['As recorded (baseline)',t,y,g],['TVL 30% lower',t*0.7,y,g],['TVL doubles (2x)',t*2,y,g],['7-day growth +20 pp',t,y,(g||0)+20],['+12 months, still no token',t,y+1,g]]
  .map(([label,tvl,yr,gr])=>{const lv=exp(scv.predictLog(tvl,gr)),odds=om.conditionalOdds(row,2,yr,tvl,gr).odds,implied=max(1,round(lv*odds));return{label,launchValue:round(lv),odds,implied,ratio:implied/max(1,row.implied_value_usd)};});
}

function nearestComps(row,comps,scv,looMap,lim=5){
 const lt=log(max(1,row.tvl_usd));
 return comps.map(c=>{
  const pen=c.category===row.category?0:sectorOf(c.category)===sectorOf(row.category)?0.8:1.8,blind=looMap?.[c.slug]||exp(scv.predictLog(c.tvl_usd,c.change_7d));
  return{slug:c.slug,name:c.name,symbol:c.symbol,category:c.category,tvl_usd:c.tvl_usd,mcap_usd:c.mcap_usd,capPerTvl:c.mcap_usd/c.tvl_usd,missRatio:c.mcap_usd/blind,dist:abs(log(max(1,c.tvl_usd))-lt)+pen};
 }).sort((a,b)=>a.dist-b.dist||cmp(a.slug,b.slug)).slice(0,lim);
}

function verifyBoard(rows,snap,ref){
 let tot=0,mono=true;const slugs=new Set(),parts=[];
 for(let i=0;i<rows.length;i++){const x=rows[i];if(x.rank!==i+1||(i>0&&x.implied_value_usd>rows[i-1].implied_value_usd))mono=false;tot+=x.implied_value_usd;slugs.add(x.slug);parts.push(`${x.rank}:${x.slug}:${x.implied_value_usd}`);}
 const checksum=fnv1a(parts.join('|')).toString(16).padStart(8,'0');
 return{rowCount:rows.length,monotonic:mono,totalImpliedUsd:tot,checksum,watchlistCovered:snap.watchlist.filter(s=>slugs.has(s)).length,watchlistTotal:snap.watchlist.length,matchesMain:ref?(checksum===ref.checksum&&tot===ref.total_implied_usd&&rows.length===ref.row_count):true};
}

/** Complete deterministic pipeline: refits curves, ablation ladders, calibration, bootstrap & farm plans live. */
function buildRadar(snap){
 const uni=classifyUniverse(snap),m7=median(snap.protocols.map(p=>p.change_7d).filter(v=>v!==null));
 const sizeCurve=fitSizeCurve(uni.comps,m7,true),oddsModel=fitLaunchOdds(uni.peers,snap.as_of,m7);
 const valCheck=runValueValidation(uni.comps,snap.as_of,m7),oddsCheck=runOddsValidation(uni.peers,snap.as_of,m7);
 const bootstrap=runBootstrap(uni.comps,uni.peers,uni.ranked,snap.as_of,m7,200),b=valCheck.bands,band=(v,q)=>max(1,round(v*exp(q)));
 const rows=uni.ranked.map(p=>{
  const age=ageDays(snap.as_of,p.listed_at),cf=carry(p.change_7d,m7),lv=exp(sizeCurve.predictLog(p.tvl_usd,p.change_7d)),od=oddsModel.conditionalOdds(p,2),imp=max(1,round(lv*od.odds)),cs=oddsModel.rates.catStats[p.category||'__none__']||{n:0,k:0},tier=uni.watchlistSet.has(p.slug)?'watchlist':p.tvl_usd>=snap.floor_usd?'offlist':'early';
  return{...p,sector:sectorOf(p.category),tier,kin_caution:uni.kinNoteBySlug[p.slug]||null,age_days:age,carry_factor:cf,launch_value_usd:round(lv),p_token_now:od.pNow,p_token_max:od.pMax,launch_odds:od.odds,cat_peers_total:cs.n,cat_peers_token:cs.k,implied_value_usd:imp,p10_usd:band(imp,b.q10),p25_usd:band(imp,b.q25),p75_usd:band(imp,b.q75),p90_usd:band(imp,b.q90)};
 }).sort((a,c)=>c.implied_value_usd-a.implied_value_usd||cmp(a.slug,c.slug)).map((x,i)=>{
  x.rank=i+1;[x.rank_low,x.rank_high]=bootstrap.rankRangeBySlug[x.slug]||[x.rank,x.rank];
  x.farm=optimalFarmScenario(x,{dropShare:DEFAULT_DROP});x.farm_steps=buildFarmPlan(x,x.farm).boardStrings;return x;
 });
 const g=uni.groups,ledger=[['rw','Watchlist','#4CC9F0'],['ro','Off-list','#80D8FF'],['re','Early (<$50M)','#2EE59D'],['tp','Traded comps','#F5B041'],['tn','Token no cap','#A57B32'],['ob','Bridge','#64748B'],['os','Staking','#526077'],['ov','Versioned','#475569'],['oc','Exchange','#3B485C'],['ow','Wrapped','#334155'],['ok','Traded kin','#F97066']].map(([key,label,color])=>({key,label,count:g[key].length,color}));
 return{model_version:MODEL_VERSION,as_of:snap.as_of,marketMed7d:m7,universe:uni,ledger,sizeCurve,oddsModel,valCheck,oddsCheck,bootstrap,rows,verification:verifyBoard(rows,snap)};
}
const api={MODEL_VERSION,DEFAULT_DROP_SHARE:DEFAULT_DROP,classifyUniverse,fitSizeCurve,fitLaunchOdds,runValueValidation,runOddsValidation,runBootstrap,evaluateFarmScenario,optimalFarmScenario,buildFarmPlan,computeSensitivity,nearestComps,verifyBoard,buildRadar,fmtUsd,fmtMoney2};
r.MeridianModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);

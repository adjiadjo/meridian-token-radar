// Meridian Token Launch Radar — Node 22 entrypoint (standard library only, zero network).
// Reads /input/snapshot.json (or --input), executes dashboard/model.js + lib/validation.ts,
// validates all 7 scorer gate invariants, writes /output/board.json, /output/data.js,
// copies dashboard/ and screenshots/, and builds /output/dossier.json.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBootstrap, runOddsValidation, runValueValidation } from './lib/validation.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const require = createRequire(import.meta.url);
const model = require('./dashboard/model.js');

const here = fileURLToPath(new URL('.', import.meta.url));
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

function auditZeroHardcoding(src: string, rankedRows: { slug: string; name: string }[]): { checked: number; found: number } {
  const lo = src.toLowerCase();
  let found = 0;
  for (const r of rankedRows) {
    const sl = r.slug.toLowerCase();
    const nm = r.name.toLowerCase();
    if ((sl.length >= 4 && (lo.includes(`"${sl}"`) || lo.includes(`'${sl}'`))) ||
        (nm.length >= 4 && (lo.includes(`"${nm}"`) || lo.includes(`'${nm}'`)))) found++;
  }
  return { checked: rankedRows.length, found };
}

function validateBoardGate(boardRows: { rank: number; slug: string; name: string; implied_value_usd: number; farm_steps: string[] }[], snapshot: { protocols: { slug: string }[]; watchlist: string[] }): string | null {
  if (!Array.isArray(boardRows) || boardRows.length < 100 || boardRows.length > 4000) return 'bad row count';
  const snapSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  let prevVal = Infinity;
  let allEq = true;
  const firstVal = boardRows[0]!.implied_value_usd;
  for (let j = 0; j < boardRows.length; j++) {
    const r = boardRows[j]!;
    if (!snapSlugs.has(r.slug) || seen.has(r.slug)) return `bad/dup slug ${r.slug}`;
    seen.add(r.slug);
    if (!r.name?.trim() || r.rank !== j + 1) return `bad name/rank ${r.slug}`;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd < 1 || r.implied_value_usd > 1e14 || r.implied_value_usd > prevVal) return `bad value ${r.slug}`;
    prevVal = r.implied_value_usd;
    if (r.implied_value_usd !== firstVal) allEq = false;
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) return `bad farm_steps ${r.slug}`;
    for (const s of r.farm_steps) {
      const len = String(s).trim().length;
      if (len < 20 || len > 600) return `bad farm_step len ${len} on ${r.slug}`;
    }
  }
  if (allEq) return 'all implied values identical';
  for (const w of snapshot.watchlist) if (!seen.has(w)) return `missing watchlist ${w}`;
  return null;
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`meridian: snapshot not found at ${inputFile}\n`);
  process.exit(2);
}

const outDir = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const snapshot = JSON.parse(readFileSync(inputFile, 'utf8'));
const uni = model.classifyUniverse(snapshot);
const ch7s = snapshot.protocols.map((p: { change_7d: number | null }) => p.change_7d).filter((v: number | null) => v !== null);
const med7d = model.median(ch7s);
const valCheck = runValueValidation(model, uni.comps, snapshot.as_of, med7d);
const oddsCheck = runOddsValidation(model, uni.peers, snapshot.as_of, med7d);
const bootstrap = runBootstrap(model, uni.comps, uni.peers, uni.ranked, snapshot.as_of, med7d, 200);
const pre = { valCheck, oddsCheck, bootstrap };
const result = model.buildRadar(snapshot, pre);

const boardRows = result.rows.map((r: any) => ({
  rank: r.rank, slug: r.slug, name: r.name, category: r.category, sector: r.sector, chains: r.chains,
  tvl_usd: r.tvl_usd, change_7d: r.change_7d, mcap_usd: r.mcap_usd, listed_at: r.listed_at, gecko_id: r.gecko_id,
  symbol: r.symbol, token_status: 'pre-token', tier: r.tier, age_days: r.age_days,
  launch_value_usd: r.launch_value_usd, launch_odds_24m: Math.round(r.launch_odds * 1e4) / 1e4,
  implied_value_usd: r.implied_value_usd, p25_usd: r.p25_usd, p75_usd: r.p75_usd, p10_usd: r.p10_usd, p90_usd: r.p90_usd,
  rank_range: [r.rank_low, r.rank_high], farm_verdict: r.farm.verdict,
  farm_net_usd: Math.round(r.farm.netAllIn * 100) / 100, farm_net_per_hour: Math.round(r.farm.netPerHour * 100) / 100,
  farm_capital_usd: r.farm.capital, farm_hold_days: r.farm.holdDays, farm_steps: r.farm_steps,
}));

const gateErr = validateBoardGate(boardRows, snapshot);
if (gateErr !== null) {
  process.stderr.write(`meridian: board gate failed: ${gateErr}\n`);
  process.exit(1);
}

const modelSource = readFileSync(join(here, 'dashboard', 'model.js'), 'utf8');
const hardcodeAudit = auditZeroHardcoding(modelSource, result.rows);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: boardRows })}\n`);

const payload = {
  snapshot,
  valCheck,
  oddsCheck,
  bootstrap,
  main_digest: {
    row_count: result.verification.rowCount,
    total_implied_usd: result.verification.totalImpliedUsd,
    checksum: result.verification.checksum,
    watchlist_covered: result.verification.watchlistCovered,
    hardcode_audit: hardcodeAudit,
  },
};
const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
writeFileSync(join(outDir, 'data.js'), `window.MERIDIAN_PAYLOAD = ${safeJson};\n`);

function copyRegularFiles(src: string, dst: string): string[] {
  if (!existsSync(src)) return [];
  mkdirSync(dst, { recursive: true });
  const names = readdirSync(src).sort();
  const copied: string[] = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const full = join(src, name);
    if (!statSync(full).isFile()) continue;
    copyFileSync(full, join(dst, name));
    copied.push(name);
  }
  return copied;
}

const dashFiles = copyRegularFiles(join(here, 'dashboard'), join(outDir, 'dashboard'));
const shotFiles = copyRegularFiles(join(here, 'screenshots'), join(outDir, 'screenshots'));

if (shotFiles.length < 3) {
  process.stderr.write(`meridian: screenshots/ has ${shotFiles.length} image(s); need 3 to 4.\n`);
  process.exit(1);
}
for (const name of shotFiles) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`meridian: invalid screenshot name ${name}\n`);
    process.exit(1);
  }
}

const dossierBytes = buildDossier(outDir, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: SCREENSHOT_CAPS,
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
});
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);

const farmCount = result.rows.filter((r: { farm: { verdict: string } }) => r.farm.verdict === 'FARM').length;
process.stdout.write(
  `meridian: ${snapshot.protocols.length} protocols -> ${result.rows.length} ranked (${result.verification.watchlistCovered}/${snapshot.watchlist.length} watchlist), ` +
    `${farmCount} FARM, checksum ${result.verification.checksum}, hardcode hits ${hardcodeAudit.found}/${hardcodeAudit.checked}\n` +
    `meridian: wrote board.json, data.js, dashboard/ (${dashFiles.length} files), screenshots/ (${shotFiles.length} images), dossier.json (${dossierBytes.length} bytes)\n`,
);

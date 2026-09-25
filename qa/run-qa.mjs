import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '..');
const html = await readFile(resolve(project, 'index.html'), 'utf8');
const engineMatch = html.match(/<script id="pvm-engine">([\s\S]*?)<\/script>/);
assert.ok(engineMatch, 'embedded calculation engine is present');
const sandbox = { window: {}, Intl, Number, Math, Object, Array, String, Error };
vm.runInNewContext(engineMatch[1], sandbox, { filename: 'index.html#pvm-engine' });
const core = sandbox.window.PVM_LAB_CORE;
assert.ok(core, 'engine exports its test interface');

let passed = 0;
let failed = 0;
let maxError = 0;
const failures = [];
const checks = [];
function check(condition, name, details = '') {
  if (condition) passed++;
  else { failed++; failures.push(`${name}${details ? ` — ${details}` : ''}`); }
}
function near(a, b, label, tol = 1e-8) {
  const err = Math.abs(a - b);
  maxError = Math.max(maxError, Number.isFinite(err) ? err : Infinity);
  const bound = tol * Math.max(1, Math.abs(a), Math.abs(b));
  check(Number.isFinite(a) && Number.isFinite(b) && err <= bound, label, `a=${a}, b=${b}, error=${err}`);
}
function independent(rows) {
  // Separate direct accumulation path: deliberately does not call core.directTotals.
  let rev1 = 0, rev2 = 0, gp1 = 0, gp2 = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    rev1 = rev1 + r.p1 * r.q1;
    rev2 = rev2 + r.p2 * r.q2;
    gp1 = gp1 + (r.p1 - r.c1) * r.q1;
    gp2 = gp2 + (r.p2 - r.c2) * r.q2;
  }
  return { rev1, rev2, gp1, gp2 };
}
function identities(rows, tag, requireSplit = true) {
  const c = core.calculate(rows);
  const r = c.revenueImpacts, g = c.gpImpacts;
  near(c.revenue.delta, r.price + r.volumeMix, `${tag}: Identity 1 Revenue = Price + Volume/Mix`);
  near(r.volumeMix, r.quantity + r.totalMix, `${tag}: Identity 2 Revenue Volume/Mix = Quantity + Total Mix`);
  if (requireSplit && c.flags.splitComparable) near(r.totalMix, r.channelMix + r.productMix, `${tag}: Identity 3 Revenue Total Mix = Channel + Product`);
  if (requireSplit && c.flags.splitComparable) near(c.revenue.delta, r.price + r.quantity + r.channelMix + r.productMix, `${tag}: Identity 4 Revenue full bridge`);
  near(c.gp.delta, g.price + g.volumeMix + g.cost, `${tag}: Identity 5 GP = Price + Volume/Mix + Cost`);
  near(g.volumeMix, g.quantity + g.totalMix, `${tag}: Identity 6 GP Volume/Mix = Quantity + Total Mix`);
  if (requireSplit && c.flags.splitComparable) near(g.totalMix, g.channelMix + g.productMix, `${tag}: Identity 7 GP Total Mix = Channel + Product`);
  if (requireSplit && c.flags.splitComparable) near(c.gp.delta, g.price + g.quantity + g.channelMix + g.productMix + g.cost, `${tag}: Identity 8 GP full bridge`);
  const d = independent(rows);
  near(c.revenue.begin, d.rev1, `${tag}: independent Revenue 1 total`);
  near(c.revenue.end, d.rev2, `${tag}: independent Revenue 2 total`);
  near(c.gp.begin, d.gp1, `${tag}: independent GP1 total`);
  near(c.gp.end, d.gp2, `${tag}: independent GP2 total`);
  return c;
}
function allZero(values, tag) {
  for (const [key, value] of Object.entries(values)) if (value != null) near(value, 0, `${tag}: ${key} is zero`, 1e-10);
}

const presetNames = ['No Change', 'Price Only', 'Pure Quantity Growth', 'Product Mix Shift', 'Channel Mix Shift', 'Cost Shock', 'Mixed Reality', 'Legacy SKU Removed'];
const scenarios = Object.fromEntries(presetNames.map(name => [name, core.applyPreset(name, core.BASE)]));
for (const name of presetNames) identities(scenarios[name], `Preset ${name}`);

const noChange = core.calculate(scenarios['No Change']);
allZero(noChange.revenueImpacts, 'No Change Revenue impacts');
allZero(noChange.gpImpacts, 'No Change GP impacts');
check(noChange.revenue.delta === 0 && noChange.gp.delta === 0, 'No Change endpoints are identical');

const priceOnly = core.calculate(scenarios['Price Only']);
check(Math.abs(priceOnly.revenueImpacts.price) > 0 && [priceOnly.revenueImpacts.volumeMix,priceOnly.revenueImpacts.quantity,priceOnly.revenueImpacts.totalMix,priceOnly.revenueImpacts.channelMix,priceOnly.revenueImpacts.productMix].every(x=>Math.abs(x)<1e-9), 'Price Only changes only Revenue Price');
check(Math.abs(priceOnly.gpImpacts.price) > 0 && [priceOnly.gpImpacts.volumeMix,priceOnly.gpImpacts.quantity,priceOnly.gpImpacts.totalMix,priceOnly.gpImpacts.cost].every(x=>Math.abs(x)<1e-9), 'Price Only changes only GP Price');

const pureQ = core.calculate(scenarios['Pure Quantity Growth']);
check(Math.abs(pureQ.revenueImpacts.quantity) > 0 && Math.abs(pureQ.gpImpacts.quantity) > 0, 'Pure Quantity Growth moves pure Quantity');
near(pureQ.revenueImpacts.totalMix, 0, 'Pure Quantity Growth Revenue Mix = 0');
near(pureQ.gpImpacts.totalMix, 0, 'Pure Quantity Growth GP Mix = 0');
near(pureQ.revenueImpacts.channelMix, 0, 'Pure Quantity Growth Channel Mix = 0');
near(pureQ.revenueImpacts.productMix, 0, 'Pure Quantity Growth Product Mix = 0');

const productShift = core.calculate(scenarios['Product Mix Shift']);
near(productShift.tq2, productShift.tq1, 'Product Mix Shift holds total quantity fixed');
near(productShift.revenueImpacts.quantity, 0, 'Product Mix Shift Quantity = 0');
near(productShift.revenueImpacts.channelMix, 0, 'Product Mix Shift Channel Mix = 0');
check(Math.abs(productShift.revenueImpacts.productMix) > 1, 'Product Mix Shift moves Product Mix');

const channelShift = core.calculate(scenarios['Channel Mix Shift']);
near(channelShift.tq2, channelShift.tq1, 'Channel Mix Shift holds total quantity fixed');
near(channelShift.revenueImpacts.quantity, 0, 'Channel Mix Shift Quantity = 0');
near(channelShift.revenueImpacts.productMix, 0, 'Channel Mix Shift Product Mix = 0');
check(Math.abs(channelShift.revenueImpacts.channelMix) > 1, 'Channel Mix Shift moves Channel Mix');

const costShock = core.calculate(scenarios['Cost Shock']);
allZero(costShock.revenueImpacts, 'Cost Shock Revenue impacts');
check(costShock.gpImpacts.cost < 0, 'Cost Shock GP Cost impact is negative');
allZero({ price: costShock.gpImpacts.price, volumeMix: costShock.gpImpacts.volumeMix, quantity: costShock.gpImpacts.quantity, totalMix: costShock.gpImpacts.totalMix, channelMix: costShock.gpImpacts.channelMix, productMix: costShock.gpImpacts.productMix }, 'Cost Shock non-Cost GP impacts');

const legacy = scenarios['Legacy SKU Removed'];
check(legacy.filter(x => x.legacy).every(x => x.q2 === 0), 'Legacy SKU Removed sets Period 2 legacy quantities to zero');
const allCalc = core.calculate(legacy), focusCalc = core.calculate(legacy, { focus: true });
check(focusCalc.tq1 < allCalc.tq1 && core.close(focusCalc.tq2,allCalc.tq2), 'Focus-SKU removes the same population from both-period totals and recalculates shares');
check(focusCalc.rows.every(x => !x.legacy), 'Focus-SKU removes the same Legacy population from both periods');
check(Math.abs(focusCalc.gpImpacts.productMix - allCalc.gpImpacts.productMix) > 1, 'All-SKU and Focus-SKU Product Mix are recalculated separately');

const mixed = core.calculate(scenarios['Mixed Reality']);
for (const key of ['price','quantity','channelMix','productMix','cost']) check(Math.abs(mixed.gpImpacts[key]) > 0, `Mixed Reality has a non-zero ${key} effect`);
for (const [name, scenarioRows] of Object.entries(scenarios)) {
  const c = core.calculate(scenarioRows);
  const mappings = [
    [1, c.revenue.delta, c.revenueImpacts.price + c.revenueImpacts.volumeMix],
    [2, c.revenueImpacts.volumeMix, c.revenueImpacts.quantity + c.revenueImpacts.totalMix],
    [3, c.revenueImpacts.totalMix, c.revenueImpacts.channelMix + c.revenueImpacts.productMix],
    [4, c.revenue.delta, c.revenueImpacts.price + c.revenueImpacts.quantity + c.revenueImpacts.channelMix + c.revenueImpacts.productMix],
    [5, c.gp.delta, c.gpImpacts.price + c.gpImpacts.volumeMix + c.gpImpacts.cost],
    [6, c.gpImpacts.volumeMix, c.gpImpacts.quantity + c.gpImpacts.totalMix],
    [7, c.gpImpacts.totalMix, c.gpImpacts.channelMix + c.gpImpacts.productMix],
    [8, c.gp.delta, c.gpImpacts.price + c.gpImpacts.quantity + c.gpImpacts.channelMix + c.gpImpacts.productMix + c.gpImpacts.cost]
  ];
  for (const [id,a,b] of mappings) if (Number.isFinite(a) && Number.isFinite(b)) near(a,b,`${name}: stage waterfall ${id} balances`);
}

// Interpretation Lab contrasts are calculated from separate, deterministic inputs.
const labA = core.applyPreset('Mixed Reality', core.BASE);
labA.forEach(x => { x.c2 += 24; });
const labACalc = core.calculate(labA);
check(labACalc.gpImpacts.productMix > 0 && labACalc.gp.delta < 0, 'Lab A: Product Mix positive while Gross Profit declines');
const labB = core.applyPreset('No Change', core.BASE);
labB.forEach(x => { x.p2 += 16; });
const direct = labB.filter(x => x.channel === 'Direct');
const directQ = direct.reduce((s,x)=>s+x.q1,0), shift = directQ * .18;
direct.find(x=>x.product==='Pro').q2 -= shift;
direct.find(x=>x.product==='Core').q2 += shift;
const labBCalc = core.calculate(labB);
check(labBCalc.gpImpacts.productMix < 0 && labBCalc.gp.delta > 0, 'Lab B: Product Mix negative while Gross Profit increases');

// Edge cases: no NaN/Infinity; undefined comparisons get N/A flags.
const zeroBase = core.clone(core.BASE).map(x => ({ ...x, q1: 0 }));
const zeroBaseCalc = core.calculate(zeroBase);
check(zeroBaseCalc.revenueImpacts.quantity === null && zeroBaseCalc.gpImpacts.totalMix === null, 'Zero Period 1 total flags Quantity/Mix as unavailable');
check(!zeroBaseCalc.flags.baseValid, 'Zero Period 1 base is flagged');
check(Object.values(zeroBaseCalc.revenue).every(Number.isFinite) && Object.values(zeroBaseCalc.gp).every(Number.isFinite), 'Zero base totals stay finite');
const zeroChannel = core.clone(core.BASE).map(x => ({ ...x, q2: x.channel === 'Online' ? 0 : x.q2 }));
const zeroChannelCalc = core.calculate(zeroChannel);
check(zeroChannelCalc.gpImpacts.productMix === null && !zeroChannelCalc.flags.splitComparable, 'Zero current channel has no comparable detailed mix split');
const newItem = core.clone(core.BASE);
newItem.find(x=>x.product==='Pro'&&x.channel==='Online').q1=0;
const newItemCalc = core.calculate(newItem);
check(newItemCalc.revenueImpacts.productMix === null && newItemCalc.flags.newItems.length === 1, 'New Product × Channel cell is flagged and detailed mix is N/A');
check([...Object.values(newItemCalc.revenueImpacts),...Object.values(newItemCalc.gpImpacts)].every(v=>v==null||Number.isFinite(v)), 'Edge impacts contain no NaN or Infinity');

// Fixed-seed property verification over 500 positive-base Product × Channel scenarios.
let seed = 20260925;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
const randomIterations = 500;
for (let iteration=0; iteration<randomIterations; iteration++) {
  const rows = core.clone(core.BASE).map(x => ({
    ...x,
    q1: 1 + random()*250,
    q2: 1 + random()*300,
    p1: 15 + random()*250,
    p2: 15 + random()*270,
    c1: 2 + random()*150,
    c2: 2 + random()*165
  }));
  identities(rows, `Random ${iteration+1}`);
}

const report = `# QA Report — PVM Learning Lab\n\n`+
  `- **Status:** ${failed === 0 ? 'PASS' : 'FAIL'}\n`+
  `- **Checks passed / failed:** ${passed} / ${failed}\n`+
  `- **Property/random scenarios:** ${randomIterations} (xorshift32 fixed seed 20260925)\n`+
  `- **Maximum absolute reconciliation / total comparison error:** ${maxError.toExponential(6)}\n`+
  `- **Runtime dependencies:** none; calculation engine extracted from the self-contained HTML and evaluated in Node.js\n\n`+
  `## Coverage\n\n`+
  `- All eight required Revenue and Gross Profit identities across all eight presets and 500 deterministic randomized Product × Channel cases.\n`+
  `- No Change; Price Only; pure proportional Quantity growth; Product Mix only; Channel Mix only; Cost Shock; Mixed Reality; and Legacy SKU Removed.\n`+
  `- Independent direct accumulation of Revenue and Gross Profit endpoints.\n`+
  `- Stage waterfall sums; both interpretation contrast scenarios; all-SKU versus recalculated Focus-SKU; zero total Period 1 base; zero current channel; new Product × Channel cell; finite-value checks.\n\n`+
  `## Results\n\n`+
  `${failed === 0 ? 'Every mathematical check passed.' : `Failures:\n\n${failures.map(x=>`- ${x}`).join('\n')}`}\n\n`+
  `This report covers the calculation engine and deterministic scenario data. Browser-based visual and interaction checks are recorded separately after application QA.\n`;
await writeFile(resolve(project, 'QA_REPORT.md'), report, 'utf8');
console.log(`PVM QA ${failed===0?'PASS':'FAIL'} — ${passed} passed, ${failed} failed; max error ${maxError.toExponential(6)}`);
if (failed) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}

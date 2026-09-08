/**
 * Runs the complete sequential DOE study end to end and prints the answer key.
 *
 *   node doe/run-study.mjs [--target=10] [--seed=...] [--write]
 *
 * Phase 1  2^(5-2) resolution III screening      - which factors are worth keeping?
 * Phase 2  2^(5-1) resolution V + centre points  - de-alias, find interactions, test curvature
 * Phase 3  Box-Behnken response surface          - fit a quadratic and optimise to target
 *
 * `--write` also drops the student data sets into course/data/ as CSV.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import {
  FACTORS, RSM_FACTORS, runDesign, shotLevel, settingsFor, confirm, toCsv
} from './catapult-doe.js';
import {
  fullFactorial2, fractionalFactorial2, aliasStructure, boxBehnken, withCentrePoints
} from './designs.js';
import { fit, lackOfFit, curvatureTest, optimiseToTarget } from './analysis.js';
import { predictSigma } from '../physics.js';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const TARGET = Number(args.target ?? 10);
const WRITE = Boolean(args.write);

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 3, n = 9) => Number(v).toFixed(d).padStart(n);
const rule = (c = '-') => console.log(c.repeat(78));
const heading = t => { console.log(); rule('='); console.log(t); rule('='); };

function effectsTable(fitResult, { aliases = null, only = null } = {}) {
  const rows = [...fitResult.terms].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  console.log(pad('Term', 8) + pad('Effect', 11) + pad('Coef', 11) + pad('SS', 11) +
              pad('F', 10) + pad('p', 11) + pad('% contrib', 11) + (aliases ? 'aliased with' : ''));
  rule();
  for (const t of rows) {
    if (only && !only.includes(t.label)) continue;
    const alias = aliases ? aliases[t.label]?.filter(a => a.length <= 2).join(', ') ?? '' : '';
    console.log(
      pad(t.label, 8) + num(t.effect, 3, 10) + ' ' + num(t.coefficient, 3, 10) + ' ' +
      num(t.sumSquares, 2, 10) + ' ' + num(t.fStatistic, 1, 9) + ' ' +
      pad(t.pValue < 1e-4 ? t.pValue.toExponential(1) : t.pValue.toFixed(4), 11).padStart(11) + ' ' +
      num(t.percentContribution, 2, 9) + '  ' + alias
    );
  }
  rule();
  console.log(`Model: R2 = ${fitResult.rSquared.toFixed(4)}   adjusted R2 = ${fitResult.adjustedRSquared.toFixed(4)}` +
              `   residual df = ${fitResult.residualDf}   MSE = ${fitResult.meanSquareError.toFixed(4)}`);
}

/* ------------------------------------------------------------------ phase 1 */

heading('PHASE 1  -  Screening: 2^(5-2) resolution III, 8 runs x 3 shots');

const p1Generators = ['D=AB', 'E=AC'];
const p1Design = fractionalFactorial2(5, p1Generators);
const p1Alias = aliasStructure(5, p1Generators);

console.log(`Factors: ${FACTORS.map(f => `${f.letter}=${f.name} [${f.low}, ${f.high}]`).join('  ')}`);
console.log(`Generators: ${p1Generators.join(', ')}`);
console.log(`Defining relation: I = ${p1Alias.words.join(' = ')}`);
console.log(`Resolution ${p1Alias.resolution} - main effects are aliased with two-factor interactions.\n`);

const p1 = runDesign(p1Design, { replicates: 3, seed: 1001 });
const p1Shots = shotLevel(p1);
const p1Fit = fit(p1Shots.design, p1Shots.response, 'main');
effectsTable(p1Fit, { aliases: p1Alias.aliases });

const p1Ranked = [...p1Fit.terms].sort((a, b) => b.percentContribution - a.percentContribution);
console.log(`\nRanked by contribution: ${p1Ranked.map(t => `${t.label} (${t.percentContribution.toFixed(1)}%)`).join(', ')}`);
console.log(`Verdict: ${p1Ranked[p1Ranked.length - 1].label} contributes ` +
            `${p1Ranked[p1Ranked.length - 1].percentContribution.toFixed(1)}% - a candidate to drop.`);
console.log('Caution: at resolution III every main effect above is confounded with a two-factor');
console.log('interaction, so these numbers rank candidates - they do not settle anything.');

/* ------------------------------------------------------------------ phase 2 */

heading('PHASE 2  -  De-aliasing: 2^(5-1) resolution V + 4 centre points, 3 shots');

const p2Generators = ['E=ABCD'];
const p2Base = fractionalFactorial2(5, p2Generators);
const p2Alias = aliasStructure(5, p2Generators);
const p2Design = withCentrePoints(p2Base, 4);

console.log(`Generators: ${p2Generators.join(', ')}`);
console.log(`Defining relation: I = ${p2Alias.words.join(' = ')}   (resolution ${p2Alias.resolution})`);
console.log('Main effects are now clear of two-factor interactions, and each two-factor');
console.log('interaction is aliased only with a three-factor interaction.\n');

const p2 = runDesign(p2Design, { replicates: 3, seed: 2002 });
const p2Shots = shotLevel(p2);

// Interactions are estimated from the factorial portion; the centre runs carry
// no interaction information and are reserved for the curvature test.
const factorialRows = p2Shots.design
  .map((row, i) => (row.some(v => v !== 0) ? i : -1))
  .filter(i => i >= 0);
const p2Fit = fit(
  factorialRows.map(i => p2Shots.design[i]),
  factorialRows.map(i => p2Shots.response[i]),
  'interaction'
);
effectsTable(p2Fit);

const trivial = p2Fit.terms.filter(t => t.percentContribution < 0.5).map(t => t.label);
console.log(`\nTerms below 0.5% contribution: ${trivial.join(', ')}`);
console.log(`Factor E (pin elevation) contributes ${p2Fit.terms.find(t => t.label === 'E').percentContribution.toFixed(2)}% - drop it.`);

const p2Curv = curvatureTest(p2Shots.design, p2Shots.response);
console.log('\nCurvature test (factorial corners vs centre points)');
rule();
console.log(`  mean of factorial runs : ${p2Curv.factorialMean.toFixed(3)} m`);
console.log(`  mean of centre runs    : ${p2Curv.centreMean.toFixed(3)} m`);
console.log(`  difference             : ${p2Curv.difference.toFixed(3)} m`);
console.log(`  F = ${p2Curv.fStatistic.toFixed(2)}   p = ${p2Curv.pValue.toExponential(3)}`);
console.log(`  => ${p2Curv.pValue < 0.05
  ? 'Significant curvature. A two-level model cannot describe this surface;\n     a response-surface design is required to hit a target reliably.'
  : 'No significant curvature.'}`);

/* ------------------------------------------------------------------ phase 3 */

heading('PHASE 3  -  Response surface: Box-Behnken, 3 factors, 15 runs x 15 shots');

console.log(`RSM window (re-centred after screening):`);
for (const f of RSM_FACTORS) console.log(`  ${f.letter} = ${pad(f.name, 16)} ${f.low} to ${f.high} ${f.unit}`);
console.log('  D = Arm hole held at 3.0,  E = Pin elevation held at 2.25\n');

const p3Design = boxBehnken(3);
const p3 = runDesign(p3Design, { factors: RSM_FACTORS, replicates: 15, seed: 3003 });
const p3Shots = shotLevel(p3);

console.log(`${p3Design.length} design points (12 edge + 3 centre), ${p3Shots.response.length} shots total.\n`);

const meanFit = fit(p3Shots.design, p3Shots.response, 'quadratic');
console.log('Quadratic model for MEAN DISTANCE');
effectsTable(meanFit);

const p3Lof = lackOfFit(p3Shots.design, p3Shots.response, meanFit);
if (p3Lof) {
  console.log(`\nLack of fit: F = ${p3Lof.fStatistic.toFixed(2)} on ${p3Lof.lackOfFitDf} and ` +
              `${p3Lof.pureErrorDf} df,  p = ${p3Lof.pValue.toExponential(3)}`);
  console.log(`  => ${p3Lof.pValue < 0.05
    ? 'Significant lack of fit - the quadratic form is missing something.'
    : 'No significant lack of fit - the quadratic model is adequate.'}`);
}

// Second response: the within-run standard deviation. A spread is modelled on
// the log scale - it is bounded below by zero, and its effects act
// multiplicatively, both of which a log transform fixes.
const logSpreadFit = fit(p3Design, p3.spreads.map(Math.log), 'interaction');
console.log('\n\nModel for ln(WITHIN-RUN STANDARD DEVIATION), n = 15 shots per run');
effectsTable(logSpreadFit);
console.log('\nObserved sd by run ranged ' +
  `${Math.min(...p3.spreads).toFixed(3)} to ${Math.max(...p3.spreads).toFixed(3)} m.`);
console.log('The mean model above would have been perfectly good on 3 shots per run. This');
console.log('variation model needs 15, because a standard deviation is a far noisier statistic');
console.log('than a mean - that asymmetry in replication cost is the real lesson here.');

/* ------------------------------------------------- optimisation to a target */

heading(`OPTIMISATION  -  hit ${TARGET.toFixed(2)} m, then minimise variation`);

// Both models come from the experiment: students never see the simulator's
// internals. The confirmation runs are what check whether the models were right.
const predictMean = point => meanFit.predict(point);
const predictSpread = point => Math.exp(logSpreadFit.predict(point));

// The two ends of the on-target ridge. Every point between them predicts the
// same mean distance; an engineer who solves only for the target lands
// somewhere along it essentially at random, which is the argument for carrying
// a variation response at all.
const robust = optimiseToTarget({
  predictMean, predictSpread, k: 3, target: TARGET, spreadWeight: 1
});
const fragile = optimiseToTarget({
  predictMean, predictSpread, k: 3, target: TARGET, spreadWeight: -1
});

function report(label, solution) {
  const settings = settingsFor(solution.point, RSM_FACTORS);
  const check = confirm(settings, 600);
  const nominal = predictSigma(settings);
  console.log(`\n${label}`);
  rule();
  console.log(`  coded          : A = ${solution.point[0].toFixed(3)}, B = ${solution.point[1].toFixed(3)}, C = ${solution.point[2].toFixed(3)}`);
  console.log(`  settings       : pull-back ${settings.pullBackAngle.toFixed(1)} deg,  ` +
              `stop ${settings.stopAngle.toFixed(1)} deg,  bungee ${settings.bungeePosition.toFixed(2)}`);
  console.log(`  model predicts : ${solution.predictedMean.toFixed(3)} m,  sd ${Math.abs(solution.predictedSpread).toFixed(4)} m`);
  console.log(`  CONFIRMATION   : ${check.mean.toFixed(3)} +/- ${check.halfWidth95.toFixed(3)} m over ${check.n} shots`);
  console.log(`                   observed sd = ${check.spread.toFixed(4)} m   (CV ${(100 * check.spread / check.mean).toFixed(2)}%)`);
  console.log(`  mean error     : ${(solution.predictedMean - check.mean >= 0 ? '+' : '')}${(solution.predictedMean - check.mean).toFixed(3)} m`);
  console.log(`  true sd here   : ${nominal.toFixed(4)} m`);
  return check;
}

const fragileCheck = report(`1. LEAST repeatable way to hit ${TARGET} m`, fragile);
const robustCheck = report(`2. MOST repeatable way to hit ${TARGET} m`, robust);

console.log('\n' + '='.repeat(78));
console.log('THE RESULT');
rule();
console.log(`  Both settings land on ${TARGET} m. They are not equally good:`);
console.log(`    least repeatable : sd = ${fragileCheck.spread.toFixed(4)} m  (CV ${(100 * fragileCheck.spread / fragileCheck.mean).toFixed(2)}%)`);
console.log(`    most repeatable  : sd = ${robustCheck.spread.toFixed(4)} m  (CV ${(100 * robustCheck.spread / robustCheck.mean).toFixed(2)}%)`);
console.log(`  Choosing well cuts scatter by ` +
            `${(100 * (1 - robustCheck.spread / fragileCheck.spread)).toFixed(1)}% at no cost in accuracy.`);
console.log('  An engineer who solves only for the target lands somewhere on that ridge');
console.log('  at random. Carrying a variation response is what turns the choice into');
console.log('  a decision instead of an accident.');
console.log('='.repeat(78));

/* ---------------------------------------------------------------- data files */

if (WRITE) {
  mkdirSync('course/data', { recursive: true });
  const files = {
    'phase1-screening-2^(5-2).csv': toCsv(p1.runs, FACTORS),
    'phase2-resolutionV-2^(5-1).csv': toCsv(p2.runs, FACTORS),
    'phase3-box-behnken.csv': toCsv(p3.runs, RSM_FACTORS),
    'full-factorial-2^5.csv': toCsv(runDesign(fullFactorial2(5), { replicates: 3, seed: 4004 }).runs, FACTORS)
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(`course/data/${name}`, content + '\n');
    console.log(`wrote course/data/${name}`);
  }
}

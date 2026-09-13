/**
 * Runs the complete sequential DOE study end to end and prints the answer key.
 *
 *   node doe/run-study.mjs [--target=10] [--noise=1] [--reps=N] [--write] [--out=DIR]
 *
 * Phase 1  2^(5-2) resolution III screening      - which factors are worth keeping?
 * Phase 2  2^(5-1) resolution V + centre points  - de-alias, find interactions, test curvature
 * Phase 3  Box-Behnken response surface          - fit a quadratic and optimise to target
 *
 * `--noise` multiplies every random effect: 0 is a perfectly repeatable
 * machine, 1 the default, 3 a badly behaved one. Raising it is the quickest way
 * to show a class that a design which worked yesterday no longer detects
 * anything. `--write` also drops the student data sets into course/data/ as CSV,
 * or into `--out=DIR` instead.
 *
 * `--reps=N` overrides the replicate count of *every* design at once. `--reps=1`
 * is the unreplicated revision: it still fits every mean model, and it takes
 * away pure error, the lack-of-fit test and the whole variation response. The
 * script reports each of those as unavailable rather than printing a number it
 * cannot support.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import {
  FACTORS, RSM_FACTORS, runDesign, shotLevel, settingsFor, confirm, toCsv
} from './catapult-doe.js';
import {
  fullFactorial2, fractionalFactorial2, aliasStructure, boxBehnken, withCentrePoints
} from './designs.js';
import {
  fit, fitSaturated, lackOfFit, curvatureTest, optimiseToTarget, modelTerms, fPValue
} from './analysis.js';
import { predictSigma } from '../physics.js';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const TARGET = Number(args.target ?? 10);
const NOISE_SCALE = Number(args.noise ?? 1);
const WRITE = Boolean(args.write);
const OUT = typeof args.out === 'string' ? args.out.replace(/\/$/, '') : 'course/data';
const REPS = args.reps === undefined ? null : Number(args.reps);

if (REPS !== null && (!Number.isInteger(REPS) || REPS < 1)) {
  console.error('--reps must be an integer >= 1');
  process.exit(1);
}
// null means "use each phase's own default", which is what reproduces the
// course answer key. Any override is flagged, because every seeded number
// below moves the moment the number of draws per run changes.
const reps = standard => REPS ?? standard;
if (REPS !== null) {
  console.log(`\nReplicates forced to ${REPS} for every design.`);
  console.log('Numbers below will not match the course answer key, which uses 3 shots per');
  console.log('run for the two-level designs and 15 for the response surface.');
  if (REPS === 1) {
    console.log('At one shot per run there is no within-run spread, so pure error, the');
    console.log('lack-of-fit test and the variation response are all unavailable.');
  }
}

if (!Number.isFinite(NOISE_SCALE) || NOISE_SCALE < 0) {
  console.error('--noise must be a number >= 0');
  process.exit(1);
}
if (NOISE_SCALE !== 1) {
  console.log(`\nNoise scale ${NOISE_SCALE}x - every random effect is multiplied by this.`);
  console.log('Numbers below will not match the course answer key, which assumes 1x.');
}

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

/**
 * The effects table for a design with nothing left over for error: no F, no p,
 * and a Lenth margin in their place.
 */
function lenthTable(result) {
  const rows = [...result.terms].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  console.log(pad('Term', 8) + pad('Effect', 11) + pad('Coef', 11) + pad('SS', 11) +
              pad('% contrib', 11) + 'vs Lenth margins');
  rule();
  for (const t of rows) {
    console.log(
      pad(t.label, 8) + num(t.effect, 3, 10) + ' ' + num(t.coefficient, 3, 10) + ' ' +
      num(t.sumSquares, 2, 10) + ' ' + num(t.percentContribution, 2, 9) + '  ' +
      (t.clear ? 'active (beyond SME)' : t.active ? 'candidate (beyond ME)' : '-')
    );
  }
  rule();
  const L = result.lenth;
  console.log(`No residual degrees of freedom: ${result.terms.length + 1} parameters from ` +
              `${result.terms.length + 1} runs.`);
  console.log('There is no F ratio and no p-value for any term here - not small ones, none.');
  console.log(`Lenth's PSE = ${L.pse.toFixed(4)} on ${L.df.toFixed(2)} df,  ` +
              `ME = ${L.me.toFixed(3)},  SME = ${L.sme.toFixed(3)}`);
  console.log('The yardstick is built from the effects themselves, assuming most of them are');
  console.log('inert. It is a good method, and it is not a replacement for knowing.');
}

/* ------------------------------------------------------------------ phase 1 */

heading(`PHASE 1  -  Screening: 2^(5-2) resolution III, 8 runs x ${reps(3)} ${reps(3) === 1 ? 'shot' : 'shots'}`);

const p1Generators = ['D=AB', 'E=AC'];
const p1Design = fractionalFactorial2(5, p1Generators);
const p1Alias = aliasStructure(5, p1Generators);

console.log(`Factors: ${FACTORS.map(f => `${f.letter}=${f.name} [${f.low}, ${f.high}]`).join('  ')}`);
console.log(`Generators: ${p1Generators.join(', ')}`);
console.log(`Defining relation: I = ${p1Alias.words.join(' = ')}`);
console.log(`Resolution ${p1Alias.resolution} - main effects are aliased with two-factor interactions.\n`);

const p1 = runDesign(p1Design, { replicates: reps(3), seed: 1001, noiseScale: NOISE_SCALE });
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

heading(`PHASE 2  -  De-aliasing: 2^(5-1) resolution V + 4 centre points, ${reps(3)} ${reps(3) === 1 ? 'shot' : 'shots'}`);

const p2Generators = ['E=ABCD'];
const p2Base = fractionalFactorial2(5, p2Generators);
const p2Alias = aliasStructure(5, p2Generators);
const p2Design = withCentrePoints(p2Base, 4);

console.log(`Generators: ${p2Generators.join(', ')}`);
console.log(`Defining relation: I = ${p2Alias.words.join(' = ')}   (resolution ${p2Alias.resolution})`);
console.log('Main effects are now clear of two-factor interactions, and each two-factor');
console.log('interaction is aliased only with a three-factor interaction.\n');

const p2 = runDesign(p2Design, { replicates: reps(3), seed: 2002, noiseScale: NOISE_SCALE });
const p2Shots = shotLevel(p2);

// Interactions are estimated from the factorial portion; the centre runs carry
// no interaction information and are reserved for the curvature test.
const factorialRows = p2Shots.design
  .map((row, i) => (row.some(v => v !== 0) ? i : -1))
  .filter(i => i >= 0);
const p2X = factorialRows.map(i => p2Shots.design[i]);
const p2Y = factorialRows.map(i => p2Shots.response[i]);

// 16 factorial runs against 16 parameters: one shot per run leaves a saturated
// design, which OLS can solve and cannot test. Lenth's PSE is the standard way
// out, and the switch is worth showing rather than hiding.
const p2Saturated = p2X.length <= modelTerms(5, 'interaction').length + 1;
const p2Result = p2Saturated
  ? fitSaturated(p2X, p2Y, 'interaction')
  : fit(p2X, p2Y, 'interaction');
if (p2Saturated) lenthTable(p2Result); else effectsTable(p2Result);

if (p2Saturated) {
  // A saturated design is not a dead end, and Lenth is not the only way out.
  // Two other routes exist here, and comparing all three is the lesson: each
  // one is a different answer to "what shall I use as the error term?".
  console.log('\nTHREE WAYS TO GET A DENOMINATOR');
  rule('=');

  console.log('\n1. Reduced models - pool the terms you are willing to call noise');
  rule();
  const ladders = [
    { keep: ['A', 'B', 'C', 'D', 'E'], name: 'main effects only' },
    { keep: ['A', 'B', 'C', 'D', 'E', 'AB'], name: '+ AB' },
    { keep: ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD'], name: '+ AB AC AD' },
    { keep: ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'], name: '+ every A interaction' }
  ];
  console.log(pad('model', 26) + pad('resid df', 10) + pad('resid SD', 11) + 'significant at 0.05');
  for (const { keep, name } of ladders) {
    const rf = fit(p2X, p2Y, keep);
    const hits = rf.terms.filter(t => t.pValue < 0.05).map(t => t.label);
    console.log(pad(name, 26) + pad(rf.residualDf, 10) +
                pad(Math.sqrt(rf.meanSquareError).toFixed(3), 11) + (hits.join(' ') || 'none'));
  }
  console.log('\n  Pooling buys degrees of freedom, and the error term it buys them with is');
  console.log('  made of the terms you pooled. Moving one real interaction (AB) out of the');
  console.log('  residual changes four conclusions - so the choice of what to pool is not a');
  console.log('  formality, and choosing it by looking at the same data biases every test.');

  console.log('\n2. Centre points - an error term made of actual noise');
  rule();
  const centreValues = p2Shots.response.filter((_, i) => p2Shots.design[i].every(v => v === 0));
  const centreMean = centreValues.reduce((a, b) => a + b, 0) / centreValues.length;
  const pureErrorDf = centreValues.length - 1;
  const pureSd = Math.sqrt(centreValues.reduce((s2, v) => s2 + (v - centreMean) ** 2, 0) / pureErrorDf);
  // Orthogonal +-1 design: var(effect) = 4 sigma^2 / n.
  const seEffect = 2 * pureSd / Math.sqrt(p2X.length);
  console.log(`  ${centreValues.length} centre shots give s = ${pureSd.toFixed(4)} on ${pureErrorDf} df,  SE(effect) = ${seEffect.toFixed(4)}`);
  const tested = [...p2Result.terms]
    .map(t => {
      const tStat = t.effect / seEffect;
      return { ...t, tStat, pValue: fPValue(tStat * tStat, 1, pureErrorDf) };
    })
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  console.log('  ' + pad('term', 7) + pad('effect', 10) + pad('t', 9) + 'p');
  for (const t of tested) {
    console.log('  ' + pad(t.label, 7) + num(t.effect, 3, 9) + ' ' + num(t.tStat, 2, 8) + ' ' +
                pad(t.pValue < 1e-4 ? t.pValue.toExponential(1) : t.pValue.toFixed(4), 9) +
                (t.pValue < 0.05 ? ' *' : ''));
  }
  console.log(`\n  ${tested.filter(t => t.pValue < 0.05).length} of ${tested.length} effects clear it. These centre runs are replicates of`);
  console.log('  each other, so this is the only error estimate in the design made of noise');
  console.log('  rather than of discarded signal - and it was there all along.');

  console.log('\n3. Lenth\'s PSE (table above) - assumption-light, and the assumption fails here.');
  rule();
  console.log(`  PSE = ${p2Result.lenth.pse.toFixed(4)} against a true shot-to-shot SD near ${pureSd.toFixed(2)}.`);
  console.log('  Effect sparsity is what the method assumes, and on this machine roughly half');
  console.log('  the contrasts are active, so the median it takes is half signal.');
}

const trivial = p2Result.terms.filter(t => t.percentContribution < 0.5).map(t => t.label);
console.log(`\nTerms below 0.5% contribution: ${trivial.join(', ')}`);
console.log(`Factor E (pin elevation) contributes ${p2Result.terms.find(t => t.label === 'E').percentContribution.toFixed(2)}% - drop it.`);

const p2Curv = curvatureTest(p2Shots.design, p2Shots.response);
console.log('\nCurvature test (factorial corners vs centre points)');
rule();
if (!p2Curv) {
  console.log('  Not available: the test needs at least two centre observations to');
  console.log('  estimate pure error, and this design has fewer.');
} else {
  console.log(`  mean of factorial runs : ${p2Curv.factorialMean.toFixed(3)} m`);
  console.log(`  mean of centre runs    : ${p2Curv.centreMean.toFixed(3)} m`);
  console.log(`  difference             : ${p2Curv.difference.toFixed(3)} m`);
  // Pure error here comes from the centre *shots*, not the centre runs: four
  // runs fired three times each is 12 observations and 11 df, not 3.
  console.log(`  F(1, ${p2Curv.pureErrorDf}) = ${p2Curv.fStatistic.toFixed(2)}   p = ${p2Curv.pValue.toExponential(3)}`);
  console.log(`  pure error from ${p2Curv.centreN} centre shots = ${p2Curv.pureErrorDf} df`);
  console.log(`  => ${p2Curv.pValue < 0.05
    ? 'Significant curvature. A two-level model cannot describe this surface;\n     a response-surface design is required to hit a target reliably.'
    : 'No significant curvature.'}`);
}

/* ------------------------------------------------- exercise 2a / 2b */

// The full factorial is the course's Exercise 2. Running it twice - once bare
// and once with four centre runs bolted on - isolates exactly what a handful of
// replicated runs buys, because the centre points are appended after the
// factorial block and so the 32 corner shots are identical in both.
heading('EXERCISE 2A / 2B  -  the full factorial, without and with centre points');

const ffBase = fullFactorial2(5);
const ffReps = reps(3);
const ffA = shotLevel(runDesign(ffBase, { replicates: ffReps, seed: 4004, noiseScale: NOISE_SCALE }));
const ffCpDesign = withCentrePoints(ffBase, 4);
const ffB = runDesign(ffCpDesign, { replicates: ffReps, seed: 4004, noiseScale: NOISE_SCALE });
const ffBShots = shotLevel(ffB);

const ffFit = fit(ffA.design, ffA.response, 'interaction');
console.log(`2a  ${ffBase.length} runs x ${ffReps} = ${ffA.response.length} shots, no centre points`);
rule();
console.log(`  15-term model: R2 = ${ffFit.rSquared.toFixed(4)}   residual df = ${ffFit.residualDf}   ` +
            `residual SD = ${Math.sqrt(ffFit.meanSquareError).toFixed(4)} m`);
const ffALof = lackOfFit(ffA.design, ffA.response, ffFit);
console.log(`  lack of fit : ${ffALof
  ? `F(${ffALof.lackOfFitDf}, ${ffALof.pureErrorDf}) = ${ffALof.fStatistic.toFixed(2)},  p = ${ffALof.pValue.toExponential(3)}`
  : 'NOT AVAILABLE - no design point was visited twice, so there is no pure error'}`);
console.log(`  curvature   : ${curvatureTest(ffA.design, ffA.response)
  ? 'available'
  : 'NOT AVAILABLE - every run sits at a corner, so the middle was never observed'}`);

const ffCentre = ffBShots.response.filter((_, i) => ffBShots.design[i].every(v => v === 0));
const ffCentreMean = ffCentre.reduce((a, b) => a + b, 0) / ffCentre.length;
const ffPeDf = ffCentre.length - 1;
const ffPeSd = Math.sqrt(ffCentre.reduce((s2, v) => s2 + (v - ffCentreMean) ** 2, 0) / ffPeDf);
const ffCornerRows = ffBShots.design
  .map((row, i) => (row.some(v => v !== 0) ? i : -1)).filter(i => i >= 0);
const ffFitB = fit(
  ffCornerRows.map(i => ffBShots.design[i]),
  ffCornerRows.map(i => ffBShots.response[i]),
  'interaction'
);
const ffLofF = (ffFitB.residualSS / ffFitB.residualDf) / (ffPeSd ** 2);
const ffCurv = curvatureTest(ffBShots.design, ffBShots.response);
const ffSe = 2 * ffPeSd / Math.sqrt(ffCornerRows.length);
const ffFound = ffFitB.terms.filter(t => fPValue((t.effect / ffSe) ** 2, 1, ffPeDf) < 0.05).length;

console.log(`\n2b  the same design plus 4 centre runs = ${ffBShots.response.length} shots`);
rule();
console.log(`  the ${ffA.response.length} corner shots are identical to 2a; only the centre runs are new`);
console.log(`  pure error  : s = ${ffPeSd.toFixed(4)} m on ${ffPeDf} df, from ${ffCentre.length} centre shots`);
console.log(`  lack of fit : F(${ffFitB.residualDf}, ${ffPeDf}) = ${ffLofF.toFixed(2)},  ` +
            `p = ${fPValue(ffLofF, ffFitB.residualDf, ffPeDf).toExponential(3)}`);
console.log(`  curvature   : F(1, ${ffCurv.pureErrorDf}) = ${ffCurv.fStatistic.toFixed(2)},  ` +
            `p = ${ffCurv.pValue.toExponential(3)}   (centre ${ffCurv.difference < 0 ? 'above' : 'below'} the corners by ` +
            `${Math.abs(ffCurv.difference).toFixed(3)} m)`);
console.log(`  effects     : ${ffFound} of ${ffFitB.terms.length} clear significance against pure error`);
console.log(`\n  Four extra runs, ${(100 * (ffBShots.response.length - ffA.response.length) / ffA.response.length).toFixed(0)}% more shots, and they buy the two diagnostics`);
console.log('  the bare design cannot produce at all: an error term made of noise, and a');
console.log('  look at the middle of the design space.');

/* ------------------------------------------------------------------ phase 3 */

heading(`PHASE 3  -  Response surface: Box-Behnken, 3 factors, 15 runs x ${reps(15)} ${reps(15) === 1 ? 'shot' : 'shots'}`);

console.log(`RSM window (re-centred after screening):`);
for (const f of RSM_FACTORS) console.log(`  ${f.letter} = ${pad(f.name, 16)} ${f.low} to ${f.high} ${f.unit}`);
console.log('  D = Arm hole held at 3.0,  E = Pin elevation held at 2.25\n');

const p3Design = boxBehnken(3);
const p3 = runDesign(p3Design, { factors: RSM_FACTORS, replicates: reps(15), seed: 3003, noiseScale: NOISE_SCALE });
const p3Shots = shotLevel(p3);

console.log(`${p3Design.length} design points (12 edge + 3 centre), ${p3Shots.response.length} shots total.\n`);

const meanFit = fit(p3Shots.design, p3Shots.response, 'quadratic');
console.log('Quadratic model for MEAN DISTANCE');
effectsTable(meanFit);

const p3Lof = lackOfFit(p3Shots.design, p3Shots.response, meanFit);
if (!p3Lof) {
  console.log('\nLack of fit: not available. The test splits the residual into pure error');
  console.log('  and model error, and with one shot per design point there is no pure');
  console.log('  error to split off. The residual is still there; nothing can say how');
  console.log('  much of it is the model being wrong and how much is the machine shaking.');
}
if (p3Lof) {
  // With no noise, pure error is zero and the F ratio blows up: any departure
  // from the model at all is infinitely significant. Report the degeneracy
  // rather than dressing it up as a finding.
  const degenerate = p3Lof.pureErrorSS < 1e-12;
  console.log(`\nLack of fit: F = ${degenerate ? 'infinite' : p3Lof.fStatistic.toFixed(2)} on ` +
              `${p3Lof.lackOfFitDf} and ${p3Lof.pureErrorDf} df,  p = ${p3Lof.pValue.toExponential(3)}`);
  if (degenerate) {
    console.log('  => Pure error is exactly zero, so the test has no scale to judge against');
    console.log('     and any departure at all looks infinitely significant. A lack-of-fit');
    console.log('     test is meaningless on a noiseless process.');
  } else {
    console.log(`  => ${p3Lof.pValue < 0.05
      ? 'Significant lack of fit - the quadratic form is missing something.'
      : 'No significant lack of fit - the quadratic model is adequate.'}`);
  }
}

// Second response: the within-run standard deviation. A spread is modelled on
// the log scale - it is bounded below by zero, and its effects act
// multiplicatively, both of which a log transform fixes.
if (NOISE_SCALE === 0) {
  console.log('\n\nNoise scale is 0: every shot is identical, so every within-run standard');
  console.log('deviation is exactly zero and there is no variation response to model.');
  console.log('That is the lesson - with a perfectly repeatable process, replication');
  console.log('buys nothing and robustness is not a question you can even ask.');
  process.exit(0);
}

const p3Reps = reps(15);
let logSpreadFit = null;

if (p3Reps < 2) {
  console.log('\n\nModel for ln(WITHIN-RUN STANDARD DEVIATION):  NOT AVAILABLE');
  rule();
  console.log(`  Each design point was fired once, so there is no within-run spread`);
  console.log('  to model. Not a small spread, and not a noisy estimate of one - no');
  console.log('  observation of it at all. The second response does not exist in this data.');
  console.log('  Every shot still scatters exactly as much as it did before. What has gone');
  console.log('  is any way to see it, and with it the whole robustness question.');
} else {
  logSpreadFit = fit(p3Design, p3.spreads.map(Math.log), 'interaction');
  console.log(`\n\nModel for ln(WITHIN-RUN STANDARD DEVIATION), n = ${p3Reps} shots per run`);
  effectsTable(logSpreadFit);
  console.log('\nObserved sd by run ranged ' +
    `${Math.min(...p3.spreads).toFixed(3)} to ${Math.max(...p3.spreads).toFixed(3)} m.`);
  console.log('The mean model above would have been perfectly good on 3 shots per run. This');
  console.log(`variation model needs ${p3Reps}, because a standard deviation is a far noisier statistic`);
  console.log('than a mean - that asymmetry in replication cost is the real lesson here.');
}

/* ------------------------------------------------- optimisation to a target */

heading(logSpreadFit
  ? `OPTIMISATION  -  hit ${TARGET.toFixed(2)} m, then minimise variation`
  : `OPTIMISATION  -  hit ${TARGET.toFixed(2)} m, with nothing to choose between the answers`);

// Both models come from the experiment: students never see the simulator's
// internals. The confirmation runs are what check whether the models were right.
const predictMean = point => meanFit.predict(point);
const predictSpread = logSpreadFit ? point => Math.exp(logSpreadFit.predict(point)) : null;

// The two ends of the on-target ridge. Every point between them predicts the
// same mean distance; an engineer who solves only for the target lands
// somewhere along it essentially at random, which is the argument for carrying
// a variation response at all.
let robust;
let fragile;
let labels;

if (predictSpread) {
  robust = optimiseToTarget({ predictMean, predictSpread, k: 3, target: TARGET, spreadWeight: 1 });
  fragile = optimiseToTarget({ predictMean, predictSpread, k: 3, target: TARGET, spreadWeight: -1 });
  labels = [`1. LEAST repeatable way to hit ${TARGET} m`, `2. MOST repeatable way to hit ${TARGET} m`];
} else {
  // Without a second response the on-target ridge is featureless: every point
  // on it is an equally good answer as far as this experiment can tell. So walk
  // the whole ridge and ask how much the choice was actually worth - using the
  // simulator's true sigma, which is instructor-only knowledge and precisely
  // what the experiment failed to buy.
  const onTarget = [];
  for (let a = -1; a <= 1.0001; a += 0.05) {
    for (let b = -1; b <= 1.0001; b += 0.05) {
      for (let c = -1; c <= 1.0001; c += 0.05) {
        const point = [a, b, c];
        if (Math.abs(predictMean(point) - TARGET) > 0.02) continue;
        onTarget.push({ point, sigma: predictSigma(settingsFor(point, RSM_FACTORS), NOISE_SCALE) });
      }
    }
  }
  onTarget.sort((x, y) => x.sigma - y.sigma);
  const asSolution = entry => ({
    point: entry.point,
    predictedMean: predictMean(entry.point),
    predictedSpread: 0
  });
  robust = asSolution(onTarget[0]);
  fragile = asSolution(onTarget[onTarget.length - 1]);

  console.log(`The mean model puts ${onTarget.length} points of the coded cube within 2 cm of`);
  console.log(`${TARGET.toFixed(2)} m. Every one is an equally good answer to the only question this`);
  console.log('experiment can answer. They are not equally good machines:');
  console.log(`  true sigma across the ridge runs ${onTarget[0].sigma.toFixed(4)} to ` +
              `${onTarget[onTarget.length - 1].sigma.toFixed(4)} m.`);
  console.log('Below are its two ends. Nothing in the data distinguishes them.');
  labels = [`1. WORST point on the ridge (unknowable from this data)`,
            `2. BEST point on the ridge (unknowable from this data)`];
}

function report(label, solution) {
  const settings = settingsFor(solution.point, RSM_FACTORS);
  const check = confirm(settings, 600, 99991, NOISE_SCALE);
  const nominal = predictSigma(settings, NOISE_SCALE);
  console.log(`\n${label}`);
  rule();
  console.log(`  coded          : A = ${solution.point[0].toFixed(3)}, B = ${solution.point[1].toFixed(3)}, C = ${solution.point[2].toFixed(3)}`);
  console.log(`  settings       : pull-back ${settings.pullBackAngle.toFixed(1)} deg,  ` +
              `stop ${settings.stopAngle.toFixed(1)} deg,  bungee ${settings.bungeePosition.toFixed(2)}`);
  console.log(`  model predicts : ${solution.predictedMean.toFixed(3)} m,  ` +
              (predictSpread
                ? `sd ${Math.abs(solution.predictedSpread).toFixed(4)} m`
                : 'sd not predicted - there is no variation model'));
  console.log(`  CONFIRMATION   : ${check.mean.toFixed(3)} +/- ${check.halfWidth95.toFixed(3)} m over ${check.n} shots`);
  console.log(`                   observed sd = ${check.spread.toFixed(4)} m   (CV ${(100 * check.spread / check.mean).toFixed(2)}%)`);
  console.log(`  mean error     : ${(solution.predictedMean - check.mean >= 0 ? '+' : '')}${(solution.predictedMean - check.mean).toFixed(3)} m`);
  console.log(`  true sd here   : ${nominal.toFixed(4)} m`);
  return check;
}

const fragileCheck = report(labels[0], fragile);
const robustCheck = report(labels[1], robust);

console.log('\n' + '='.repeat(78));
console.log('THE RESULT');
rule();
console.log(`  Both settings land on ${TARGET} m. They are not equally good:`);
console.log(`    ${predictSpread ? 'least repeatable' : 'worst on ridge  '} : sd = ${fragileCheck.spread.toFixed(4)} m  (CV ${(100 * fragileCheck.spread / fragileCheck.mean).toFixed(2)}%)`);
console.log(`    ${predictSpread ? 'most repeatable ' : 'best on ridge   '} : sd = ${robustCheck.spread.toFixed(4)} m  (CV ${(100 * robustCheck.spread / robustCheck.mean).toFixed(2)}%)`);
console.log(`  Choosing well cuts scatter by ` +
            `${(100 * (1 - robustCheck.spread / fragileCheck.spread)).toFixed(1)}% at no cost in accuracy.`);
if (predictSpread) {
  console.log('  An engineer who solves only for the target lands somewhere on that ridge');
  console.log('  at random. Carrying a variation response is what turns the choice into');
  console.log('  a decision instead of an accident.');
} else {
  console.log('  Nothing in this experiment could have told you which was which. The');
  console.log('  unreplicated design measured the mean well and the spread not at all, so');
  console.log('  the difference above was invisible at the point the decision was made.');
  console.log('  That is what one shot per run costs: not precision on the mean, but the');
  console.log('  entire second response, and the accident is picked for you.');
}
console.log('='.repeat(78));

/* ---------------------------------------------------------------- data files */

if (WRITE) {
  mkdirSync(OUT, { recursive: true });
  const files = {
    'phase1-screening-2^(5-2).csv': toCsv(p1.runs, FACTORS),
    'phase2-resolutionV-2^(5-1).csv': toCsv(p2.runs, FACTORS),
    'phase3-box-behnken.csv': toCsv(p3.runs, RSM_FACTORS),
    'full-factorial-2^5.csv': toCsv(runDesign(fullFactorial2(5), { replicates: reps(3), seed: 4004, noiseScale: NOISE_SCALE }).runs, FACTORS),
    'full-factorial-2^5-plus-4cp.csv': toCsv(ffB.runs, FACTORS)
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(`${OUT}/${name}`, content + '\n');
    console.log(`wrote ${OUT}/${name}`);
  }
}

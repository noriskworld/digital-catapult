import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fullFactorial2, fractionalFactorial2, aliasStructure, boxBehnken,
  withCentrePoints, replicate, randomiseRunOrder, decode, encode
} from '../doe/designs.js';
import {
  fit, lackOfFit, curvatureTest, optimiseToTarget, fPValue, modelTerms
} from '../doe/analysis.js';
import { FACTORS, RSM_FACTORS, runDesign, shotLevel, settingsFor } from '../doe/catapult-doe.js';
import { makeRng } from '../physics.js';

const column = (m, i) => m.map(r => r[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/* ------------------------------------------------------------------ designs */

test('full factorial has the right size, balance and orthogonality', () => {
  for (const k of [2, 3, 5]) {
    const d = fullFactorial2(k);
    assert.equal(d.length, 2 ** k);
    for (let i = 0; i < k; i++) {
      assert.equal(dot(column(d, i), column(d, i).map(() => 1)), 0, 'column not balanced');
      for (let j = i + 1; j < k; j++) {
        assert.equal(dot(column(d, i), column(d, j)), 0, 'columns not orthogonal');
      }
    }
    assert.equal(new Set(d.map(r => r.join())).size, d.length, 'duplicate runs');
  }
});

test('fractional factorial columns obey their generators', () => {
  const d = fractionalFactorial2(5, ['D=AB', 'E=AC']);
  assert.equal(d.length, 8);
  for (const row of d) {
    const [A, B, C, D, E] = row;
    assert.equal(D, A * B, 'D column is not A*B');
    assert.equal(E, A * C, 'E column is not A*C');
  }
});

test('a resolution V half-fraction stays orthogonal in every column', () => {
  const d = fractionalFactorial2(5, ['E=ABCD']);
  assert.equal(d.length, 16);
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      assert.equal(dot(column(d, i), column(d, j)), 0);
    }
  }
});

test('alias structure finds every defining word, not just the generators', () => {
  const a = aliasStructure(5, ['D=AB', 'E=AC']);
  // ABD and ACE are the generators; their product BCDE must also appear.
  assert.deepEqual(a.words, ['ABD', 'ACE', 'BCDE']);
  assert.equal(a.resolution, 3);
  assert.ok(a.aliases.A.includes('BD') && a.aliases.A.includes('CE'));
  assert.ok(a.aliases.D.includes('AB'));
});

test('resolution V design aliases main effects only with high-order terms', () => {
  const a = aliasStructure(5, ['E=ABCD']);
  assert.deepEqual(a.words, ['ABCDE']);
  assert.equal(a.resolution, 5);
  // No main effect is aliased with any two-factor interaction.
  for (const letter of 'ABCDE') {
    assert.ok(a.aliases[letter].every(x => x.length > 2), `${letter} aliased with a 2FI`);
  }
});

test('Box-Behnken matches the standard run counts and never visits a cube corner', () => {
  for (const [k, expected] of [[3, 15], [4, 27], [5, 46]]) {
    const d = boxBehnken(k);
    assert.equal(d.length, expected, `k=${k}`);
    for (const row of d) {
      const nonZero = row.filter(v => v !== 0).length;
      assert.ok(nonZero === 2 || nonZero === 0, 'a run set other than exactly one pair');
    }
  }
  assert.throws(() => boxBehnken(2));
  assert.throws(() => boxBehnken(6));
});

test('centre points, replication and randomisation preserve the design', () => {
  const base = fullFactorial2(3);
  const withCp = withCentrePoints(base, 4);
  assert.equal(withCp.length, 12);
  assert.equal(withCp.filter(r => r.every(v => v === 0)).length, 4);

  assert.equal(replicate(base, 3).length, 24);

  const shuffled = randomiseRunOrder(base, makeRng(9));
  assert.equal(shuffled.length, base.length);
  assert.deepEqual(
    [...shuffled].map(r => r.join()).sort(),
    [...base].map(r => r.join()).sort(),
    'randomisation changed the set of runs'
  );
});

test('decode and encode round-trip', () => {
  for (const coded of [[-1, -1, -1, -1, -1], [1, 0, -0.5, 0.25, 1], [0, 0, 0, 0, 0]]) {
    const settings = decode(coded, FACTORS);
    const back = encode(settings, FACTORS);
    back.forEach((v, i) => assert.ok(Math.abs(v - coded[i]) < 1e-12));
  }
  // Coded 0 must be the midpoint of the declared range.
  const centre = decode([0, 0, 0, 0, 0], FACTORS);
  FACTORS.forEach(f => assert.equal(centre[f.key], (f.low + f.high) / 2));
});

/* ----------------------------------------------------------------- analysis */

test('F p-values match published critical values', () => {
  const cases = [[4.9646, 1, 10], [3.0984, 3, 20], [2.9013, 5, 15], [4.0012, 1, 60]];
  for (const [f, d1, d2] of cases) {
    assert.ok(Math.abs(fPValue(f, d1, d2) - 0.05) < 5e-4, `F=${f} (${d1},${d2})`);
  }
  assert.ok(Math.abs(fPValue(1, 10, 10) - 0.5) < 1e-6);
  assert.equal(fPValue(-1, 1, 1), 1);
});

test('model terms are generated in the right shape', () => {
  assert.deepEqual(modelTerms(3, 'main').map(t => t.label), ['A', 'B', 'C']);
  assert.deepEqual(modelTerms(3, 'interaction').map(t => t.label),
    ['A', 'B', 'C', 'AB', 'AC', 'BC']);
  assert.deepEqual(modelTerms(3, 'quadratic').map(t => t.label),
    ['A', 'B', 'C', 'AB', 'AC', 'BC', 'A^2', 'B^2', 'C^2']);
});

test('the fit recovers coefficients it was built from', () => {
  const design = replicate(fullFactorial2(3), 2);
  // y = 10 + 3A - 2B + 0.5C + 1.5AB, exactly
  const truth = p => 10 + 3 * p[0] - 2 * p[1] + 0.5 * p[2] + 1.5 * p[0] * p[1];
  const y = design.map(truth);
  const f = fit(design, y, 'interaction');

  assert.ok(Math.abs(f.intercept - 10) < 1e-10);
  const coefficient = label => f.terms.find(t => t.label === label).coefficient;
  assert.ok(Math.abs(coefficient('A') - 3) < 1e-10);
  assert.ok(Math.abs(coefficient('B') + 2) < 1e-10);
  assert.ok(Math.abs(coefficient('C') - 0.5) < 1e-10);
  assert.ok(Math.abs(coefficient('AB') - 1.5) < 1e-10);
  assert.ok(Math.abs(coefficient('AC')) < 1e-10);
  assert.ok(f.rSquared > 0.999999, 'a noiseless fit should be exact');
  // The effect is twice the coefficient in coded units.
  assert.ok(Math.abs(f.terms.find(t => t.label === 'A').effect - 6) < 1e-10);
});

test('the fit recovers a quadratic from a Box-Behnken design', () => {
  const design = boxBehnken(3);
  const truth = p => 8 - 1.5 * p[0] + 0.75 * p[1] * p[1] + 0.4 * p[0] * p[2];
  const f = fit(design, design.map(truth), 'quadratic');
  const coefficient = label => f.terms.find(t => t.label === label).coefficient;
  assert.ok(Math.abs(coefficient('A') + 1.5) < 1e-9);
  assert.ok(Math.abs(coefficient('B^2') - 0.75) < 1e-9);
  assert.ok(Math.abs(coefficient('AC') - 0.4) < 1e-9);
  assert.ok(Math.abs(coefficient('C^2')) < 1e-9);
});

test('a saturated design is refused rather than silently fitted', () => {
  // 16 runs cannot support 16 parameters (intercept + 5 main + 10 two-factor).
  const design = fractionalFactorial2(5, ['E=ABCD']);
  assert.throws(() => fit(design, design.map(() => 1), 'interaction'), /Not enough runs/);
});

test('lack of fit separates pure error from model inadequacy', () => {
  const design = replicate(fullFactorial2(2), 4);
  // A curved truth that a main-effects model cannot capture.
  const y = design.map(p => 5 + 2 * p[0] + 3 * p[0] * p[1]);
  const linear = fit(design, y, 'main');
  const result = lackOfFit(design, y, linear);
  assert.ok(result, 'replicated runs should yield a pure-error estimate');
  assert.ok(result.pureErrorSS < 1e-18, 'identical runs must have zero pure error');
  assert.ok(result.lackOfFitSS > 1, 'the missing interaction should show as lack of fit');

  // The correct model leaves nothing behind.
  const full = fit(design, y, 'interaction');
  assert.ok(full.residualSS < 1e-18);
});

test('the curvature test fires only when the centre departs from the corners', () => {
  const design = withCentrePoints(fullFactorial2(2), 4);
  // Centre runs must carry some spread, or pure error is zero and every
  // departure however tiny looks infinitely significant.
  const noise = [0.05, -0.04, 0.03, -0.04];
  let i = 0;
  const linear = design.map(p =>
    p.every(v => v === 0) ? 5 + noise[i++] : 5 + 2 * p[0] + p[1]);
  const flat = curvatureTest(design, linear);
  assert.ok(flat.pValue > 0.05, `a flat surface should not show curvature (p=${flat.pValue})`);

  // Same design, but the centre runs sit well above the corner average. Give
  // the centre runs a little spread so pure error is non-zero, as it would be.
  const wobble = [0.05, -0.04, 0.03, -0.04];
  let c = 0;
  const domed = design.map(p =>
    p.every(v => v === 0) ? 9 + wobble[c++] : 5 + 2 * p[0] + p[1]);
  const bent = curvatureTest(design, domed);
  assert.ok(bent.pValue < 0.05, 'a domed surface should show curvature');
  assert.ok(bent.difference < 0, 'factorial mean should sit below the centre mean');
});

test('an infinite F is the most significant result, not the least', () => {
  // Replicates that agree exactly give zero pure error and an infinite F. If
  // that were reported as p = 1 the conclusion would be exactly backwards.
  assert.equal(fPValue(Infinity, 1, 3), 0);
  assert.equal(fPValue(NaN, 1, 3), 1);
  assert.equal(fPValue(0, 1, 3), 1);

  const design = withCentrePoints(fullFactorial2(2), 4);
  const exact = design.map(p => (p.every(v => v === 0) ? 9 : 5 + 2 * p[0] + p[1]));
  const bent = curvatureTest(design, exact);
  assert.equal(bent.fStatistic, Infinity);
  assert.equal(bent.pValue, 0);
});

test('the optimiser hits a target and is reproducible', () => {
  const predictMean = p => 5 + 2 * p[0] + p[1] + 0.5 * p[2];
  const first = optimiseToTarget({ predictMean, k: 3, target: 6.5 });
  const second = optimiseToTarget({ predictMean, k: 3, target: 6.5 });

  assert.ok(Math.abs(first.predictedMean - 6.5) < 1e-4);
  assert.deepEqual(first.point, second.point, 'the same problem gave two answers');
  first.point.forEach(v => assert.ok(v >= -1 && v <= 1, 'left the coded cube'));
});

test('the optimiser trades along the ridge to minimise or maximise spread', () => {
  // Mean depends only on A; spread only on C. Every C hits the target.
  const predictMean = p => 5 * p[0];
  const predictSpread = p => 1 + p[2];

  const low = optimiseToTarget({ predictMean, predictSpread, k: 3, target: 0, spreadWeight: 1 });
  const high = optimiseToTarget({ predictMean, predictSpread, k: 3, target: 0, spreadWeight: -1 });

  assert.ok(Math.abs(low.predictedMean) < 1e-4 && Math.abs(high.predictedMean) < 1e-4);
  assert.ok(low.point[2] < -0.99, `expected C at -1, got ${low.point[2]}`);
  assert.ok(high.point[2] > 0.99, `expected C at +1, got ${high.point[2]}`);
});

test('the optimiser respects tightened bounds', () => {
  const predictMean = p => 5 + 2 * p[0] + p[1] + 0.5 * p[2];
  const r = optimiseToTarget({
    predictMean, k: 3, target: 6.5, lower: [0.2, -1, -1], upper: [0.4, 1, 1]
  });
  assert.ok(r.point[0] >= 0.2 - 1e-9 && r.point[0] <= 0.4 + 1e-9);
});

/* ------------------------------------------------------- catapult integration */

test('every run of every course design is a valid launch', () => {
  const designs = [
    [fractionalFactorial2(5, ['D=AB', 'E=AC']), FACTORS],
    [fractionalFactorial2(5, ['E=ABCD']), FACTORS],
    [withCentrePoints(fullFactorial2(5), 4), FACTORS],
    [boxBehnken(3), RSM_FACTORS]
  ];
  for (const [design, factors] of designs) {
    const { runs } = runDesign(design, { factors, replicates: 2, seed: 11 });
    for (const run of runs) {
      assert.ok(run.nominal > 0.5,
        `a design point produced no throw: ${JSON.stringify(run.settings)}`);
      assert.ok(run.distances.every(d => d > 0), 'a shot recorded zero distance');
    }
  }
});

test('a seed reproduces a whole data set', () => {
  const design = boxBehnken(3);
  const options = { factors: RSM_FACTORS, replicates: 3, seed: 4242 };
  assert.deepEqual(runDesign(design, options).means, runDesign(design, options).means);
  assert.notDeepEqual(
    runDesign(design, options).means,
    runDesign(design, { ...options, seed: 4243 }).means
  );
});

test('runDesign honours the noise scale', () => {
  const design = fractionalFactorial2(5, ['E=ABCD']);
  const options = { replicates: 4, seed: 606 };

  const quiet = runDesign(design, { ...options, noiseScale: 0 });
  // Identical replicates leave floating-point residue of order 1e-15 rather
  // than an exact zero, because a mean of n identical values need not round
  // back to that value. Assert what is true, not what is tidy.
  assert.ok(quiet.spreads.every(s => Math.abs(s) < 1e-12),
    `zero noise should give zero within-run spread, got ${Math.max(...quiet.spreads)}`);
  quiet.runs.forEach(r => assert.ok(Math.abs(r.mean - r.nominal) < 1e-12));

  const normal = runDesign(design, { ...options, noiseScale: 1 });
  const loud = runDesign(design, { ...options, noiseScale: 4 });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(loud.spreads) > mean(normal.spreads) * 2,
    'four times the noise should visibly widen the runs');
});

test('raising the noise costs a small factor its significance', () => {
  // E is the smallest real effect. It should be found easily on a quiet machine
  // and lost on a loud one, using the same design and the same seed.
  const design = fractionalFactorial2(5, ['E=ABCD']);
  const pFor = noiseScale => {
    const { design: X, response: y } = shotLevel(
      runDesign(design, { replicates: 2, seed: 2468, noiseScale })
    );
    return fit(X, y, 'interaction').terms.find(t => t.label === 'E').pValue;
  };

  assert.ok(pFor(0.5) < 0.05, 'E should be detected on a quiet machine');
  assert.ok(pFor(6) > 0.05, 'E should be lost on a very noisy one');
});

test('factors outside a response-surface subset are held at their centre', () => {
  const settings = settingsFor([1, -1, 0], RSM_FACTORS);
  assert.equal(settings.armHole, 3);
  assert.equal(settings.pinElevation, 2.25);
  assert.equal(settings.pullBackAngle, RSM_FACTORS[0].high);
  assert.equal(settings.stopAngle, RSM_FACTORS[1].low);
});

test('shotLevel expands runs to one row per shot', () => {
  const design = boxBehnken(3);
  const result = runDesign(design, { factors: RSM_FACTORS, replicates: 4, seed: 8 });
  const { design: X, response: y } = shotLevel(result);
  assert.equal(X.length, design.length * 4);
  assert.equal(y.length, X.length);
  assert.deepEqual(X[0], design[0]);
  assert.deepEqual(X[4], design[1]);
});

test('the course study reaches its documented conclusions', () => {
  // Screening must rank pull-back first and pin elevation last.
  const screening = fractionalFactorial2(5, ['D=AB', 'E=AC']);
  const s = shotLevel(runDesign(screening, { replicates: 3, seed: 1001 }));
  const ranked = [...fit(s.design, s.response, 'main').terms]
    .sort((a, b) => b.percentContribution - a.percentContribution)
    .map(t => t.label);
  assert.equal(ranked[0], 'A', 'pull-back should dominate the screening');
  assert.equal(ranked[4], 'E', 'pin elevation should rank last');

  // The response surface must be curved, and the quadratic must fit it well.
  const bbd = boxBehnken(3);
  const r = runDesign(bbd, { factors: RSM_FACTORS, replicates: 15, seed: 3003 });
  const rsm = shotLevel(r);
  const quadratic = fit(rsm.design, rsm.response, 'quadratic');
  assert.ok(quadratic.rSquared > 0.99, `R2 was only ${quadratic.rSquared}`);
  assert.ok(quadratic.terms.find(t => t.label === 'B^2').pValue < 0.01,
    'the stop-angle quadratic term should be significant');
});

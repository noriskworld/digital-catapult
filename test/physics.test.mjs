import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateLaunch, trajectoryAt, apexHeight, randomNormal,
  simulateShot, predictSigma, makeRng, machineState, solveLaunch
} from '../physics.js';
import { FACTOR_BOUNDS, NOISE, cupRadius, springRate, effectiveStopAngle, clamp } from '../constants.js';

const nominal = () => calculateLaunch(180, 105, 3, 3, 2);

/** Every field a caller may read, dud launch or not. */
const RESULT_FIELDS = [
  'distance', 'releaseVelocity', 'launchAngleDeg', 'flightTime',
  'releaseX', 'releaseY', 'vx', 'vy', 'effectiveStopAngle', 'valid', 'reason'
];

const FACTORS_AT = (pull, stop, bungee, arm, pin) => ({
  pullBackAngle: pull, stopAngle: stop, bungeePosition: bungee, armHole: arm, pinElevation: pin
});

test('a nominal launch produces a sane, fully populated result', () => {
  const r = nominal();
  assert.ok(r.valid);
  for (const field of RESULT_FIELDS) {
    assert.ok(field in r, `missing field: ${field}`);
    if (typeof r[field] === 'number') assert.ok(Number.isFinite(r[field]), `${field} is not finite`);
  }
  assert.ok(r.distance > 1 && r.distance < 40, `implausible distance: ${r.distance}`);
  assert.ok(r.releaseVelocity > 0);
  assert.ok(r.flightTime > 0);
});

test('distance is measured from the pivot, not the release point', () => {
  const r = nominal();
  // Stop angles above 90 deg put the cup behind the pivot at release.
  assert.ok(r.releaseX < 0, 'expected the release point to sit behind the pivot');
  // The ground range must be the trajectory's own landing point.
  const landing = trajectoryAt(r, r.flightTime);
  assert.ok(Math.abs(landing.x - r.distance) < 1e-9, 'distance disagrees with the trajectory');
  assert.ok(Math.abs(landing.y) < 1e-9, 'trajectory does not end at ground level');
});

test('the trajectory starts at the cup and stays above ground', () => {
  const r = nominal();
  const start = trajectoryAt(r, 0);
  assert.ok(Math.abs(start.x - r.releaseX) < 1e-12);
  assert.ok(Math.abs(start.y - r.releaseY) < 1e-12);

  for (let i = 0; i <= 50; i++) {
    const { y } = trajectoryAt(r, (i / 50) * r.flightTime);
    assert.ok(y >= 0, `trajectory dipped below ground at step ${i}`);
  }
});

test('rangeScale lands a perturbed shot exactly on its own mark', () => {
  const r = nominal();
  const actual = r.distance + 0.75;
  const rangeScale = (actual - r.releaseX) / (r.distance - r.releaseX);
  const landing = trajectoryAt(r, r.flightTime, rangeScale);
  assert.ok(Math.abs(landing.x - actual) < 1e-9);
});

test('apex height matches the peak of the sampled trajectory', () => {
  const r = nominal();
  let sampledPeak = 0;
  for (let i = 0; i <= 2000; i++) {
    sampledPeak = Math.max(sampledPeak, trajectoryAt(r, (i / 2000) * r.flightTime).y);
  }
  assert.ok(Math.abs(apexHeight(r) - sampledPeak) < 1e-3, `${apexHeight(r)} vs ${sampledPeak}`);
});

test('distance increases monotonically with pull-back angle', () => {
  let previous = -1;
  for (let pull = 115; pull <= 200; pull += 5) {
    const { distance } = calculateLaunch(pull, 105, 3, 3, 2);
    assert.ok(distance > previous, `pull=${pull} did not increase range`);
    previous = distance;
  }
});

test('distance increases monotonically with band tension', () => {
  let previous = -1;
  for (let bungee = 1; bungee <= 5; bungee += 0.5) {
    const { distance } = calculateLaunch(180, 110, bungee, 3, 3);
    assert.ok(distance > previous, `bungee=${bungee} did not increase range`);
    previous = distance;
  }
});

test('the pin folds into the effective stop angle', () => {
  const withPin = calculateLaunch(180, 105, 3, 3, 4);
  const equivalent = calculateLaunch(180, 111, 3, 3, 0);
  assert.equal(withPin.effectiveStopAngle, effectiveStopAngle(105, 4));
  assert.ok(Math.abs(withPin.distance - equivalent.distance) < 1e-9);
});

test('a pull-back that does not clear the stop is a dud, not a crash', () => {
  const r = calculateLaunch(90, 120, 1, 1, 5);
  assert.equal(r.valid, false);
  assert.equal(r.distance, 0);
  assert.match(r.reason, /clear the stop/);
  for (const field of RESULT_FIELDS) assert.ok(field in r, `dud result missing ${field}`);
});

test('every dud path returns the full result shape', () => {
  const duds = [
    calculateLaunch(100, 105, 3, 3, 2),   // below the stop
    calculateLaunch(108.1, 105, 3, 3, 2)  // clears the stop by a hair
  ];
  for (const r of duds) {
    for (const field of RESULT_FIELDS) assert.ok(field in r, `missing ${field}`);
    assert.ok(Number.isFinite(r.distance));
  }
});

test('machineState and solveLaunch compose back into calculateLaunch', () => {
  const direct = calculateLaunch(175, 104, 3.5, 2.5, 2);
  const composed = solveLaunch(machineState(175, 104, 3.5, 2.5, 2));
  assert.equal(direct.distance, composed.distance);
  assert.equal(direct.releaseVelocity, composed.releaseVelocity);
});

test('a seeded generator reproduces a shot sequence exactly', () => {
  const factors = FACTORS_AT(170, 105, 3, 3, 2);
  const first = Array.from({ length: 25 }, ((r) => () => simulateShot(factors, r).distance)(makeRng(1234)));
  const second = Array.from({ length: 25 }, ((r) => () => simulateShot(factors, r).distance)(makeRng(1234)));
  assert.deepEqual(first, second);
  // ...and a different seed does not.
  const other = Array.from({ length: 25 }, ((r) => () => simulateShot(factors, r).distance)(makeRng(4321)));
  assert.notDeepEqual(first, other);
});

test('simulated shots scatter around the nominal distance', () => {
  const factors = FACTORS_AT(175, 105, 3, 3, 2);
  const rng = makeRng(2024);
  const nominal = calculateLaunch(175, 105, 3, 3, 2).distance;

  const draws = Array.from({ length: 20000 }, () => simulateShot(factors, rng).distance);
  const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
  const sd = Math.sqrt(draws.reduce((s, d) => s + (d - mean) ** 2, 0) / (draws.length - 1));

  assert.ok(Math.abs(mean - nominal) < 0.05, `mean ${mean} drifted from nominal ${nominal}`);
  assert.ok(sd > 0.01, 'shots showed no scatter at all');
});

test('predictSigma agrees with a Monte Carlo estimate across the space', () => {
  const cases = [
    FACTORS_AT(150, 100, 2, 3, 2),
    FACTORS_AT(185, 108, 2, 3, 2),
    FACTORS_AT(170, 97, 4, 4, 2),
    FACTORS_AT(190, 110, 4.5, 2, 3)
  ];
  for (const factors of cases) {
    const rng = makeRng(31337);
    const draws = Array.from({ length: 30000 }, () => simulateShot(factors, rng).distance);
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    const sd = Math.sqrt(draws.reduce((s, d) => s + (d - mean) ** 2, 0) / (draws.length - 1));
    const predicted = predictSigma(factors);
    const relativeError = Math.abs(predicted - sd) / sd;
    assert.ok(relativeError < 0.05, `delta method off by ${(100 * relativeError).toFixed(1)}%`);
  }
});

test('scatter grows with impact severity, not just with distance', () => {
  // Two settings that travel a similar distance: one lofted and slow, one flat
  // and fast. The flat one must be the less repeatable of the pair.
  const lofted = FACTORS_AT(183, 111.7, 1.5, 3, 2.25);
  const flat = FACTORS_AT(190, 95.3, 4.5, 3, 2.25);
  const dLofted = calculateLaunch(183, 111.7, 1.5, 3, 2.25);
  const dFlat = calculateLaunch(190, 95.3, 4.5, 3, 2.25);

  assert.ok(Math.abs(dLofted.distance - dFlat.distance) < 0.5, 'the two settings should travel alike');
  assert.ok(dFlat.releaseVelocity > dLofted.releaseVelocity, 'the flat shot should be the faster one');
  assert.ok(predictSigma(flat) > predictSigma(lofted) * 1.2,
    'the harder-arriving shot should scatter noticeably more');
});

test('a dud configuration reports zero rather than noise', () => {
  const rng = makeRng(5);
  const dud = FACTORS_AT(95, 118, 3, 3, 4);
  for (let i = 0; i < 50; i++) assert.equal(simulateShot(dud, rng).distance, 0);
  assert.equal(predictSigma(dud), 0);
});

test('every noise source is a positive, small perturbation', () => {
  for (const [name, value] of Object.entries(NOISE)) {
    assert.ok(Number.isFinite(value) && value > 0, `${name} must be a positive number`);
  }
});

test('the whole factor space stays finite and non-negative', () => {
  const b = FACTOR_BOUNDS;
  let checked = 0;
  for (let pull = b.pullBackAngle.min; pull <= b.pullBackAngle.max; pull += 10)
    for (let stop = b.stopAngle.min; stop <= b.stopAngle.max; stop += 5)
      for (let bungee = 1; bungee <= 5; bungee++)
        for (let arm = 1; arm <= 5; arm++)
          for (let pin = 1; pin <= 5; pin++) {
            const r = calculateLaunch(pull, stop, bungee, arm, pin);
            assert.ok(Number.isFinite(r.distance) && r.distance >= 0);
            assert.ok(Number.isFinite(r.flightTime) && r.flightTime >= 0);
            assert.ok(Number.isFinite(predictSigma(FACTORS_AT(pull, stop, bungee, arm, pin))));
            checked++;
          }
  assert.ok(checked > 1000, `only ${checked} combinations exercised`);
});

test('randomNormal is deterministic under an injected generator', () => {
  const seq = [0.25, 0.5, 0.25, 0.5];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  const a = randomNormal(10, 2, rng);
  i = 0;
  const b = randomNormal(10, 2, rng);
  assert.equal(a, b);
  assert.ok(Number.isFinite(a));
});

test('randomNormal survives a generator that returns zero', () => {
  assert.ok(Number.isFinite(randomNormal(5, 1, () => 0)));
});

test('randomNormal recovers its mean and spread over many samples', () => {
  const n = 200000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const x = randomNormal(12, 3);
    sum += x;
    sumSq += x * x;
  }
  const mean = sum / n;
  const sd = Math.sqrt(sumSq / n - mean * mean);
  assert.ok(Math.abs(mean - 12) < 0.1, `mean drifted to ${mean}`);
  assert.ok(Math.abs(sd - 3) < 0.1, `sd drifted to ${sd}`);
});

test('geometry helpers agree with the documented ranges', () => {
  assert.equal(cupRadius(1), 0.6);
  assert.equal(cupRadius(5), 1.0);
  assert.equal(springRate(1), 88);
  assert.equal(springRate(5), 200);
  assert.equal(clamp(300, 90, 200), 200);
  assert.equal(clamp(10, 90, 200), 90);
});

test('every factor default sits inside its own bounds', () => {
  for (const [name, b] of Object.entries(FACTOR_BOUNDS)) {
    assert.ok(b.default >= b.min && b.default <= b.max, `${name} default is out of bounds`);
    assert.ok(b.step > 0, `${name} step must be positive`);
  }
});

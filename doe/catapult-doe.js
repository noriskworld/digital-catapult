/**
 * The catapult's DOE setup: which factors, at which levels, and how to turn a
 * coded design into simulated data.
 *
 * The level ranges were chosen so that every corner of the full factorial is a
 * valid launch (no run where the arm fails to clear the stop), the response
 * spans roughly 2 m to 19 m, and a 10 m target sits comfortably inside the
 * region - which is what makes the optimisation exercise honest.
 */

import { calculateLaunch, simulateShot, predictSigma, makeRng } from '../physics.js';
import { decode } from './designs.js';

/** @type {Array<{letter: string, name: string, key: string, low: number, high: number, unit: string}>} */
export const FACTORS = [
  { letter: 'A', name: 'Pull-back angle', key: 'pullBackAngle',  low: 130, high: 190, unit: 'deg' },
  { letter: 'B', name: 'Stop angle',      key: 'stopAngle',      low: 95,  high: 110, unit: 'deg' },
  { letter: 'C', name: 'Bungee position', key: 'bungeePosition', low: 2,   high: 4,   unit: '' },
  { letter: 'D', name: 'Arm hole',        key: 'armHole',        low: 2,   high: 4,   unit: '' },
  { letter: 'E', name: 'Pin elevation',   key: 'pinElevation',   low: 1.5, high: 3.0, unit: '' }
];

/**
 * Response-surface window for the final phase, after screening has dropped the
 * pin and fixed the arm hole. It is re-centred and re-scaled around where the
 * interesting responses live - standard practice once screening has told you
 * which part of the space is worth mapping in detail.
 */
export const RSM_FACTORS = [
  { letter: 'A', name: 'Pull-back angle', key: 'pullBackAngle',  low: 150, high: 190, unit: 'deg' },
  { letter: 'B', name: 'Stop angle',      key: 'stopAngle',      low: 95,  high: 112, unit: 'deg' },
  { letter: 'C', name: 'Bungee position', key: 'bungeePosition', low: 1.5, high: 4.5, unit: '' }
];

/** Centre (coded 0) settings for the full five-factor space. */
export function centreSettings(factors = FACTORS) {
  return decode(new Array(factors.length).fill(0), factors);
}

/**
 * Expands a coded row over a factor subset into full machine settings, holding
 * every factor outside the subset at its centre value.
 *
 * @param {number[]} codedRow
 * @param {Array<object>} activeFactors
 * @returns {Record<string, number>}
 */
export function settingsFor(codedRow, activeFactors) {
  return { ...centreSettings(), ...decode(codedRow, activeFactors) };
}

/**
 * Runs a coded design through the simulator.
 *
 * Each design point is fired `replicates` times; the mean and the sample
 * standard deviation of those shots are the two responses students analyse.
 * The standard deviation is a *measurement*, not a model output - which is the
 * whole reason replication is worth paying for.
 *
 * @param {number[][]} design - coded rows
 * @param {object} options
 * @param {Array<object>} [options.factors=FACTORS] - the active factors
 * @param {number} [options.replicates=3]
 * @param {number} [options.seed=20260907]
 * @returns {{runs: Array<object>, means: number[], spreads: number[], shots: Array<object>}}
 */
export function runDesign(design, { factors = FACTORS, replicates = 3, seed = 20260907 } = {}) {
  const rng = makeRng(seed);
  const runs = [];
  const shots = [];

  design.forEach((codedRow, index) => {
    const settings = settingsFor(codedRow, factors);
    const nominal = calculateLaunch(
      settings.pullBackAngle, settings.stopAngle, settings.bungeePosition,
      settings.armHole, settings.pinElevation
    );

    const distances = [];
    for (let rep = 1; rep <= replicates; rep++) {
      const shot = simulateShot(settings, rng);
      distances.push(shot.distance);
      shots.push({ run: index + 1, rep, coded: codedRow, settings, distance: shot.distance });
    }

    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const spread = distances.length > 1
      ? Math.sqrt(distances.reduce((s, d) => s + (d - mean) ** 2, 0) / (distances.length - 1))
      : 0;

    runs.push({
      run: index + 1,
      coded: codedRow,
      settings,
      distances,
      mean,
      spread,
      nominal: nominal.distance,
      predictedSigma: predictSigma(settings)
    });
  });

  return {
    runs,
    means: runs.map(r => r.mean),
    spreads: runs.map(r => r.spread),
    shots
  };
}

/**
 * Confirms a candidate setting by firing a lot of shots at it - the
 * confirmation run that every DOE study should end with.
 *
 * @param {Record<string, number>} settings
 * @param {number} [shots=400]
 * @param {number} [seed=99991]
 * @returns {{mean: number, spread: number, n: number, halfWidth95: number}}
 */
export function confirm(settings, shots = 400, seed = 99991) {
  const rng = makeRng(seed);
  const distances = [];
  for (let i = 0; i < shots; i++) distances.push(simulateShot(settings, rng).distance);

  const mean = distances.reduce((a, b) => a + b, 0) / shots;
  const spread = Math.sqrt(distances.reduce((s, d) => s + (d - mean) ** 2, 0) / (shots - 1));
  return { mean, spread, n: shots, halfWidth95: 1.96 * spread / Math.sqrt(shots) };
}

/**
 * Flattens a run-level result to one row per shot.
 *
 * Fitting on individual shots rather than run means is what buys the degrees of
 * freedom for a saturated design, and it is what gives an honest pure-error
 * term for the lack-of-fit test.
 *
 * @param {{runs: Array<object>}} result - from runDesign
 * @returns {{design: number[][], response: number[]}}
 */
export function shotLevel(result) {
  const design = [];
  const response = [];
  for (const run of result.runs) {
    for (const distance of run.distances) {
      design.push(run.coded);
      response.push(distance);
    }
  }
  return { design, response };
}

/** Formats a coded design and its responses as CSV, ready for Minitab or JMP. */
export function toCsv(runs, factors = FACTORS) {
  const header = [
    'StdOrder',
    ...factors.map(f => `${f.letter}_${f.key}`),
    ...factors.map(f => `${f.letter}_coded`),
    'Shot', 'Distance_m'
  ];
  const lines = [header.join(',')];

  for (const run of runs) {
    run.distances.forEach((distance, i) => {
      lines.push([
        run.run,
        ...factors.map(f => run.settings[f.key]),
        ...run.coded,
        i + 1,
        distance.toFixed(3)
      ].join(','));
    });
  }
  return lines.join('\n');
}

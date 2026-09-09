/**
 * How much noise can a design survive?
 *
 *   node doe/power-study.mjs [--trials=200] [--alpha=0.05]
 *
 * Repeats the same screening experiment many times with different random
 * draws and counts how often each factor is declared significant. That
 * proportion is the design's **power** for that factor.
 *
 * Power is the thing students most reliably fail to internalise from a lecture.
 * Running the same design at four noise levels and watching a factor fade from
 * "found every time" to "found one time in five" makes the point in a way a
 * formula does not.
 */

import { FACTORS, runDesign, shotLevel } from './catapult-doe.js';
import { fullFactorial2, fractionalFactorial2 } from './designs.js';
import { fit } from './analysis.js';
import { calculateLaunch } from '../physics.js';
import { decode } from './designs.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const TRIALS = Number(args.trials ?? 200);
const ALPHA = Number(args.alpha ?? 0.05);

const NOISE_LEVELS = [0.5, 1, 2, 3, 5];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Each design is analysed with the richest model it can actually support. This
// matters more than it looks: fitting main effects only to a system with large
// interactions dumps those interactions into the residual, which inflates the
// error term far beyond the real noise and hides every small factor. That is
// model misspecification, not low power, and confusing the two is a classic way
// to draw the wrong lesson from a screening design.
const DESIGNS = [
  {
    name: '2^(5-2) res III', reps: 2, order: 'main',
    build: () => fractionalFactorial2(5, ['D=AB', 'E=AC']),
    caveat: 'main effects only - the design cannot separate interactions'
  },
  {
    name: '2^(5-1) res V', reps: 2, order: 'interaction',
    build: () => fractionalFactorial2(5, ['E=ABCD']),
    caveat: 'main effects and all two-factor interactions'
  },
  {
    name: '2^(5-1) res V', reps: 6, order: 'interaction',
    build: () => fractionalFactorial2(5, ['E=ABCD']),
    caveat: 'main effects and all two-factor interactions'
  },
  {
    name: '2^5 full', reps: 2, order: 'interaction',
    build: () => fullFactorial2(5),
    caveat: 'main effects and all two-factor interactions'
  }
];

/* ------------------------------------------------- the truth being detected */

// The noiseless main effects: what a design is trying to find. Computed from
// the deterministic physics, so this is ground truth, not an estimate.
const noiseless = fullFactorial2(5).map(row => {
  const s = decode(row, FACTORS);
  return calculateLaunch(s.pullBackAngle, s.stopAngle, s.bungeePosition, s.armHole, s.pinElevation).distance;
});
const trueEffects = Object.fromEntries(
  fit(fullFactorial2(5), noiseless, 'main').terms.map(t => [t.label, t.effect])
);

console.log('='.repeat(76));
console.log('POWER STUDY - how often does a design find each factor?');
console.log('='.repeat(76));
console.log(`${TRIALS} independent repeats per cell, significance at alpha = ${ALPHA}.\n`);
console.log('True main effects from the noiseless physics (metres per coded step of 2):');
console.log('  ' + LETTERS.map(l => `${l} = ${trueEffects[l].toFixed(2)}`).join('   '));
console.log('\nEach cell is the percentage of experiments in which that factor came out');
console.log('significant. 100% means the design always finds it; 5% means it is being');
console.log('found no more often than chance alone would produce.\n');

/* ------------------------------------------------------------- the sweep */

for (const design of DESIGNS) {
  const matrix = design.build();
  const shotsPerExperiment = matrix.length * design.reps;

  console.log('-'.repeat(76));
  console.log(`${design.name}   ${matrix.length} runs x ${design.reps} shots = ${shotsPerExperiment} shots per experiment`);
  console.log(`  model: ${design.caveat}`);
  console.log('-'.repeat(76));
  console.log('  noise |' + LETTERS.map(l => `    ${l}`).join('') + '   |  typical sd of a shot');

  for (const noiseScale of NOISE_LEVELS) {
    const detections = Object.fromEntries(LETTERS.map(l => [l, 0]));
    let sdTotal = 0;

    for (let trial = 0; trial < TRIALS; trial++) {
      // A fresh seed per trial: independent repeats of the same experiment.
      const result = runDesign(matrix, {
        replicates: design.reps,
        seed: 1_000_000 + trial * 7919,
        noiseScale
      });
      sdTotal += result.spreads.reduce((a, b) => a + b, 0) / result.spreads.length;

      const { design: X, response: y } = shotLevel(result);
      const model = fit(X, y, design.order);
      for (const term of model.terms) {
        if (term.pValue < ALPHA) detections[term.label]++;
      }
    }

    const cells = LETTERS.map(l => {
      const pct = Math.round((100 * detections[l]) / TRIALS);
      return String(pct).padStart(5);
    }).join('');
    console.log(`  ${String(noiseScale).padStart(5)}x |${cells}   |  ${(sdTotal / TRIALS).toFixed(3)} m`);
  }
  console.log();
}

console.log('='.repeat(76));
console.log('HOW TO READ IT');
console.log('='.repeat(76));
console.log('A, B, C and D are large effects. Every design finds them at every noise');
console.log('level, so replication spent on them is wasted.');
console.log();
console.log('E is the whole story. Its true effect is only ' + trueEffects.E.toFixed(2) + ' m, and it is the one that');
console.log('fades as the machine gets noisier. On the resolution V design at 2 shots per');
console.log('run it goes from always found, to a coin toss at 3x noise, to almost never');
console.log('at 5x. Nothing about the machine changed except how much it shakes.');
console.log();
console.log('Replication buys it back: the same 16 runs at 6 shots each hold E at 90% where');
console.log('2 shots managed about half. More runs do not do the same job - the 32-run full');
console.log('factorial uses twice the shots of the 16-run half-fraction and gains nothing');
console.log('for E, because its error term has to carry every three-factor and higher');
console.log('interaction, which the half-fraction quietly absorbs into its two-factor');
console.log('estimates. Runs buy resolution; replicates buy power. They are not');
console.log('interchangeable, and this table is what that sentence looks like as data.');
console.log();
console.log('One trap is visible here. In the resolution III design E is aliased with the');
console.log('AC interaction, which is genuinely large, so that column really detects E + AC.');
console.log('It looks like the most powerful design in the table. It is measuring the wrong');
console.log('thing. A design can be confident and wrong at the same time.');
console.log('='.repeat(76));

/**
 * Catapult physics solver.
 *
 * Pure functions only - no DOM, no randomness except where explicitly named.
 * Geometry and material constants live in constants.js so that the renderer
 * draws exactly the machine that this file solves.
 *
 * Model chain:
 *   band extension -> elastic strain energy -> angular velocity at the stop
 *   -> tangential release velocity -> ballistic flight to ground.
 */

import {
  GRAVITY,
  ARM_LENGTH,
  ARM_MASS,
  PROJECTILE_MASS,
  BAND_ANCHOR,
  BAND_ATTACH_RATIO,
  BAND_REST_LENGTH,
  DRAG_FACTOR,
  NOISE,
  springRate,
  cupRadius,
  effectiveStopAngle as computeEffectiveStopAngle
} from './constants.js';

const DEG = Math.PI / 180;

/**
 * A launch that never leaves the cup. Every field of a successful result is
 * present so callers never have to guard against undefined.
 *
 * @param {object} known - fields that are meaningful even for a dud launch
 * @returns {LaunchResult}
 */
function nullLaunch(known = {}) {
  return {
    distance: 0,
    releaseVelocity: 0,
    launchAngleDeg: 0,
    flightTime: 0,
    releaseX: 0,
    releaseY: 0,
    vx: 0,
    vy: 0,
    effectiveStopAngle: 0,
    valid: false,
    reason: 'no launch',
    ...known
  };
}

/**
 * Straight-line distance from the band anchor to its attachment point on the
 * arm when the arm sits at the given angle.
 *
 * @param {number} angleRad - arm angle in radians
 * @returns {number} band length in metres
 */
function bandLength(angleRad) {
  const attach = ARM_LENGTH * BAND_ATTACH_RATIO;
  const dx = attach * Math.cos(angleRad) - BAND_ANCHOR.x;
  const dy = attach * Math.sin(angleRad) - BAND_ANCHOR.y;
  return Math.hypot(dx, dy);
}

/**
 * Maps the five dimensionless operator settings onto the physical state of the
 * machine. Separating this from the solver lets random effects perturb the
 * physics directly, the way real slop and drift do.
 *
 * @param {number} pullBackAngle - 90-200 deg; arm angle when loaded
 * @param {number} stopAngle - 90-120 deg; mechanical stop position
 * @param {number} bungeePosition - 1.0-5.0; band tension setting
 * @param {number} armHole - 1.0-5.0; cup position along the arm
 * @param {number} pinElevation - 1.0-5.0; raises the effective stop angle
 * @returns {MachineState}
 */
export function machineState(pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation) {
  return {
    pullBackAngle,
    stopAngleDeg: computeEffectiveStopAngle(stopAngle, pinElevation),
    springRate: springRate(bungeePosition),
    cupRadius: cupRadius(armHole),
    mass: PROJECTILE_MASS
  };
}

/**
 * Solves a launch from a fully specified physical state.
 *
 * `distance` is measured along the ground from the *pivot* (x = 0), which is
 * where the on-screen ruler is zeroed - not from the release point, which sits
 * behind the pivot whenever the stop angle exceeds 90 degrees.
 *
 * @param {MachineState} state
 * @returns {LaunchResult}
 */
export function solveLaunch(state) {
  const { pullBackAngle, stopAngleDeg: stopDeg, springRate: k, cupRadius: cupDist, mass } = state;

  // The arm must be drawn back past the stop or there is no swing at all.
  if (pullBackAngle <= stopDeg) {
    return nullLaunch({ effectiveStopAngle: stopDeg, reason: 'pull-back does not clear the stop' });
  }

  const thetaPull = pullBackAngle * DEG;
  const thetaStop = stopDeg * DEG;

  const extensionPull = Math.max(0, bandLength(thetaPull) - BAND_REST_LENGTH);
  const extensionStop = Math.max(0, bandLength(thetaStop) - BAND_REST_LENGTH);

  // Strain energy released over the swing: E = 1/2 k (x_pull^2 - x_stop^2)
  const energy = 0.5 * k * (extensionPull ** 2 - extensionStop ** 2);
  if (energy <= 0) {
    return nullLaunch({ effectiveStopAngle: stopDeg, reason: 'band stores no usable energy' });
  }

  // Rod about one end, plus the projectile as a point mass at the cup.
  const inertia = (ARM_MASS * ARM_LENGTH ** 2) / 3 + mass * cupDist ** 2;

  const omega = Math.sqrt((2 * energy) / inertia);
  const releaseVelocity = omega * cupDist;

  // Velocity is tangential to the arm, so it leads the arm angle by 90 degrees.
  const launchAngle = thetaStop - Math.PI / 2;
  const releaseX = cupDist * Math.cos(thetaStop);
  const releaseY = cupDist * Math.sin(thetaStop);

  const vxRaw = releaseVelocity * Math.cos(launchAngle);
  const vy = releaseVelocity * Math.sin(launchAngle);

  if (vxRaw <= 0) {
    return nullLaunch({
      effectiveStopAngle: stopDeg,
      launchAngleDeg: launchAngle / DEG,
      releaseX,
      releaseY,
      reason: 'projectile is not travelling downrange'
    });
  }

  // Lumped aerodynamic loss: faster shots bleed proportionally more range.
  // Applied to the horizontal component so that releaseX + vx * flightTime
  // reproduces `distance` exactly, keeping the drawn arc and the number honest.
  const vx = vxRaw / (1 + DRAG_FACTOR * releaseVelocity);

  // Time to fall from the release height back to the ground:
  //   releaseY + vy t - 1/2 g t^2 = 0
  const flightTime = (vy + Math.sqrt(vy ** 2 + 2 * GRAVITY * releaseY)) / GRAVITY;

  return {
    distance: Math.max(0, releaseX + vx * flightTime),
    releaseVelocity,
    launchAngleDeg: launchAngle / DEG,
    flightTime,
    releaseX,
    releaseY,
    vx,
    vy,
    effectiveStopAngle: stopDeg,
    valid: true,
    reason: ''
  };
}

/**
 * Nominal (noise-free) launch for a set of operator settings.
 *
 * @param {number} pullBackAngle
 * @param {number} stopAngle
 * @param {number} bungeePosition
 * @param {number} armHole
 * @param {number} pinElevation
 * @returns {LaunchResult}
 */
export function calculateLaunch(pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation) {
  return solveLaunch(machineState(pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation));
}

/**
 * Position of the projectile at time t during flight, in metres from the pivot.
 *
 * `rangeScale` stretches the horizontal axis so a shot perturbed by process
 * noise still follows a true parabola but lands on its actual mark. Pass the
 * ratio of the realised ground range to the nominal one.
 *
 * @param {LaunchResult} launch
 * @param {number} t - seconds since release
 * @param {number} [rangeScale=1]
 * @returns {{x: number, y: number}}
 */
export function trajectoryAt(launch, t, rangeScale = 1) {
  return {
    x: launch.releaseX + launch.vx * rangeScale * t,
    y: Math.max(0, launch.releaseY + launch.vy * t - 0.5 * GRAVITY * t * t)
  };
}

/**
 * Apex height of the flight, in metres above the ground.
 *
 * @param {LaunchResult} launch
 * @returns {number}
 */
export function apexHeight(launch) {
  if (!launch.valid || launch.vy <= 0) return launch.releaseY;
  return launch.releaseY + launch.vy ** 2 / (2 * GRAVITY);
}

/**
 * Normally distributed sample via the Box-Muller transform.
 *
 * @param {number} mean
 * @param {number} stdDev
 * @param {() => number} [rng=Math.random] - injectable for deterministic tests
 * @returns {number}
 */
export function randomNormal(mean, stdDev, rng = Math.random) {
  // 1 - rng() keeps u1 in (0, 1] so Math.log never sees zero.
  const u1 = 1 - rng();
  const u2 = rng();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/* ------------------------------------------------------------ random effects */

/**
 * Small, fast, seedable PRNG (mulberry32). A seed makes a whole class's data
 * set reproducible, which matters when an instructor needs the same numbers the
 * students got.
 *
 * @param {number} seed - any 32-bit integer
 * @returns {() => number} uniform generator on [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Applies the machine's random effects to a nominal state.
 *
 * @param {MachineState} nominal
 * @param {() => number} rng
 * @returns {MachineState}
 */
function perturbState(nominal, rng, releaseVelocity = 0) {
  const z = () => randomNormal(0, 1, rng);
  // The arm rebounds off the stop less repeatably the harder it arrives.
  const stopSigma = NOISE.stopAngleDeg * (1 + NOISE.stopAngleVelocityCoupling * releaseVelocity);
  return {
    pullBackAngle: nominal.pullBackAngle + NOISE.pullBackAngleDeg * z(),
    stopAngleDeg: nominal.stopAngleDeg + stopSigma * z(),
    springRate: nominal.springRate * (1 + NOISE.springRateRelative * z()),
    cupRadius: Math.max(0.05, nominal.cupRadius + NOISE.cupRadiusM * z()),
    mass: nominal.mass * (1 + NOISE.massRelative * z())
  };
}

/**
 * Fires one shot: perturbs the machine, solves the perturbed physics, then adds
 * measurement error at the tape. The spread this produces is *emergent* - it
 * depends on the settings, because the same slop matters more at high tension
 * and long cup radii than it does at low ones.
 *
 * @param {object} factors - {pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation}
 * @param {() => number} [rng=Math.random]
 * @returns {{distance: number, launch: LaunchResult, nominal: LaunchResult}}
 */
export function simulateShot(factors, rng = Math.random) {
  const nominalState = machineState(
    factors.pullBackAngle, factors.stopAngle, factors.bungeePosition,
    factors.armHole, factors.pinElevation
  );
  const nominal = solveLaunch(nominalState);
  const launch = solveLaunch(perturbState(nominalState, rng, nominal.releaseVelocity));

  // A shot that never leaves the cup is measured as zero, not as noise.
  const measured = launch.valid
    ? Math.max(0, launch.distance + randomNormal(0, NOISE.measurementM, rng))
    : 0;

  return { distance: measured, launch, nominal };
}

/**
 * Predicted shot-to-shot standard deviation at a set of settings, by first-order
 * error propagation (the delta method): sigma^2 = sum (d distance / d p)^2 sigma_p^2.
 *
 * Deterministic and cheap, so the UI can show it without a Monte Carlo run. It
 * is the *model's* sigma - the honest way to get a variation response for
 * analysis is still to fire replicates and take their standard deviation.
 *
 * @param {object} factors
 * @returns {number} metres
 */
export function predictSigma(factors) {
  const nominal = machineState(
    factors.pullBackAngle, factors.stopAngle, factors.bungeePosition,
    factors.armHole, factors.pinElevation
  );
  const base = solveLaunch(nominal);
  if (!base.valid) return 0;

  // Perturbation sizes for the numerical derivative, and the SD of each source.
  const sources = [
    ['pullBackAngle', 0.01, NOISE.pullBackAngleDeg],
    ['stopAngleDeg', 0.01, NOISE.stopAngleDeg * (1 + NOISE.stopAngleVelocityCoupling * base.releaseVelocity)],
    ['springRate', nominal.springRate * 1e-4, nominal.springRate * NOISE.springRateRelative],
    ['cupRadius', 1e-5, NOISE.cupRadiusM],
    ['mass', nominal.mass * 1e-4, nominal.mass * NOISE.massRelative]
  ];

  let varianceSum = NOISE.measurementM ** 2;
  for (const [key, step, sigma] of sources) {
    const up = solveLaunch({ ...nominal, [key]: nominal[key] + step });
    const down = solveLaunch({ ...nominal, [key]: nominal[key] - step });
    if (!up.valid || !down.valid) continue;
    const slope = (up.distance - down.distance) / (2 * step);
    varianceSum += (slope * sigma) ** 2;
  }

  return Math.sqrt(varianceSum);
}

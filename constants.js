/**
 * Single source of truth for the catapult's physical geometry and material
 * properties. Both the physics solver and the canvas renderer import from
 * here so the drawing can never drift out of sync with the maths.
 *
 * Coordinate convention (shared by every module):
 *   Origin is the arm pivot, at ground level.
 *   +x points downrange, +y points up, both in metres.
 *   Angles are standard maths angles about the pivot, in degrees:
 *     90 = arm straight up, 180 = arm horizontal pointing backwards,
 *     >180 = arm pulled below the backwards horizontal.
 */

export const GRAVITY = 9.81; // m/s^2

/** Arm length from pivot to tip. */
export const ARM_LENGTH = 1.0; // m
/** Uniform arm mass, used for the 1/3 M L^2 rod inertia term. */
export const ARM_MASS = 0.25; // kg
/** Projectile mass (golf-ball class). */
export const PROJECTILE_MASS = 0.045; // kg

/** Elastic band anchor on the forward upright of the frame. */
export const BAND_ANCHOR = { x: 0.25, y: 0.35 }; // m
/** Band attaches to the arm at this fraction of the arm length. */
export const BAND_ATTACH_RATIO = 0.4;
/** Unstretched band length; extension below this stores no energy. */
export const BAND_REST_LENGTH = 0.20; // m

/** Aerodynamic loss coefficient: distance is divided by (1 + DRAG_FACTOR * v). */
export const DRAG_FACTOR = 0.02;

/**
 * Random effects: the machine is never set up twice in exactly the same state.
 * These are standard deviations on the *physical* quantities, applied per shot
 * and then propagated through the solver, so the resulting spread in distance
 * is an emergent property of the settings rather than an assumed formula.
 * That is what makes "which factors drive variation?" a real question.
 */
export const NOISE = {
  /** Band stiffness drifts with temperature, fatigue and how it was hooked on. */
  springRateRelative: 0.020,
  /** The arm does not rebound off the stop in exactly the same place. */
  stopAngleDeg: 0.28,
  /**
   * ...and it stops less consistently the harder it arrives. Scatter in the
   * release angle grows with impact severity, so the stop-angle standard
   * deviation is multiplied by (1 + this * release velocity).
   *
   * This is what makes variation a genuinely separate response from the mean:
   * a lofted, slower shot and a flat, fast one can travel the same distance
   * while scattering by different amounts.
   */
  stopAngleVelocityCoupling: 0.055,
  /** Play in the arm-hole peg and the cup seating. */
  cupRadiusM: 0.004,
  /** The operator cannot hold the pull-back angle perfectly. */
  pullBackAngleDeg: 0.60,
  /** Ball-to-ball mass differences. */
  massRelative: 0.015,
  /** Reading the tape measure at the landing point. */
  measurementM: 0.040
};

/**
 * How hard the machine is shaking today.
 *
 * Every magnitude in NOISE is multiplied by this before a shot is fired, so the
 * signal-to-noise ratio of the whole experiment can be dialled up and down
 * without changing the underlying physics. `stopAngleVelocityCoupling` is
 * deliberately *not* scaled: it describes the shape of the variance structure
 * rather than its size, and keeping it fixed means the robust-settings lesson
 * survives at every noise level.
 *
 * A design that comfortably detects a factor at NORMAL will miss it at HIGH.
 * That is the point: it lets a class discover statistical power by running into
 * it, rather than being told about it.
 */
export const NOISE_PRESETS = [
  { value: 0, label: 'None - deterministic', note: 'Every shot identical. Replication buys nothing.' },
  { value: 0.25, label: 'Very low', note: 'Almost everything is detectable, even trivia.' },
  { value: 0.5, label: 'Low', note: 'A forgiving process.' },
  { value: 1, label: 'Normal (default)', note: 'The machine as specified.' },
  { value: 2, label: 'High', note: 'Small effects start to disappear into the noise.' },
  { value: 3, label: 'Very high', note: 'Only the big effects survive a small design.' },
  { value: 5, label: 'Extreme', note: 'Demands heavy replication to conclude anything.' }
];

/** Noise multiplier used when none is given. */
export const DEFAULT_NOISE_SCALE = 1;

/** Input factor bounds, shared by the UI, the paste importer and the solver. */
export const FACTOR_BOUNDS = {
  pullBackAngle: { min: 90, max: 200, step: 1, default: 160 },
  stopAngle: { min: 90, max: 120, step: 1, default: 105 },
  bungeePosition: { min: 1, max: 5, step: 0.5, default: 3 },
  armHole: { min: 1, max: 5, step: 0.5, default: 3 },
  pinElevation: { min: 1, max: 5, step: 0.5, default: 2 }
};

/** Band spring rate as a function of the bungee setting: 88 - 200 N/m. */
export function springRate(bungeePosition) {
  return 60 + bungeePosition * 28;
}

/** Cup radius from the pivot as a function of the arm-hole setting: 0.6 - 1.0 m. */
export function cupRadius(armHole) {
  return (0.5 + armHole * 0.1) * ARM_LENGTH;
}

/** The stop pin raises the mechanical stop by 1.5 degrees per unit of elevation. */
export function effectiveStopAngle(stopAngle, pinElevation) {
  return stopAngle + pinElevation * 1.5;
}

/** Clamp a value into an inclusive range. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

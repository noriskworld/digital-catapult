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

/**
 * Calculates the catapult throw distance and variation based on input parameters.
 * Uses a strongly non-linear energy conservation model.
 * 
 * @param {number} pullBackAngle - (100 - 200 degrees)
 * @param {number} stopAngle - (90 - 120 degrees)
 * @param {number} bungeePosition - (1, 2, or 3)
 * @param {number} armHole - (1, 2, or 3)
 * @param {number} pinElevation - (1, 2, or 3)
 * @returns {object} { distance, variation }
 */
export function calculateLaunch(pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation) {
  // Constants
  const g = 9.81; // gravity
  
  // Convert inputs to physical parameters
  // Bungee position changes spring tension non-linearly
  const tensions = { 1: 50, 2: 100, 3: 180 };
  const tension = tensions[bungeePosition] || 100;
  
  // Arm hole changes cup placement on the arm (0.6, 0.8, 1.0)
  const placements = { 1: 0.6, 2: 0.8, 3: 1.0 };
  const cupPlacement = placements[armHole] || 0.8;
  const armLength = 1.0; // Base arm length
  
  // Pin elevation modifies the stop angle intercept height slightly and release angle
  const pinOffsets = { 1: 0, 2: 5, 3: 10 };
  const effectiveStopAngle = stopAngle + (pinOffsets[pinElevation] || 0);
  
  // Convert angles to radians (Assuming 90 is vertical, 180 is horizontal to the back)
  // We'll map them so 90 is vertical (pi/2) and 180 is horizontal (pi)
  // The catapult throws towards 0 degrees (right side).
  const thetaP = pullBackAngle * (Math.PI / 180);
  const thetaS = effectiveStopAngle * (Math.PI / 180);
  
  if (thetaP <= thetaS) {
    return { distance: 0, variation: 0 }; 
  }

  // Anchor point for rubber band
  const anchorX = -0.3; 
  const anchorY = -0.2;
  
  // Point where rubber band attaches to arm
  const attachDist = armLength * 0.4;

  // Law of cosines/distance formula for spring extension
  // Arm vector from pivot at (0,0): x = cos(theta), y = sin(theta)
  const armPx = attachDist * Math.cos(thetaP);
  const armPy = attachDist * Math.sin(thetaP);
  const distPull = Math.sqrt(Math.pow(armPx - anchorX, 2) + Math.pow(armPy - anchorY, 2));
  
  const armSx = attachDist * Math.cos(thetaS);
  const armSy = attachDist * Math.sin(thetaS);
  const distStop = Math.sqrt(Math.pow(armSx - anchorX, 2) + Math.pow(armSy - anchorY, 2));
  
  // Energy stored in spring
  const restLength = 0.2;
  const extPull = Math.max(0, distPull - restLength);
  const extStop = Math.max(0, distStop - restLength);
  
  const energyStored = 0.5 * tension * (Math.pow(extPull, 2) - Math.pow(extStop, 2));
  
  if (energyStored <= 0) {
    return { distance: 0, variation: 0 };
  }
  
  // Mass of projectile (keep constant or maybe derived from armHole? Let's say mass is constant for now)
  const mass = 0.05; // 50g
  const armMass = 0.3;
  const cupDist = cupPlacement * armLength;
  const momentOfInertia = (armMass * Math.pow(armLength, 2) / 3) + (mass * Math.pow(cupDist, 2));
  
  const omega = Math.sqrt((2 * energyStored) / momentOfInertia);
  const releaseVelocity = omega * cupDist;
  
  // Release angle: if arm is at thetaS (where 90 is vertical, >90 is tilted back)
  // The velocity vector is perpendicular to the arm, moving forward.
  // Angle of velocity = thetaS - 90 deg
  const launchAngle = thetaS - (Math.PI / 2);
  
  const h0 = cupDist * Math.sin(thetaS);
  
  const vCos = releaseVelocity * Math.cos(launchAngle);
  const vSin = releaseVelocity * Math.sin(launchAngle);
  
  let distance;
  if (vCos <= 0) {
    // Shot backwards or straight up
    distance = 0;
  } else {
    distance = (vCos / g) * (vSin + Math.sqrt(Math.pow(vSin, 2) + 2 * g * h0));
  }
  
  // Introduce strong non-linearity through aerodynamic drag scaling
  const dragFactor = 0.008 / mass;
  distance = distance * Math.exp(-dragFactor * releaseVelocity);

  // Variation: Non-linear w.r.t distance and tension
  let variation = (distance * 0.05) * (tension / 100);
  
  return {
    distance: Math.max(0, distance),
    variation: variation
  };
}

export function randomNormal(mean, stdDev) {
  let u1 = Math.random();
  let u2 = Math.random();
  let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

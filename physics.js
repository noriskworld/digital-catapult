/**
 * Calculates the catapult throw distance, ballistic properties, and landing variation
 * based on input factor settings using an energy conservation and Newtonian kinematic model.
 * 
 * @param {number} pullBackAngle - (90 - 200 degrees; 90 = vertical, 180 = horizontal back)
 * @param {number} stopAngle - (90 - 120 degrees; angle where catapult arm hits the stop)
 * @param {number} bungeePosition - (1.0 - 5.0; elastic tension setting)
 * @param {number} armHole - (1.0 - 5.0; cup placement position along the arm)
 * @param {number} pinElevation - (1.0 - 5.0; modifies the physical stop angle)
 * @returns {object} Calculated launch and kinematic metrics
 */
export function calculateLaunch(pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation) {
  const g = 9.81; 
  
  // Physical parameters
  const armLength = 1.0; // meters
  const tension = 60 + (bungeePosition * 28); // 88 - 200 N/m spring rate
  const cupPlacement = 0.5 + (armHole * 0.1); // 0.6 - 1.0 ratio along arm
  const effectiveStopAngle = stopAngle + (pinElevation * 1.5); // pin raises mechanical stop
  
  // Valid launch requires pulling back past the stop angle
  if (pullBackAngle <= effectiveStopAngle) {
    return {
      distance: 0,
      variation: 0,
      releaseVelocity: 0,
      launchAngleDeg: 0,
      flightTime: 0,
      startX: 0,
      startY: 0,
      vCos: 0,
      vSin: 0,
      effectiveStopAngle
    }; 
  }

  // Convert angles to radians
  // Standard math angle: 90 is UP (+y), 180 is LEFT (-x)
  const thetaP = pullBackAngle * (Math.PI / 180);
  const thetaS = effectiveStopAngle * (Math.PI / 180);

  // Band anchor positioned on forward upright frame (x=0.25, y=0.35)
  // Guarantees strictly monotonic extension across the full 90-200 deg pullback range
  const anchorX = 0.25; 
  const anchorY = 0.35;
  const attachDist = armLength * 0.4; // band attaches at 40% of arm length

  const armPx = attachDist * Math.cos(thetaP);
  const armPy = attachDist * Math.sin(thetaP);
  const distPull = Math.sqrt(Math.pow(armPx - anchorX, 2) + Math.pow(armPy - anchorY, 2));

  const armSx = attachDist * Math.cos(thetaS);
  const armSy = attachDist * Math.sin(thetaS);
  const distStop = Math.sqrt(Math.pow(armSx - anchorX, 2) + Math.pow(armSy - anchorY, 2));

  const restLength = 0.20;
  const extPull = Math.max(0, distPull - restLength);
  const extStop = Math.max(0, distStop - restLength);

  // Elastic strain energy released between pullback and stop: E = 0.5 * k * (x_pull^2 - x_stop^2)
  const energyStored = 0.5 * tension * (Math.pow(extPull, 2) - Math.pow(extStop, 2));

  if (energyStored <= 0) {
    return {
      distance: 0,
      variation: 0,
      releaseVelocity: 0,
      launchAngleDeg: 0,
      flightTime: 0,
      startX: 0,
      startY: 0,
      vCos: 0,
      vSin: 0,
      effectiveStopAngle
    };
  }

  // Mass & Rotational Inertia
  const mass = 0.045; // 45g projectile (e.g. golf ball / ping pong ball)
  const armMass = 0.25; // 250g arm
  const cupDist = cupPlacement * armLength;
  const momentOfInertia = (armMass * Math.pow(armLength, 2) / 3) + (mass * Math.pow(cupDist, 2));

  // Angular velocity at stop: omega = sqrt(2 * E / I)
  const omega = Math.sqrt((2 * energyStored) / momentOfInertia);
  const releaseVelocity = omega * cupDist;

  // Tangential velocity vector at arm stop angle (moving towards positive X)
  const launchAngle = thetaS - (Math.PI / 2);
  
  // Starting coordinates of the projectile from pivot at release
  const startX = cupDist * Math.cos(thetaS);
  const startY = cupDist * Math.sin(thetaS);

  const vCos = releaseVelocity * Math.cos(launchAngle);
  const vSin = releaseVelocity * Math.sin(launchAngle);

  if (vCos <= 0) {
    return {
      distance: 0,
      variation: 0,
      releaseVelocity: 0,
      launchAngleDeg: launchAngle * 180 / Math.PI,
      flightTime: 0,
      startX,
      startY,
      vCos: 0,
      vSin: 0,
      effectiveStopAngle
    };
  }

  // Exact vacuum ballistic flight time to ground (y = 0):
  // y(t) = startY + vSin * t - 0.5 * g * t^2 = 0
  const flightTime = (vSin + Math.sqrt(Math.pow(vSin, 2) + 2 * g * startY)) / g;
  
  // Nominal horizontal travel from release point to ground impact
  let nominalDistance = vCos * flightTime;

  // Realistic aerodynamic drag calibration
  const dragFactor = 0.02;
  const effectiveDistance = nominalDistance / (1 + dragFactor * releaseVelocity);

  // Six Sigma process noise: variation increases with tension and longer arm radius
  const variation = (effectiveDistance * 0.035) * (tension / 110) * (1 + 0.06 * (armHole - 1));

  return {
    distance: Math.max(0, effectiveDistance),
    variation: Math.max(0.01, variation),
    releaseVelocity,
    launchAngleDeg: launchAngle * (180 / Math.PI),
    flightTime,
    startX,
    startY,
    vCos: vCos / (1 + dragFactor * releaseVelocity), // effective horizontal velocity
    vSin,
    effectiveStopAngle
  };
}

/**
 * Generates a normally distributed random number using Box-Muller transform.
 * Guarded against Math.random() returning 0.
 * 
 * @param {number} mean 
 * @param {number} stdDev 
 * @returns {number}
 */
export function randomNormal(mean, stdDev) {
  // Ensure u1 is in (0, 1] to prevent Math.log(0) = -Infinity
  const u1 = 1.0 - Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

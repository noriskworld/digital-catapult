/**
 * Calculates the catapult throw distance and variation based on input parameters.
 * Uses a strongly non-linear energy conservation model.
 * 
 * @param {number} pullBackAngle - (90 - 200 degrees)
 * @param {number} stopAngle - (90 - 120 degrees)
 * @param {number} bungeePosition - (1.0 - 5.0)
 * @param {number} armHole - (1.0 - 5.0)
 * @param {number} pinElevation - (1.0 - 5.0)
 * @returns {object} { distance, variation }
 */
export function calculateLaunch(pullBackAngle, stopAngle, bungeePosition, armHole, pinElevation) {
  const g = 9.81; 
  
  // Map continuous input parameters to physical values
  const tension = 50 + (bungeePosition * 35); // Continuous tension mapping
  const cupPlacement = 0.5 + (armHole * 0.1); // Continuous cup placement ratio
  const armLength = 1.0; 
  
  const effectiveStopAngle = stopAngle + (pinElevation * 1.5); // Pin elevation affects stop angle intercept
  
  // Convert angles to radians
  // 90 is vertical, 180 is horizontal left (pulled back).
  const thetaP = pullBackAngle * (Math.PI / 180);
  const thetaS = effectiveStopAngle * (Math.PI / 180);
  
  if (thetaP <= thetaS) {
    return { distance: 0, variation: 0 }; 
  }

  // FIXED ANCHOR POINT: Anchor is on the right side (front of catapult)
  // so pulling arm to the left (180 deg) stretches the band further.
  const anchorX = 0.3; 
  const anchorY = -0.2;
  
  const attachDist = armLength * 0.4;

  // Arm vector from pivot at (0,0): 90 is UP, 180 is LEFT
  // standard math: x = cos(angle), y = sin(angle)
  const armPx = attachDist * Math.cos(thetaP);
  const armPy = attachDist * Math.sin(thetaP);
  const distPull = Math.sqrt(Math.pow(armPx - anchorX, 2) + Math.pow(armPy - anchorY, 2));
  
  const armSx = attachDist * Math.cos(thetaS);
  const armSy = attachDist * Math.sin(thetaS);
  const distStop = Math.sqrt(Math.pow(armSx - anchorX, 2) + Math.pow(armSy - anchorY, 2));
  
  const restLength = 0.1;
  const extPull = Math.max(0, distPull - restLength);
  const extStop = Math.max(0, distStop - restLength);
  
  const energyStored = 0.5 * tension * (Math.pow(extPull, 2) - Math.pow(extStop, 2));
  
  if (energyStored <= 0) {
    return { distance: 0, variation: 0 };
  }
  
  const mass = 0.05; 
  const armMass = 0.3;
  const cupDist = cupPlacement * armLength;
  const momentOfInertia = (armMass * Math.pow(armLength, 2) / 3) + (mass * Math.pow(cupDist, 2));
  
  const omega = Math.sqrt((2 * energyStored) / momentOfInertia);
  const releaseVelocity = omega * cupDist;
  
  // Velocity vector is perpendicular to the arm moving forward (towards 0 degrees)
  const launchAngle = thetaS - (Math.PI / 2);
  
  const h0 = cupDist * Math.sin(thetaS);
  
  const vCos = releaseVelocity * Math.cos(launchAngle);
  const vSin = releaseVelocity * Math.sin(launchAngle);
  
  let distance;
  if (vCos <= 0) {
    distance = 0;
  } else {
    distance = (vCos / g) * (vSin + Math.sqrt(Math.pow(vSin, 2) + 2 * g * h0));
  }
  
  const dragFactor = 0.008 / mass;
  distance = distance * Math.exp(-dragFactor * releaseVelocity);

  let variation = (distance * 0.05) * (tension / 100);
  
  return {
    distance: Math.max(0, distance),
    variation: Math.max(0.001, variation)
  };
}

export function randomNormal(mean, stdDev) {
  let u1 = Math.random();
  let u2 = Math.random();
  let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

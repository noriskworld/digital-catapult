/**
 * Calculates the catapult throw distance and variation based on input parameters.
 * Uses a non-linear energy conservation model.
 * 
 * @param {number} pullBackAngle - in degrees (0 = vertical, 90 = horizontal back)
 * @param {number} tension - Spring constant (N/m)
 * @param {number} armLength - Length of the arm (m)
 * @param {number} mass - Mass of the projectile (kg)
 * @param {number} stopAngle - Angle where arm stops and releases (degrees)
 * @param {number} cupPlacement - Ratio of arm length where cup is placed (0.0 - 1.0)
 * @returns {object} { distance, variation }
 */
export function calculateLaunch(pullBackAngle, tension, armLength, mass, stopAngle, cupPlacement) {
  // Constants
  const g = 9.81; // gravity
  
  // Convert angles to radians
  // Assuming 0 is vertical pointing up. Pulling back goes to positive angles (e.g. 90 is horizontal right).
  // The catapult throws to the left.
  const thetaP = pullBackAngle * (Math.PI / 180);
  const thetaS = stopAngle * (Math.PI / 180);
  
  if (thetaP <= thetaS) {
    return { distance: 0, variation: 0 }; // Cannot pull back less than stop angle
  }

  // Anchor point for rubber band (relative to pivot at 0,0)
  const anchorX = 0.2; 
  const anchorY = -0.1;
  
  // Point where rubber band attaches to arm (assume halfway)
  const attachDist = armLength * 0.5;

  // Calculate rubber band extension at pull-back
  // Arm position at pull-back
  const armPx = attachDist * Math.sin(thetaP);
  const armPy = attachDist * Math.cos(thetaP);
  const distPull = Math.sqrt(Math.pow(armPx - anchorX, 2) + Math.pow(armPy - anchorY, 2));
  
  // Arm position at stop
  const armSx = attachDist * Math.sin(thetaS);
  const armSy = attachDist * Math.cos(thetaS);
  const distStop = Math.sqrt(Math.pow(armSx - anchorX, 2) + Math.pow(armSy - anchorY, 2));
  
  // Energy stored in spring (E = 1/2 k * (dx^2))
  // Assume resting length of band is 0.1m
  const restLength = 0.1;
  const extPull = Math.max(0, distPull - restLength);
  const extStop = Math.max(0, distStop - restLength);
  
  const energyStored = 0.5 * tension * (Math.pow(extPull, 2) - Math.pow(extStop, 2));
  
  if (energyStored <= 0) {
    return { distance: 0, variation: 0 };
  }
  
  // Effective mass (projectile + effective mass of arm)
  // Let's approximate arm mass as 0.2 kg
  const armMass = 0.2;
  // Kinetic energy = 1/2 * I * omega^2
  // I = m_arm * L^2 / 3 + m_proj * (C * L)^2
  const cupDist = cupPlacement * armLength;
  const momentOfInertia = (armMass * Math.pow(armLength, 2) / 3) + (mass * Math.pow(cupDist, 2));
  
  // E = 1/2 I omega^2 => omega = sqrt(2E / I)
  const omega = Math.sqrt((2 * energyStored) / momentOfInertia);
  
  // Release velocity v = omega * r
  const releaseVelocity = omega * cupDist;
  
  // Release angle relative to horizontal
  // If stopAngle is thetaS (from vertical), then release velocity vector is perpendicular to arm.
  // Arm angle from horizontal is (90 - thetaS). Velocity angle is thetaS from horizontal (upwards).
  const launchAngle = thetaS; // radians
  
  // Calculate range on flat ground: R = (v^2 * sin(2*theta)) / g
  // Let's also add initial height of the cup
  const h0 = armLength + cupDist * Math.cos(thetaS); // approximation
  
  // R = (v * cos(a) / g) * (v * sin(a) + sqrt(v^2 * sin^2(a) + 2*g*h0))
  const vCos = releaseVelocity * Math.cos(launchAngle);
  const vSin = releaseVelocity * Math.sin(launchAngle);
  
  let distance = (vCos / g) * (vSin + Math.sqrt(Math.pow(vSin, 2) + 2 * g * h0));
  
  // Add some non-linear air resistance factor based on velocity squared and mass
  // This makes the transfer function even more complex
  const dragFactor = 0.005 / mass;
  distance = distance * Math.exp(-dragFactor * releaseVelocity);

  // Variation (Standard Deviation)
  // Higher velocity and smaller mass leads to higher variation
  let variation = (releaseVelocity * 0.02) / Math.sqrt(mass * 10);
  
  return {
    distance: Math.max(0, distance),
    variation: variation
  };
}

// Helper to generate a normally distributed random number (Box-Muller)
export function randomNormal(mean, stdDev) {
  let u1 = Math.random();
  let u2 = Math.random();
  let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

import './style.css';
import { calculateLaunch, randomNormal } from './physics.js';
import { CatapultRenderer } from './animation.js';

let renderer;
let rowCount = 0;
const configs = [];

document.addEventListener('DOMContentLoaded', () => {
  renderer = new CatapultRenderer('sim-canvas');
  renderer.clear();
  renderer.drawBase();
  renderer.drawArm(45, 1.0, 0.9); // Initial static draw
  
  document.getElementById('add-row-btn').addEventListener('click', addConfigRow);
  document.getElementById('launch-btn').addEventListener('click', launchSelected);
  
  // Add a default row
  addConfigRow();
});

function addConfigRow() {
  rowCount++;
  const tbody = document.getElementById('config-tbody');
  const tr = document.createElement('tr');
  tr.dataset.id = rowCount;
  
  tr.innerHTML = `
    <td><input type="number" step="1" value="70" class="inp-pull"></td>
    <td><input type="number" step="10" value="100" class="inp-tension"></td>
    <td><input type="number" step="0.1" value="1.0" class="inp-arm"></td>
    <td><input type="number" step="0.01" value="0.05" class="inp-mass"></td>
    <td><input type="number" step="1" value="20" class="inp-stop"></td>
    <td><input type="number" step="0.05" value="0.9" class="inp-cup"></td>
    <td>
      <div class="radio-container">
        <input type="radio" name="selected-config" value="${rowCount}" ${rowCount === 1 ? 'checked' : ''}>
      </div>
    </td>
  `;
  
  tbody.appendChild(tr);
}

function getSelectedConfig() {
  const selectedRadio = document.querySelector('input[name="selected-config"]:checked');
  if (!selectedRadio) return null;
  
  const rowId = selectedRadio.value;
  const tr = document.querySelector(`tr[data-id="${rowId}"]`);
  
  return {
    id: rowId,
    pullBackAngle: parseFloat(tr.querySelector('.inp-pull').value),
    tension: parseFloat(tr.querySelector('.inp-tension').value),
    armLength: parseFloat(tr.querySelector('.inp-arm').value),
    mass: parseFloat(tr.querySelector('.inp-mass').value),
    stopAngle: parseFloat(tr.querySelector('.inp-stop').value),
    cupPlacement: parseFloat(tr.querySelector('.inp-cup').value)
  };
}

function launchSelected() {
  const config = getSelectedConfig();
  if (!config) {
    alert("Please select a configuration to launch.");
    return;
  }
  
  // Disable button during animation
  document.getElementById('launch-btn').disabled = true;
  
  // Physics Calculation
  const result = calculateLaunch(
    config.pullBackAngle,
    config.tension,
    config.armLength,
    config.mass,
    config.stopAngle,
    config.cupPlacement
  );
  
  // Generate a sampled outcome based on the theoretical mean and variation
  const actualDistance = Math.max(0, randomNormal(result.distance, result.variation));
  
  // Add to results table
  addResultRow(config.id, actualDistance, result.variation);
  
  // Animate
  animateLaunch(config, actualDistance);
}

function addResultRow(configId, distance, variation) {
  const tbody = document.getElementById('results-tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>Config ${configId}</td>
    <td>${distance.toFixed(2)}</td>
    <td>&plusmn; ${variation.toFixed(3)}</td>
  `;
  tbody.prepend(tr); // Add to top
}

function animateLaunch(config, actualDistance) {
  let startTime = null;
  const animDurationMs = 500; // time to swing arm
  
  // Arm swing from pullBackAngle to stopAngle
  const startAngle = config.pullBackAngle;
  const endAngle = config.stopAngle;
  
  function swingStep(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / animDurationMs, 1.0);
    
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentAngle = startAngle - (startAngle - endAngle) * easeProgress;
    
    renderer.clear();
    renderer.drawBase();
    renderer.drawArm(currentAngle, config.armLength, config.cupPlacement);
    
    if (progress < 1.0) {
      requestAnimationFrame(swingStep);
    } else {
      // Launch projectile
      animateProjectile(config, actualDistance);
    }
  }
  
  requestAnimationFrame(swingStep);
}

function animateProjectile(config, actualDistance) {
  let startTime = null;
  const flightDurationMs = 1500;
  const g = 9.81;
  
  // Initial projectile position at stop angle
  const angleRad = config.stopAngle * (Math.PI / 180);
  const startX = config.armLength * config.cupPlacement * Math.sin(angleRad);
  const startY = config.armLength * config.cupPlacement * Math.cos(angleRad);
  
  // We know the final distance, so we can reverse engineer a simple parabola for visual effect
  // Let's just make a fake parabola that lands at `actualDistance` for the animation
  // y = a * x^2 + b * x + c
  
  const trajectoryPoints = [];
  
  function flightStep(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / flightDurationMs, 1.0);
    
    // Fake x moving linearly
    const currentX = startX + actualDistance * progress;
    
    // Fake y moving as a parabola
    // At t=0, y = startY. At t=0.5, y is max. At t=1, y = 0.
    const h = actualDistance / 2;
    const maxHeight = startY + actualDistance * 0.5; // just a visual guess
    const a = -maxHeight / (h * h);
    // y = a * (x - h)^2 + maxHeight
    const currentY = Math.max(0, a * Math.pow(currentX - h, 2) + maxHeight);
    
    trajectoryPoints.push({ x: currentX, y: currentY });
    
    renderer.clear();
    renderer.drawBase();
    renderer.drawArm(config.stopAngle, config.armLength, config.cupPlacement);
    renderer.drawTrajectory(trajectoryPoints);
    renderer.drawProjectile(currentX, currentY);
    
    if (progress < 1.0 && currentY > 0) {
      requestAnimationFrame(flightStep);
    } else {
      document.getElementById('launch-btn').disabled = false;
    }
  }
  
  requestAnimationFrame(flightStep);
}

import './style.css';
import { calculateLaunch, randomNormal } from './physics.js';
import { CatapultRenderer } from './animation.js';

let renderer;
let rowCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  renderer = new CatapultRenderer('sim-canvas');
  renderer.clear();
  renderer.drawBase();
  renderer.drawArm(130, 2); // Initial static draw (130 deg pullback, arm hole 2)
  
  document.getElementById('add-row-btn').addEventListener('click', addConfigRow);
  document.getElementById('launch-btn').addEventListener('click', runAllAtOnce);
  
  // Add a few default rows
  addConfigRow(180, 100, 3, 3, 2);
  addConfigRow(150, 110, 2, 2, 1);
  addConfigRow(120, 95, 1, 1, 3);
});

function addConfigRow(pull = 160, stop = 110, bungee = 2, arm = 2, pin = 2) {
  rowCount++;
  const tbody = document.getElementById('config-tbody');
  const tr = document.createElement('tr');
  tr.dataset.id = rowCount;
  
  tr.innerHTML = `
    <td><input type="number" step="1" min="100" max="200" value="${pull}" class="inp-pull"></td>
    <td><input type="number" step="1" min="90" max="120" value="${stop}" class="inp-stop"></td>
    <td><input type="number" step="1" min="1" max="3" value="${bungee}" class="inp-bungee"></td>
    <td><input type="number" step="1" min="1" max="3" value="${arm}" class="inp-arm"></td>
    <td><input type="number" step="1" min="1" max="3" value="${pin}" class="inp-pin"></td>
    <td><button class="btn delete" onclick="this.closest('tr').remove()">Remove</button></td>
  `;
  
  tbody.appendChild(tr);
}

function getAllConfigs() {
  const rows = document.querySelectorAll('#config-tbody tr');
  const configs = [];
  rows.forEach(tr => {
    configs.push({
      id: tr.dataset.id,
      pullBackAngle: parseFloat(tr.querySelector('.inp-pull').value),
      stopAngle: parseFloat(tr.querySelector('.inp-stop').value),
      bungeePosition: parseInt(tr.querySelector('.inp-bungee').value),
      armHole: parseInt(tr.querySelector('.inp-arm').value),
      pinElevation: parseInt(tr.querySelector('.inp-pin').value)
    });
  });
  return configs;
}

function runAllAtOnce() {
  const configs = getAllConfigs();
  if (configs.length === 0) {
    alert("Please add at least one configuration.");
    return;
  }
  
  // Disable button
  document.getElementById('launch-btn').disabled = true;
  document.getElementById('results-tbody').innerHTML = ''; // Clear old results
  
  const results = [];
  
  // Physics Calculation for all
  configs.forEach(config => {
    const result = calculateLaunch(
      config.pullBackAngle,
      config.stopAngle,
      config.bungeePosition,
      config.armHole,
      config.pinElevation
    );
    
    const actualDistance = Math.max(0, randomNormal(result.distance, result.variation));
    results.push({ config, actualDistance, variation: result.variation });
    addResultRow(config.id, actualDistance, result.variation);
  });
  
  // Animate all simultaneously
  animateSimultaneous(results);
}

function addResultRow(configId, distance, variation) {
  const tbody = document.getElementById('results-tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>Config ${configId}</td>
    <td>${distance.toFixed(2)}</td>
    <td>&plusmn; ${variation.toFixed(3)}</td>
  `;
  tbody.appendChild(tr); 
}

const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function animateSimultaneous(runs) {
  let startTime = null;
  const animDurationMs = 500; 
  const flightDurationMs = 1500;
  
  // Setup trajectories
  runs.forEach((run, index) => {
    run.color = colors[index % colors.length];
    run.trajectoryPoints = [];
    
    // Physics geometry to match drawing:
    const angleRad = run.config.stopAngle * (Math.PI / 180);
    const placements = { 1: 0.6, 2: 0.8, 3: 1.0 };
    const armLengthPx = 150; 
    const cupPx = armLengthPx * (placements[run.config.armHole] || 0.8);
    // Convert to meters using scale
    const scale = 20; 
    const cupM = cupPx / scale;
    
    // Position of cup at stop angle
    run.startX = cupM * Math.cos(angleRad);
    run.startY = cupM * Math.sin(angleRad);
  });
  
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    
    renderer.clear();
    renderer.drawBase();
    
    let allFinished = true;
    
    runs.forEach(run => {
      if (elapsed < animDurationMs) {
        // Arm swinging phase
        allFinished = false;
        const progress = elapsed / animDurationMs;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentAngle = run.config.pullBackAngle - (run.config.pullBackAngle - run.config.stopAngle) * easeProgress;
        
        renderer.drawArm(currentAngle, run.config.armHole);
      } else {
        // Flight phase
        renderer.drawArm(run.config.stopAngle, run.config.armHole);
        
        const flightElapsed = elapsed - animDurationMs;
        if (flightElapsed < flightDurationMs) {
          allFinished = false;
          const progress = flightElapsed / flightDurationMs;
          
          // Fake parabola mapping to actual distance
          const currentX = run.startX + run.actualDistance * progress;
          const h = run.actualDistance / 2;
          const maxHeight = run.startY + Math.max(2, run.actualDistance * 0.4); 
          const a = -maxHeight / (h * h);
          const currentY = Math.max(0, a * Math.pow(currentX - h, 2) + maxHeight);
          
          run.trajectoryPoints.push({ x: currentX, y: currentY });
          renderer.drawProjectile(currentX, currentY, run.color);
        } else {
          // Finished flight, just draw last pos
          const currentX = run.startX + run.actualDistance;
          renderer.drawProjectile(currentX, 0, run.color);
        }
        
        renderer.drawTrajectory(run.trajectoryPoints, run.color);
      }
    });
    
    if (!allFinished) {
      requestAnimationFrame(step);
    } else {
      document.getElementById('launch-btn').disabled = false;
    }
  }
  
  requestAnimationFrame(step);
}

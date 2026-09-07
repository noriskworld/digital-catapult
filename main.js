import './style.css';
import { calculateLaunch, randomNormal } from './physics.js';
import { CatapultRenderer } from './animation.js';

let renderer;
let rowCount = 0;
let lastResults = [];

const RUN_COLORS = [
  '#ef4444', // red
  '#38bdf8', // sky blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316'  // orange
];

document.addEventListener('DOMContentLoaded', () => {
  renderer = new CatapultRenderer('sim-canvas');
  resetCanvasPreview();

  // Control Buttons
  document.getElementById('add-row-btn').addEventListener('click', () => addConfigRow());
  document.getElementById('clear-table-btn').addEventListener('click', clearConfigTable);
  document.getElementById('launch-btn').addEventListener('click', runAllAtOnce);
  
  // Results Buttons
  document.getElementById('export-csv-btn')?.addEventListener('click', exportResultsToCSV);
  document.getElementById('copy-results-btn')?.addEventListener('click', copyResultsToClipboard);
  document.getElementById('clear-results-btn')?.addEventListener('click', clearResultsTable);

  // Guide Toggle
  const guideToggle = document.getElementById('guide-toggle-btn');
  const guideContent = document.getElementById('guide-content');
  if (guideToggle && guideContent) {
    guideToggle.addEventListener('click', () => {
      const isHidden = guideContent.classList.toggle('hidden');
      guideToggle.textContent = isHidden ? 'Show DOE & User Guide' : 'Hide DOE & User Guide';
    });
  }

  // Event delegation for table removal
  document.getElementById('config-tbody').addEventListener('click', (e) => {
    if (e.target.closest('.btn-delete-row')) {
      const row = e.target.closest('tr');
      row.remove();
      updateRowLabels();
    }
  });

  // Scoped Clipboard Paste Handler (Excel TSV and CSV support)
  const configSection = document.querySelector('.config-panel');
  if (configSection) {
    configSection.addEventListener('paste', handleTablePaste);
  }

  // Pre-populate with 3 standard DOE trial configurations
  addConfigRow(180, 100, 3, 3, 2);
  addConfigRow(150, 110, 2, 2, 1);
  addConfigRow(120, 95, 1, 1, 3);
});

function resetCanvasPreview() {
  renderer.clear();
  renderer.drawBase(105);
  renderer.drawArm(140, 3, true); // Idle preview
}

function updateRowLabels() {
  const rows = document.querySelectorAll('#config-tbody tr');
  rows.forEach((tr, index) => {
    const id = index + 1;
    tr.dataset.id = id;
    const badge = tr.querySelector('.row-num-badge');
    if (badge) badge.textContent = `#${id}`;
  });
}

function clearConfigTable() {
  document.getElementById('config-tbody').innerHTML = '';
  rowCount = 0;
  resetCanvasPreview();
}

function clearResultsTable() {
  document.getElementById('results-tbody').innerHTML = '';
  lastResults = [];
  resetCanvasPreview();
}

/**
 * Handles pasting TSV (from Excel) or CSV data into the configuration table.
 */
function handleTablePaste(e) {
  const pasteData = e.clipboardData?.getData('text');
  if (!pasteData) return;

  const lines = pasteData.trim().split(/\r?\n/);
  // If single cell, let native input focus handle it
  if (lines.length === 1 && !lines[0].includes('\t') && !lines[0].includes(',')) {
    return;
  }

  e.preventDefault();

  let importedCount = 0;
  lines.forEach(line => {
    const delimiter = line.includes('\t') ? '\t' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 2) {
      const pull = parseFloat(cols[0]);
      if (isNaN(pull)) return; // Skip headers

      const stop = parseFloat(cols[1]);
      const bungee = cols[2] !== undefined ? parseFloat(cols[2]) : 3;
      const arm = cols[3] !== undefined ? parseFloat(cols[3]) : 3;
      const pin = cols[4] !== undefined ? parseFloat(cols[4]) : 2;

      addConfigRow(
        clamp(isNaN(pull) ? 160 : pull, 90, 200),
        clamp(isNaN(stop) ? 105 : stop, 90, 120),
        clamp(isNaN(bungee) ? 3 : bungee, 1, 5),
        clamp(isNaN(arm) ? 3 : arm, 1, 5),
        clamp(isNaN(pin) ? 2 : pin, 1, 5)
      );
      importedCount++;
    }
  });
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Appends a new configuration row with bounds validation.
 */
function addConfigRow(pull = 160, stop = 105, bungee = 3, arm = 3, pin = 2) {
  rowCount++;
  const tbody = document.getElementById('config-tbody');
  const tr = document.createElement('tr');
  tr.dataset.id = rowCount;

  tr.innerHTML = `
    <td><span class="row-num-badge">#${rowCount}</span></td>
    <td><input type="number" step="1" min="90" max="200" value="${pull}" class="inp-pull" aria-label="Pull-back Angle"></td>
    <td><input type="number" step="1" min="90" max="120" value="${stop}" class="inp-stop" aria-label="Stop Angle"></td>
    <td><input type="number" step="0.5" min="1" max="5" value="${bungee}" class="inp-bungee" aria-label="Bungee Position"></td>
    <td><input type="number" step="0.5" min="1" max="5" value="${arm}" class="inp-arm" aria-label="Arm Hole"></td>
    <td><input type="number" step="0.5" min="1" max="5" value="${pin}" class="inp-pin" aria-label="Pin Elevation"></td>
    <td><button class="btn delete btn-delete-row" title="Remove Configuration">Remove</button></td>
  `;

  tbody.appendChild(tr);
  updateRowLabels();
}

/**
 * Reads and validates all input rows from the configuration table.
 */
function getAllConfigs() {
  const rows = document.querySelectorAll('#config-tbody tr');
  const configs = [];
  let hasError = false;

  rows.forEach(tr => {
    tr.classList.remove('row-error');
    const pull = parseFloat(tr.querySelector('.inp-pull').value);
    const stop = parseFloat(tr.querySelector('.inp-stop').value);
    const bungee = parseFloat(tr.querySelector('.inp-bungee').value);
    const arm = parseFloat(tr.querySelector('.inp-arm').value);
    const pin = parseFloat(tr.querySelector('.inp-pin').value);

    if ([pull, stop, bungee, arm, pin].some(isNaN)) {
      tr.classList.add('row-error');
      hasError = true;
      return;
    }

    configs.push({
      id: tr.dataset.id,
      pullBackAngle: clamp(pull, 90, 200),
      stopAngle: clamp(stop, 90, 120),
      bungeePosition: clamp(bungee, 1, 5),
      armHole: clamp(arm, 1, 5),
      pinElevation: clamp(pin, 1, 5)
    });
  });

  if (hasError) {
    alert('Some rows have empty or invalid numbers. Please correct them.');
    return null;
  }

  return configs;
}

/**
 * Executes the simulation for all configured catapult settings.
 */
function runAllAtOnce() {
  const configs = getAllConfigs();
  if (!configs || configs.length === 0) {
    if (configs && configs.length === 0) alert('Please add at least one configuration row.');
    return;
  }

  const launchBtn = document.getElementById('launch-btn');
  launchBtn.disabled = true;
  document.getElementById('results-tbody').innerHTML = ''; // Fresh results for this batch
  lastResults = [];

  const simulationRuns = [];

  configs.forEach((config, idx) => {
    const phys = calculateLaunch(
      config.pullBackAngle,
      config.stopAngle,
      config.bungeePosition,
      config.armHole,
      config.pinElevation
    );

    // Stochastic throw with realistic process variation
    let actualDistance = 0;
    if (phys.distance > 0) {
      actualDistance = Math.max(0, randomNormal(phys.distance, phys.variation));
    }

    const color = RUN_COLORS[idx % RUN_COLORS.length];
    const runData = {
      config,
      phys,
      actualDistance,
      variation: phys.variation,
      color,
      trajectoryPoints: []
    };

    simulationRuns.push(runData);
    lastResults.push(runData);
    addResultRow(runData);
  });

  // Run the unified canvas animation
  animateRuns(simulationRuns, () => {
    launchBtn.disabled = false;
  });
}

function addResultRow(run) {
  const tbody = document.getElementById('results-tbody');
  const tr = document.createElement('tr');
  const c = run.config;
  
  tr.innerHTML = `
    <td>
      <span class="color-dot" style="background-color: ${run.color}; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px;"></span>
      <strong>Config #${c.id}</strong>
    </td>
    <td>${c.pullBackAngle}&deg;</td>
    <td>${c.stopAngle}&deg;</td>
    <td>${c.bungeePosition}</td>
    <td>${c.armHole}</td>
    <td>${c.pinElevation}</td>
    <td class="result-dist">${run.actualDistance.toFixed(2)} m</td>
    <td class="result-var">&plusmn; ${run.variation.toFixed(3)} m</td>
    <td>${run.phys.releaseVelocity.toFixed(1)} m/s</td>
  `;
  tbody.appendChild(tr);
}

/**
 * Synchronized multi-projectile ballistic animation.
 */
function animateRuns(runs, onComplete) {
  let startTime = null;
  const swingDurationMs = 450;
  const flightDurationMs = 1600;

  // Use the primary configuration for the physical arm animation
  const masterRun = runs[0];
  const maxPull = Math.max(...runs.map(r => r.config.pullBackAngle));
  const avgStop = runs.reduce((acc, r) => acc + r.phys.effectiveStopAngle, 0) / runs.length;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    renderer.clear();
    renderer.drawBase(avgStop);

    if (elapsed < swingDurationMs) {
      // 1. Arm Swing Phase
      const progress = elapsed / swingDurationMs;
      // Ease-in swing acceleration
      const ease = Math.pow(progress, 2.5);
      const currentAngle = maxPull - (maxPull - avgStop) * ease;
      
      renderer.drawArm(currentAngle, masterRun.config.armHole, true);
      requestAnimationFrame(step);
    } else {
      // 2. Flight & Impact Phase
      renderer.drawArm(avgStop, masterRun.config.armHole, false);
      const flightElapsed = elapsed - swingDurationMs;
      const progress = Math.min(1.0, flightElapsed / flightDurationMs);

      // Render each projectile's ballistic trajectory
      runs.forEach(run => {
        if (run.actualDistance <= 0) return;

        const startX = run.phys.startX;
        const startY = run.phys.startY;
        const targetX = startX + run.actualDistance;

        // Current horizontal position
        const curX = startX + (targetX - startX) * progress;
        
        // Exact parabolic arc calibrated from release height (startY) to ground (0)
        // y(t) = startY + (4*peakHeight - startY)*(t/T) - 4*peakHeight*(t/T)^2
        const peakHeight = Math.max(startY + 0.3, run.actualDistance * 0.28);
        const curY = Math.max(0, startY * (1 - progress) + 4 * peakHeight * progress * (1 - progress));

        if (progress < 1.0) {
          run.trajectoryPoints.push({ x: curX, y: curY });
          renderer.drawProjectile(curX, curY, run.color);
        } else {
          // Final landing position
          if (!run.landed) {
            run.trajectoryPoints.push({ x: targetX, y: 0 });
            run.landed = true;
          }
          renderer.drawProjectile(targetX, 0, run.color);
        }

        // Draw trajectory trail
        renderer.drawTrajectory(run.trajectoryPoints, run.color);

        // Draw landing marker flag once grounded
        if (progress >= 1.0) {
          renderer.drawLandingMarker(targetX, `C${run.config.id}`, run.color);
        }
      });

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        if (onComplete) onComplete();
      }
    }
  }

  requestAnimationFrame(step);
}

/**
 * Exports current simulation results as a CSV file.
 */
function exportResultsToCSV() {
  if (!lastResults || lastResults.length === 0) {
    alert('No results available to export. Please run a simulation first.');
    return;
  }

  const headers = ['Config_ID', 'Pull_Angle_deg', 'Stop_Angle_deg', 'Bungee_Pos', 'Arm_Hole', 'Pin_Elevation', 'Distance_m', 'Variation_m', 'Release_Velocity_mps'];
  const rows = lastResults.map(r => [
    r.config.id,
    r.config.pullBackAngle,
    r.config.stopAngle,
    r.config.bungeePosition,
    r.config.armHole,
    r.config.pinElevation,
    r.actualDistance.toFixed(3),
    r.variation.toFixed(3),
    r.phys.releaseVelocity.toFixed(2)
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catapult_simulation_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies results in tab-separated format for quick pasting into Excel or Minitab.
 */
function copyResultsToClipboard() {
  if (!lastResults || lastResults.length === 0) {
    alert('No results to copy. Please run a simulation first.');
    return;
  }

  const headers = ['Config_ID', 'Pull_Angle', 'Stop_Angle', 'Bungee', 'Arm_Hole', 'Pin_Elevation', 'Distance_m', 'Variation_m', 'Velocity_mps'];
  const rows = lastResults.map(r => [
    r.config.id,
    r.config.pullBackAngle,
    r.config.stopAngle,
    r.config.bungeePosition,
    r.config.armHole,
    r.config.pinElevation,
    r.actualDistance.toFixed(3),
    r.variation.toFixed(3),
    r.phys.releaseVelocity.toFixed(2)
  ]);

  const text = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
  navigator.clipboard.writeText(text)
    .then(() => alert('Results copied to clipboard (Tab-separated for Excel / Minitab)!'))
    .catch(() => alert('Failed to copy to clipboard.'));
}

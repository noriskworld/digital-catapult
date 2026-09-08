import './style.css';
import { calculateLaunch, randomNormal, trajectoryAt, apexHeight } from './physics.js';
import { CatapultRenderer } from './animation.js';
import { FACTOR_BOUNDS, clamp } from './constants.js';

const RUN_COLORS = [
  '#ef4444', '#38bdf8', '#10b981', '#f59e0b',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316'
];

/** Wall-clock length of the arm swing, before release. */
const SWING_MS = 450;
/** Real seconds of flight are stretched by this factor so the arc is watchable. */
const FLIGHT_TIME_SCALE = 1.6;
/** Beyond this many shots in one batch, only the first replicate is animated. */
const MAX_ANIMATED_SHOTS = 24;

let renderer;
let configSeq = 0;
let batchSeq = 0;
/**
 * The finished batch currently shown in the arena, or null for the idle
 * preview. Held so a resize can repaint the same scene instead of wiping it.
 */
let arenaBatch = null;
/** Every shot recorded since the last "Clear Results" - this is the export set. */
let collectedShots = [];

document.addEventListener('DOMContentLoaded', () => {
  renderer = new CatapultRenderer('sim-canvas');
  showPreview();

  document.getElementById('add-row-btn').addEventListener('click', () => addConfigRow());
  document.getElementById('clear-table-btn').addEventListener('click', clearConfigTable);
  document.getElementById('launch-btn').addEventListener('click', runBatch);
  document.getElementById('export-csv-btn')?.addEventListener('click', exportResultsToCSV);
  document.getElementById('copy-results-btn')?.addEventListener('click', copyResultsToClipboard);
  document.getElementById('clear-results-btn')?.addEventListener('click', clearResultsTable);

  const guideToggle = document.getElementById('guide-toggle-btn');
  const guideContent = document.getElementById('guide-content');
  guideToggle?.addEventListener('click', () => {
    const isHidden = guideContent.classList.toggle('hidden');
    guideToggle.textContent = isHidden ? 'Show DOE & User Guide' : 'Hide DOE & User Guide';
  });

  document.getElementById('config-tbody').addEventListener('click', (e) => {
    if (e.target.closest('.btn-delete-row')) {
      e.target.closest('tr').remove();
      renumberConfigRows();
      showPreview();
    }
  });

  // Editing a factor returns the arena to a live preview of the new settings.
  document.getElementById('config-tbody').addEventListener('input', showPreview);

  document.querySelector('.config-panel')?.addEventListener('paste', handleTablePaste);

  // Keep the arena crisp through resizes without discarding the last batch.
  window.addEventListener('resize', () => {
    renderer.syncBackingStore();
    redrawArena();
  });

  // Three starting configurations spanning the factor space.
  addConfigRow(180, 100, 3, 3, 2);
  addConfigRow(150, 110, 2, 2, 1);
  addConfigRow(120, 95, 1, 1, 3);
});

/* -------------------------------------------------------------- status bar */

/**
 * Shows a transient message in the status bar. Replaces the old alert() calls,
 * which blocked the animation loop and could not be styled.
 *
 * @param {string} message
 * @param {'info'|'success'|'error'} [tone='info']
 */
function setStatus(message, tone = 'info') {
  const el = document.getElementById('status-bar');
  if (!el) return;
  el.textContent = message;
  el.className = `status-bar status-${tone}`;
  el.hidden = !message;
}

/* ------------------------------------------------------- configuration table */

/**
 * Repaints the arena from scratch: either the last finished batch, or the idle
 * preview of the first configuration. Every path that touches the canvas goes
 * through here, so a resize can never lose what was on screen.
 */
function redrawArena() {
  if (arenaBatch) {
    drawBatchResult(arenaBatch);
    return;
  }

  const first = (readConfigs({ silent: true }) ?? [])[0];
  renderer.resetScale();
  renderer.clear();

  if (!first) {
    renderer.drawBase(105);
    renderer.drawArm(140, 3, true);
    return;
  }

  const launch = calculateLaunch(
    first.pullBackAngle, first.stopAngle, first.bungeePosition,
    first.armHole, first.pinElevation
  );
  renderer.drawBase(launch.effectiveStopAngle);
  renderer.drawArm(first.pullBackAngle, first.armHole, true);
}

/** Drops any finished batch and shows the live configuration preview. */
function showPreview() {
  arenaBatch = null;
  redrawArena();
}

/**
 * Paints a batch at rest: every trajectory complete, every shot on its mark.
 * Also the fallback when the frame loop cannot run.
 *
 * @param {{shots: Array<object>, stopAngle: number, armHole: number}} batch
 */
function drawBatchResult(batch) {
  const { shots, stopAngle, armHole } = batch;

  renderer.fitToRange(
    Math.max(1, ...shots.map(s => s.distance)),
    Math.max(1, ...shots.map(s => apexHeight(s.launch)))
  );
  renderer.clear();
  renderer.drawBase(stopAngle);
  renderer.drawArm(stopAngle, armHole, false);

  shots.forEach((shot, i) => {
    const arc = [];
    for (let step = 0; step <= 60; step++) {
      arc.push(trajectoryAt(shot.launch, (step / 60) * shot.launch.flightTime, shot.rangeScale));
    }
    renderer.drawTrajectory(arc, shot.color);
    renderer.drawProjectile(shot.distance, 0, shot.color);
    renderer.drawLandingMarker(
      shot.distance, `#${shot.config.id}`, shot.color,
      shot.rep === 1 ? 0 : (i % 3) + 1
    );
  });
}

function renumberConfigRows() {
  document.querySelectorAll('#config-tbody tr').forEach((tr, index) => {
    tr.dataset.id = index + 1;
    const badge = tr.querySelector('.row-num-badge');
    if (badge) badge.textContent = `#${index + 1}`;
  });
  configSeq = document.querySelectorAll('#config-tbody tr').length;
}

function clearConfigTable() {
  document.getElementById('config-tbody').innerHTML = '';
  configSeq = 0;
  showPreview();
  setStatus('Configuration table cleared.', 'info');
}

function clearResultsTable() {
  document.getElementById('results-tbody').innerHTML = '';
  collectedShots = [];
  batchSeq = 0;
  showPreview();
  setStatus('Results cleared.', 'info');
}

/**
 * Builds one configuration row. Input bounds come from FACTOR_BOUNDS so the
 * markup, the paste importer and the solver can never disagree.
 */
function addConfigRow(
  pull = FACTOR_BOUNDS.pullBackAngle.default,
  stop = FACTOR_BOUNDS.stopAngle.default,
  bungee = FACTOR_BOUNDS.bungeePosition.default,
  arm = FACTOR_BOUNDS.armHole.default,
  pin = FACTOR_BOUNDS.pinElevation.default
) {
  configSeq++;
  const tr = document.createElement('tr');
  tr.dataset.id = configSeq;

  const cell = (key, value, cls, label) => {
    const b = FACTOR_BOUNDS[key];
    return `<td><input type="number" step="${b.step}" min="${b.min}" max="${b.max}"
      value="${value}" class="${cls}" aria-label="${label}"></td>`;
  };

  tr.innerHTML = `
    <td><span class="row-num-badge">#${configSeq}</span></td>
    ${cell('pullBackAngle', pull, 'inp-pull', 'Pull-back Angle')}
    ${cell('stopAngle', stop, 'inp-stop', 'Stop Angle')}
    ${cell('bungeePosition', bungee, 'inp-bungee', 'Bungee Position')}
    ${cell('armHole', arm, 'inp-arm', 'Arm Hole')}
    ${cell('pinElevation', pin, 'inp-pin', 'Pin Elevation')}
    <td><button class="btn delete btn-delete-row" title="Remove Configuration">Remove</button></td>
  `;

  document.getElementById('config-tbody').appendChild(tr);
  renumberConfigRows();
}

/**
 * Pastes a TSV (Excel, Sheets) or CSV block into the configuration table.
 * Header rows are skipped by detecting a non-numeric first column.
 */
function handleTablePaste(e) {
  const pasteData = e.clipboardData?.getData('text');
  if (!pasteData) return;

  const lines = pasteData.trim().split(/\r?\n/);
  // A single plain value is an ordinary paste into the focused input.
  if (lines.length === 1 && !/[\t,]/.test(lines[0])) return;

  e.preventDefault();

  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    const delimiter = line.includes('\t') ? '\t' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const values = cols.slice(0, 5).map(Number);
    if (!Number.isFinite(values[0]) || !Number.isFinite(values[1])) {
      skipped++;
      continue;
    }

    const pick = (i, key) => {
      const b = FACTOR_BOUNDS[key];
      return clamp(Number.isFinite(values[i]) ? values[i] : b.default, b.min, b.max);
    };

    addConfigRow(
      pick(0, 'pullBackAngle'),
      pick(1, 'stopAngle'),
      pick(2, 'bungeePosition'),
      pick(3, 'armHole'),
      pick(4, 'pinElevation')
    );
    imported++;
  }

  showPreview();
  setStatus(
    imported
      ? `Imported ${imported} configuration${imported === 1 ? '' : 's'}` +
        `${skipped ? ` (${skipped} non-numeric row${skipped === 1 ? '' : 's'} skipped)` : ''}.`
      : 'Nothing imported - no numeric rows found in the pasted data.',
    imported ? 'success' : 'error'
  );
}

/**
 * Reads every configuration row, clamping values into their valid ranges and
 * reporting rows that cannot be parsed at all.
 *
 * @param {{silent?: boolean}} [options]
 * @returns {Array<object>|null} null when a row is unparseable
 */
function readConfigs({ silent = false } = {}) {
  const rows = [...document.querySelectorAll('#config-tbody tr')];
  const configs = [];
  let invalid = 0;
  let clamped = 0;

  for (const tr of rows) {
    tr.classList.remove('row-error');
    const raw = {
      pullBackAngle: parseFloat(tr.querySelector('.inp-pull').value),
      stopAngle: parseFloat(tr.querySelector('.inp-stop').value),
      bungeePosition: parseFloat(tr.querySelector('.inp-bungee').value),
      armHole: parseFloat(tr.querySelector('.inp-arm').value),
      pinElevation: parseFloat(tr.querySelector('.inp-pin').value)
    };

    if (Object.values(raw).some(v => !Number.isFinite(v))) {
      tr.classList.add('row-error');
      invalid++;
      continue;
    }

    const config = { id: tr.dataset.id };
    for (const [key, value] of Object.entries(raw)) {
      const b = FACTOR_BOUNDS[key];
      const bounded = clamp(value, b.min, b.max);
      // Write the clamped value back so the table shows what was actually run.
      if (bounded !== value) clamped++;
      config[key] = bounded;
    }
    configs.push(config);
  }

  if (invalid) {
    if (!silent) {
      setStatus(`${invalid} row${invalid === 1 ? ' has' : 's have'} a missing or non-numeric value. Highlighted rows were not run.`, 'error');
    }
    return null;
  }
  if (clamped && !silent) {
    setStatus(`${clamped} value${clamped === 1 ? ' was' : 's were'} outside its valid range and has been clamped.`, 'info');
  }

  return configs;
}

/* ----------------------------------------------------------------- the run */

/**
 * Solves every configuration, fires the requested number of replicates, and
 * hands the shots to the animator. Results accumulate across batches so a full
 * DOE with replication can be built up and exported in one go.
 */
function runBatch() {
  const configs = readConfigs();
  if (!configs) return;
  if (configs.length === 0) {
    setStatus('Add at least one configuration before running.', 'error');
    return;
  }

  const repInput = document.getElementById('replicates-input');
  const replicates = clamp(parseInt(repInput?.value, 10) || 1, 1, 30);
  if (repInput) repInput.value = replicates;

  const launchBtn = document.getElementById('launch-btn');
  launchBtn.disabled = true;
  arenaBatch = null;
  batchSeq++;

  const shots = [];
  let duds = 0;

  configs.forEach((config, idx) => {
    const launch = calculateLaunch(
      config.pullBackAngle, config.stopAngle, config.bungeePosition,
      config.armHole, config.pinElevation
    );
    if (!launch.valid) duds++;

    for (let rep = 1; rep <= replicates; rep++) {
      // The realised shot: nominal range perturbed by the process noise.
      const distance = launch.valid
        ? Math.max(0, randomNormal(launch.distance, launch.variation))
        : 0;

      shots.push({
        batch: batchSeq,
        rep,
        config,
        launch,
        distance,
        color: RUN_COLORS[idx % RUN_COLORS.length],
        // Stretches the parabola so a noisy shot still lands on its own mark.
        rangeScale: launch.distance > 0
          ? (distance - launch.releaseX) / (launch.distance - launch.releaseX)
          : 1,
        trail: []
      });
    }
  });

  collectedShots.push(...shots);
  shots.forEach(appendResultRow);

  const message = duds
    ? `Fired ${shots.length} shot${shots.length === 1 ? '' : 's'}. ${duds} configuration${duds === 1 ? '' : 's'} did not launch - check that pull-back clears the effective stop angle.`
    : `Fired ${shots.length} shot${shots.length === 1 ? '' : 's'} across ${configs.length} configuration${configs.length === 1 ? '' : 's'}.`;
  setStatus(message, duds ? 'error' : 'success');

  animateShots(shots, () => { launchBtn.disabled = false; });
}

function appendResultRow(shot) {
  const c = shot.config;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <span class="color-dot" style="background-color:${shot.color}"></span>
      <strong>#${c.id}</strong><span class="rep-tag">b${shot.batch}·r${shot.rep}</span>
    </td>
    <td>${c.pullBackAngle}&deg;</td>
    <td>${c.stopAngle}&deg;</td>
    <td>${c.bungeePosition}</td>
    <td>${c.armHole}</td>
    <td>${c.pinElevation}</td>
    <td class="result-dist">${shot.distance.toFixed(2)} m</td>
    <td class="result-var">&plusmn; ${shot.launch.variation.toFixed(3)} m</td>
    <td>${shot.launch.releaseVelocity.toFixed(1)} m/s</td>
  `;
  document.getElementById('results-tbody').appendChild(tr);
}

/**
 * Animates a batch. The arm swing is a shared visual approximation, but each
 * projectile follows its own true ballistic arc from physics.js, sampled in
 * simulated seconds and merely slowed down for viewing.
 *
 * @param {Array<object>} shots
 * @param {() => void} onComplete
 */
function animateShots(shots, onComplete) {
  const live = shots.filter(s => s.distance > 0);
  // Beyond the cap, animate one shot per configuration to keep the arena legible.
  const animated = live.length > MAX_ANIMATED_SHOTS ? live.filter(s => s.rep === 1) : live;

  const stopAngle = shots.length
    ? shots.reduce((sum, s) => sum + s.launch.effectiveStopAngle, 0) / shots.length
    : 105;
  const armHole = shots[0]?.config.armHole ?? 3;

  if (animated.length === 0) {
    showPreview();
    onComplete();
    return;
  }

  const batch = { shots: animated, stopAngle, armHole };
  let finished = false;

  /** Idempotent: whichever of the frame loop and the watchdog arrives first wins. */
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    // Hand the batch to the arena so a later resize repaints it rather than
    // falling back to the idle preview.
    arenaBatch = batch;
    redrawArena();
    onComplete();
  }

  renderer.fitToRange(
    Math.max(1, ...animated.map(s => s.distance)),
    Math.max(1, ...animated.map(s => apexHeight(s.launch)))
  );

  const startAngle = Math.max(...animated.map(s => s.config.pullBackAngle));
  const flightMs = Math.max(...animated.map(s => s.launch.flightTime)) * 1000 * FLIGHT_TIME_SCALE;

  // requestAnimationFrame is throttled to a standstill in background tabs and
  // barely runs in some headless contexts. Without this watchdog the arena
  // would be left mid-flight and the Run button disabled indefinitely.
  const watchdog = setTimeout(finish, SWING_MS + flightMs + 1500);

  let startTime = null;

  function frame(timestamp) {
    if (finished) return;
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;

    renderer.clear();
    renderer.drawBase(stopAngle);

    if (elapsed < SWING_MS) {
      // Accelerating swing: the band does most of its work late.
      const progress = (elapsed / SWING_MS) ** 2.5;
      renderer.drawArm(startAngle - (startAngle - stopAngle) * progress, armHole, true);
      requestAnimationFrame(frame);
      return;
    }

    renderer.drawArm(stopAngle, armHole, false);

    // Simulated seconds since release, slowed by FLIGHT_TIME_SCALE for viewing.
    const simTime = (elapsed - SWING_MS) / (1000 * FLIGHT_TIME_SCALE);
    let allLanded = true;

    animated.forEach((shot, i) => {
      const landed = simTime >= shot.launch.flightTime;
      const point = trajectoryAt(shot.launch, landed ? shot.launch.flightTime : simTime, shot.rangeScale);

      shot.trail.push(point);
      renderer.drawTrajectory(shot.trail, shot.color);
      renderer.drawProjectile(point.x, point.y, shot.color);

      if (landed) {
        renderer.drawLandingMarker(
          shot.distance, `#${shot.config.id}`, shot.color,
          shot.rep === 1 ? 0 : (i % 3) + 1
        );
      } else {
        allLanded = false;
      }
    });

    if (allLanded) finish();
    else requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------- data export */

const EXPORT_HEADERS = [
  'Batch', 'Config_ID', 'Replicate',
  'Pull_Angle_deg', 'Stop_Angle_deg', 'Bungee_Pos', 'Arm_Hole', 'Pin_Elevation',
  'Distance_m', 'Model_Sigma_m', 'Release_Velocity_mps', 'Launch_Angle_deg'
];

/** One export row per recorded shot - raw data, ready for Minitab or JMP. */
function exportRows() {
  return collectedShots.map(s => [
    s.batch, s.config.id, s.rep,
    s.config.pullBackAngle, s.config.stopAngle, s.config.bungeePosition,
    s.config.armHole, s.config.pinElevation,
    s.distance.toFixed(3), s.launch.variation.toFixed(3),
    s.launch.releaseVelocity.toFixed(2), s.launch.launchAngleDeg.toFixed(2)
  ]);
}

function exportResultsToCSV() {
  if (collectedShots.length === 0) {
    setStatus('No results to export - run a batch first.', 'error');
    return;
  }

  const csv = [EXPORT_HEADERS.join(','), ...exportRows().map(r => r.join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `catapult_doe_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${collectedShots.length} shots to CSV.`, 'success');
}

function copyResultsToClipboard() {
  if (collectedShots.length === 0) {
    setStatus('No results to copy - run a batch first.', 'error');
    return;
  }

  const tsv = [EXPORT_HEADERS.join('\t'), ...exportRows().map(r => r.join('\t'))].join('\n');
  navigator.clipboard.writeText(tsv)
    .then(() => setStatus(`Copied ${collectedShots.length} shots (tab-separated) to the clipboard.`, 'success'))
    .catch(() => setStatus('Clipboard access was refused by the browser.', 'error'));
}

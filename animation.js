/**
 * Canvas renderer for the catapult arena.
 *
 * Everything this class draws is expressed in the shared physical coordinate
 * system (metres from the pivot, +y up) and converted to pixels in one place,
 * so the machine, the ruler and the trajectories are always to the same scale.
 */

import {
  ARM_LENGTH,
  BAND_ANCHOR,
  BAND_ATTACH_RATIO,
  cupRadius
} from './constants.js';

const PIVOT_MARGIN_PX = 90;   // pixels between the left edge and the pivot
const GROUND_MARGIN_PX = 60;  // pixels between the ground line and the bottom edge
const MIN_SCALE = 3;          // px per metre; floor for very long shots
const MAX_SCALE = 80;         // px per metre; ceiling so short shots stay readable
const DEFAULT_SCALE = 26;     // px per metre used for the idle preview

export class CatapultRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.scale = DEFAULT_SCALE;
    this.syncBackingStore();
  }

  /**
   * Matches the canvas backing store to its CSS size and the device pixel
   * ratio, so the arena stays sharp on retina displays and after a resize.
   */
  syncBackingStore() {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    // Before layout runs, fall back to the element's attribute size.
    this.width = Math.round(rect.width) || this.canvas.width;
    this.height = Math.round(rect.height) || this.canvas.height;

    this.canvas.width = this.width * ratio;
    this.canvas.height = this.height * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.originX = PIVOT_MARGIN_PX;
    this.originY = this.height - GROUND_MARGIN_PX;
  }

  /** Visible downrange distance at the current scale, in metres. */
  get visibleRange() {
    return (this.width - this.originX - 12) / this.scale;
  }

  /**
   * Scales the view so the whole batch fits, downrange and overhead. It zooms
   * in on short shots as well as out on long ones, so the arena is never mostly
   * empty - the canvas is fluid width, so a fixed px-per-metre cannot work.
   *
   * @param {number} maxRangeM - furthest landing point, metres from the pivot
   * @param {number} maxApexM - highest point of any trajectory, metres
   */
  fitToRange(maxRangeM, maxApexM = 0) {
    // Padding leaves room for the landing flag and its label.
    const horizontal = (this.width - this.originX - 40) / Math.max(0.5, maxRangeM + 1);
    const vertical = (this.originY - 30) / Math.max(0.5, maxApexM + 0.5);
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, horizontal, vertical));
  }

  /** Restores the idle preview scale. */
  resetScale() {
    this.scale = DEFAULT_SCALE;
  }

  /** Metres from the pivot -> canvas x. */
  toPx(xMeters) {
    return this.originX + xMeters * this.scale;
  }

  /** Metres above the ground -> canvas y. */
  toPy(yMeters) {
    return this.originY - yMeters * this.scale;
  }

  /** Clears the canvas and redraws sky, ground and the metric ruler. */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.originY);
    skyGrad.addColorStop(0, '#0b1329');
    skyGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.originY);

    const groundGrad = this.ctx.createLinearGradient(0, this.originY, 0, this.height);
    groundGrad.addColorStop(0, '#1e293b');
    groundGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, this.originY, this.width, this.height - this.originY);

    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.originY);
    this.ctx.lineTo(this.width, this.originY);
    this.ctx.stroke();

    this.drawGroundRuler();
  }

  /**
   * Draws the ground ruler. Tick spacing adapts to the current scale so the
   * labels stay legible when the view is zoomed out for a long shot.
   */
  drawGroundRuler() {
    // Aim for a labelled tick roughly every 90 px, from a set of round numbers.
    const labelStep = [1, 2, 5, 10, 20, 50, 100].find(s => s * this.scale >= 90) ?? 200;
    const divisions = 5;
    const minorPx = (labelStep * this.scale) / divisions;
    const lastTick = Math.ceil(this.visibleRange / labelStep) * divisions;

    this.ctx.textAlign = 'center';
    this.ctx.font = '10px Inter, system-ui, sans-serif';

    // Step over integer tick indices rather than accumulating a float, so the
    // labels stay exact (0.4 summed ten times is not 4).
    for (let i = 0; i <= lastTick; i++) {
      const px = this.originX + i * minorPx;
      if (px > this.width - 10) break;

      if (i % divisions === 0) {
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(px, this.originY);
        this.ctx.lineTo(px, this.originY + 12);
        this.ctx.stroke();

        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.fillText(`${(i / divisions) * labelStep}m`, px, this.originY + 25);
      } else {
        this.ctx.strokeStyle = '#475569';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(px, this.originY);
        this.ctx.lineTo(px, this.originY + 6);
        this.ctx.stroke();
      }
    }
  }

  /**
   * Draws the frame, the band anchor post and the stop-pin indicator.
   *
   * @param {number} stopAngleDeg - effective stop angle, for the stop indicator
   */
  drawBase(stopAngleDeg = 105) {
    const ctx = this.ctx;
    const armPx = ARM_LENGTH * this.scale;
    const anchorX = BAND_ANCHOR.x * this.scale;
    const anchorY = -BAND_ANCHOR.y * this.scale;

    ctx.save();
    ctx.translate(this.originX, this.originY);

    // Base plate, sized from the arm so the frame stays in proportion.
    const plateHalf = armPx * 0.35;
    ctx.fillStyle = '#334155';
    ctx.fillRect(-plateHalf, 0, plateHalf * 2, 10);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(-plateHalf, 0, plateHalf * 2, 10);

    // Forward upright carrying the band anchor.
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(plateHalf * 0.45, 0);
    ctx.lineTo(anchorX, anchorY);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Stop position, drawn as a dashed ray from the pivot.
    const stopRad = stopAngleDeg * (Math.PI / 180);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(armPx * 0.7 * Math.cos(stopRad), -armPx * 0.7 * Math.sin(stopRad));
    ctx.stroke();
    ctx.setLineDash([]);

    // Pivot hub.
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws the arm at its true physical length, with the band stretched from the
   * anchor to its attachment point.
   *
   * @param {number} angleDeg - arm angle (90 = up, 180 = horizontal back)
   * @param {number} armHole - cup setting, 1-5
   * @param {boolean} showProjectileInCup
   */
  drawArm(angleDeg, armHole = 3, showProjectileInCup = false) {
    const ctx = this.ctx;
    const angleRad = angleDeg * (Math.PI / 180);
    const armPx = ARM_LENGTH * this.scale;
    const cupDistPx = cupRadius(armHole) * this.scale;
    const attachPx = ARM_LENGTH * BAND_ATTACH_RATIO * this.scale;

    ctx.save();
    ctx.translate(this.originX, this.originY);

    // Band: anchor -> attachment point on the arm, in unrotated coordinates.
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(BAND_ANCHOR.x * this.scale, -BAND_ANCHOR.y * this.scale);
    ctx.lineTo(attachPx * Math.cos(angleRad), -attachPx * Math.sin(angleRad));
    ctx.stroke();

    // Canvas y is inverted, so a positive maths angle is a negative rotation.
    ctx.rotate(-angleRad);

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(armPx, 0);
    ctx.stroke();

    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(attachPx, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cupDistPx, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (showProjectileInCup) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cupDistPx, -1, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * @param {number} x - metres from the pivot
   * @param {number} y - metres above the ground
   * @param {string} color
   */
  drawProjectile(x, y, color = '#ef4444') {
    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(this.toPx(x), this.toPy(y), 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  /**
   * @param {Array<{x: number, y: number}>} points - metres
   * @param {string} color
   */
  drawTrajectory(points, color = '#ef4444') {
    if (!points || points.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    points.forEach((pt, i) => {
      const px = this.toPx(pt.x);
      const py = this.toPy(pt.y);
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    });
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Landing flag at the impact point.
   *
   * @param {number} x - metres from the pivot
   * @param {string} label
   * @param {string} color
   * @param {number} stackIndex - lifts the flag to avoid overlapping neighbours
   */
  drawLandingMarker(x, label, color, stackIndex = 0) {
    const ctx = this.ctx;
    const px = this.toPx(x);
    const py = this.originY;
    const poleHeight = 20 + stackIndex * 15;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - poleHeight);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillRect(px, py - poleHeight - 4, 22, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + 11, py - poleHeight + 2);
    ctx.restore();
  }
}

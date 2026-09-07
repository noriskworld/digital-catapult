/**
 * Catapult visual renderer and canvas animator.
 * Draws physical components (frame, pivot, arm, cup, stretched band),
 * ground with metric distance ruler, projectile trajectories, and landing markers.
 */

export class CatapultRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    // Origin mapping (catapult pivot point in canvas coordinates)
    this.originX = 110;
    this.originY = this.height - 65;
    
    // Physical scale: pixels per meter
    this.scale = 26;
    
    // Arm visual length in pixels (corresponds to ~1.0m arm + cup)
    this.armLengthPx = 55;
  }

  /**
   * Clears canvas and redraws the background, ground, and graduated metric ruler.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Sky / arena background gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.originY);
    skyGrad.addColorStop(0, '#0b1329');
    skyGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.originY);

    // Ground block
    const groundGrad = this.ctx.createLinearGradient(0, this.originY, 0, this.height);
    groundGrad.addColorStop(0, '#1e293b');
    groundGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, this.originY, this.width, this.height - this.originY);

    // Ground surface line
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.originY);
    this.ctx.lineTo(this.width, this.originY);
    this.ctx.stroke();

    // Draw graduated metric distance ruler
    this.drawGroundRuler();
  }

  /**
   * Draws metric distance tick marks and numerical labels along the ground.
   */
  drawGroundRuler() {
    const maxMeters = Math.ceil((this.width - this.originX) / this.scale);
    
    this.ctx.textAlign = 'center';
    this.ctx.font = '10px Inter, system-ui, sans-serif';

    for (let m = 0; m <= maxMeters; m++) {
      const px = this.originX + m * this.scale;
      if (px > this.width - 10) break;

      const isMajor = m % 5 === 0;
      const isMinor = m % 1 === 0;

      if (isMajor) {
        // Major 5m tick
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(px, this.originY);
        this.ctx.lineTo(px, this.originY + 12);
        this.ctx.stroke();

        this.ctx.fillStyle = '#cbd5e1';
        this.ctx.fillText(`${m}m`, px, this.originY + 25);
      } else if (isMinor) {
        // Minor 1m tick
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
   * Draws the mechanical base frame, stop pin upright, and band anchor.
   * @param {number} stopAngle - Stop angle in degrees (for stop block visual)
   */
  drawBase(stopAngle = 105) {
    this.ctx.save();
    this.ctx.translate(this.originX, this.originY);

    // Base plate
    this.ctx.fillStyle = '#334155';
    this.ctx.fillRect(-35, 0, 70, 10);
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(-35, 0, 70, 10);

    // Upright A-frame supports
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(-20, 0);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(15, 0);
    this.ctx.stroke();

    // Forward upright for rubber band anchor & stop pin
    const anchorCanvasX = 0.25 * this.scale;
    const anchorCanvasY = -0.35 * this.scale;
    
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(15, 0);
    this.ctx.lineTo(anchorCanvasX, anchorCanvasY);
    this.ctx.stroke();

    // Rubber band anchor post
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.arc(anchorCanvasX, anchorCanvasY, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Stop post visualization
    const stopRad = stopAngle * (Math.PI / 180);
    const stopPostLen = 35;
    const stopX = stopPostLen * Math.cos(stopRad);
    const stopY = -stopPostLen * Math.sin(stopRad);
    
    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([2, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(stopX, stopY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Central Pivot hub
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#e2e8f0';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Draws the swinging arm, dynamic rubber band tension line, and projectile cup.
   * @param {number} angleDeg - Current arm angle (90 = up, 180 = horizontal left)
   * @param {number} armHole - Cup placement index (1 - 5)
   * @param {boolean} showProjectileInCup - Whether to render a ball sitting in the cup
   */
  drawArm(angleDeg, armHole = 3, showProjectileInCup = false) {
    const angleRad = angleDeg * (Math.PI / 180);
    const cupPlacement = 0.5 + (armHole * 0.1); // 0.6 to 1.0
    const cupDistPx = this.armLengthPx * cupPlacement;

    this.ctx.save();
    this.ctx.translate(this.originX, this.originY);

    // Calculate band attachment point on arm
    const attachDistPx = this.armLengthPx * 0.4;
    const attachX = attachDistPx * Math.cos(angleRad);
    const attachY = -attachDistPx * Math.sin(angleRad);

    // Anchor position in canvas relative coords
    const anchorCanvasX = 0.25 * this.scale;
    const anchorCanvasY = -0.35 * this.scale;

    // Draw dynamic rubber band
    this.ctx.strokeStyle = '#f97316';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.moveTo(anchorCanvasX, anchorCanvasY);
    this.ctx.lineTo(attachX, attachY);
    this.ctx.stroke();

    // Rotate context to arm angle (counter-clockwise for positive degrees from +X)
    this.ctx.rotate(-angleRad);

    // Arm beam
    this.ctx.strokeStyle = '#6366f1';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(this.armLengthPx, 0);
    this.ctx.stroke();

    // Arm pin attachment ring
    this.ctx.fillStyle = '#a855f7';
    this.ctx.beginPath();
    this.ctx.arc(attachDistPx, 0, 3.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Cup
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.beginPath();
    this.ctx.arc(cupDistPx, 0, 7, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#d97706';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Optional ball in cup
    if (showProjectileInCup) {
      this.ctx.fillStyle = '#ef4444';
      this.ctx.beginPath();
      this.ctx.arc(cupDistPx, -1, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  /**
   * Draws a flying projectile at specified physical meter coordinates.
   * @param {number} x - meters relative to pivot
   * @param {number} y - meters above ground
   * @param {string} color - CSS color
   */
  drawProjectile(x, y, color = '#ef4444') {
    const px = this.originX + x * this.scale;
    const py = this.originY - y * this.scale;

    this.ctx.save();
    // Subtle glow
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(px, py, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  /**
   * Draws the completed or in-progress trajectory arc.
   * @param {Array<{x: number, y: number}>} points 
   * @param {string} color 
   */
  drawTrajectory(points, color = 'rgba(239, 68, 68, 0.6)') {
    if (!points || points.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    points.forEach((pt, i) => {
      const px = this.originX + pt.x * this.scale;
      const py = this.originY - pt.y * this.scale;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    });
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Draws a landing pin marker with the configuration ID at impact point.
   * @param {number} x - Landing x coordinate in meters
   * @param {string} label - Configuration label (e.g. "C1")
   * @param {string} color - Marker color
   */
  drawLandingMarker(x, label, color) {
    const px = this.originX + x * this.scale;
    const py = this.originY;

    this.ctx.save();
    // Landing point circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(px, py, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Marker flag pin line
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(px, py);
    this.ctx.lineTo(px, py - 20);
    this.ctx.stroke();

    // Flag banner
    this.ctx.fillStyle = color;
    this.ctx.fillRect(px, py - 24, 22, 12);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 9px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, px + 11, py - 18);
    this.ctx.restore();
  }
}

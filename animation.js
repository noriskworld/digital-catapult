/**
 * Handles canvas animation of the catapult
 */

export class CatapultRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    // Origin mapping (pivot point)
    this.originX = 150;
    this.originY = this.height - 50;
    this.scale = 20; // pixels per meter
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    // Draw ground
    this.ctx.fillStyle = '#334155';
    this.ctx.fillRect(0, this.originY, this.width, this.height - this.originY);
  }

  drawBase() {
    this.ctx.fillStyle = '#475569';
    this.ctx.fillRect(this.originX - 30, this.originY, 60, 20);
    this.ctx.beginPath();
    this.ctx.arc(this.originX, this.originY, 15, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // angleDeg: 90 is vertical, 180 is horizontal back
  drawArm(angleDeg, armHole) {
    const angleRad = angleDeg * (Math.PI / 180);
    // Arm length visual
    const armPx = 150; 
    
    this.ctx.save();
    this.ctx.translate(this.originX, this.originY);
    
    // In our physics: 90 is vertical up, 180 is horizontal left
    // Canvas: 0 is right, Math.PI/2 is down.
    // We want 90 to point UP, 180 to point LEFT.
    // Standard Math: x = cos(a), y = -sin(a)
    // We rotate by -angleRad (since canvas y goes down)
    this.ctx.rotate(-angleRad);
    
    // Draw arm (from origin along positive x axis relative to rotation)
    this.ctx.strokeStyle = '#8b5cf6';
    this.ctx.lineWidth = 8;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(armPx, 0); 
    this.ctx.stroke();

    // Draw cup
    const placements = { 1: 0.6, 2: 0.8, 3: 1.0 };
    const cupPlacement = placements[armHole] || 0.8;
    const cupDist = armPx * cupPlacement;
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.arc(cupDist, 0, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawProjectile(x, y, color = '#ef4444') {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    // Physics output: distance to the right (positive X).
    // In our coordinate system, if 90 is UP, 0 is RIGHT.
    // Launch angle is less than 90, so it flies RIGHT.
    this.ctx.arc(this.originX + x * this.scale, this.originY - y * this.scale, 6, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawTrajectory(trajectoryPoints, color = 'rgba(239, 68, 68, 0.5)') {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    trajectoryPoints.forEach((pt, i) => {
      const px = this.originX + pt.x * this.scale;
      const py = this.originY - pt.y * this.scale;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    });
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }
}

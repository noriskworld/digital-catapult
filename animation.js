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
    this.scale = 100; // pixels per meter
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

  drawArm(angleDeg, armLength, cupPlacement) {
    const angleRad = angleDeg * (Math.PI / 180);
    const armPx = armLength * this.scale;
    
    this.ctx.save();
    this.ctx.translate(this.originX, this.originY);
    // 0 degrees is vertical. Canvas rotation is clockwise, so subtract from -90 deg.
    // Actually, let's rotate by angleRad directly if we start pointing UP.
    this.ctx.rotate(angleRad);
    
    // Draw arm
    this.ctx.strokeStyle = '#8b5cf6';
    this.ctx.lineWidth = 8;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, -armPx); // pointing up before rotation
    this.ctx.stroke();

    // Draw cup
    const cupDist = armPx * cupPlacement;
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.arc(10, -cupDist, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawProjectile(x, y) {
    this.ctx.fillStyle = '#ef4444';
    this.ctx.beginPath();
    this.ctx.arc(this.originX + x * this.scale, this.originY - y * this.scale, 8, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawTrajectory(trajectoryPoints) {
    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
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

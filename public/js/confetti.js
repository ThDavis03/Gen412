/**
 * confetti.js
 * Generador ligero y fluido de confeti en HTML5 Canvas (60 FPS sin dependencias).
 * Maneja gravedad, oscilación (flutter), rotación 3D y colores vibrantes.
 */

export class ConfettiSystem {
  constructor(canvasId = 'confettiCanvas') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animationId = null;
    this.colors = ['#38bdf8', '#fb7185', '#f59e0b', '#a78bfa', '#22c55e', '#ec4899', '#facc15'];

    if (this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Lanza una ráfaga festiva de confeti.
   * @param {number} count - Cantidad de partículas (default 140)
   */
  burst(count = 140) {
    if (!this.canvas || !this.ctx) return;

    this.resize();
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: -20 - Math.random() * 100,
        size: 8 + Math.random() * 8,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 6,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        oscillationSpeed: 0.05 + Math.random() * 0.05,
        oscillationAngle: Math.random() * Math.PI * 2,
        tilt: Math.random() * 10,
      });
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  animate() {
    if (!this.ctx || this.particles.length === 0) {
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.oscillationAngle += p.oscillationSpeed;
      p.x += Math.sin(p.oscillationAngle) * 2 + p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;

      // Dibujar partícula con rotación
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      this.ctx.restore();

      // Eliminar cuando sale por debajo de la pantalla
      if (p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
      }
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.particles = [];
  }
}

export const confetti = new ConfettiSystem();

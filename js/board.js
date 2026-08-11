/* Shared canvas board renderer used by both Go and Five in a Row. */
class BoardView {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = opts.size;
    this.starPoints = opts.starPoints || [];
    this.margin = opts.margin ?? 30;
    this.onCellClick = opts.onCellClick || (() => {});
    this.onHover = opts.onHover || (() => {});
    this.showCoords = opts.showCoords !== false;
    this.hoverCell = null;
    this.dpr = window.devicePixelRatio || 1;
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this._bindEvents();
    this.resize();
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
  }

  setSize(size, starPoints) {
    this.size = size;
    this.starPoints = starPoints || [];
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const cssSize = Math.max(240, Math.min(parent.clientWidth, window.innerHeight * 0.68, 620));
    this.cssSize = cssSize;
    this.canvas.style.width = cssSize + 'px';
    this.canvas.style.height = cssSize + 'px';
    this.canvas.width = Math.round(cssSize * this.dpr);
    this.canvas.height = Math.round(cssSize * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cell = (cssSize - this.margin * 2) / (this.size - 1);
  }

  gridToPixel(x, y) {
    return [this.margin + x * this.cell, this.margin + y * this.cell];
  }

  pixelToGrid(px, py) {
    const x = Math.round((px - this.margin) / this.cell);
    const y = Math.round((py - this.margin) / this.cell);
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return null;
    // reject clicks too far from an actual intersection
    const [ex, ey] = this.gridToPixel(x, y);
    if (Math.hypot(ex - px, ey - py) > this.cell * 0.5) return null;
    return { x, y };
  }

  _bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches && e.touches[0];
      const clientX = t ? t.clientX : e.clientX;
      const clientY = t ? t.clientY : e.clientY;
      return [clientX - rect.left, clientY - rect.top];
    };
    this.canvas.addEventListener('click', (e) => {
      const [px, py] = getPos(e);
      const cell = this.pixelToGrid(px, py);
      if (cell) this.onCellClick(cell.x, cell.y);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const [px, py] = getPos(e);
      this.hoverCell = this.pixelToGrid(px, py);
      this.onHover(this.hoverCell);
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      this.onHover(null);
    });
  }

  render(state) {
    const ctx = this.ctx;
    const s = this.cssSize;
    ctx.clearRect(0, 0, s, s);

    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#e8bd72');
    grad.addColorStop(1, '#c99450');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(35, 18, 0, 0.75)';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.size; i++) {
      const [x0, y0] = this.gridToPixel(i, 0);
      const [x1, y1] = this.gridToPixel(i, this.size - 1);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const [xa, ya] = this.gridToPixel(0, i);
      const [xb, yb] = this.gridToPixel(this.size - 1, i);
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(35, 18, 0, 0.85)';
    for (const [sx, sy] of this.starPoints) {
      const [px, py] = this.gridToPixel(sx, sy);
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
    }

    if (this.showCoords) this._drawCoords();

    if (state.territory) {
      for (const [key, color] of state.territory) {
        if (color === 'neutral' || !color) continue;
        const [x, y] = key.split(',').map(Number);
        const [px, py] = this.gridToPixel(x, y);
        ctx.fillStyle = color === 'black' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(px, py, this.cell * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    }

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const v = state.board[y][x];
        if (!v) continue;
        const dead = state.dead && state.dead.has(`${x},${y}`);
        this._drawStone(x, y, v, dead);
      }
    }

    if (state.winLine) {
      ctx.strokeStyle = 'rgba(224, 46, 46, 0.9)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const [x0, y0] = this.gridToPixel(state.winLine[0].x, state.winLine[0].y);
      const last = state.winLine[state.winLine.length - 1];
      const [x1, y1] = this.gridToPixel(last.x, last.y);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.lineCap = 'butt';
    }

    if (state.lastMove) {
      const { x, y } = state.lastMove;
      const v = state.board[y][x];
      if (v) {
        const [px, py] = this.gridToPixel(x, y);
        ctx.strokeStyle = v === 1 ? '#f0f0f0' : '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, this.cell * 0.16, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (this.hoverCell && state.allowHoverPreview && state.board[this.hoverCell.y][this.hoverCell.x] === 0) {
      const { x, y } = this.hoverCell;
      const [px, py] = this.gridToPixel(x, y);
      ctx.globalAlpha = 0.42;
      this._drawStoneRaw(px, py, state.currentColor === 1 ? 'black' : 'white');
      ctx.globalAlpha = 1;
    }

    if (state.hint) {
      const [px, py] = this.gridToPixel(state.hint.x, state.hint.y);
      ctx.strokeStyle = '#2fd15b';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, this.cell * 0.4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  _drawCoords() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(35, 18, 0, 0.7)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letters = 'ABCDEFGHJKLMNOPQRST';
    for (let x = 0; x < this.size; x++) {
      const [px] = this.gridToPixel(x, 0);
      ctx.fillText(letters[x], px, this.margin * 0.42);
    }
    for (let y = 0; y < this.size; y++) {
      const [, py] = this.gridToPixel(0, y);
      ctx.fillText(String(this.size - y), this.margin * 0.42, py);
    }
  }

  _drawStone(x, y, color, dead) {
    const [px, py] = this.gridToPixel(x, y);
    this.ctx.save();
    if (dead) this.ctx.globalAlpha = 0.35;
    this._drawStoneRaw(px, py, color === 1 ? 'black' : 'white');
    this.ctx.restore();
    if (dead) {
      const ctx = this.ctx;
      ctx.strokeStyle = 'rgba(220,20,20,0.9)';
      ctx.lineWidth = 2;
      const r = this.cell * 0.28;
      ctx.beginPath();
      ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
      ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
      ctx.stroke();
    }
  }

  _drawStoneRaw(px, py, colorName) {
    const r = this.cell * 0.46;
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    if (colorName === 'black') {
      grad.addColorStop(0, '#5c5c5c'); grad.addColorStop(1, '#050505');
    } else {
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#cfcfcf');
    }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

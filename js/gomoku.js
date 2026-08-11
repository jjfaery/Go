/* Gomoku (五子棋 Five in a Row) game engine + pattern-based AI. */
class GomokuGame {
  constructor(size = 15) {
    this.size = size;
    this.board = Array.from({ length: size }, () => Array(size).fill(0));
    this.current = 1; // 1 = black, 2 = white
    this.gameOver = false;
    this.winner = null;
    this.winLine = null;
    this.lastMove = null;
    this.moveLog = [];
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }

  play(x, y, color = this.current) {
    if (this.gameOver) return { legal: false, reason: 'game-over' };
    if (!this.inBounds(x, y) || this.board[y][x] !== 0) return { legal: false, reason: 'occupied' };
    this.board[y][x] = color;
    this.moveLog.push({ x, y, color });
    this.lastMove = { x, y };
    const line = this.checkWin(x, y, color);
    if (line) {
      this.gameOver = true;
      this.winner = color;
      this.winLine = line;
    } else if (this.moveLog.length === this.size * this.size) {
      this.gameOver = true;
      this.winner = null;
    } else {
      this.current = color === 1 ? 2 : 1;
    }
    return { legal: true, win: !!line };
  }

  checkWin(x, y, color) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      let cells = [{ x, y }];
      let cx = x + dx, cy = y + dy;
      while (this.inBounds(cx, cy) && this.board[cy][cx] === color) { cells.push({ x: cx, y: cy }); cx += dx; cy += dy; }
      cx = x - dx; cy = y - dy;
      while (this.inBounds(cx, cy) && this.board[cy][cx] === color) { cells.push({ x: cx, y: cy }); cx -= dx; cy -= dy; }
      if (cells.length >= 5) {
        cells.sort((a, b) => (a.x - b.x) || (a.y - b.y));
        return [cells[0], cells[cells.length - 1]];
      }
    }
    return null;
  }

  undo() {
    const last = this.moveLog.pop();
    if (!last) return false;
    this.board[last.y][last.x] = 0;
    this.current = last.color;
    this.gameOver = false;
    this.winner = null;
    this.winLine = null;
    const prev = this.moveLog[this.moveLog.length - 1];
    this.lastMove = prev ? { x: prev.x, y: prev.y } : null;
    return true;
  }
}

const GomokuAI = {
  suggest(game, color, level = 'medium') {
    const opponent = color === 1 ? 2 : 1;
    const candidates = this._candidates(game);
    if (candidates.length === 0) return null;

    const scored = candidates.map(({ x, y }) => {
      const offense = this._evalPoint(game, x, y, color);
      const defense = this._evalPoint(game, x, y, opponent);
      return { x, y, score: offense + defense * 0.9 };
    });
    scored.sort((a, b) => b.score - a.score);

    if (level === 'hard') {
      const topN = scored.slice(0, Math.min(6, scored.length));
      let bestMove = null, bestVal = -Infinity;
      for (const cand of topN) {
        if (cand.score >= 90000) return { x: cand.x, y: cand.y }; // immediate win
        const clone = this._cloneGame(game);
        clone.play(cand.x, cand.y, color);
        let oppBest = 0;
        if (!clone.gameOver) {
          for (const oc of this._candidates(clone)) {
            const s = this._evalPoint(clone, oc.x, oc.y, opponent);
            if (s > oppBest) oppBest = s;
          }
        }
        const val = cand.score - oppBest * 0.9;
        if (val > bestVal) { bestVal = val; bestMove = cand; }
      }
      return { x: bestMove.x, y: bestMove.y };
    }

    let pool;
    if (level === 'easy') pool = scored.slice(0, Math.max(3, Math.ceil(scored.length * 0.6)));
    else pool = scored.slice(0, Math.max(1, Math.min(4, scored.length)));

    const pick = level === 'easy' ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
    return { x: pick.x, y: pick.y };
  },

  _cloneGame(game) {
    const g = new GomokuGame(game.size);
    g.board = game.board.map((r) => r.slice());
    g.current = game.current;
    return g;
  },

  _candidates(game) {
    const set = new Set();
    let any = false;
    for (let y = 0; y < game.size; y++) {
      for (let x = 0; x < game.size; x++) {
        if (game.board[y][x] !== 0) {
          any = true;
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
              const nx = x + dx, ny = y + dy;
              if (game.inBounds(nx, ny) && game.board[ny][nx] === 0) set.add(`${nx},${ny}`);
            }
          }
        }
      }
    }
    if (!any) {
      const c = Math.floor(game.size / 2);
      return [{ x: c, y: c }];
    }
    return [...set].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y }; });
  },

  _evalPoint(game, x, y, color) {
    let total = 0;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) total += this._lineScore(game, x, y, dx, dy, color);
    return total;
  },

  _lineScore(game, x, y, dx, dy, color) {
    const get = (cx, cy) => (game.inBounds(cx, cy) ? game.board[cy][cx] : -1);
    let count = 1;
    let openEnds = 0;
    let cx = x + dx, cy = y + dy;
    while (get(cx, cy) === color) { count++; cx += dx; cy += dy; }
    if (get(cx, cy) === 0) openEnds++;
    cx = x - dx; cy = y - dy;
    while (get(cx, cy) === color) { count++; cx -= dx; cy -= dy; }
    if (get(cx, cy) === 0) openEnds++;
    if (count >= 5) return 100000;
    const table = {
      4: openEnds === 2 ? 50000 : openEnds === 1 ? 5000 : 0,
      3: openEnds === 2 ? 2000 : openEnds === 1 ? 400 : 0,
      2: openEnds === 2 ? 150 : openEnds === 1 ? 30 : 0,
      1: openEnds === 2 ? 10 : 2,
    };
    return table[count] || 0;
  },
};

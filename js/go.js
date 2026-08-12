/* Go (围棋 Weiqi) game engine: legality, capture, simple-ko, Chinese area scoring. */
class GoGame {
  constructor(size = 9, komi = 7.5) {
    this.size = size;
    this.komi = komi;
    this.board = Array.from({ length: size }, () => Array(size).fill(0));
    this.current = 1; // 1 = black, 2 = white
    this.history = []; // board hashes, one per accepted move
    this.moveLog = [];
    this.captures = { 1: 0, 2: 0 };
    this.passes = 0;
    this.gameOver = false;
    this.scoringPhase = false;
    this.dead = new Set();
    this.lastMove = null;
    this.result = null;
    this.undoStack = [];
  }

  clone() { return this.board.map((r) => r.slice()); }
  hash(b) { return b.map((r) => r.join('')).join('/'); }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }

  neighbors(x, y) {
    const n = [];
    if (x > 0) n.push([x - 1, y]);
    if (x < this.size - 1) n.push([x + 1, y]);
    if (y > 0) n.push([x, y - 1]);
    if (y < this.size - 1) n.push([x, y + 1]);
    return n;
  }

  getGroup(x, y, board) {
    const color = board[y][x];
    const seen = new Set();
    const stack = [[x, y]];
    const group = [];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const key = `${cx},${cy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      group.push([cx, cy]);
      for (const [nx, ny] of this.neighbors(cx, cy)) {
        if (board[ny][nx] === color && !seen.has(`${nx},${ny}`)) stack.push([nx, ny]);
      }
    }
    return group;
  }

  getLiberties(group, board) {
    const libs = new Set();
    for (const [x, y] of group) {
      for (const [nx, ny] of this.neighbors(x, y)) {
        if (board[ny][nx] === 0) libs.add(`${nx},${ny}`);
      }
    }
    return libs;
  }

  tryMove(x, y, color) {
    if (!this.inBounds(x, y) || this.board[y][x] !== 0) return { legal: false, reason: 'occupied' };
    const b = this.clone();
    b[y][x] = color;
    const opponent = color === 1 ? 2 : 1;
    const captured = [];
    for (const [nx, ny] of this.neighbors(x, y)) {
      if (b[ny][nx] === opponent) {
        const group = this.getGroup(nx, ny, b);
        if (this.getLiberties(group, b).size === 0) {
          for (const [gx, gy] of group) { b[gy][gx] = 0; captured.push([gx, gy]); }
        }
      }
    }
    const ownGroup = this.getGroup(x, y, b);
    if (this.getLiberties(ownGroup, b).size === 0) {
      return { legal: false, reason: 'suicide' };
    }
    const h = this.hash(b);
    if (captured.length > 0 && this.history.length >= 2 && h === this.history[this.history.length - 2]) {
      return { legal: false, reason: 'ko' };
    }
    return { legal: true, board: b, captured, hash: h };
  }

  _snapshot() {
    return {
      board: this.clone(),
      current: this.current,
      captures: { ...this.captures },
      passes: this.passes,
      history: [...this.history],
      lastMove: this.lastMove,
      gameOver: this.gameOver,
      scoringPhase: this.scoringPhase,
      moveLogLen: this.moveLog.length,
    };
  }

  play(x, y, color = this.current) {
    if (this.gameOver || this.scoringPhase) return { legal: false, reason: 'game-over' };
    const res = this.tryMove(x, y, color);
    if (!res.legal) return res;
    this.undoStack.push(this._snapshot());
    this.board = res.board;
    this.captures[color] += res.captured.length;
    this.history.push(res.hash);
    this.moveLog.push({ x, y, color });
    this.lastMove = { x, y };
    this.passes = 0;
    this.current = color === 1 ? 2 : 1;
    return { legal: true, captured: res.captured };
  }

  pass() {
    if (this.gameOver || this.scoringPhase) return;
    this.undoStack.push(this._snapshot());
    this.moveLog.push({ pass: true, color: this.current });
    this.passes++;
    this.lastMove = null;
    this.current = this.current === 1 ? 2 : 1;
    if (this.passes >= 2) this.scoringPhase = true;
  }

  resign(color) {
    this.gameOver = true;
    this.result = { winner: color === 1 ? 2 : 1, reason: 'resign' };
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const snap = this.undoStack.pop();
    this.board = snap.board;
    this.current = snap.current;
    this.captures = snap.captures;
    this.passes = snap.passes;
    this.history = snap.history;
    this.lastMove = snap.lastMove;
    this.gameOver = snap.gameOver;
    this.scoringPhase = snap.scoringPhase;
    this.moveLog.length = snap.moveLogLen;
    this.dead.clear();
    return true;
  }

  toggleDead(x, y) {
    if (!this.scoringPhase || this.board[y][x] === 0) return;
    const group = this.getGroup(x, y, this.board);
    const isDead = this.dead.has(`${x},${y}`);
    for (const [gx, gy] of group) {
      const k = `${gx},${gy}`;
      if (isDead) this.dead.delete(k); else this.dead.add(k);
    }
  }

  resumePlay() {
    this.scoringPhase = false;
    this.passes = 0;
    this.dead.clear();
  }

  computeScore() {
    const b = this.clone();
    for (const key of this.dead) {
      const [x, y] = key.split(',').map(Number);
      b[y][x] = 0;
    }
    const visited = new Set();
    const territory = new Map();
    const score = { 1: 0, 2: 0 };
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (b[y][x]) score[b[y][x]]++;
      }
    }
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (b[y][x] !== 0) continue;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        const stack = [[x, y]];
        const region = [];
        const borders = new Set();
        while (stack.length) {
          const [cx, cy] = stack.pop();
          const k = `${cx},${cy}`;
          if (visited.has(k)) continue;
          visited.add(k);
          region.push([cx, cy]);
          for (const [nx, ny] of this.neighbors(cx, cy)) {
            if (b[ny][nx] === 0) {
              if (!visited.has(`${nx},${ny}`)) stack.push([nx, ny]);
            } else {
              borders.add(b[ny][nx]);
            }
          }
        }
        let owner = borders.size === 1 ? [...borders][0] : null;
        for (const [rx, ry] of region) {
          territory.set(`${rx},${ry}`, owner === 1 ? 'black' : owner === 2 ? 'white' : 'neutral');
          if (owner) score[owner]++;
        }
      }
    }
    const black = score[1];
    const white = score[2] + this.komi;
    return { black, white, territory, winner: black > white ? 1 : 2, margin: Math.abs(black - white) };
  }

  finalizeScore() {
    const s = this.computeScore();
    this.gameOver = true;
    this.result = { winner: s.winner, black: s.black, white: s.white, margin: s.margin, reason: 'score' };
    return s;
  }

  legalMoves(color) {
    const moves = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] === 0) {
          const r = this.tryMove(x, y, color);
          if (r.legal) moves.push({ x, y });
        }
      }
    }
    return moves;
  }
}

const GoAI = {
  suggest(game, color, level = 'medium') {
    const moves = game.legalMoves(color);
    if (moves.length === 0) return null;
    const opponent = color === 1 ? 2 : 1;
    const scored = moves.map((m) => {
      let score = 0;
      const res = game.tryMove(m.x, m.y, color);
      score += res.captured.length * 60;

      const ownGroup = game.getGroup(m.x, m.y, res.board);
      const ownLibs = game.getLiberties(ownGroup, res.board).size;
      if (ownLibs === 1) score -= 40;
      if (ownLibs >= 4) score += 5;

      for (const [nx, ny] of game.neighbors(m.x, m.y)) {
        if (game.board[ny][nx] === opponent) {
          const beforeGroup = game.getGroup(nx, ny, game.board);
          const beforeLibs = game.getLiberties(beforeGroup, game.board).size;
          const stillThere = res.board[ny][nx] === opponent;
          const afterLibs = stillThere ? game.getLiberties(game.getGroup(nx, ny, res.board), res.board).size : 0;
          if (beforeLibs - afterLibs > 0) score += (beforeLibs - afterLibs) * 15;
          if (stillThere && afterLibs === 1) score += 20;
        }
      }

      for (const [nx, ny] of game.neighbors(m.x, m.y)) {
        if (game.board[ny][nx] === color) {
          const g = game.getGroup(nx, ny, game.board);
          if (game.getLiberties(g, game.board).size === 1) score += 25;
        }
      }

      const edgeDist = Math.min(m.x, game.size - 1 - m.x, m.y, game.size - 1 - m.y);
      score += edgeDist === 2 || edgeDist === 3 ? 8 : edgeDist === 0 ? -10 : 2;

      let hasNearbyStone = false;
      for (let dx = -2; dx <= 2 && !hasNearbyStone; dx++) {
        for (let dy = -2; dy <= 2 && !hasNearbyStone; dy++) {
          const nx = m.x + dx, ny = m.y + dy;
          if (game.inBounds(nx, ny) && game.board[ny][nx] !== 0) hasNearbyStone = true;
        }
      }
      if (hasNearbyStone) score += 3;

      const neighborsOwn = game.neighbors(m.x, m.y).every(([nx, ny]) => game.board[ny][nx] === color);
      if (neighborsOwn && res.captured.length === 0) score -= 60;

      score += Math.random() * 10;
      return { move: m, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const passThreshold = level === 'easy' ? -25 : -15;
    if (scored[0].score < passThreshold && game.moveLog.length > game.size * game.size) return null;

    let pool;
    if (level === 'easy') pool = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.5)));
    else if (level === 'medium') pool = scored.slice(0, Math.max(1, Math.min(5, scored.length)));
    else pool = scored.slice(0, 1);

    if (level === 'easy') return pool[Math.floor(Math.random() * pool.length)].move;
    return pool[0].move;
  },
};

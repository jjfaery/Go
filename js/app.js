/* App shell: screen routing, mode setup, and game-loop wiring for both games. */
const App = (() => {
  const screens = {};
  let boardView = null;
  let game = null;
  let gameKey = null; // 'go' | 'gomoku'
  let setup = { boardSize: 9, mode: '2p', difficulty: 'medium', humanColor: 1 };
  let hintMove = null;
  let aiThinking = false;
  let aiToken = 0;
  let rulesVisible = false;

  const GO_STAR_POINTS = {
    9: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]],
    13: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]],
    19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
  };

  function $(id) { return document.getElementById(id); }

  function init() {
    document.querySelectorAll('.screen').forEach((el) => { screens[el.id] = el; });
    $('btn-home').addEventListener('click', () => showScreen('home'));
    $('btn-nav-home').addEventListener('click', () => showScreen('home'));
    document.querySelectorAll('.back-link').forEach((btn) => {
      btn.addEventListener('click', () => showScreen(btn.dataset.back));
    });
    document.querySelectorAll('.game-card').forEach((card) => {
      card.addEventListener('click', () => openModeScreen(card.dataset.game));
    });
    $('mode-row').addEventListener('click', onModeRowClick);
    $('difficulty-row').addEventListener('click', onPillClick('difficulty-row', 'difficulty', 'difficulty'));
    $('color-row').addEventListener('click', onPillClick('color-row', 'color', 'humanColor', Number));
    $('btn-start-game').addEventListener('click', startGame);

    $('btn-hint').addEventListener('click', onHint);
    $('btn-undo').addEventListener('click', onUndo);
    $('btn-rules').addEventListener('click', toggleRules);
    $('btn-newgame').addEventListener('click', () => startGame());
    $('btn-pass').addEventListener('click', onPass);
    $('btn-resign').addEventListener('click', onResign);
    $('btn-finalize').addEventListener('click', onFinalize);
    $('btn-resume').addEventListener('click', onResumePlay);

    showScreen('home');
  }

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens['screen-' + name].classList.add('active');
    if (name !== 'game') aiThinking = false;
  }

  function openModeScreen(key) {
    gameKey = key;
    setup = { boardSize: 9, mode: '2p', difficulty: 'medium', humanColor: 1 };
    $('mode-title').textContent = key === 'go' ? '围棋 Go — Choose how to play' : '五子棋 Gomoku — Choose how to play';

    const sizeBlock = $('block-boardsize');
    if (key === 'go') {
      sizeBlock.hidden = false;
      $('boardsize-row').innerHTML = ['9', '13', '19'].map((s) =>
        `<button class="pill${s === '9' ? ' selected' : ''}" data-size="${s}">${s}×${s}</button>`).join('');
      $('boardsize-row').onclick = (e) => {
        const btn = e.target.closest('.pill');
        if (!btn) return;
        setup.boardSize = Number(btn.dataset.size);
        markSelected('boardsize-row', btn);
      };
    } else {
      sizeBlock.hidden = true;
      setup.boardSize = 15;
    }

    resetPillSelection('mode-row', 'mode', '2p');
    $('block-difficulty').hidden = true;
    $('block-color').hidden = true;
    $('btn-start-game').hidden = false;
    showScreen('mode');
  }

  function markSelected(rowId, btn) {
    $(rowId).querySelectorAll('.pill').forEach((p) => p.classList.remove('selected'));
    btn.classList.add('selected');
  }
  function resetPillSelection(rowId, dataKey, defaultVal) {
    $(rowId).querySelectorAll('.pill').forEach((p) => {
      p.classList.toggle('selected', p.dataset[dataKey] === String(defaultVal));
    });
  }
  function onPillClick(rowId, dataKey, setupKey, transform = (v) => v) {
    return (e) => {
      const btn = e.target.closest('.pill');
      if (!btn) return;
      setup[setupKey] = transform(btn.dataset[dataKey]);
      markSelected(rowId, btn);
    };
  }

  function onModeRowClick(e) {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    setup.mode = btn.dataset.mode;
    markSelected('mode-row', btn);
    const isCpu = setup.mode === 'cpu';
    $('block-difficulty').hidden = !isCpu;
    $('block-color').hidden = !isCpu;
    if (isCpu) {
      resetPillSelection('difficulty-row', 'difficulty', 'medium');
      resetPillSelection('color-row', 'color', '1');
      setup.difficulty = 'medium';
      setup.humanColor = 1;
    }
  }

  function startGame() {
    hintMove = null;
    aiThinking = false;
    aiToken++; // invalidate any pending computer move from a previous game
    if (gameKey === 'go') {
      game = new GoGame(setup.boardSize, 7.5);
    } else {
      game = new GomokuGame(15);
    }
    setupBoardView();
    $('go-controls').style.display = gameKey === 'go' ? '' : 'none';
    $('rules-panel').hidden = true;
    rulesVisible = false;
    if (gameKey === 'go') $('rules-panel').innerHTML = buildRulesHTML('go');
    else $('rules-panel').innerHTML = buildRulesHTML('gomoku');
    log('New game started.', true);
    showScreen('game');
    render();
    maybeTriggerAI();
  }

  function setupBoardView() {
    const canvas = $('board-canvas');
    const star = gameKey === 'go' ? (GO_STAR_POINTS[setup.boardSize] || []) : [];
    if (boardView) boardView.destroy();
    boardView = new BoardView(canvas, {
      size: setup.boardSize,
      starPoints: star,
      onCellClick: handleCellClick,
      onHover: () => render(),
      showCoords: true,
    });
  }

  function isHumanTurn() {
    if (setup.mode !== 'cpu') return true;
    return game.current === setup.humanColor;
  }

  function handleCellClick(x, y) {
    if (!game) return;
    if (gameKey === 'go' && game.scoringPhase) {
      game.toggleDead(x, y);
      render();
      return;
    }
    if (game.gameOver) return;
    if (aiThinking) return;
    if (!isHumanTurn()) return;
    attemptMove(x, y, game.current);
  }

  function attemptMove(x, y, color) {
    hintMove = null;
    if (gameKey === 'go') {
      const res = game.play(x, y, color);
      if (!res.legal) {
        toast(illegalReason(res.reason));
        return;
      }
      if (res.captured.length) log(`${colorName(color)} captures ${res.captured.length} stone${res.captured.length > 1 ? 's' : ''}.`);
    } else {
      const res = game.play(x, y, color);
      if (!res.legal) return;
      if (game.gameOver && game.winner) log(`${colorName(game.winner)} wins with five in a row!`, true);
      else if (game.gameOver) log('Board full — draw.', true);
    }
    render();
    checkGoEndState();
    maybeTriggerAI();
  }

  function illegalReason(reason) {
    if (reason === 'occupied') return 'That point is already occupied.';
    if (reason === 'suicide') return 'Illegal move: that would leave your group with no liberties (suicide).';
    if (reason === 'ko') return 'Illegal move: the ko rule forbids immediately recapturing that position.';
    return 'Illegal move.';
  }

  function colorName(c) { return c === 1 ? 'Black' : 'White'; }

  function maybeTriggerAI() {
    if (setup.mode !== 'cpu' || !game || game.gameOver) return;
    if (gameKey === 'go' && game.scoringPhase) return;
    if (game.current === setup.humanColor) return;
    aiThinking = true;
    updateSidePanel();
    const token = ++aiToken;
    setTimeout(() => runAIMove(token), 450 + Math.random() * 350);
  }

  function runAIMove(token) {
    if (token !== aiToken) return; // stale — state changed (undo/new game) since this was scheduled
    if (!game || game.gameOver) { aiThinking = false; return; }
    const aiColor = game.current;
    if (gameKey === 'go') {
      const mv = GoAI.suggest(game, aiColor, setup.difficulty);
      if (!mv) {
        game.pass();
        log(`${colorName(aiColor)} (computer) passes.`);
      } else {
        const res = game.play(mv.x, mv.y, aiColor);
        if (res.legal && res.captured.length) log(`${colorName(aiColor)} (computer) captures ${res.captured.length} stone${res.captured.length > 1 ? 's' : ''}.`);
      }
    } else {
      const mv = GomokuAI.suggest(game, aiColor, setup.difficulty);
      if (mv) {
        game.play(mv.x, mv.y, aiColor);
        if (game.gameOver && game.winner) log(`${colorName(game.winner)} (computer) wins with five in a row!`, true);
        else if (game.gameOver) log('Board full — draw.', true);
      }
    }
    aiThinking = false;
    render();
    checkGoEndState();
    maybeTriggerAI();
  }

  function checkGoEndState() {
    if (gameKey === 'go' && game.scoringPhase && !game.gameOver) {
      $('scoring-banner').hidden = false;
    } else {
      $('scoring-banner').hidden = true;
    }
  }

  function onHint() {
    if (!game || game.gameOver || aiThinking) return;
    if (gameKey === 'go' && game.scoringPhase) return;
    const color = game.current;
    const mv = gameKey === 'go' ? GoAI.suggest(game, color, 'hard') : GomokuAI.suggest(game, color, 'hard');
    if (!mv) { toast('No strong move found — consider passing.'); return; }
    hintMove = mv;
    render();
    toast(`Hint: try ${coordLabel(mv.x, mv.y)}`);
  }

  function coordLabel(x, y) {
    const letters = 'ABCDEFGHJKLMNOPQRST';
    return `${letters[x]}${game.size - y}`;
  }

  function onUndo() {
    if (!game) return;
    aiToken++; // invalidate any pending computer move
    aiThinking = false;
    if (gameKey === 'go') {
      if (game.scoringPhase) { game.resumePlay(); render(); checkGoEndState(); return; }
      if (!game.undo()) { toast('Nothing to undo.'); return; }
      if (setup.mode === 'cpu' && game.undoStack.length && game.current !== setup.humanColor) game.undo();
    } else {
      if (!game.undo()) { toast('Nothing to undo.'); return; }
      if (setup.mode === 'cpu' && game.current !== setup.humanColor) game.undo();
    }
    hintMove = null;
    aiThinking = false;
    render();
    checkGoEndState();
  }

  function onPass() {
    if (!game || gameKey !== 'go' || game.gameOver || game.scoringPhase) return;
    if (!isHumanTurn() || aiThinking) return;
    const passer = game.current;
    game.pass();
    log(`${colorName(passer)} passes.`);
    render();
    checkGoEndState();
    maybeTriggerAI();
  }

  function onResign() {
    if (!game || gameKey !== 'go' || game.gameOver) return;
    if (!confirm('Resign this game?')) return;
    game.resign(game.current);
    log(`${colorName(game.current === 1 ? 2 : 1)} resigns.`, true);
    render();
  }

  function onFinalize() {
    if (!game || gameKey !== 'go') return;
    const s = game.finalizeScore();
    log(`Final score — Black: ${s.black}, White: ${s.white.toFixed(1)}. ${colorName(s.winner)} wins by ${s.margin.toFixed(1)}.`, true);
    render();
    checkGoEndState();
  }

  function onResumePlay() {
    if (!game || gameKey !== 'go') return;
    game.resumePlay();
    log('Resumed play.');
    render();
    checkGoEndState();
    maybeTriggerAI();
  }

  function toggleRules() {
    rulesVisible = !rulesVisible;
    $('rules-panel').hidden = !rulesVisible;
  }

  function buildRulesHTML(key) {
    const r = RULES[key];
    let html = `<h3>${r.title}</h3>`;
    for (const s of r.sections) html += `<h4>${s.h}</h4><p>${s.p}</p>`;
    return html;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, 2600);
  }

  function log(msg, strong) {
    const el = $('message-log');
    const line = document.createElement('div');
    line.className = 'log-line' + (strong ? ' strong' : '');
    line.textContent = msg;
    el.prepend(line);
    while (el.children.length > 40) el.removeChild(el.lastChild);
  }

  function render() {
    if (!game || !boardView) return;
    const state = {
      board: game.board,
      lastMove: game.lastMove,
      hint: hintMove,
      allowHoverPreview: !aiThinking && isHumanTurn() && !game.gameOver && !(gameKey === 'go' && game.scoringPhase),
      currentColor: game.current,
    };
    if (gameKey === 'go') {
      state.dead = game.dead;
      if (game.scoringPhase || game.gameOver) {
        const s = game.computeScore();
        state.territory = s.territory;
      }
    } else {
      state.winLine = game.winLine;
    }
    boardView.render(state);
    updateSidePanel();
  }

  function updateSidePanel() {
    const turnEl = $('turn-indicator');
    const statEl = $('stat-row');
    if (!game) return;

    if (gameKey === 'go' && game.gameOver && game.result) {
      const r = game.result;
      turnEl.innerHTML = r.reason === 'resign'
        ? `<span class="badge win">${colorName(r.winner)} wins by resignation</span>`
        : `<span class="badge win">${colorName(r.winner)} wins by ${r.margin.toFixed(1)}</span>`;
    } else if (gameKey === 'gomoku' && game.gameOver) {
      turnEl.innerHTML = game.winner ? `<span class="badge win">${colorName(game.winner)} wins!</span>` : `<span class="badge">Draw</span>`;
    } else if (gameKey === 'go' && game.scoringPhase) {
      turnEl.innerHTML = `<span class="badge">Scoring phase</span>`;
    } else {
      const stoneIcon = game.current === 1 ? '⚫' : '⚪';
      const who = setup.mode === 'cpu' ? (game.current === setup.humanColor ? 'Your turn' : 'Computer thinking…') : `${colorName(game.current)}'s turn`;
      turnEl.innerHTML = `<span class="stone-dot ${game.current === 1 ? 'b' : 'w'}"></span> ${stoneIcon} ${who}`;
    }

    if (gameKey === 'go') {
      let stats = `<div>Captures — Black: <b>${game.captures[1]}</b> · White: <b>${game.captures[2]}</b></div>`;
      if (game.scoringPhase || (game.gameOver && game.result.reason === 'score')) {
        const s = game.computeScore();
        stats += `<div>Score — Black: <b>${s.black}</b> · White: <b>${s.white.toFixed(1)}</b> (incl. komi 7.5)</div>`;
      } else {
        stats += `<div>Komi: 7.5 (White) · Board: ${game.size}×${game.size}</div>`;
      }
      statEl.innerHTML = stats;
    } else {
      statEl.innerHTML = `<div>Moves played: <b>${game.moveLog.length}</b> · Board: 15×15</div>`;
    }

    $('btn-pass').disabled = !isHumanTurn() || game.gameOver || game.scoringPhase;
    $('btn-resign').disabled = game.gameOver;
    $('btn-hint').disabled = game.gameOver || (gameKey === 'go' && game.scoringPhase);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);

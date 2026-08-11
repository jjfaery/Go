# 棋苑 · Chinese Board Games

Play **围棋 Go (Weiqi)** and **五子棋 Gomoku (Five in a Row)** right in your browser — no install, no build step, no backend. Send someone the link and they can start playing immediately.

## Features

- **Two games**: Go (9×9 / 13×13 / 19×19) with real capture/liberty rules, simple-ko protection, and Chinese area scoring; Gomoku (15×15) with standard five-in-a-row win detection.
- **Three ways to play**, for each game:
  - 👥 **2 Players** — pass-and-play on one device.
  - 🤖 **vs Computer** — Easy / Medium / Hard heuristic AI, choose to play Black or White.
  - 📖 **Learn & Practice** — same board, with rules always a click away.
- **💡 Hint button** — at any point in any mode, see a strong candidate move for whoever's turn it is (great for learning).
- **↩ Undo**, **Pass** / **Resign** (Go), and an end-of-game **scoring phase** for Go where you mark dead stones before the score is finalized (Chinese/area scoring, with komi).
- Fully responsive, works on desktop and mobile (tap to place stones).

## Play it now

Once deployed (see below), the game is available at:

```
https://jjfaery.github.io/Go/
```

## Running locally

No build tools required — it's plain HTML/CSS/JS. Just serve the folder statically, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly by double-clicking also works in most browsers.)

## Deploying to GitHub Pages

A workflow (`.github/workflows/pages.yml`) is already included and will auto-deploy on every push to `main`. One-time setup:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push (or merge) to `main` — the site will build and publish automatically at `https://<owner>.github.io/<repo>/`.

## Project structure

```
index.html        Single-page app shell (home, mode select, game screen)
css/style.css      All styling
js/board.js        Shared canvas board renderer (used by both games)
js/go.js           Go engine: legality, capture, ko, scoring + AI
js/gomoku.js       Gomoku engine: win detection + AI
js/rules.js        Bilingual rules text for the Learn panel
js/app.js          UI wiring: screens, modes, AI turn loop, hints
```

## Notes on the AI

The computer opponents are lightweight heuristic engines (pattern/liberty scoring, with a shallow lookahead on "Hard"), tuned for casual and learning play. They are **not** professional-strength bots — a strong human player will beat "Hard" Go or Gomoku fairly easily. The same heuristics power the Hint button.

## Rules summary

**Go**: surround territory and capture stones by removing your opponent's last liberty; suicide moves are illegal; the ko rule prevents immediate repetition after a capture; scoring is Chinese-style (stones + territory), with a 7.5-point komi for White.

**Gomoku**: place stones alternately on a 15×15 grid; first to get five in a row (any direction) wins; no captures, stones never move.

Full rules with strategy tips are available in-app via the **📖 Rules** button on the game screen, or the **Learn & Practice** mode.

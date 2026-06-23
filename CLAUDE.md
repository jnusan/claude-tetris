# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step or dependencies. Open directly in a browser:

```bash
# Windows
start index.html

# Or serve locally (avoids some browser restrictions)
python3 -m http.server 8000
# then open http://localhost:8000
```

## Architecture

Three files, no framework, no bundler:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600px) for the playfield, `<canvas id="next-canvas">` (120×120px) for piece preview, a side panel with score/lines/level displays, and an overlay div that doubles as both the pause screen and game-over screen.
- **`style.css`** — Dark/retro aesthetic. The overlay uses `backdrop-filter: blur` and toggling `.hidden` (display:none) controls visibility.
- **`game.js`** — All game logic (~305 lines), structured as module-level state variables plus pure functions. No classes.

## Key game.js internals

**State** is held in module-level `let` variables: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`.

**Board** is a `ROWS × COLS` matrix where `0` = empty, `1–7` = piece color index.

**Piece object** shape: `{ type, shape, x, y }` — `shape` is a 2D array of color indices (matching the piece type).

**Core function call chain:**
```
init() → spawn() → requestAnimationFrame(loop)
loop() → [auto-drop or lockPiece()] → draw()
lockPiece() → merge() → clearLines() → spawn()
spawn() → collide() check → endGame() if collision
```

**Canvas sizing**: `COLS × BLOCK` = canvas width, `ROWS × BLOCK` = canvas height. If you change `COLS`, `ROWS`, or `BLOCK`, update the `<canvas>` width/height attributes in `index.html` to match.

**Speed formula**: `dropInterval = Math.max(100, 1000 - (level - 1) * 90)` ms. Level increments every 10 lines cleared.

**Wall kicks** in `tryRotate()`: tries column offsets `[0, -1, 1, -2, 2]` after rotating — first non-colliding offset wins.

**Ghost piece**: `ghostY()` projects the current piece straight down; drawn with `globalAlpha = 0.2`.

**Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level for 0–4 simultaneous line clears; soft drop +1 per row; hard drop +2 per row dropped.

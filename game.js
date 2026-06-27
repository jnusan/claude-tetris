'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // Tuerca - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (anillo 3x3, hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_STORAGE_KEY = 'tetris-theme';
const SKIN_STORAGE_KEY  = 'tetris-skin';
const START_LEVEL_KEY   = 'tetris-start-level';
const RECORDS_KEY       = 'tetris-records';
const LAST_NAME_KEY     = 'tetris-last-name';
const MIN_LEVEL = 1, MAX_LEVEL = 20;

// Skins: cada uno define paleta de colores (índices 1-8), estilo de dibujo,
// y opcionalmente fondo del tablero y color de rejilla.
const SKINS = {
  retro: {
    label: 'Retro', style: 'flat', colors: COLORS,
    boardBg: null, grid: null,
  },
  neon: {
    label: 'Neon', style: 'neon',
    colors: [null, '#00f5ff', '#ffe600', '#cc00ff', '#00ff66', '#ff0055', '#0088ff', '#ff6600', '#b0b0cc'],
    boardBg: '#000000', grid: '#0d0d0d',
  },
  pastel: {
    label: 'Pastel', style: 'rounded',
    colors: [null, '#a8d8ea', '#ffeaa7', '#dda0dd', '#b2dfdb', '#f8c8c8', '#b0c4de', '#ffd8a8', '#d4d4d4'],
    boardBg: null, grid: null,
  },
  pixel: {
    label: 'Pixel art', style: 'pixel',
    colors: [null, '#00aacc', '#ddcc00', '#9900cc', '#00aa44', '#cc0022', '#0044cc', '#cc6600', '#778899'],
    boardBg: null, grid: null,
  },
};

// ---- DOM ----
const canvas       = document.getElementById('board');
const ctx          = canvas.getContext('2d');
const nextCanvas   = document.getElementById('next-canvas');
const nextCtx      = nextCanvas.getContext('2d');
const scoreEl      = document.getElementById('score');
const linesEl      = document.getElementById('lines');
const levelEl      = document.getElementById('level');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn   = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinSelect   = document.getElementById('skin-select');

// Menú de pausa
const pauseOverlay    = document.getElementById('pause-overlay');
const pauseMain       = document.getElementById('pause-main');
const pauseControls   = document.getElementById('pause-controls');
const resumeBtn       = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDecBtn     = document.getElementById('level-dec');
const levelIncBtn     = document.getElementById('level-inc');
const startLevelValueEl = document.getElementById('start-level-value');

// Récords
const startOverlay        = document.getElementById('start-overlay');
const startRecordsEl      = document.getElementById('start-records');
const playBtn             = document.getElementById('play-btn');
const resetRecordsStartBtn = document.getElementById('reset-records-start-btn');
const nameEntry           = document.getElementById('name-entry');
const nameInput           = document.getElementById('name-input');
const saveRecordBtn       = document.getElementById('save-record-btn');
const goRecordsEl         = document.getElementById('go-records');
const resetRecordsGoBtn   = document.getElementById('reset-records-go-btn');

// ---- Tema y skin ----
let skin = SKINS[localStorage.getItem(SKIN_STORAGE_KEY)] ? localStorage.getItem(SKIN_STORAGE_KEY) : 'retro';
let gridLineColor = '#22222e';

function readGridLineColor() {
  return getComputedStyle(document.body).getPropertyValue('--grid-line').trim() || gridLineColor;
}

function applyTheme(theme) {
  document.body.classList.toggle('light-mode', theme === 'light');
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  themeToggleBtn.setAttribute('aria-label', theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  gridLineColor = readGridLineColor();
  // Preservar el override de rejilla del skin activo
  if (SKINS[skin] && SKINS[skin].grid) gridLineColor = SKINS[skin].grid;
}

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  localStorage.setItem(SKIN_STORAGE_KEY, skin);
  gridLineColor = SKINS[skin].grid || readGridLineColor();
  skinSelect.value = skin;
  if (typeof current !== 'undefined' && current && next) { draw(); drawNext(); }
}

themeToggleBtn.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light-mode');
  applyTheme(isLight ? 'dark' : 'light');
});

skinSelect.addEventListener('change', e => applySkin(e.target.value));

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
applySkin(skin);

// ---- Récords en localStorage ----

function defaultRecords() {
  return { scores: [], bestCombo: 0, bestLines: 0 };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return defaultRecords();
    const data = JSON.parse(raw);
    return {
      scores: Array.isArray(data.scores) ? data.scores : [],
      bestCombo: data.bestCombo || 0,
      bestLines: data.bestLines || 0,
    };
  } catch (_) {
    return defaultRecords();
  }
}

function saveRecords(data) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(data));
}

function qualifiesTop(sc) {
  const data = loadRecords();
  return data.scores.length < 5 || sc > data.scores[data.scores.length - 1].score;
}

function addRecord(entry) {
  const data = loadRecords();
  data.scores.push(entry);
  data.scores.sort((a, b) => b.score - a.score);
  if (data.scores.length > 5) data.scores.length = 5;
  saveRecords(data);
  return data.scores.findIndex(e => e === entry);
}

function resetRecords() {
  localStorage.removeItem(RECORDS_KEY);
}

function renderRecords(containerEl, highlightIndex = -1) {
  const data = loadRecords();
  let html = '';

  if (data.scores.length === 0) {
    html += '<p class="records-empty">Sin récords aún</p>';
  } else {
    html += '<table class="records-table">';
    html += '<thead><tr><th>#</th><th>NOMBRE</th><th>SCORE</th><th>LÍNEAS</th></tr></thead>';
    html += '<tbody>';
    data.scores.forEach((entry, i) => {
      const cls = i === highlightIndex ? ' class="record-highlight"' : '';
      html += `<tr${cls}><td>${i + 1}</td><td>${escapeHtml(entry.name)}</td><td>${entry.score.toLocaleString()}</td><td>${entry.lines}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  html += '<div class="records-stats">';
  html += `<span>Mejor combo: ${data.bestCombo}</span>`;
  html += `<span>Máx. líneas: ${data.bestLines}</span>`;
  html += '</div>';

  containerEl.innerHTML = html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Helpers de nivel ----
function clampLevel(n) { return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n || 1)); }
function dropIntervalForLevel(lvl) { return Math.max(100, 1000 - (lvl - 1) * 90); }
function setStartLevel(n) {
  startLevel = clampLevel(n);
  localStorage.setItem(START_LEVEL_KEY, startLevel);
  startLevelValueEl.textContent = startLevel;
}

// ---- Estado del juego ----
let startLevel = clampLevel(parseInt(localStorage.getItem(START_LEVEL_KEY), 10) || 1);
startLevelValueEl.textContent = startLevel;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, gameMaxCombo;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = dropIntervalForLevel(level);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > gameMaxCombo) gameMaxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skinDef = SKINS[skin];
  const color = skinDef.colors[colorIndex];
  const a = alpha ?? 1;
  const px = x * size + 1;
  const py = y * size + 1;
  const pw = size - 2;
  const ph = size - 2;

  context.globalAlpha = a;

  switch (skinDef.style) {
    case 'flat':
      context.fillStyle = color;
      context.fillRect(px, py, pw, ph);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px, py, pw, 4);
      break;

    case 'neon': {
      context.fillStyle = '#0a0a0a';
      context.fillRect(px, py, pw, ph);
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.globalAlpha = a * 0.25;
      context.fillRect(px + 3, py + 3, pw - 6, ph - 6);
      break;
    }

    case 'rounded': {
      const rad = size * 0.25;
      context.fillStyle = color;
      context.beginPath();
      if (context.roundRect) {
        context.roundRect(px, py, pw, ph, rad);
      } else {
        context.moveTo(px + rad, py);
        context.lineTo(px + pw - rad, py);
        context.arcTo(px + pw, py,      px + pw, py + rad,    rad);
        context.lineTo(px + pw, py + ph - rad);
        context.arcTo(px + pw, py + ph, px + pw - rad, py + ph, rad);
        context.lineTo(px + rad, py + ph);
        context.arcTo(px, py + ph,      px, py + ph - rad,    rad);
        context.lineTo(px, py + rad);
        context.arcTo(px, py,           px + rad, py,         rad);
        context.closePath();
      }
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.22)';
      context.fillRect(px + rad, py + 1, pw - rad * 2, 4);
      break;
    }

    case 'pixel':
      context.fillStyle = color;
      context.fillRect(px, py, pw, ph);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px,          py,          pw, 2);
      context.fillRect(px,          py,          2,  ph);
      context.fillRect(px,          py + ph - 2, pw, 2);
      context.fillRect(px + pw - 2, py,          2,  ph);
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(px + 2, py + 2, Math.floor(pw / 3), 2);
      context.fillRect(px + 2, py + 2, 2, Math.floor(ph / 3));
      break;
  }

  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const boardBg = SKINS[skin].boardBg;
  if (boardBg) {
    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  // Actualizar récords globales (combo y líneas)
  const data = loadRecords();
  if (gameMaxCombo > data.bestCombo) data.bestCombo = gameMaxCombo;
  if (lines > data.bestLines) data.bestLines = lines;
  saveRecords(data);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (qualifiesTop(score)) {
    nameInput.value = localStorage.getItem(LAST_NAME_KEY) || '';
    nameEntry.classList.remove('hidden');
    goRecordsEl.classList.add('hidden');
    resetRecordsGoBtn.classList.add('hidden');
    setTimeout(() => nameInput.focus(), 50);
  } else {
    nameEntry.classList.add('hidden');
    renderRecords(goRecordsEl);
    goRecordsEl.classList.remove('hidden');
    resetRecordsGoBtn.classList.remove('hidden');
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseMain.classList.remove('hidden');
    pauseControls.classList.add('hidden');
    startLevelValueEl.textContent = startLevel;
    pauseOverlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  gameMaxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalForLevel(startLevel);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  startOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  renderRecords(startRecordsEl);
  startOverlay.classList.remove('hidden');
}

// ---- Teclado ----
document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// ---- Handlers de botones ----
playBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  document.activeElement.blur();
  togglePause();
});
pauseRestartBtn.addEventListener('click', () => {
  document.activeElement.blur();
  paused = false;
  init();
});
showControlsBtn.addEventListener('click', () => {
  document.activeElement.blur();
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});
controlsBackBtn.addEventListener('click', () => {
  document.activeElement.blur();
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
});
levelDecBtn.addEventListener('click', () => { document.activeElement.blur(); setStartLevel(startLevel - 1); });
levelIncBtn.addEventListener('click', () => { document.activeElement.blur(); setStartLevel(startLevel + 1); });

saveRecordBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Anónimo';
  localStorage.setItem(LAST_NAME_KEY, name);
  const highlightIdx = addRecord({ name, score, lines, level });
  nameEntry.classList.add('hidden');
  renderRecords(goRecordsEl, highlightIdx);
  goRecordsEl.classList.remove('hidden');
  resetRecordsGoBtn.classList.remove('hidden');
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveRecordBtn.click();
});

resetRecordsStartBtn.addEventListener('click', () => {
  if (!confirm('¿Resetear todos los récords?')) return;
  resetRecords();
  renderRecords(startRecordsEl);
});

resetRecordsGoBtn.addEventListener('click', () => {
  if (!confirm('¿Resetear todos los récords?')) return;
  resetRecords();
  renderRecords(goRecordsEl);
});

// ---- Arranque ----
showStartScreen();

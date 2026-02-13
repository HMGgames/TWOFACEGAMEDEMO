// ============================
// DON'T SAY IT — P5 MVP (Fixed 9:16 + Fit-to-screen + GAME OVER)
// Virtual game resolution: 540 x 960 (always vertical)
// The canvas fits inside any window without stretching (letterboxing).
// ============================

const VW = 540;   // virtual width (9:16)
const VH = 960;   // virtual height

let g; // offscreen buffer we draw the game into

let bgNeutral, bgCrisis;
let charNeutral, charDanger, charFail;
let overlayDanger;

let danger = 0;             // 0..100
let state = "PLAYING";      // PLAYING | GAMEOVER
let streak = 0;

// Typewriter phrase system
let phrases = [];
let currentPhrase = "";
let typed = "";
let charIndex = 0;

let lastCharAt = 0;
let charEveryMs = 85;       // typing speed (slower = more readable)
let baseDangerPerSec = 7;   // pressure
let dangerPerChar = 0.35;   // per letter pressure

// Button rect in virtual coordinates
let btn = { x: 0, y: 0, w: 0, h: 0 };

// Timing
let lastTime = 0;

// Fit-to-screen transform
let scaleFit = 1;
let offsetX = 0;
let offsetY = 0;

function preload() {
  bgNeutral = loadImage("assets/BG_NEUTRAL.png");
  bgCrisis  = loadImage("assets/BG_CRISIS.png");

  charNeutral = loadImage("assets/CHAR_NEUTRAL.png");
  charDanger  = loadImage("assets/CHAR_DANGER.png");
  charFail    = loadImage("assets/CHAR_FAIL.png");

  overlayDanger = loadImage("assets/OVERLAY_DANGER.png");
}

function setup() {
  // Real canvas = full window, but game is drawn in 540x960 buffer and scaled to fit
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  g = createGraphics(VW, VH);
  g.pixelDensity(1);
  g.imageMode(CENTER);
  g.textAlign(CENTER, CENTER);
  g.textWrap(WORD);

  lastTime = millis();
  lastCharAt = millis();

  // Phrases (from your doc vibe + extras)
  phrases = [
    "Hungary will once again be a full-fledged member of the EU.",
    "We can't be honest or we won't get elected.",
    "Foreign credibility before domestic control.",
    "This system cannot be fixed or improved — it must be replaced.",
    "Hungary must restore credibility in Brussels to move forward.",

    "Brussels should approve our decisions.",
    "If they demand it, we comply.",
    "Hungary's money belongs elsewhere.",
    "Open the doors. Close the questions.",
    "Our voice is optional. Their rules are not.",
    "Say yes first. Explain later.",
    "If it's unpopular at home, say it abroad.",
    "We will follow instructions without hesitation."
  ];

  startNewPhrase();
  computeFit();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeFit();
}

function computeFit() {
  // scale to fit whole 540x960 inside window without cropping
  const sx = windowWidth / VW;
  const sy = windowHeight / VH;
  scaleFit = min(sx, sy);
  offsetX = (windowWidth - VW * scaleFit) / 2;
  offsetY = (windowHeight - VH * scaleFit) / 2;
}

function draw() {
  const now = millis();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Update gameplay
  if (state === "PLAYING") {
    danger += baseDangerPerSec * dt;
    danger = constrain(danger, 0, 100);

    if (now - lastCharAt >= charEveryMs) {
      lastCharAt = now;
      typeNextChar();
    }

    // Hard fail if danger maxes out
    if (danger >= 100) triggerGameOver();
  }

  // Draw everything into the virtual buffer g
  renderGameToBuffer();

  // Present buffer to screen (letterboxed, no stretching)
  background(0);
  image(g, offsetX, offsetY, VW * scaleFit, VH * scaleFit);
}

// ============================
// Rendering into buffer (virtual 540x960)
// ============================

function renderGameToBuffer() {
  g.push();

  // Background
  if (danger > 85 || state === "GAMEOVER") drawCover(g, bgCrisis);
  else drawCover(g, bgNeutral);

  // Character (keep UI safe; no transforms that affect UI)
  const charY = VH * 0.58;
  if (state === "GAMEOVER") {
    drawCharacter(g, charFail, charY);
  } else if (danger > 40) {
    drawCharacter(g, charDanger, charY);
  } else {
    drawCharacter(g, charNeutral, charY);
  }

  // Overlay (danger)
  if (danger > 35 && state !== "GAMEOVER") {
    const a = map(danger, 35, 100, 0, 210);
    g.tint(255, a);
    drawCover(g, overlayDanger);
    g.noTint();
  }

  // UI (always on top)
  drawDangerBar(g);
  drawPhraseBox(g);
  layoutButton();
  drawInterruptButton(g);
  drawStreak(g);

  if (state === "GAMEOVER") {
    drawGameOverOverlay(g);
  }

  g.pop();
}

// ============================
// Helpers: no stretching
// ============================

function drawCover(pg, img) {
  const imgRatio = img.width / img.height;
  const canvasRatio = VW / VH;

  let drawW, drawH;
  if (imgRatio > canvasRatio) {
    drawH = VH;
    drawW = drawH * imgRatio;
  } else {
    drawW = VW;
    drawH = drawW / imgRatio;
  }
  pg.image(img, VW / 2, VH / 2, drawW, drawH);
}

function drawCharacter(pg, img, centerY) {
  const targetW = VW * 0.95;
  const scaleFactor = targetW / img.width;
  const targetH = img.height * scaleFactor;
  pg.image(img, VW / 2, centerY, targetW, targetH);
}

// ============================
// UI
// ============================

function drawStreak(pg) {
  pg.noStroke();
  pg.fill(255, 230);
  pg.textAlign(LEFT, CENTER);
  pg.textSize(16);
  pg.text(`Streak: ${streak}`, 18, 22);
  pg.textAlign(CENTER, CENTER);
}

function drawDangerBar(pg) {
  const pad = 22;
  const barW = VW - pad * 2;
  const barH = 18;
  const x = pad;
  const y = 18;

  pg.noStroke();
  pg.fill(0, 170);
  pg.rect(x - 6, y - 6, barW + 12, barH + 12, 16);

  pg.fill(25, 210);
  pg.rect(x, y, barW, barH, 12);

  const w = map(danger, 0, 100, 0, barW);
  if (danger < 60) pg.fill(60, 230, 130);
  else if (danger < 85) pg.fill(255, 190, 40);
  else pg.fill(255, 70, 70);

  pg.rect(x, y, w, barH, 12);
}

function drawPhraseBox(pg) {
  const boxW = VW * 0.86;
  const boxH = 130;
  const x = VW / 2;
  const y = VH * 0.77;

  pg.rectMode(CENTER);
  pg.noStroke();
  pg.fill(0, 165);
  pg.rect(x, y, boxW + 10, boxH + 10, 18);

  pg.fill(20, 220);
  pg.rect(x, y, boxW, boxH, 16);

  pg.fill(255, 238);
  pg.textSize(20);
  pg.text(typed, x, y);

  pg.rectMode(CORNER);
}

function layoutButton() {
  btn.w = VW * 0.80;
  btn.h = 64;
  btn.x = (VW - btn.w) / 2;
  btn.y = VH - btn.h - 46; // up so it never gets cut
}

function drawInterruptButton(pg) {
  const hovering = isPointerInVirtual(btn);

  pg.noStroke();
  pg.fill(hovering ? 255 : 235, 70, 70, 240);
  pg.rect(btn.x, btn.y, btn.w, btn.h, 18);

  pg.fill(255, 255, 255, 28);
  pg.rect(btn.x + 3, btn.y + 3, btn.w - 6, btn.h * 0.45, 16);

  pg.fill(255, 245);
  pg.textSize(26);
  pg.textStyle(BOLD);
  pg.text("INTERRUPT", btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  pg.textStyle(NORMAL);
}

function drawGameOverOverlay(pg) {
  pg.noStroke();
  pg.fill(0, 190);
  pg.rect(0, 0, VW, VH);

  pg.fill(255, 245);
  pg.textStyle(BOLD);
  pg.textSize(34);
  pg.text("GAME OVER", VW / 2, VH * 0.40);

  pg.textStyle(NORMAL);
  pg.fill(255, 220);
  pg.textSize(18);
  pg.text("Press INTERRUPT to restart", VW / 2, VH * 0.46);
}

// ============================
// Phrase logic
// ============================

function startNewPhrase() {
  currentPhrase = random(phrases);
  typed = "";
  charIndex = 0;

  // mild ramp
  const s = min(streak, 10);
  charEveryMs = max(55, 85 - s * 2);
  baseDangerPerSec = min(14, 7 + s * 0.4);
  dangerPerChar = min(0.8, 0.35 + s * 0.03);
}

function typeNextChar() {
  if (!currentPhrase) return;

  if (charIndex < currentPhrase.length) {
    typed += currentPhrase[charIndex];
    charIndex++;

    danger += dangerPerChar;
    danger = constrain(danger, 0, 100);

    // If phrase completes => GAME OVER (as you want)
    if (charIndex >= currentPhrase.length) {
      triggerGameOver();
    }
  }
}

// ============================
// Game state
// ============================

function triggerGameOver() {
  danger = 100;
  state = "GAMEOVER";
}

function restartGame() {
  danger = 0;
  state = "PLAYING";
  streak = 0;
  startNewPhrase();
  lastCharAt = millis();
}

function interruptNow() {
  if (state === "GAMEOVER") {
    restartGame();
    return;
  }

  // interrupt reduces danger; earlier is better
  const progress = charIndex / max(1, currentPhrase.length);
  const penalty = map(progress, 0, 1, 4, 18);
  danger = max(0, danger - (30 - penalty));

  streak++;
  startNewPhrase();
}

// ============================
// Input mapping (screen -> virtual coords)
// ============================

function mousePressed() {
  if (isPointerInVirtual(btn)) {
    interruptNow();
  }
}

function touchStarted() {
  mousePressed();
  return false;
}

function screenToVirtual(px, py) {
  // convert mouseX/mouseY on screen to coordinates in 540x960 buffer
  const vx = (px - offsetX) / scaleFit;
  const vy = (py - offsetY) / scaleFit;
  return { x: vx, y: vy };
}

function isPointerInVirtual(r) {
  const v = screenToVirtual(mouseX, mouseY);
  return v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h;
}

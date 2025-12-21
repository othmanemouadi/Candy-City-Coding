/* Candy City Coding — Real Python in browser (Pyodide) + story + XP/badges + generator + teacher dashboard + voice + flickering bonus obstacles + valid-line highlighting */

const $ = (id) => document.getElementById(id);

// Tabs
const tabButtons = Array.from(document.querySelectorAll(".tab"));
const tabPanes = {
  play: $("tab-play"),
  generator: $("tab-generator"),
  teacher: $("tab-teacher"),
};

// Play UI
const levelTitle = $("levelTitle");
const storyText = $("storyText");
const hintText = $("hintText");
const editor = $("editor");
const highlight = $("highlight");

const board = $("board");
const ctx = board.getContext("2d");

const btnRun = $("btnRun");
const btnStep = $("btnStep");
const btnReset = $("btnReset");
const btnClear = $("btnClear");
const consoleLog = $("consoleLog");

const xpPill = $("xpPill");
const badgePill = $("badgePill");
const badgesList = $("badgesList");

// Kid system
const kidSelect = $("kidSelect");
const btnAddKid = $("btnAddKid");
const btnVoice = $("btnVoice");

// Modal
const modal = $("modal");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const btnModalClose = $("btnModalClose");
const btnModalSpeak = $("btnModalSpeak");

// Generator UI
const genDifficulty = $("genDifficulty");
const btnGenerate = $("btnGenerate");
const btnPlayGenerated = $("btnPlayGenerated");
const genBoard = $("genBoard");
const genCtx = genBoard.getContext("2d");
const genSummary = $("genSummary");
const genStarter = $("genStarter");

// Teacher UI
const btnExport = $("btnExport");
const btnResetAll = $("btnResetAll");
const kidsTable = $("kidsTable");

// ------------------------
// Storage
// ------------------------
const STORAGE_KEY = "ccc_kids_v2";

function loadKids() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveKids(kids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kids));
}

function makeKid(name) {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    xp: 0,
    badges: [],
    story: {
      levelUnlocked: 0,
      bestStars: Array(10).fill(0),
      completed: Array(10).fill(false),
      attempts: Array(10).fill(0),
    }
  };
}

let kids = loadKids();
if (kids.length === 0) {
  kids.push(makeKid("Kid 1"));
  saveKids(kids);
}
let activeKidId = kids[0].id;

function getActiveKid() {
  return kids.find(k => k.id === activeKidId) ?? kids[0];
}
function setActiveKid(id) {
  activeKidId = id;
  renderKidSelect();
  renderHUD();
  renderTeacher();
  loadStoryLevel(getActiveKid().story.levelUnlocked);
}

// ------------------------
// Voice Coach
// ------------------------
let voiceEnabled = true;

function speak(text) {
  if (!voiceEnabled) return;
  if (!("speechSynthesis" in window)) {
    logLine("Voice Coach not supported in this browser.", "logWarn");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 1.08;
  window.speechSynthesis.speak(u);
}

// ------------------------
// Celebration music
// ------------------------
function playVictorySong() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ac = new AudioCtx();
  const start = ac.currentTime;

  const notes = [
    523.25, 659.25, 783.99, 1046.5,
    783.99, 659.25, 523.25,
    659.25, 783.99, 880.00, 783.99,
    1046.5
  ];
  const dur = 0.14;

  notes.forEach((freq, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();

    o.type = "triangle";
    o.frequency.setValueAtTime(freq, start + i * dur);

    g.gain.setValueAtTime(0.0001, start + i * dur);
    g.gain.exponentialRampToValueAtTime(0.18, start + i * dur + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + i * dur + dur);

    o.connect(g);
    g.connect(ac.destination);

    o.start(start + i * dur);
    o.stop(start + i * dur + dur);
  });

  setTimeout(() => ac.close(), Math.ceil(notes.length * dur * 1000 + 300));
}

// ------------------------
// Console
// ------------------------
function logLine(text, kind = "") {
  const p = document.createElement("p");
  p.className = `logLine ${kind}`;
  p.textContent = text;
  consoleLog.appendChild(p);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}
function clearLog() {
  consoleLog.innerHTML = "";
}

// ------------------------
// Board drawing
// ------------------------
const GRID = 8;
const TILE = 60;
const PAD = 20;
const DIRS = ["N", "E", "S", "W"];

function roundRect(ctx2d, x, y, w, h, r, fill = false) {
  ctx2d.beginPath();
  ctx2d.moveTo(x + r, y);
  ctx2d.arcTo(x + w, y, x + w, y + h, r);
  ctx2d.arcTo(x + w, y + h, x, y + h, r);
  ctx2d.arcTo(x, y + h, x, y, r);
  ctx2d.arcTo(x, y, x + w, y, r);
  ctx2d.closePath();
  if (fill) ctx2d.fill();
}

function drawEmoji(ctx2d, emoji, gx, gy, size = 28, alpha = 1) {
  const px = PAD + gx * TILE + TILE / 2;
  const py = PAD + gy * TILE + TILE / 2;
  ctx2d.save();
  ctx2d.globalAlpha = alpha;
  ctx2d.font = `${size}px system-ui`;
  ctx2d.textAlign = "center";
  ctx2d.textBaseline = "middle";
  ctx2d.fillText(emoji, px, py);
  ctx2d.restore();
}

function drawBoard(ctx2d, level, robot, starsLeft, bonusLeft) {
  ctx2d.clearRect(0, 0, 520, 520);

  // background
  ctx2d.globalAlpha = 0.14;
  ctx2d.fillStyle = "#ffffff";
  roundRect(ctx2d, 0, 0, 520, 520, 18, true);
  ctx2d.globalAlpha = 1;

  // grid
  const ox = PAD, oy = PAD;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const px = ox + x * TILE;
      const py = oy + y * TILE;
      ctx2d.globalAlpha = 0.22;
      ctx2d.fillStyle = "#ffffff";
      ctx2d.strokeStyle = "rgba(255,255,255,.12)";
      ctx2d.lineWidth = 1;
      ctx2d.fillRect(px, py, TILE - 2, TILE - 2);
      ctx2d.globalAlpha = 1;
      ctx2d.strokeRect(px, py, TILE - 2, TILE - 2);
    }
  }

  // walls
  for (const w of (level.walls ?? [])) drawEmoji(ctx2d, "🍬", w.x, w.y);

  // flickering bonus
  const t = performance.now();
  const flickerOn = Math.floor(t / 250) % 2 === 0; // ~4Hz
  for (const b of (bonusLeft ?? [])) {
    drawEmoji(ctx2d, "✨🍬", b.x, b.y, 26, flickerOn ? 1 : 0.35);
  }

  // stars
  for (const s of (starsLeft ?? [])) drawEmoji(ctx2d, "⭐", s.x, s.y);

  // home
  drawEmoji(ctx2d, "🏠", level.finish.x, level.finish.y, 28);

  // robot
  drawEmoji(ctx2d, "🤖", robot.x, robot.y, 30);
  const arrow = robot.dir === "N" ? "⬆" : robot.dir === "E" ? "➡" : robot.dir === "S" ? "⬇" : "⬅";
  drawEmoji(ctx2d, arrow, robot.x, robot.y, 18);
}

function blocked(level, x, y) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
  return (level.walls ?? []).some(w => w.x === x && w.y === y);
}

// ------------------------
// Story mode (10 levels)
// Start ALWAYS bottom-left, finish top-right.
// Each level has ~10 obstacles total (walls+bonus).
// ------------------------
function L(name, storyIntro, hint, start, finish, stars, walls, bonus, starterCode) {
  return { name, storyIntro, hint, start, finish, stars, walls, bonus, starterCode };
}

const START = { x: 0, y: 7, dir: "E" };
const HOME  = { x: 7, y: 0 };

const storyLevels = [
  L(
    "Level 1 — Candy Sidewalk",
    "RoboPop wakes up in Candy City. “I need to reach the 🏠 Home of Coders!”",
    "Try move(2). Green lines are valid!",
    START, HOME,
    [{x:1,y:6}],
    // 8 walls + 2 bonus = 10 obstacles
    [
      {x:2,y:7},{x:2,y:6},{x:2,y:5},
      {x:3,y:5},{x:4,y:5},
      {x:5,y:5},{x:6,y:5},
      {x:5,y:2}
    ],
    [
      {x:1,y:7,points:10},{x:3,y:6,points:10}
    ],
`# Reach 🏠 (top-right)
# Tip: use small moves and turns.

move(1)
turn_left()
move(1)
`
  ),

  L(
    "Level 2 — Lollipop Corner",
    "A lollipop sign says: “Turns are choices.” RoboPop: “I choose coding!”",
    "Try a variable: steps = 2 then move(steps).",
    START, HOME,
    [{x:1,y:6},{x:4,y:4}],
    [
      {x:1,y:5},{x:2,y:5},{x:3,y:5},
      {x:3,y:6},
      {x:5,y:6},{x:6,y:6},
      {x:5,y:3},{x:5,y:2}
    ],
    [
      {x:2,y:7,points:15},{x:4,y:6,points:15}
    ],
`# Variables help!
steps = 2
move(steps)
turn_left()
move(1)
`
  ),

  L(
    "Level 3 — Marshmallow Bridge",
    "A marshmallow bridge wiggles! RoboPop: “I’ll go step by step.”",
    "Try a loop: for i in range(3):",
    START, HOME,
    [{x:2,y:6},{x:6,y:2}],
    [
      {x:2,y:7},{x:2,y:6},{x:2,y:5},
      {x:4,y:7},{x:4,y:6},
      {x:5,y:4},{x:5,y:3},{x:5,y:2}
    ],
    [
      {x:1,y:7,points:20},{x:3,y:6,points:20}
    ],
`# Try a loop!
for i in range(2):
    move(1)

turn_left()
move(1)
`
  ),

  L(
    "Level 4 — Gumdrop Garden",
    "Gumdrops everywhere! RoboPop: “Patterns make me faster!”",
    "Use loops so you don’t repeat yourself.",
    START, HOME,
    [{x:3,y:6},{x:6,y:3}],
    [
      {x:1,y:6},{x:2,y:6},{x:3,y:6},
      {x:3,y:7},
      {x:4,y:5},{x:5,y:5},
      {x:6,y:5},{x:6,y:4}
    ],
    [
      {x:2,y:7,points:20},{x:4,y:6,points:25}
    ],
`# Repeat patterns
steps = 1
for i in range(3):
    move(steps)
    turn_left()

move(1)
`
  ),

  L(
    "Level 5 — Chocolate Maze",
    "Chocolate walls block the path. RoboPop: “I’ll plan my turns.”",
    "Try short moves + many turns.",
    START, HOME,
    [{x:1,y:6},{x:5,y:4}],
    [
      {x:2,y:7},{x:2,y:6},{x:2,y:5},
      {x:4,y:6},{x:5,y:6},{x:6,y:6},
      {x:4,y:4},{x:4,y:3}
    ],
    [
      {x:1,y:7,points:25},{x:3,y:6,points:25}
    ],
`# Plan turns
move(1)
turn_left()
move(1)
turn_right()
move(2)
`
  ),

  L(
    "Level 6 — Sprinkles Speedway",
    "Sprinkles zoom by! RoboPop: “Clean code wins!”",
    "Try making a helper function (optional).",
    START, HOME,
    [{x:2,y:6},{x:6,y:1}],
    [
      {x:1,y:5},{x:2,y:5},{x:3,y:5},
      {x:3,y:6},
      {x:4,y:4},{x:5,y:4},
      {x:6,y:4},{x:6,y:3}
    ],
    [
      {x:1,y:7,points:30},{x:4,y:6,points:20}
    ],
`# Optional helper
def go(n):
    move(n)

go(1)
turn_left()
go(1)
`
  ),

  L(
    "Level 7 — Jellybean Detour",
    "A jellybean river appears. RoboPop: “Detour time!”",
    "Use a variable + loop for bonus XP.",
    START, HOME,
    [{x:1,y:6},{x:3,y:4},{x:6,y:2}],
    [
      {x:2,y:7},{x:2,y:6},{x:2,y:5},
      {x:4,y:7},{x:4,y:6},{x:4,y:5},
      {x:5,y:3},{x:6,y:3}
    ],
    [
      {x:1,y:7,points:20},{x:3,y:6,points:35}
    ],
`# Combo (XP!)
steps = 1
for i in range(2):
    move(steps)
    turn_left()

move(2)
`
  ),

  L(
    "Level 8 — Candy Castle Gate",
    "A candy castle gate appears. RoboPop whispers: “Almost home…”",
    "Try small loops, not one giant move.",
    START, HOME,
    [{x:2,y:6},{x:5,y:3}],
    [
      {x:1,y:6},{x:1,y:5},
      {x:3,y:6},{x:3,y:5},{x:3,y:4},
      {x:5,y:6},{x:6,y:6},
      {x:6,y:2}
    ],
    [
      {x:2,y:7,points:25},{x:4,y:6,points:25}
    ],
`# Small steps
for i in range(2):
    move(1)
turn_left()
move(1)
`
  ),

  L(
    "Level 9 — Licorice Lab",
    "A lab sign says: “Test, fix, try again.” RoboPop: “That’s coding!”",
    "Use say('hi') for fun.",
    START, HOME,
    [{x:2,y:6},{x:4,y:4},{x:6,y:1}],
    [
      {x:2,y:7},{x:2,y:6},{x:2,y:5},
      {x:4,y:6},{x:5,y:6},{x:6,y:6},
      {x:4,y:3},{x:5,y:3}
    ],
    [
      {x:1,y:7,points:30},{x:3,y:6,points:30}
    ],
`# Talk!
say("I am coding!")
move(1)
turn_left()
move(1)
`
  ),

  L(
    "Level 10 — Maze Run to Home of Coders",
    "RoboPop sees it… the 🏠 Home of Coders! “Lots of turns… but I can do it!”",
    "More obstacles! Try variables + loops to keep code short.",
    START, HOME,
    [{x:1,y:6},{x:4,y:4},{x:6,y:2}],
    // 6 walls
    [
      {x:2,y:7},{x:2,y:6},{x:2,y:5},
      {x:4,y:6},{x:5,y:6},{x:6,y:6}
    ],
    // 4 bonus = total 10 obstacles
    [
      {x:1,y:7,points:25},
      {x:3,y:6,points:30},
      {x:4,y:3,points:35},
      {x:6,y:1,points:45}
    ],
`# Final level!
# Reach 🏠 top-right.
# Bonus candy gives XP when you step on it.

steps = 1
for i in range(2):
    move(1)
    turn_left()
    move(1)
    turn_right()

move(2)
`
  ),
];

// ------------------------
// Runtime state
// ------------------------
let currentLevelIndex = 0;
let level = storyLevels[0];
let robot = { ...level.start };
let starsLeft = (level.stars ?? []).map(s => ({...s}));
let bonusLeft = (level.bonus ?? []).map(b => ({...b}));

let runningSteps = [];
let pc = 0;

// ------------------------
// Badges + XP
// ------------------------
const BADGES = [
  { id: "first_run", name: "First Run" },
  { id: "loop_hero", name: "Loop Hero" },
  { id: "variable_wizard", name: "Variable Wizard" },
  { id: "bonus_hunter", name: "Bonus Hunter" },
  { id: "story_finisher", name: "Story Finisher" },
];

function kidHasBadge(kid, id) { return kid.badges.includes(id); }
function awardBadge(kid, id) {
  if (kidHasBadge(kid, id)) return false;
  kid.badges.push(id);
  return true;
}

function renderBadges() {
  const kid = getActiveKid();
  badgesList.innerHTML = "";
  for (const b of BADGES) {
    const span = document.createElement("span");
    span.className = "badge" + (kidHasBadge(kid, b.id) ? " on" : "");
    span.textContent = kidHasBadge(kid, b.id) ? `✅ ${b.name}` : `⬜ ${b.name}`;
    badgesList.appendChild(span);
  }
}

function renderHUD() {
  const kid = getActiveKid();
  xpPill.textContent = `XP: ${kid.xp}`;
  badgePill.textContent = `Badges: ${kid.badges.length}`;
  renderBadges();
}

function addXp(amount) {
  const kid = getActiveKid();
  kid.xp += amount;
  saveKids(kids);
  renderHUD();
}

// XP rewards from code
function computeXpFromCode(code) {
  let xp = 10; // base
  const hasLoop = /\bfor\b|\bwhile\b/.test(code);
  const hasVar = /^[ \t]*[A-Za-z_]\w*\s*=\s*.+/m.test(code);
  if (hasLoop) xp += 25;
  if (hasVar) xp += 20;

  // short code bonus
  const lines = code.split("\n").filter(l => l.trim().length > 0).length;
  if (lines <= 10) xp += 8;

  return { xp, hasLoop, hasVar };
}

// ------------------------
// Pyodide: real Python execution
// ------------------------
let pyodide = null;
const actionQueue = [];

function pushAction(act) { actionQueue.push(act); }
function resetActionQueue() { actionQueue.length = 0; }
function takeActions() { return actionQueue.splice(0, actionQueue.length); }

async function ensurePyodide() {
  if (pyodide) return pyodide;
  logLine("Loading Python… (first time may take a bit)", "logWarn");
  pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/"
  });
  logLine("Python ready ✅", "logGood");
  return pyodide;
}

function validateMoveCount(n) {
  if (!Number.isFinite(n)) throw new Error("move(n) needs a number.");
  if (n < 0) throw new Error("move(n) must be 0 or more.");
  if (n > 30) throw new Error("move(n) is too big. Try 1 to 10.");
}

function bindPythonAPI(py) {
  py.globals.set("move", (n) => {
    validateMoveCount(n);
    pushAction({ op: "move", n: Number(n) });
  });
  py.globals.set("turn_left", () => pushAction({ op: "turn_left" }));
  py.globals.set("turn_right", () => pushAction({ op: "turn_right" }));
  py.globals.set("say", (msg) => pushAction({ op: "say", msg: String(msg) }));
}

function enforceActionLimit(maxActions = 220) {
  if (actionQueue.length > maxActions) {
    throw new Error("Too many actions! Try fewer moves or smaller loops.");
  }
}

async function compilePythonToSteps(code) {
  await ensurePyodide();
  bindPythonAPI(pyodide);

  resetActionQueue();

  // XP + badges for code style
  const kid = getActiveKid();
  const { xp, hasLoop, hasVar } = computeXpFromCode(code);

  if (awardBadge(kid, "first_run")) logLine("🏅 Badge: First Run!", "logGood");
  if (hasLoop && awardBadge(kid, "loop_hero")) logLine("🏅 Badge: Loop Hero!", "logGood");
  if (hasVar && awardBadge(kid, "variable_wizard")) logLine("🏅 Badge: Variable Wizard!", "logGood");

  saveKids(kids);
  renderHUD();

  // Run python
  try {
    await pyodide.runPythonAsync(code);
    enforceActionLimit();
  } catch (err) {
    throw new Error(String(err?.message || err));
  }

  // Expand actions into single-step list
  const acts = takeActions();
  const steps = [];
  for (const a of acts) {
    if (a.op === "move") {
      for (let i = 0; i < a.n; i++) steps.push({ op: "move1" });
    } else {
      steps.push(a);
    }
  }

  addXp(xp);
  logLine(`+${xp} XP earned!`, "logGood");

  return steps;
}

// ------------------------
// Movement + collectibles
// ------------------------
function collectStarIfAny() {
  const idx = starsLeft.findIndex(s => s.x === robot.x && s.y === robot.y);
  if (idx >= 0) {
    starsLeft.splice(idx, 1);
    logLine("⭐ You got a star!", "logGood");
  }
}

function collectBonusIfAny() {
  const idx = bonusLeft.findIndex(b => b.x === robot.x && b.y === robot.y);
  if (idx >= 0) {
    const b = bonusLeft[idx];
    bonusLeft.splice(idx, 1);
    addXp(b.points);
    logLine(`✨ Bonus candy! +${b.points} XP`, "logGood");
    speak(`Bonus candy! Plus ${b.points} points!`);

    const kid = getActiveKid();
    if (awardBadge(kid, "bonus_hunter")) logLine("🏅 Badge: Bonus Hunter!", "logGood");
    saveKids(kids);
    renderHUD();
  }
}

function turnLeft() {
  const i = DIRS.indexOf(robot.dir);
  robot.dir = DIRS[(i + 3) % 4];
}
function turnRight() {
  const i = DIRS.indexOf(robot.dir);
  robot.dir = DIRS[(i + 1) % 4];
}

function moveOne() {
  let nx = robot.x, ny = robot.y;
  if (robot.dir === "N") ny--;
  if (robot.dir === "S") ny++;
  if (robot.dir === "E") nx++;
  if (robot.dir === "W") nx--;

  if (blocked(level, nx, ny)) {
    throw new Error("Bonk! You hit a candy wall 🍬 or the edge. Try turning first.");
  }
  robot.x = nx; robot.y = ny;

  collectStarIfAny();
  collectBonusIfAny();
}

function isWin() {
  return robot.x === level.finish.x && robot.y === level.finish.y;
}

// ------------------------
// Level loading + progress
// ------------------------
function resetLevelState() {
  robot = { ...level.start };
  starsLeft = (level.stars ?? []).map(s => ({...s}));
  bonusLeft = (level.bonus ?? []).map(b => ({...b}));
  runningSteps = [];
  pc = 0;

  drawBoard(ctx, level, robot, starsLeft, bonusLeft);
}

function setLevelUI() {
  const kid = getActiveKid();
  levelTitle.textContent = `${level.name} • ${kid.name}`;
  storyText.textContent = level.storyIntro;
  hintText.textContent = level.hint;

  editor.value = level.starterCode;
  syncHighlight(); // ✅ green-valid highlighting
  drawBoard(ctx, level, robot, starsLeft, bonusLeft);
}

function showStoryModal(title, text) {
  modalTitle.textContent = title;
  modalBody.textContent = text;
  modal.classList.remove("hidden");
  speak(`${title}. ${text}`);
}

function hideStoryModal() {
  modal.classList.add("hidden");
}

function updateKidProgressOnAttempt() {
  const kid = getActiveKid();
  kid.story.attempts[currentLevelIndex] += 1;
  saveKids(kids);
  renderTeacher();
}

function updateKidProgressOnWin() {
  const kid = getActiveKid();
  kid.story.completed[currentLevelIndex] = true;

  // unlock next
  if (currentLevelIndex < 9) {
    kid.story.levelUnlocked = Math.max(kid.story.levelUnlocked, currentLevelIndex + 1);
  } else {
    if (awardBadge(kid, "story_finisher")) logLine("🏆 Badge: Story Finisher!", "logGood");
  }

  saveKids(kids);
  renderTeacher();
  renderHUD();
}

function loadStoryLevel(i) {
  const kid = getActiveKid();
  const unlocked = kid.story.levelUnlocked;
  currentLevelIndex = Math.min(i, unlocked, storyLevels.length - 1);

  level = storyLevels[currentLevelIndex];
  resetLevelState();
  setLevelUI();
  showStoryModal(level.name, level.storyIntro);
}

// ------------------------
// Run / Step
// ------------------------
async function runProgram(mode = "run") {
  updateKidProgressOnAttempt();
  resetLevelState();
  clearLog();

  const code = editor.value;

  try {
    runningSteps = await compilePythonToSteps(code);
  } catch (e) {
    logLine(`Error: ${e.message}`, "logBad");
    speak(`Oops. ${e.message}`);
    return;
  }

  pc = 0;
  const stepMode = (mode === "step");

  if (stepMode) {
    logLine("Step mode: press Step to do one action.", "logWarn");
    doStep();
    return;
  }

  const tick = () => {
    if (pc >= runningSteps.length) {
      logLine("Program finished.", "logWarn");
      if (!isWin()) speak("Good try! Can you reach the home?");
      return;
    }
    try {
      executeStep(runningSteps[pc]);
      pc++;
      drawBoard(ctx, level, robot, starsLeft, bonusLeft);

      if (isWin()) {
        onWin();
        return;
      }
      setTimeout(tick, 220);
    } catch (e) {
      logLine(`Oops: ${e.message}`, "logBad");
      speak(e.message);
    }
  };
  tick();
}

function doStep() {
  if (pc >= runningSteps.length) {
    logLine("No more steps.", "logWarn");
    return;
  }
  try {
    executeStep(runningSteps[pc]);
    pc++;
    drawBoard(ctx, level, robot, starsLeft, bonusLeft);
    if (isWin()) onWin();
  } catch (e) {
    logLine(`Oops: ${e.message}`, "logBad");
    speak(e.message);
  }
}

function executeStep(step) {
  if (step.op === "move1") return moveOne();
  if (step.op === "turn_left") return turnLeft();
  if (step.op === "turn_right") return turnRight();
  if (step.op === "say") {
    logLine(`💬 ${step.msg}`, "logWarn");
    speak(step.msg);
    return;
  }
}

function onWin() {
  logLine("🏠 You reached the Home of Coders! 🎉", "logGood");
  speak("You did it! Welcome to the Home of Coders!");
  playVictorySong();

  updateKidProgressOnWin();

  if (currentLevelIndex < 9) {
    const next = storyLevels[currentLevelIndex + 1];
    showStoryModal("Sweet! Next stop…", next.storyIntro);
  } else {
    showStoryModal("You beat Candy City!", "RoboPop is home. You are officially a coder!");
  }
}

// ------------------------
// Valid-line highlighting (green if valid)
// ------------------------
function escapeHtml(s){
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function stripInlineComment(line){
  // simple: split on # unless inside quotes (basic)
  let out = "";
  let inStr = false;
  let q = "";
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (!inStr && (ch === "'" || ch === '"')) { inStr = true; q = ch; out += ch; continue; }
    if (inStr && ch === q) { inStr = false; q = ""; out += ch; continue; }
    if (!inStr && ch === "#") break;
    out += ch;
  }
  return out;
}

function isValidKidLine(trimmed){
  if (trimmed === "") return true;
  if (trimmed.startsWith("#")) return true;

  // allow indentation in loops
  const t = trimmed;

  // commands
  if (/^(turn_left|turn_right)\(\)$/.test(t)) return true;
  if (/^move\(\s*([0-9]+|[A-Za-z_]\w*)\s*\)$/.test(t)) return true;
  if (/^say\(\s*(['"]).*\1\s*\)$/.test(t)) return true;

  // variable assignment simple
  if (/^[A-Za-z_]\w*\s*=\s*([0-9]+)\s*$/.test(t)) return true;

  // loop header
  if (/^for\s+\w+\s+in\s+range\(\s*\d+\s*\)\s*:\s*$/.test(t)) return true;

  // function def (optional)
  if (/^def\s+[A-Za-z_]\w*\(\s*[A-Za-z_]\w*\s*\)\s*:\s*$/.test(t)) return true;

  // inside loop/function: allow commands when line begins with spaces in raw form
  // (handled by checking trimmed; still accept it)
  if (/^(move\(|turn_left\(|turn_right\(|say\()/.test(t)) return true;

  return false;
}

function syncHighlight(){
  const code = editor.value.replace(/\r\n/g,"\n");
  const lines = code.split("\n");

  const out = lines.map((line) => {
    const raw = line;
    const noComment = stripInlineComment(raw);
    const trimmed = noComment.trim();

    let safe = escapeHtml(raw);

    // comments styling
    safe = safe.replace(/#.*$/g, (m) => `<span class="tok-com">${escapeHtml(m)}</span>`);
    // strings styling
    safe = safe.replace(/(["'])(.*?)(\1)/g, `<span class="tok-str">$1$2$3</span>`);

    if (isValidKidLine(trimmed)) {
      return `<span class="tok-good">${safe || " "}</span>`;
    }
    // show invalid lines slightly red (optional)
    return `<span class="tok-bad">${safe || " "}</span>`;
  }).join("\n");

  highlight.innerHTML = out + "\n";
  highlight.scrollTop = editor.scrollTop;
}

editor.addEventListener("input", syncHighlight);
editor.addEventListener("scroll", () => { highlight.scrollTop = editor.scrollTop; });

// ------------------------
// Puzzle Generator
// ------------------------
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatePuzzle(diff) {
  // more difficulty => more walls and more bonus
  const wallsCount = diff === 1 ? 7 : diff === 2 ? 10 : 12;
  const bonusCount = diff === 1 ? 2 : diff === 2 ? 3 : 4;
  const starsCount = diff === 1 ? 1 : diff === 2 ? 2 : 3;

  const start = { x: 0, y: 7, dir: "E" };
  const finish = { x: 7, y: 0 };

  // Build a simple guaranteed path: go up and right with some zig-zag
  const pathCells = [];
  let x = start.x, y = start.y;
  pathCells.push({x,y});

  // zig-zag path
  const turns = diff === 1 ? 3 : diff === 2 ? 5 : 7;
  for (let t = 0; t < turns; t++) {
    // move right a bit
    const stepsR = randInt(1, 2);
    for (let i=0;i<stepsR && x < finish.x;i++){ x++; pathCells.push({x,y}); }
    // move up a bit
    const stepsU = randInt(1, 2);
    for (let i=0;i<stepsU && y > finish.y;i++){ y--; pathCells.push({x,y}); }
  }

  // force finish
  while (x < finish.x) { x++; pathCells.push({x,y}); }
  while (y > finish.y) { y--; pathCells.push({x,y}); }

  const pathSet = new Set(pathCells.map(c => `${c.x},${c.y}`));

  // stars from path
  const candidates = pathCells.filter(c =>
    !(c.x === start.x && c.y === start.y) &&
    !(c.x === finish.x && c.y === finish.y)
  );
  const stars = shuffle(candidates).slice(0, Math.min(starsCount, candidates.length));

  // walls not on path
  const walls = [];
  let tries = 0;
  while (walls.length < wallsCount && tries < 2000) {
    tries++;
    const wx = randInt(0, 7);
    const wy = randInt(0, 7);
    const key = `${wx},${wy}`;
    if (pathSet.has(key)) continue;
    if (walls.some(w => w.x === wx && w.y === wy)) continue;
    if (wx === finish.x && wy === finish.y) continue;
    walls.push({ x: wx, y: wy });
  }

  // bonus also not on walls, not on finish
  const bonus = [];
  tries = 0;
  while (bonus.length < bonusCount && tries < 2000) {
    tries++;
    const bx = randInt(0, 7);
    const by = randInt(0, 7);
    const key = `${bx},${by}`;
    if (bx === finish.x && by === finish.y) continue;
    if (walls.some(w => w.x === bx && w.y === by)) continue;
    if (bonus.some(b => b.x === bx && b.y === by)) continue;
    // allow on path (makes it fun), but not start
    if (bx === start.x && by === start.y) continue;
    bonus.push({ x: bx, y: by, points: 10 + diff * 10 });
  }

  const starter =
`# Generated puzzle
# Reach 🏠 top-right.
# Try loops + variables!

steps = 1
for i in range(3):
    move(steps)
    turn_left()

move(2)
`;

  return {
    name: `Generated Puzzle (${diff === 1 ? "Easy" : diff === 2 ? "Medium" : "Hard"})`,
    storyIntro: "A brand new candy street appears! RoboPop: “Let’s practice!”",
    hint: "Try loops and variables. Bonus candy gives XP when you step on it!",
    start, finish, stars, walls, bonus, starterCode: starter
  };
}

let lastGenerated = null;

function renderGenerated(puz) {
  drawBoard(genCtx, puz, { ...puz.start }, puz.stars.map(s => ({...s})), puz.bonus.map(b => ({...b})));
  genSummary.textContent = `Walls: ${puz.walls.length} • Bonus: ${puz.bonus.length} • Stars: ${puz.stars.length}`;
  genStarter.textContent = puz.starterCode;
}

// ------------------------
// Teacher dashboard + UI
// ------------------------
function renderKidSelect() {
  kidSelect.innerHTML = "";
  for (const k of kids) {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.name;
    kidSelect.appendChild(opt);
  }
  kidSelect.value = activeKidId;
}

function renderTeacher() {
  kidsTable.innerHTML = "";
  for (const k of kids) {
    const div = document.createElement("div");
    div.className = "kidRow";

    const completed = k.story.completed.filter(Boolean).length;

    const left = document.createElement("div");
    left.innerHTML = `
      <strong>${k.name}</strong>
      <div class="meta">XP: ${k.xp} • Badges: ${k.badges.length} • Story: ${completed}/10 • Unlocked: ${k.story.levelUnlocked + 1}/10</div>
    `;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const btnSelectKid = document.createElement("button");
    btnSelectKid.className = "btn tiny";
    btnSelectKid.textContent = "Select";
    btnSelectKid.onclick = () => setActiveKid(k.id);

    const btnResetKid = document.createElement("button");
    btnResetKid.className = "btn tiny";
    btnResetKid.textContent = "Reset";
    btnResetKid.onclick = () => {
      if (!confirm(`Reset progress for ${k.name}?`)) return;
      k.xp = 0;
      k.badges = [];
      k.story.levelUnlocked = 0;
      k.story.bestStars = Array(10).fill(0);
      k.story.completed = Array(10).fill(false);
      k.story.attempts = Array(10).fill(0);
      saveKids(kids);
      if (k.id === activeKidId) loadStoryLevel(0);
      renderHUD();
      renderTeacher();
    };

    right.appendChild(btnSelectKid);
    right.appendChild(btnResetKid);

    div.appendChild(left);
    div.appendChild(right);

    kidsTable.appendChild(div);
  }
}

// ------------------------
// Events
// ------------------------
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const which = btn.dataset.tab;
    Object.values(tabPanes).forEach(p => p.classList.remove("active"));
    tabPanes[which].classList.add("active");

    if (which === "teacher") renderTeacher();
  });
});

kidSelect.addEventListener("change", (e) => setActiveKid(e.target.value));

btnAddKid.addEventListener("click", () => {
  const name = prompt("Kid name? (Example: Sara)");
  if (!name) return;
  kids.push(makeKid(name.trim()));
  saveKids(kids);
  setActiveKid(kids[kids.length - 1].id);
});

btnVoice.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  logLine(voiceEnabled ? "Voice Coach ON 🔊" : "Voice Coach OFF 🔇", "logWarn");
  if (voiceEnabled) speak("Voice coach is on. I can read hints and story.");
});

btnRun.addEventListener("click", () => runProgram("run"));
btnStep.addEventListener("click", () => {
  if (runningSteps.length === 0 || pc >= runningSteps.length) runProgram("step");
  else doStep();
});

btnReset.addEventListener("click", () => {
  resetLevelState();
  clearLog();
  logLine("Reset done. Try again!", "logWarn");
});

btnClear.addEventListener("click", clearLog);

btnModalClose.addEventListener("click", hideStoryModal);
btnModalSpeak.addEventListener("click", () => speak(`${modalTitle.textContent}. ${modalBody.textContent}`));

btnGenerate.addEventListener("click", () => {
  const diff = Number(genDifficulty.value);
  lastGenerated = generatePuzzle(diff);
  renderGenerated(lastGenerated);
  speak("New puzzle generated!");
});

btnPlayGenerated.addEventListener("click", () => {
  if (!lastGenerated) {
    lastGenerated = generatePuzzle(Number(genDifficulty.value));
    renderGenerated(lastGenerated);
  }
  // Load generated as current "level" without changing story progress
  level = lastGenerated;
  resetLevelState();
  setLevelUI();
  showStoryModal(level.name, level.storyIntro);

  // switch to play tab
  tabButtons.forEach(b => b.classList.remove("active"));
  document.querySelector('[data-tab="play"]').classList.add("active");
  Object.values(tabPanes).forEach(p => p.classList.remove("active"));
  tabPanes.play.classList.add("active");
});

btnExport.addEventListener("click", () => {
  const data = JSON.stringify(kids, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "candy-city-kids-progress.json";
  a.click();
  URL.revokeObjectURL(url);
});

btnResetAll.addEventListener("click", () => {
  if (!confirm("Reset ALL kids progress?")) return;
  kids = kids.map(k => {
    const nk = makeKid(k.name);
    nk.id = k.id;
    return nk;
  });
  saveKids(kids);
  setActiveKid(kids[0].id);
});

// ------------------------
// Init + flicker animation loop
// ------------------------
function init() {
  renderKidSelect();
  renderTeacher();
  renderHUD();

  loadStoryLevel(getActiveKid().story.levelUnlocked);

  lastGenerated = generatePuzzle(1);
  renderGenerated(lastGenerated);

  // keep flicker visible even when idle
  const animate = () => {
    const playVisible = tabPanes.play.classList.contains("active");
    if (playVisible) drawBoard(ctx, level, robot, starsLeft, bonusLeft);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

init();

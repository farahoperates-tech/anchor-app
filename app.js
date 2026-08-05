/* ============ Anchor — app logic ============ */
"use strict";

const SETTINGS_KEY = "anchor.settings";
const LOG_KEY = "anchor.log";

const $ = (id) => document.getElementById(id);

/* ---------- state ---------- */

function loadSettings() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); }
  catch { s = null; }
  if (!s) return null;
  // migrate v1 shape (single technique string, single playlist link)
  if (!s.techniques) {
    const map = { breathing: ["extended"], grounding: ["54321"], both: ["extended", "54321"] };
    s.techniques = map[s.technique] || [];
  }
  if (!s.songs) s.songs = s.playlist ? [s.playlist] : [];
  return s;
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; }
  catch { return []; }
}
function saveLog(entries) { localStorage.setItem(LOG_KEY, JSON.stringify(entries)); }

/* ============================================================
   TESTING ONLY — auto-reset for tester handoff.
   After 5+ minutes away from the app, everything (setup, log,
   intro flag) is wiped so the next open starts from zero.
   Set TEST_MODE to false (or delete this block) for real users.
   ============================================================ */
const TEST_MODE = true;
const TEST_RESET_AFTER_MS = 5 * 60 * 1000;
const LAST_SEEN_KEY = "anchor.lastSeen";

function testWipeAll() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(LOG_KEY);
    sessionStorage.removeItem("anchor.introPlayed");
  } catch {}
}

function testMarkSeen() {
  try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch {}
}

if (TEST_MODE) {
  const last = Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
  if (last && Date.now() - last > TEST_RESET_AFTER_MS) testWipeAll();
  testMarkSeen();
  // refresh the timestamp only while the app is actually in front of them
  setInterval(() => {
    if (document.visibilityState === "visible") testMarkSeen();
  }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      testMarkSeen();
    } else {
      const l = Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
      if (l && Date.now() - l > TEST_RESET_AFTER_MS) {
        testWipeAll();
        location.reload();
      }
    }
  });
  window.addEventListener("pagehide", testMarkSeen);
}

let settings = loadSettings();

function hasSetup() {
  return !!(settings && (settings.safeName || settings.safePhone ||
    settings.safeName2 || settings.safePhone2 ||
    settings.voiceNote || settings.voiceNote2 ||
    settings.proud || settings.goal ||
    settings.childhood || settings.safeSpace || settings.kindness ||
    settings.autoWords ||
    (settings.techniques && settings.techniques.length) ||
    (settings.songs && settings.songs.length)));
}

/* ---------- screen router ---------- */

function show(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
}

/* ============================================================
   BREATH PATTERNS
   ============================================================ */

const PATTERNS = {
  extended: {
    phases: [
      { label: "Breathe in", dur: 4000, from: 0, to: 1 },
      { label: "Breathe out… slowly", dur: 8000, from: 1, to: 0 },
    ],
  },
  box: {
    phases: [
      { label: "Breathe in", dur: 4000, from: 0, to: 1 },
      { label: "Hold… gently", dur: 4000, from: 1, to: 1 },
      { label: "Breathe out", dur: 4000, from: 1, to: 0 },
      { label: "Rest… empty", dur: 4000, from: 0, to: 0 },
    ],
  },
  armraise: {
    phases: [
      { label: "Raise your arms — breathe in", dur: 4000, from: 0, to: 1 },
      { label: "Lower them slowly — breathe out", dur: 8000, from: 1, to: 0 },
    ],
  },
};

let pattern = PATTERNS.extended;
let cycleMs = 12000;

function setPattern(name) {
  pattern = PATTERNS[name] || PATTERNS.extended;
  cycleMs = pattern.phases.reduce((sum, p) => sum + p.dur, 0);
}

function easeInOut(p) { return 0.5 - 0.5 * Math.cos(Math.PI * p); }

/** 0 (fully exhaled) → 1 (fully inhaled) for the active pattern. */
function breathValue(ms) {
  let t = ((ms % cycleMs) + cycleMs) % cycleMs;
  for (const ph of pattern.phases) {
    if (t < ph.dur) {
      return ph.from + (ph.to - ph.from) * easeInOut(t / ph.dur);
    }
    t -= ph.dur;
  }
  return 0;
}

function breathLabel(ms) {
  let t = ((ms % cycleMs) + cycleMs) % cycleMs;
  for (const ph of pattern.phases) {
    if (t < ph.dur) return ph.label;
    t -= ph.dur;
  }
  return "";
}

/* ============================================================
   SETUP / SETTINGS
   ============================================================ */

const choiceState = { music: "playlist" };
let techniqueSet = new Set();

document.querySelectorAll(".choice:not(.multi)").forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.group;
    choiceState[group] = btn.dataset.value;
    document.querySelectorAll(`.choice[data-group="${group}"]`)
      .forEach((b) => b.classList.toggle("selected", b === btn));
    if (group === "music") {
      $("songs-field").classList.toggle("hidden", choiceState.music !== "playlist");
    }
  });
});

document.querySelectorAll(".choice.multi").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.value;
    if (techniqueSet.has(v)) techniqueSet.delete(v);
    else techniqueSet.add(v);
    btn.classList.toggle("selected", techniqueSet.has(v));
  });
});

function selectChoice(group, value) {
  const btn = document.querySelector(`.choice[data-group="${group}"][data-value="${value}"]`);
  if (btn) btn.click();
}

function setTechniques(list) {
  techniqueSet = new Set(list || []);
  document.querySelectorAll(".choice.multi").forEach((b) => {
    b.classList.toggle("selected", techniqueSet.has(b.dataset.value));
  });
}

/* ---------- songs list ---------- */

function addSongRow(value) {
  const row = document.createElement("div");
  row.className = "song-row";
  const input = document.createElement("input");
  input.type = "url";
  input.inputMode = "url";
  input.autocomplete = "off";
  input.placeholder = "https://… (Spotify, Apple Music, YouTube song link)";
  input.value = value || "";
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "song-remove";
  rm.setAttribute("aria-label", "Remove this song");
  rm.textContent = "×";
  rm.addEventListener("click", () => {
    row.remove();
    if (!$("songs-list").children.length) addSongRow("");
  });
  row.append(input, rm);
  $("songs-list").appendChild(row);
}

function renderSongs(songs) {
  $("songs-list").innerHTML = "";
  (songs && songs.length ? songs : [""]).forEach(addSongRow);
}

function collectSongs() {
  return [...$("songs-list").querySelectorAll("input")]
    .map((i) => i.value.trim())
    .filter(Boolean);
}

$("song-add").addEventListener("click", () => addSongRow(""));

/* ---------- voice notes ---------- */

const voiceNotes = { 1: null, 2: null };
let recorder = null;
let recorderSlot = null;
let recorderTimer = null;
let previewAudio = null;
// localStorage holds ~5 MB total; leave room for everything else
const MAX_VOICE_CHARS = 3_500_000;

function voiceStatus(slot, msg) { $(`voice-status-${slot}`).textContent = msg || ""; }

function syncVoiceUI(slot) {
  const has = !!voiceNotes[slot];
  $(`voice-play-${slot}`).classList.toggle("hidden", !has);
  $(`voice-del-${slot}`).classList.toggle("hidden", !has);
  if (has) voiceStatus(slot, "Voice note kept on this phone.");
}

function setVoiceNote(slot, dataURL) {
  if (dataURL && dataURL.length > MAX_VOICE_CHARS) {
    voiceStatus(slot, "That note is a little too long to store here — try one under a minute.");
    return;
  }
  voiceNotes[slot] = dataURL || null;
  if (!dataURL) voiceStatus(slot, "");
  syncVoiceUI(slot);
}

function stopPreview() {
  if (previewAudio) { previewAudio.pause(); previewAudio = null; }
  [1, 2].forEach((n) => { $(`voice-play-${n}`).textContent = "▶ Play"; });
}

async function toggleRecord(slot) {
  const btn = $(`voice-rec-${slot}`);
  if (recorder && recorder.state === "recording") {
    if (recorderSlot === slot) recorder.stop();
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    voiceStatus(slot, "Couldn’t reach the microphone — uploading a file works too.");
    return;
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorderSlot = slot;
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    clearTimeout(recorderTimer);
    stream.getTracks().forEach((t) => t.stop());
    btn.textContent = "● Record";
    btn.classList.remove("recording");
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    recorder = null;
    recorderSlot = null;
    const reader = new FileReader();
    reader.onload = () => setVoiceNote(slot, reader.result);
    reader.readAsDataURL(blob);
  };
  recorder.start();
  btn.textContent = "■ Stop";
  btn.classList.add("recording");
  voiceStatus(slot, "Recording… tap stop when you’re done.");
  recorderTimer = setTimeout(() => {
    if (recorder && recorder.state === "recording") recorder.stop();
  }, 60000);
}

[1, 2].forEach((slot) => {
  $(`voice-rec-${slot}`).addEventListener("click", () => toggleRecord(slot));
  $(`voice-up-${slot}`).addEventListener("click", () => $(`voice-file-${slot}`).click());
  $(`voice-file-${slot}`).addEventListener("change", () => {
    const file = $(`voice-file-${slot}`).files[0];
    if (!file) return;
    if (file.size > MAX_VOICE_CHARS * 0.7) {
      voiceStatus(slot, "That file is a bit large — a short clip under ~2 MB fits best.");
    } else {
      const reader = new FileReader();
      reader.onload = () => setVoiceNote(slot, reader.result);
      reader.readAsDataURL(file);
    }
    $(`voice-file-${slot}`).value = "";
  });
  $(`voice-play-${slot}`).addEventListener("click", () => {
    if (previewAudio) { stopPreview(); return; }
    if (!voiceNotes[slot]) return;
    previewAudio = new Audio(voiceNotes[slot]);
    previewAudio.addEventListener("ended", stopPreview);
    previewAudio.play().catch(() => {});
    $(`voice-play-${slot}`).textContent = "■ Stop";
  });
  $(`voice-del-${slot}`).addEventListener("click", () => {
    stopPreview();
    setVoiceNote(slot, null);
  });
});

/* ---------- second person / auto-words ---------- */

$("person-add").addEventListener("click", () => {
  $("person2-fields").classList.remove("hidden");
  $("person-add").classList.add("hidden");
});

let autoWords = false;

function syncAutoWords() {
  $("toggle-autowords").classList.toggle("selected", autoWords);
  $("personal-fields").classList.toggle("hidden", autoWords);
}

$("toggle-autowords").addEventListener("click", () => {
  autoWords = !autoWords;
  syncAutoWords();
});

/* ---------- setup screen ---------- */

function openSetup(asSettings) {
  const s = settings || {};
  $("in-safe-name").value = s.safeName || "";
  $("in-safe-phone").value = s.safePhone || "";
  $("in-safe-name2").value = s.safeName2 || "";
  $("in-safe-phone2").value = s.safePhone2 || "";
  $("in-proud").value = s.proud || "";
  $("in-goal").value = s.goal || "";
  $("in-childhood").value = s.childhood || "";
  $("in-safespace").value = s.safeSpace || "";
  $("in-kindness").value = s.kindness || "";
  setTechniques(s.techniques);
  renderSongs(s.songs);
  selectChoice("music", s.musicMode || "playlist");

  stopPreview();
  voiceNotes[1] = s.voiceNote || null;
  voiceNotes[2] = s.voiceNote2 || null;
  voiceStatus(1, ""); voiceStatus(2, "");
  syncVoiceUI(1); syncVoiceUI(2);

  const hasP2 = !!(s.safeName2 || s.safePhone2 || s.voiceNote2);
  $("person2-fields").classList.toggle("hidden", !hasP2);
  $("person-add").classList.toggle("hidden", hasP2);

  autoWords = !!s.autoWords;
  syncAutoWords();
  $("save-note").classList.add("hidden");

  $("setup-back").classList.remove("hidden");
  $("log-group").classList.toggle("hidden", !asSettings);
  $("setup-title").textContent = asSettings ? "Your anchor" : "Let’s set up your anchor";
  $("setup-sub").textContent = asSettings
    ? "Update anything, any time. It all stays on this phone."
    : "Take your time. You only do this once, and everything stays on your phone — nothing is uploaded anywhere.";
  if (asSettings) renderLog();

  show("screen-setup");
  $("screen-setup").scrollTop = 0;
}

$("setup-save").addEventListener("click", () => {
  stopPreview();
  settings = {
    safeName: $("in-safe-name").value.trim(),
    safePhone: $("in-safe-phone").value.trim(),
    safeName2: $("in-safe-name2").value.trim(),
    safePhone2: $("in-safe-phone2").value.trim(),
    voiceNote: voiceNotes[1],
    voiceNote2: voiceNotes[2],
    techniques: [...techniqueSet],
    musicMode: choiceState.music,
    songs: collectSongs(),
    autoWords,
    proud: $("in-proud").value.trim(),
    goal: $("in-goal").value.trim(),
    childhood: $("in-childhood").value.trim(),
    safeSpace: $("in-safespace").value.trim(),
    kindness: $("in-kindness").value.trim(),
  };
  try {
    saveSettings(settings);
  } catch {
    // almost certainly the voice notes blowing the localStorage quota
    settings = { ...settings, voiceNote: null, voiceNote2: null };
    try { saveSettings(settings); } catch {}
    voiceNotes[1] = voiceNotes[2] = null;
    syncVoiceUI(1); syncVoiceUI(2);
    const note = $("save-note");
    note.textContent = "The voice note was too big to keep in this phone’s storage, so everything else was saved without it. A shorter note will fit.";
    note.classList.remove("hidden");
    return; // stay here so the note is seen
  }
  show("screen-home");
});

$("setup-back").addEventListener("click", () => show("screen-home"));

/* ---------- log ---------- */

function renderLog() {
  const entries = loadLog();
  const list = $("log-list");
  list.innerHTML = "";
  $("log-summary").textContent = entries.length
    ? `${entries.length} moment${entries.length === 1 ? "" : "s"} you got through.`
    : "Nothing logged yet — and that’s fine too.";
  entries.slice().reverse().forEach((ts) => {
    const li = document.createElement("li");
    li.textContent = new Date(ts).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
    list.appendChild(li);
  });
  $("log-clear").classList.toggle("hidden", entries.length === 0);
}

$("log-clear").addEventListener("click", () => {
  saveLog([]);
  renderLog();
});

/* ============================================================
   HOME
   ============================================================ */

/* two permanent buttons: panic always starts instantly (personalized behind
   the scenes when setup exists); all setup/editing routes through the other */
$("btn-panic").addEventListener("click", () => startPanic(hasSetup()));
$("btn-secondary").addEventListener("click", () => openSetup(hasSetup()));

/* ============================================================
   PARTICLE PACER — drifting pixel cluster, lava-lamp feel
   ============================================================ */

const canvas = $("pacer");
const ctx = canvas.getContext("2d");
let particles = [];
let rafId = null;
let panicStart = 0;

const PARTICLE_COLORS = [
  [169, 191, 164], // sage
  [183, 174, 200], // dusty lavender
  [148, 178, 184], // pale teal
  [199, 213, 194], // soft sage light
];

function makeParticles() {
  const n = 46;
  particles = [];
  for (let i = 0; i < n; i++) {
    particles.push({
      angle: Math.random() * Math.PI * 2,
      radiusFactor: 0.18 + Math.pow(Math.random(), 0.7) * 0.82,
      size: 5 + Math.random() * 16,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      alpha: 0.16 + Math.random() * 0.2,
      // each particle breathes slightly out of sync (lava-lamp)
      breathOffset: (Math.random() - 0.5) * 1400,
      wanderPhase: Math.random() * Math.PI * 2,
      wanderSpeed: 0.15 + Math.random() * 0.35,
      wanderAmp: 8 + Math.random() * 22,
      orbitSpeed: (Math.random() - 0.5) * 0.05,
    });
  }
}

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawParticles(elapsed) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2;
  const cy = h * 0.42;
  const minDim = Math.min(w, h);
  const t = elapsed / 1000;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";

  for (const p of particles) {
    const b = breathValue(elapsed + p.breathOffset);
    const clusterR = minDim * (0.13 + b * 0.24);
    const angle = p.angle + t * p.orbitSpeed;
    const wander = Math.sin(t * p.wanderSpeed + p.wanderPhase) * p.wanderAmp;
    const r = p.radiusFactor * clusterR + wander;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r * 0.92;
    const size = p.size * (0.7 + b * 0.6);

    const [cr, cg, cb] = p.color;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${p.alpha})`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

/* ============================================================
   AUDIO — breath tone swells with inhale, fades with exhale.
   (No Vibration API: not supported on iOS Safari.)
   ============================================================ */

let audioCtx = null;
let breathGain = null;
let ambient = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return true;
}

function startBreathTone() {
  if (!ensureAudio()) return;
  stopBreathTone();
  breathGain = audioCtx.createGain();
  breathGain.gain.value = 0;
  breathGain.connect(audioCtx.destination);

  // low, soft dyad — a hum, not a beep
  [110, 165].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.value = i === 0 ? 1 : 0.35;
    osc.connect(g).connect(breathGain);
    osc.start();
    breathGain._oscs = breathGain._oscs || [];
    breathGain._oscs.push(osc);
  });
}

function updateBreathTone(b) {
  if (breathGain && audioCtx) {
    breathGain.gain.setTargetAtTime(b * 0.055, audioCtx.currentTime, 0.08);
  }
}

function stopBreathTone() {
  if (!breathGain) return;
  const g = breathGain;
  breathGain = null;
  g.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
  setTimeout(() => {
    (g._oscs || []).forEach((o) => { try { o.stop(); } catch {} });
    g.disconnect();
  }, 800);
}

/* built-in ambient pad for "calming music" when no songs saved */
function startAmbient() {
  if (!ensureAudio()) return;
  stopAmbient();
  const master = audioCtx.createGain();
  master.gain.value = 0;
  master.connect(audioCtx.destination);
  master.gain.setTargetAtTime(0.05, audioCtx.currentTime, 2);

  const oscs = [];
  const lfos = [];
  [
    { f: 110.0, base: 0.8, lfoRate: 0.05 },
    { f: 164.8, base: 0.5, lfoRate: 0.07 },
    { f: 220.0, base: 0.4, lfoRate: 0.04 },
    { f: 329.6, base: 0.18, lfoRate: 0.09 },
  ].forEach((v) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = v.f;
    const g = audioCtx.createGain();
    g.gain.value = v.base * 0.6;
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = v.lfoRate;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = v.base * 0.35;
    lfo.connect(lfoGain).connect(g.gain);
    osc.connect(g).connect(master);
    osc.start();
    lfo.start();
    oscs.push(osc);
    lfos.push(lfo);
  });
  ambient = { master, oscs, lfos };
}

function stopAmbient() {
  if (!ambient) return;
  const a = ambient;
  ambient = null;
  a.master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.6);
  setTimeout(() => {
    a.oscs.concat(a.lfos).forEach((o) => { try { o.stop(); } catch {} });
    a.master.disconnect();
  }, 2500);
}

/* ============================================================
   AFFIRMATIONS
   ============================================================ */

const GENERIC_LINES = [
  // the wave passes
  "This is a wave. It peaks — and then it always, always comes back down.",
  "Panic has a ceiling. It cannot climb forever — it always runs out of fuel.",
  "This feeling is loud, but it is temporary. Loud things tire quickly.",
  "No panic attack in history has lasted forever. Not one.",
  "The worst minute of this has either passed or will pass. Either way, it ends.",
  "Feelings are weather. This is a storm, and storms move through.",
  "You don’t have to make this stop. It stops on its own. It always does.",
  "This has an ending built into it. Your body cannot hold this pace for long.",
  "Every second that passes is a second closer to calm.",
  "You’ve felt this rise before — which means you’ve also felt it fall.",
  "The edge of this wave is closer than it feels.",
  "This peak is the hardest part, and you’re already in it. From here, it eases.",
  // your body is on your side
  "Your heart is racing because your body is trying to protect you. It’s on your side.",
  "This is adrenaline, not danger. It feels enormous, but it’s just chemistry moving through.",
  "A racing heart is a strong heart doing its job. It can handle this easily.",
  "Dizziness, tingling, a tight chest — these are panic’s signatures. Uncomfortable, not dangerous.",
  "Your body thinks it’s helping. Thank it, and let it stand down.",
  "You are not sick. You are not dying. Your alarm system is just ringing too loud.",
  "Shaky hands mean your body is ready for action it doesn’t need. It will settle.",
  "That tight chest is muscle tension, not your heart failing. It loosens when you exhale.",
  "Adrenaline burns off in minutes. Your body is already clearing it.",
  "Your nervous system fired an alarm. There is no fire. Alarms wind down.",
  "That wave of heat is blood moving where your body thinks it’s needed. It passes.",
  "Fainting from panic is rare — your blood pressure is up, not down. Your body’s got you.",
  "Your body will not let you stop breathing. It’s been doing it your whole life, even while you sleep.",
  // one breath at a time
  "Nothing needs to be decided right now. Your only job is this one breath.",
  "Long, slow exhales tell your body the coast is clear. It listens.",
  "One breath, then one more. That’s the entire assignment.",
  "You cannot breathe wrong here. Any breath that comes is fine.",
  "Let your shoulders drop with the next breath out.",
  "Slow the exhale, and the heart follows. It’s wired that way.",
  "Air is coming in fine — even when it feels tight, you are getting enough.",
  "Breathe with the rhythm on the screen. Borrow it until yours comes back.",
  "Each exhale is a small message to your body: we’re safe.",
  "Just this breath. Not the next hour. Just this breath.",
  "Cool air in, warm air out. Your body knows this rhythm by heart.",
  // you are here, and here is safe
  "Right now, in this exact second, you are safe.",
  "Look around — nothing here is attacking you. Your body just hasn’t caught up yet.",
  "Feel your feet on the floor. The ground is holding you, the way it always has.",
  "You are here. This is a real place, and you are really in it.",
  "Name what’s around you. The real world is still here — steady, ordinary, safe.",
  "The room hasn’t changed. Only the alarm in your body has. It will quiet.",
  "You don’t have to fight this moment. You only have to stay in it.",
  "Nothing terrible is happening in this room. Something uncomfortable is happening in your body.",
  "Press your hand against something solid. Real. Cool. Still here.",
  "The floor is under you. The walls are standing. Gravity works. You’re okay.",
  "Notice one color in the room. Then another. The world is still in detail.",
  // your unbroken record
  "You have gotten through every hard moment of your life so far. Every single one.",
  "You have a perfect record of surviving your worst days. Perfect.",
  "This isn’t your first wave. You know how this goes — up, then down, then done.",
  "Every panic attack you’ve ever had ended with you still here.",
  "You already know how to do this. You’ve done it before, and it’s in you.",
  "Your track record against hard moments is undefeated.",
  "One day this will be a moment you got through. It’s already becoming that.",
  "Future you is on the other side of this — and they made it there.",
  "You’ve carried heavier than this. Your hands remember how.",
  "This moment will end, and you will be the one who outlasted it.",
  // you matter
  "You matter — not for what you get done, but because you’re here.",
  "Be as gentle with yourself right now as you’d be with a scared friend.",
  "Panic is not weakness. It’s a body that cares about you, working overtime.",
  "You are not broken. You are a person having a hard minute.",
  "There is nothing shameful about this. Bodies do this. Good, strong bodies do this.",
  "You are allowed to slow down. Everything else can wait.",
  "Nobody is grading you on this moment. There is no wrong way to get through it.",
  "You deserve the same kindness you give everyone else. Start now.",
  "Being scared doesn’t make you weak. Staying with yourself through it makes you brave.",
  "You are still you under all this noise. That hasn’t gone anywhere.",
  "It’s okay that this happened. It says nothing bad about you.",
  "You came here for help, and that was exactly right. That instinct protects you.",
  // this moment is small
  "You are one small person under a very big sky. This moment is smaller than it feels.",
  "This hour is a speck in your life. It will not define the day, let alone you.",
  "Zoom out: this is one moment on one day of the thousands you’ve lived.",
  "The world is wide and patient. It will still be there when this passes.",
  "Somewhere the ocean is moving and mountains are standing still. This moment is small.",
  "This feeling fills the room, but it doesn’t fill your life. Not even close.",
  "A year from now this will be a sentence, not a chapter.",
  // nothing to solve right now
  "Nothing has to be solved right now. Solving comes later. Breathing comes now.",
  "Whatever triggered this can wait. It has no choice — it waits.",
  "You don’t have to figure anything out mid-wave. Let it pass first.",
  "There is no emergency to manage. The only task is to be here while this fades.",
  "Put every problem down for five minutes. They can wait — they always can.",
  // time is on your side
  "Minutes are on your side. Let them pass — they’re doing the work for you.",
  "You don’t have to do anything for this to end. Time alone will end it.",
  "Panic burns hot and fast. It cannot keep this up. You can.",
  "Stay put, breathe slow, and let the clock do the heavy lifting.",
  // you are not alone
  "You are not the only one who knows this feeling. Millions do — and they’re okay.",
  "People you’ll never meet got through this exact feeling today. You’re in good company.",
  "Someone who loves you would want to sit with you right now. Imagine them here beside you.",
  "You are not alone in this, even when the room is empty.",
  // let the body soften
  "Unclench your jaw. Drop your shoulders. Let your hands go soft.",
  "Your thoughts are sprinting. You don’t have to chase them.",
  "Scary thoughts during panic are symptoms, not truths.",
  "The thought “something is wrong” is part of the alarm — not evidence.",
  "You can watch this feeling like weather through a window. You are the watcher, not the storm.",
  "Let the wave carry you instead of fighting it. Floating takes less strength — and you have it.",
  "Don’t add fear to fear. This is one alarm, and it’s already fading.",
  "Softening beats bracing. Wherever you’re clenched, let it melt a little.",
  "You’re doing it right now — getting through. This counts.",
  "Small steady things are on your side: the floor, your breath, the next minute.",
  "You’re okay. Not perfectly, not forever — just okay enough for this minute. That’s all you need.",
];

/* shown when they asked Anchor to find the words for them */
const ANCHOR_WORDS = [
  "Most people, most of the time, are quietly rooting for each other. Strangers included. You included.",
  "The world is enormous, and this moment is one tiny corner of it. It cannot swallow you.",
  "You have survived every single one of your hardest days. That record is unbroken, and it holds today too.",
  "Look how far you’ve already come. Every step of it was real, and every step of it was yours.",
  "Somewhere right now, a stranger is holding a door, waiting an extra moment, being kind for no reason. That world is your world.",
  "This hour is small. You are not. The size of this feeling is not the size of your life.",
  "You’ve walked through things you once thought would end you. They didn’t. This won’t either.",
  "Ordinary kindness is everywhere, and you belong to it — given and received, more times than you can count.",
];

let affirmationTimer = null;

function shuffled(arr) {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/* a line is either a plain string, or {lead, body} — a fixed lead-in with
   the user's own words underneath, exactly as they typed them */
function renderAffirmation(el, line) {
  el.textContent = "";
  if (typeof line === "string") {
    el.textContent = line;
    return;
  }
  const lead = document.createElement("span");
  lead.className = "affirmation-lead";
  lead.textContent = line.lead;
  const body = document.createElement("span");
  body.className = "affirmation-body";
  body.textContent = line.body;
  el.append(lead, body);
}

function loopFeed(lines) {
  let i = 0;
  return () => lines[i++ % lines.length];
}

/* one full pass through their personal answers, then 10 generic phrases,
   then the personal pass again, then 10 different generic ones — repeating,
   with the generic deck reshuffled once it runs dry */
function alternatingFeed(personalLines) {
  let genericPool = shuffled(GENERIC_LINES);
  let gIdx = 0;
  let queue = [];
  let personalNext = true;
  return () => {
    if (!queue.length) {
      if (personalNext) {
        queue = [...personalLines];
      } else {
        if (gIdx + 10 > genericPool.length) { genericPool = shuffled(GENERIC_LINES); gIdx = 0; }
        queue = genericPool.slice(gIdx, gIdx + 10);
        gIdx += 10;
      }
      personalNext = !personalNext;
    }
    return queue.shift();
  };
}

function startAffirmations(next) {
  const el = $("affirmation");
  let showing = false;

  const step = () => {
    if (showing) {
      el.classList.remove("visible");
      showing = false;
      affirmationTimer = setTimeout(step, 3000); // fade-out gap
    } else {
      renderAffirmation(el, next());
      el.classList.add("visible");
      showing = true;
      affirmationTimer = setTimeout(step, 9000); // hold
    }
  };
  affirmationTimer = setTimeout(step, 4000); // let the first breath land alone
}

function stopAffirmations() {
  clearTimeout(affirmationTimer);
  $("affirmation").classList.remove("visible");
  $("affirmation").textContent = "";
}

/* ============================================================
   GUIDED SEQUENCES — 5-4-3-2-1, muscle relaxation, cold water
   ============================================================ */

const GUIDES = {
  "54321": {
    chip: "5‑4‑3‑2‑1 ground me",
    stepMs: 18000,
    steps: [
      "Look around slowly.\nName 5 things you can see.",
      "Now, 4 things you can physically feel.\nYour feet. The fabric on your skin.",
      "Listen. 3 things you can hear,\neven quiet ones.",
      "2 things you can smell —\nor two smells you love.",
      "1 thing you can taste.\nJust notice it.",
      "You’re here.\nYou’re okay. You did it.",
    ],
  },
  pmr: {
    chip: "Relax my muscles",
    stepMs: 14000,
    steps: [
      "Your body is holding tension for you.\nLet’s hand it back, one group at a time.",
      "Squeeze your hands into fists.\nHold tight… 5, 4, 3, 2, 1 — now let go. Feel them soften.",
      "Pull your shoulders up toward your ears.\nHold… and release. Let them drop, heavy.",
      "Scrunch your face — eyes, jaw, forehead.\nHold… now let your whole face go slack.",
      "Tighten your stomach.\nHold… and breathe out long as you release.",
      "Press your legs together, curl your toes.\nHold… and let everything go loose.",
      "Notice how your body feels now.\nHeavier. Softer. You did that yourself.",
    ],
  },
  tipp: {
    chip: "Cold water reset",
    stepMs: 16000,
    steps: [
      "Cold can reset your nervous system fast.\nIf you can, move toward a sink.",
      "Splash cold water on your face —\nor run it over the inside of your wrists.",
      "Cold on your face triggers your dive reflex.\nIt slows your heart rate for you, automatically.",
      "Stay with the cold for 15–30 seconds.\nKeep your exhales long and slow.",
      "Notice your body settling.\nYou gave it exactly what it needed.",
    ],
  },
};

let activeGuide = null; // guide id
let guideIdx = -1;
let guideTimer = null;

function renderGuideStep() {
  const guide = GUIDES[activeGuide];
  $("guide-step").textContent = guide.steps[guideIdx];
  const dots = $("guide-dots");
  dots.innerHTML = "";
  for (let i = 0; i < guide.steps.length - 1; i++) {
    const d = document.createElement("span");
    if (i <= guideIdx) d.classList.add("done");
    dots.appendChild(d);
  }
  $("guide-card").classList.remove("hidden");
}

function advanceGuide() {
  if (!activeGuide) return;
  clearTimeout(guideTimer);
  const guide = GUIDES[activeGuide];
  guideIdx++;
  if (guideIdx >= guide.steps.length) { stopGuide(); return; }
  renderGuideStep();
  const isLast = guideIdx === guide.steps.length - 1;
  guideTimer = setTimeout(advanceGuide, isLast ? 8000 : guide.stepMs);
}

function startGuide(id) {
  stopGuide();
  activeGuide = id;
  guideIdx = -1;
  syncChips();
  advanceGuide();
}

function stopGuide() {
  clearTimeout(guideTimer);
  activeGuide = null;
  guideIdx = -1;
  $("guide-card").classList.add("hidden");
  syncChips();
}

$("guide-card").addEventListener("click", advanceGuide);

function buildChips(guideIds) {
  const row = $("chip-row");
  row.innerHTML = "";
  guideIds.forEach((id) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.guide = id;
    btn.textContent = GUIDES[id].chip;
    btn.addEventListener("click", () => {
      if (activeGuide === id) stopGuide();
      else startGuide(id);
    });
    row.appendChild(btn);
  });
}

function syncChips() {
  document.querySelectorAll("#chip-row .chip[data-guide]").forEach((c) => {
    c.classList.toggle("active", c.dataset.guide === activeGuide);
  });
}

function addExtraChip(kind, label, onClick) {
  const btn = document.createElement("button");
  btn.className = "chip";
  btn.dataset.extra = kind;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  $("chip-row").appendChild(btn);
  return btn;
}

/* ---------- safe-person voice, on repeat ---------- */

let voiceLoop = null;

function startVoiceLoop(url) {
  stopVoiceLoop();
  voiceLoop = new Audio(url);
  voiceLoop.loop = true;
  voiceLoop.play().catch(() => {});
  const chip = document.querySelector('#chip-row .chip[data-extra="voice"]');
  if (chip) chip.classList.add("active");
}

function stopVoiceLoop() {
  if (voiceLoop) { voiceLoop.pause(); voiceLoop = null; }
  const chip = document.querySelector('#chip-row .chip[data-extra="voice"]');
  if (chip) chip.classList.remove("active");
}

/* ============================================================
   PANIC MODE
   ============================================================ */

const BREATHING_TECHNIQUES = ["box", "extended", "armraise"];
let wakeLock = null;
let songIdx = 0;
let sessionSongs = [];

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
  } catch {}
}

function panicLoop(now) {
  const elapsed = now - panicStart;
  const b = breathValue(elapsed);

  drawParticles(elapsed);
  updateBreathTone(b);
  $("breath-glow").style.opacity = (b * 0.13).toFixed(3);

  const label = $("breath-label");
  const next = breathLabel(elapsed);
  if (label.textContent !== next) label.textContent = next;

  rafId = requestAnimationFrame(panicLoop);
}

function startPanic(personalized) {
  show("screen-panic");
  sizeCanvas();
  makeParticles();

  const s = personalized ? settings : {};
  const techniques = (s.techniques || []);

  // breathing style: use what they chose; extended-exhale is the calm default
  if (techniques.includes("armraise")) setPattern("armraise");
  else if (techniques.includes("box")) setPattern("box");
  else setPattern("extended");

  // guided technique chips: only what they chose; 5-4-3-2-1 as fallback
  let guideIds = techniques.filter((t) => GUIDES[t]);
  if (!guideIds.length) guideIds = ["54321"];
  buildChips(guideIds);

  // their person's voice, looping alongside the pacer
  const voiceUrl = s.voiceNote || s.voiceNote2;
  if (techniques.includes("voice") && voiceUrl) {
    const whose = s.voiceNote ? s.safeName : s.safeName2;
    addExtraChip("voice", whose ? `${whose}’s voice` : "Their voice", () => {
      if (voiceLoop) stopVoiceLoop();
      else startVoiceLoop(voiceUrl);
    });
    startVoiceLoop(voiceUrl);
  }

  // their calming song, one tap away
  const panicSongs = (s.songs && s.songs.length) ? s.songs : [];
  if (techniques.includes("song") && panicSongs.length) {
    addExtraChip("song", "♫ My calming song", () => {
      let url = panicSongs[songIdx % panicSongs.length];
      songIdx++;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      window.open(url, "_blank", "noopener");
    });
  }

  // call buttons
  $("call-label").textContent = s.safeName ? `Call ${s.safeName}` : "Call someone";
  const callBtn = $("btn-call");
  if (s.safePhone) {
    callBtn.href = "tel:" + s.safePhone.replace(/[^\d+]/g, "");
    callBtn.style.display = "";
  } else {
    callBtn.style.display = "none";
  }
  const callBtn2 = $("btn-call2");
  if (s.safePhone2) {
    $("call-label2").textContent = s.safeName2 ? `Call ${s.safeName2}` : "Call my second person";
    callBtn2.href = "tel:" + s.safePhone2.replace(/[^\d+]/g, "");
    callBtn2.classList.remove("hidden");
  } else {
    callBtn2.classList.add("hidden");
  }

  // music button
  sessionSongs = (s.musicMode === "playlist" && s.songs && s.songs.length) ? s.songs : [];
  songIdx = 0;
  $("music-label").textContent = sessionSongs.length ? "Play my calming music" : "Play calming sounds";

  // their words (shown verbatim under a fixed lead-in, alternating with the
  // generic arsenal), Anchor's words, or the generic arsenal alone
  const personal = [];
  if (!s.autoWords) {
    if (s.proud) personal.push({ lead: "Something you’re proud of:", body: s.proud });
    if (s.goal) personal.push({ lead: "Something you’re working toward:", body: s.goal });
    if (s.childhood) personal.push({ lead: "A memory to hold onto:", body: s.childhood });
    if (s.safeSpace) personal.push({ lead: "Your safe space is waiting:", body: s.safeSpace });
    if (s.kindness) personal.push({ lead: "A kindness someone showed you:", body: s.kindness });
  }
  let feed;
  if (s.autoWords) feed = loopFeed(shuffled(ANCHOR_WORDS));
  else if (personal.length) feed = alternatingFeed(personal);
  else feed = loopFeed(shuffled(GENERIC_LINES));

  startBreathTone();
  startAffirmations(feed);
  // if they chose only guided techniques (no breathing style), lead with the first one
  if (guideIds.length && !techniques.some((t) => BREATHING_TECHNIQUES.includes(t)) &&
      techniques.some((t) => GUIDES[t])) {
    startGuide(guideIds[0]);
  }
  requestWakeLock();

  panicStart = performance.now();
  rafId = requestAnimationFrame(panicLoop);
}

function endPanic(toAfterScreen) {
  cancelAnimationFrame(rafId);
  rafId = null;
  stopBreathTone();
  stopAmbient();
  stopAffirmations();
  stopGuide();
  stopVoiceLoop();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  show(toAfterScreen ? "screen-after" : "screen-home");
}

$("btn-better").addEventListener("click", () => endPanic(true));

$("btn-music").addEventListener("click", () => {
  if (sessionSongs.length) {
    let url = sessionSongs[songIdx % sessionSongs.length];
    songIdx++;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    window.open(url, "_blank", "noopener");
    if (sessionSongs.length > 1) $("music-label").textContent = "Next song";
  } else {
    if (ambient) {
      stopAmbient();
      $("music-label").textContent = "Play calming sounds";
    } else {
      startAmbient();
      $("music-label").textContent = "Pause calming sounds";
    }
  }
});

window.addEventListener("resize", () => {
  if (rafId) sizeCanvas();
});

/* ============================================================
   AFTER / LOG
   ============================================================ */

$("btn-log").addEventListener("click", () => {
  const entries = loadLog();
  entries.push(Date.now());
  saveLog(entries);
  $("btn-log").textContent = "Logged ✓";
  $("btn-log").disabled = true;
  setTimeout(() => {
    $("btn-log").textContent = "Log this episode";
    $("btn-log").disabled = false;
    show("screen-home");
  }, 900);
});

$("btn-done").addEventListener("click", () => show("screen-home"));

/* ============================================================
   BOOT — home first, always; setup never blocks a panic moment
   ============================================================ */

show("screen-home");

/* opening breath — once per session, tap anywhere to skip */
(function playIntro() {
  let played = false;
  try { played = !!sessionStorage.getItem("anchor.introPlayed"); } catch {}
  if (played) return;
  try { sessionStorage.setItem("anchor.introPlayed", "1"); } catch {}

  const intro = $("intro");
  intro.classList.remove("hidden");
  requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.add("in")));

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    intro.classList.add("out");
    setTimeout(() => intro.classList.add("hidden"), 1100);
  };
  intro.addEventListener("click", finish);
  setTimeout(finish, 3400); // fade in, hold, let go
})();

if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

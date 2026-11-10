/* ==========================================================================
   StudyFlow — app.js
   Vanilla JS · no dependencies · data persisted in localStorage

   1. Helpers            6. Router & views
   2. State & storage    7. Task / note / calendar logic
   3. Achievements       8. Search
   4. Timer engine       9. Actions, events & shortcuts
   5. UI primitives     10. Boot
   ========================================================================== */
(() => {
'use strict';

/* ==========================================================================
   1. Helpers
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid   = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad   = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ymd   = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => ymd(new Date());
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMin = v => { v = Math.round(v); const h = Math.floor(v / 60), m = v % 60; return h ? `${h}h ${m}m` : `${m}m`; };
const ic = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const media = q => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
let reduceMotion = media('(prefers-reduced-motion: reduce)').matches;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const TICK = '<svg viewBox="0 0 24 24" class="tick"><path d="m6.5 12.5 3.5 3.5 7.5-8"/></svg>';

const fmtDate = (d, o) => d.toLocaleDateString(undefined, o);
const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtRel = ts => {
  const d = new Date(ts);
  return ymd(d) === todayStr() ? fmtTime(ts) : fmtDate(d, { month: 'short', day: 'numeric' });
};

/* ==========================================================================
   2. State & storage
   ========================================================================== */
const KEY_BASE = 'studyflow.v1', ACC_KEY = 'studyflow.accounts', SESS_KEY = 'studyflow.session';
const safeGet = (store, k) => { try { return store.getItem(k); } catch (e) { return null; } };
const getAccounts = () => { try { const a = JSON.parse(localStorage.getItem(ACC_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const putAccounts = list => { try { localStorage.setItem(ACC_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };
let sessionId = safeGet(localStorage, SESS_KEY) || safeGet(sessionStorage, SESS_KEY) || '';
let account = sessionId && sessionId !== 'guest' ? (getAccounts().find(a => a.id === sessionId) || null) : null;
if (sessionId !== 'guest' && !account) sessionId = '';
// null KEY = nobody is signed in yet (the sign-in screen is showing); nothing is read or written
const KEY = sessionId === 'guest' ? KEY_BASE : account ? `${KEY_BASE}.${account.id}` : null;
let skipFlush = false;
const DEFAULT_SETTINGS = { name: '', theme: 'auto', accent: 'school', style: 'campus', customAccent: '', bg: 'aurora', blur: 30, radius: 22, density: 'comfortable', windowFull: false, font: 'system', fontSize: 15, motion: 'auto', sidebarIcons: false, sidebarKbd: true, startPage: 'dashboard', navOrder: [], navHidden: [], widgetOrder: [], widgetHidden: [], focus: 25, short: 5, long: 15, until: 4, goal: 120, sound: true, weekStart: 1, ambient: 'off' };
const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 90], until: [2, 10], goal: [10, 720] };
const blank = () => ({ settings: { ...DEFAULT_SETTINGS }, tasks: [], notes: [], sessions: [], achievements: {}, decks: [], exams: [], grades: [], habits: [], meta: { reviews: 0 }, ach: { over: {}, hidden: [], custom: [] } });

function normalize(p) {
  const b = blank();
  return {
    settings: { ...b.settings, ...(p && p.settings) },
    tasks: Array.isArray(p && p.tasks) ? p.tasks : [],
    notes: Array.isArray(p && p.notes) ? p.notes : [],
    sessions: Array.isArray(p && p.sessions) ? p.sessions : [],
    achievements: p && typeof p.achievements === 'object' && p.achievements ? p.achievements : {},
    decks: Array.isArray(p && p.decks) ? p.decks.filter(d => d && Array.isArray(d.cards)) : [],
    exams: Array.isArray(p && p.exams) ? p.exams.filter(x => x && x.date) : [],
    grades: Array.isArray(p && p.grades) ? p.grades.filter(g => g && typeof g.score === 'number' && g.max > 0) : [],
    habits: Array.isArray(p && p.habits) ? p.habits.filter(h => h && Array.isArray(h.days)) : [],
    meta: { reviews: 0, ...(p && p.meta) },
    ach: { over: {}, hidden: [], custom: [], ...((p && p.ach) || {}) }
  };
}

function sample() {
  const s = blank(), now = new Date(), day = n => ymd(addDays(now, n));
  const mk = (title, subject, priority, due, extra = {}) =>
    ({ id: uid(), title, subject, priority, due, notes: '', done: false, doneAt: null, created: Date.now() - Math.random() * 3e8, focus: 0, ...extra });
  s.tasks = [
    mk('Review Chapter 4 — Thermodynamics', 'Physics', 'high', day(0), { notes: 'Focus on entropy and the second law.' }),
    mk('Calculus problem set 7', 'Mathematics', 'high', day(1)),
    mk('Read The Great Gatsby, ch. 5–6', 'Literature', 'med', day(2)),
    mk('Prepare chemistry lab report', 'Chemistry', 'med', day(4)),
    mk('Spanish vocabulary flashcards', 'Languages', 'low', day(0)),
    mk('Outline history essay', 'History', 'med', day(8)),
    mk('Organise lecture notes', 'General', 'low', ''),
    mk('Submit economics quiz', 'Economics', 'high', day(-1), { done: true, doneAt: Date.now() - 72e5 * 10 }),
    mk('Finish lab safety module', 'Chemistry', 'low', day(-2), { done: true, doneAt: Date.now() - 72e5 * 20 })
  ];
  [2, 3, 1, 4, 2, 3].forEach((count, i) => {
    for (let k = 0; k < count; k++) s.sessions.push({ id: uid(), date: day(i - 6), minutes: 25, ts: Date.now() - (6 - i) * 864e5, taskId: '' });
  });
  s.notes = [
    { id: uid(), title: 'Welcome to StudyFlow 👋', updated: Date.now() - 6e4, body:
      'Everything you add here is stored privately in your browser.\n\n• Press N to add a task\n• Press ⌘K (or /) to search\n• Press 1–9 to jump between pages\n• Press Space on the Focus Timer to start or pause\n• Press ? to see every shortcut\n\nYou can clear this sample data any time in Settings.' },
    { id: uid(), title: 'Thermodynamics cheat sheet', updated: Date.now() - 36e5 * 5, body:
      'First law: ΔU = Q − W\nSecond law: entropy of an isolated system never decreases.\nEfficiency of a heat engine: η = 1 − Tc/Th\n\nTodo: work through examples 4.2 and 4.5.' }
  ];
  const mk2 = (front, back, due) => ({ id: uid(), front, back, due: due || todayStr(), interval: 0, ease: 2.5, reps: 0, lapses: 0, created: Date.now() });
  s.decks = [
    { id: uid(), name: 'Spanish Basics', color: '#ff9f0a', cards: [
      mk2('Hola', 'Hello'), mk2('Gracias', 'Thank you'), mk2('Por favor', 'Please'), mk2('Buenos días', 'Good morning'),
      mk2('¿Cómo estás?', 'How are you?'), mk2('Adiós', 'Goodbye', day(3)), mk2('Lo siento', 'I’m sorry', day(5)), mk2('De nada', 'You’re welcome', day(9))] },
    { id: uid(), name: 'Physics Formulas', color: '#0a84ff', cards: [
      mk2('Newton’s second law', 'F = m · a'), mk2('Kinetic energy', 'KE = ½ m v²'), mk2('Ohm’s law', 'V = I · R'),
      mk2('Momentum', 'p = m · v', day(2)), mk2('Efficiency of a heat engine', 'η = 1 − Tc / Th', day(4))] }
  ];
  s.exams = [
    { id: uid(), title: 'Physics midterm', subject: 'Physics', date: day(12), notes: 'Chapters 1–4. Bring a calculator.' },
    { id: uid(), title: 'Calculus final', subject: 'Mathematics', date: day(24), notes: '' }
  ];
  return s;
}

function load() {
  if (!KEY) return blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (err) { console.warn('StudyFlow: could not read saved data.', err); }
  return blank(); // brand-new users start with an empty workspace
}

let state = load();
let saveTimer = 0;
function flush() {
  clearTimeout(saveTimer);
  if (!KEY || skipFlush) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (err) { toast({ title: 'Couldn’t save', msg: 'Browser storage is full or unavailable.', icon: '⚠️' }); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 120); }

/* ---------- Derived stats ---------- */
const byId = id => state.tasks.find(t => t.id === id);
const sessionsByDay = () => { const m = {}; state.sessions.forEach(s => { m[s.date] = (m[s.date] || 0) + s.minutes; }); return m; };
const minutesOn = date => state.sessions.reduce((a, s) => a + (s.date === date ? s.minutes : 0), 0);
const totalMinutes = () => state.sessions.reduce((a, s) => a + s.minutes, 0);
const doneCount = () => state.tasks.filter(t => t.done).length;
const goalDays = () => Object.values(sessionsByDay()).filter(v => v >= state.settings.goal).length;
function streak() {
  const m = sessionsByDay();
  let d = new Date();
  if (!m[ymd(d)]) d = addDays(d, -1);
  let n = 0;
  while (m[ymd(d)]) { n++; d = addDays(d, -1); }
  return n;
}

/* ==========================================================================
   3. Achievements
   ========================================================================== */
const METRICS = {
  tasks:    { label: 'Tasks completed',  val: doneCount },
  sessions: { label: 'Focus sessions',   val: () => state.sessions.length },
  minutes:  { label: 'Minutes studied',  val: totalMinutes, time: true },
  streak:   { label: 'Day streak',       val: streak },
  notes:    { label: 'Notes written',    val: () => state.notes.filter(n => (n.title + n.body).trim().length > 2).length },
  goaldays: { label: 'Daily goals hit',  val: goalDays },
  reviews:  { label: 'Cards reviewed',   val: () => state.meta.reviews || 0 },
  cards:    { label: 'Cards created',    val: () => state.decks.reduce((a, d) => a + d.cards.length, 0) },
  exams:    { label: 'Exams added',      val: () => state.exams.length }
};
const GRADS = [['#34c759', '#30b0c7'], ['#ff9f0a', '#ff6a00'], ['#5e5ce6', '#bf5af2'], ['#0a84ff', '#5e5ce6'], ['#ff375f', '#ff9f0a'], ['#ffd60a', '#ff9f0a'], ['#40c8e0', '#0a84ff'], ['#bf5af2', '#ff375f'], ['#8e8e93', '#48484a'], ['#30d158', '#00b8a9']];
const ACH_ICONS = ['check', 'target', 'rocket', 'timer', 'leaf', 'book', 'flame', 'bolt', 'note', 'trophy', 'cards', 'exam', 'star', 'heart', 'crown', 'bulb'];
const ACH_BASE = [
  { id: 'first-task',   icon: 'check',  g: GRADS[0], name: 'First Step',   desc: 'Complete your first task',      goal: 1,   metric: 'tasks' },
  { id: 'ten-tasks',    icon: 'target', g: GRADS[1], name: 'Task Master',  desc: 'Complete 10 tasks',             goal: 10,  metric: 'tasks' },
  { id: 'fifty-tasks',  icon: 'rocket', g: GRADS[2], name: 'Unstoppable',  desc: 'Complete 50 tasks',             goal: 50,  metric: 'tasks' },
  { id: 'first-focus',  icon: 'timer',  g: GRADS[3], name: 'Locked In',    desc: 'Finish a focus session',        goal: 1,   metric: 'sessions' },
  { id: 'ten-sessions', icon: 'bulb',   g: GRADS[9], name: 'Deep Diver',   desc: 'Finish 10 focus sessions',      goal: 10,  metric: 'sessions' },
  { id: 'hour',         icon: 'leaf',   g: GRADS[6], name: 'Warming Up',   desc: 'Study for 1 hour in total',     goal: 60,  metric: 'minutes' },
  { id: 'ten-hours',    icon: 'book',   g: GRADS[7], name: 'Scholar',      desc: 'Study for 10 hours in total',   goal: 600, metric: 'minutes' },
  { id: 'streak3',      icon: 'flame',  g: GRADS[1], name: 'On a Roll',    desc: 'Reach a 3-day study streak',    goal: 3,   metric: 'streak' },
  { id: 'streak7',      icon: 'bolt',   g: GRADS[5], name: 'Week Warrior', desc: 'Reach a 7-day study streak',    goal: 7,   metric: 'streak' },
  { id: 'notes3',       icon: 'note',   g: GRADS[5], name: 'Note Taker',   desc: 'Write 3 notes',                 goal: 3,   metric: 'notes' },
  { id: 'goal',         icon: 'trophy', g: GRADS[4], name: 'Goal Getter',  desc: 'Hit your daily study goal',     goal: 1,   metric: 'goaldays' },
  { id: 'cards50',      icon: 'cards',  g: GRADS[6], name: 'Card Shark',   desc: 'Review 50 flashcards',          goal: 50,  metric: 'reviews' },
  { id: 'deck20',       icon: 'star',   g: GRADS[7], name: 'Deck Builder', desc: 'Create 20 flashcards',          goal: 20,  metric: 'cards' },
  { id: 'exam1',        icon: 'exam',   g: GRADS[1], name: 'Exam Planner', desc: 'Add an exam countdown',         goal: 1,   metric: 'exams' }
];
function buildAch(withHidden) {
  const cfg = state.ach || { over: {}, hidden: [], custom: [] };
  const mk = (a, base) => { const m = METRICS[a.metric] || METRICS.tasks; return { ...a, base, time: !!m.time, val: m.val, hidden: cfg.hidden.includes(a.id) }; };
  const all = [...ACH_BASE.map(a => mk({ ...a, ...(cfg.over[a.id] || {}) }, true)), ...cfg.custom.map(a => mk(a, false))];
  return withHidden ? all : all.filter(a => !a.hidden);
}
let ACH = [];
function rebuildAch() { ACH = buildAch(false); }
const achIcon = a => ic(ACH_ICONS.includes(a.icon) ? a.icon : 'star');
rebuildAch();

function checkAchievements(silent = false) {
  rebuildAch();
  let changed = false;
  ACH.forEach(a => {
    if (!state.achievements[a.id] && a.val() >= a.goal) {
      state.achievements[a.id] = Date.now();
      changed = true;
      if (!silent) toast({ title: 'Achievement unlocked', msg: `${a.name} — ${a.desc}`, icon: achIcon(a) });
    }
  });
  if (changed) save();
}

/* ==========================================================================
   4. Timer engine
   ========================================================================== */
const MODE_LABEL = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
const RING_C = 2 * Math.PI * 130;
const T = { mode: 'focus', total: 0, remaining: 0, running: false, endAt: 0, cycle: 0, taskId: '', iv: 0 };
const modeSecs = m => state.settings[m] * 60;

function timerSetMode(m) {
  stopTick();
  T.mode = m; T.total = T.remaining = modeSecs(m); T.running = false;
  updateTimerUI();
}
function startTick() { stopTick(); T.iv = setInterval(tick, 250); }
function stopTick()  { clearInterval(T.iv); T.iv = 0; }
function timerToggle() {
  if (T.running) {
    tick(); stopTick(); T.running = false;
  } else {
    if (T.remaining <= 0) T.remaining = T.total;
    T.running = true; T.endAt = Date.now() + T.remaining * 1000; startTick();
    try { if ('Notification' in window && Notification.permission === 'default') Promise.resolve(Notification.requestPermission()).catch(() => {}); } catch (e) { /* ignore */ }
  }
  updateTimerUI();
}
function tick() {
  if (!T.running) return;
  T.remaining = Math.max(0, Math.round((T.endAt - Date.now()) / 1000));
  updateTimerUI();
  if (T.remaining <= 0) timerComplete();
}
function nextAfterFocus() { return T.cycle % state.settings.until === 0 ? 'long' : 'short'; }
function timerComplete() {
  stopTick(); T.running = false;
  const wasFocus = T.mode === 'focus';
  if (wasFocus) {
    const minutes = state.settings.focus;
    state.sessions.push({ id: uid(), date: todayStr(), minutes, ts: Date.now(), taskId: T.taskId });
    const t = byId(T.taskId); if (t) t.focus = (t.focus || 0) + minutes;
    T.cycle++; save(); checkAchievements(); updateChrome();
  }
  chime();
  const next = wasFocus ? nextAfterFocus() : 'focus';
  toast({ title: wasFocus ? 'Focus session complete' : 'Break is over', msg: wasFocus ? `Nice work — time for a ${MODE_LABEL[next].toLowerCase()}.` : 'Ready for another round?', icon: wasFocus ? '🎉' : '☀️' });
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification('StudyFlow', { body: wasFocus ? 'Focus session complete. Take a break!' : 'Break is over — back to it.' }); } catch (e) { /* ignore */ }
  timerSetMode(next);
  if (current === 'dashboard' || current === 'timer') mount(current, false);
}
function updateTimerUI() {
  syncAmbient();
  const txt = `${pad(Math.floor(T.remaining / 60))}:${pad(T.remaining % 60)}`;
  const label = MODE_LABEL[T.mode];
  const status = T.running ? label : (T.remaining < T.total ? `${label} · Paused` : label);

  const mini = $('#miniTimer');
  if (mini) { mini.classList.toggle('running', T.running); $('#miniTime').textContent = txt; $('#miniMode').textContent = T.mode === 'focus' ? 'Focus' : 'Break'; }
  document.title = T.running ? `${txt} · ${label} — StudyFlow` : 'StudyFlow';

  const card = $('#timerCard');
  if (!card) return;
  card.classList.toggle('running', T.running);
  $('#timeText').textContent = txt;
  $('#modeLabel').textContent = status;
  $('#ringProg').style.strokeDashoffset = String(RING_C * (1 - (T.total ? T.remaining / T.total : 0)));
  $('#playBtn').innerHTML = ic(T.running ? 'pause' : 'play');
  $('#playBtn').setAttribute('aria-label', T.running ? 'Pause timer' : 'Start timer');
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.action === `mode:${T.mode}`));
  $('#cycleDots').innerHTML = [...Array(state.settings.until)].map((_, i) => `<i class="${i < T.cycle % state.settings.until ? 'on' : ''}"></i>`).join('');
}
function chime() {
  if (!state.settings.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC();
    [659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.16;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (e) { /* audio unavailable */ }
}
function updateChrome() { const el = $('#miniStreak'); if (el) el.textContent = streak(); }

/* ==========================================================================
   5. UI primitives — theme, toasts, modal, count-up
   ========================================================================== */
const darkMQ = media('(prefers-color-scheme: dark)');
function isDark() { const t = state.settings.theme; return t === 'dark' || (t === 'auto' && darkMQ.matches); }
const mixHex = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
function applyTheme() {
  const root = document.documentElement, s = state.settings, st = root.style;
  root.dataset.theme = isDark() ? 'dark' : 'light';
  root.dataset.accent = s.accent;
  root.dataset.style = s.style === 'classic' ? 'classic' : 'campus';
  const hex = /^#[0-9a-f]{6}$/i.test(s.customAccent || '') ? s.customAccent : '';
  if (s.accent === 'custom' && hex) {
    st.setProperty('--accent', hex); st.setProperty('--accent-2', mixHex(hex, '#5e5ce6', .4));
    st.setProperty('--accent-rgb', [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', '));
  } else ['--accent', '--accent-2', '--accent-rgb'].forEach(p => st.removeProperty(p));
  const r = clamp(+s.radius || 22, 6, 36);
  st.setProperty('--blur', `saturate(190%) blur(${clamp(+s.blur, 0, 60)}px)`);
  st.setProperty('--r-lg', r + 'px'); st.setProperty('--r', Math.round(r * .73) + 'px'); st.setProperty('--r-sm', Math.round(r * .5) + 'px');
  st.setProperty('--font', FONTS[s.font] || FONTS.system);
  st.setProperty('--fs', clamp(+s.fontSize || 15, 12, 20) + 'px');
  root.dataset.density = s.density; root.dataset.bg = s.bg; root.dataset.motion = s.motion;
  root.dataset.window = s.windowFull ? 'full' : 'float'; root.dataset.sidebar = s.sidebarIcons ? 'icons' : 'full';
  root.dataset.kbd = s.sidebarKbd === false ? 'off' : 'on';
  reduceMotion = s.motion === 'reduce' || (s.motion !== 'full' && media('(prefers-reduced-motion: reduce)').matches);
  const b = $('#themeBtn'); if (b) b.innerHTML = ic(isDark() ? 'sun' : 'moon');
}
function toggleTheme() { state.settings.theme = isDark() ? 'light' : 'dark'; save(); applyTheme(); if (current === 'settings') mount('settings', false); }

function toast({ title, msg = '', icon = '✨', action, ms = 4600 }) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="t-ico">${icon}</div><div class="t-txt"><b>${esc(title)}</b>${msg ? `<span>${esc(msg)}</span>` : ''}</div>${action ? `<button class="t-act">${esc(action.label)}</button>` : ''}`;
  const remove = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); };
  if (action) $('.t-act', el).addEventListener('click', () => { action.fn(); remove(); });
  box.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  setTimeout(remove, ms);
}

let lastFocus = null;
const modalRoot = () => $('#modalRoot');
const modalOpen = () => modalRoot().classList.contains('open');
function openModal(html) {
  const root = modalRoot();
  lastFocus = document.activeElement;
  root.innerHTML = html;
  root.classList.remove('closing'); root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
  setTimeout(() => { const f = $('[autofocus]', root) || $('input, textarea, button', root); if (f) f.focus(); }, 40);
  return root;
}
function closeModal() {
  const root = modalRoot();
  if (!root.classList.contains('open')) return;
  root.classList.add('closing');
  setTimeout(() => {
    root.classList.remove('open', 'closing'); root.innerHTML = ''; root.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }, reduceMotion ? 0 : 190);
}
function confirmDialog({ title, msg, ok = 'Confirm', danger = false }, onOk) {
  const root = openModal(`<div class="sheet small" role="alertdialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3><p class="sub">${esc(msg)}</p><footer><button class="btn" data-action="close-modal">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="confirmOk" autofocus>${esc(ok)}</button></footer></div>`);
  $('#confirmOk', root).addEventListener('click', () => { closeModal(); onOk(); });
}

function runCountUps(root) {
  $$('[data-count]', root).forEach(el => {
    const target = +el.dataset.count, fmt = el.dataset.fmt;
    const f = v => (fmt === 'min' ? fmtMin(v) : Math.round(v).toLocaleString());
    if (reduceMotion) { el.textContent = f(target); return; }
    el.textContent = f(0);
    const t0 = performance.now(), dur = 950;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(target * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ==========================================================================
   6. Router & views
   ========================================================================== */
const PRI = { high: { label: 'High', w: 0 }, med: { label: 'Medium', w: 1 }, low: { label: 'Low', w: 2 } };
const VIEWS = {
  dashboard:    { title: 'Dashboard',    icon: 'home',     render: renderDashboard },
  tasks:        { title: 'Tasks',        icon: 'check',    render: renderTasks },
  calendar:     { title: 'Calendar',     icon: 'calendar', render: renderCalendar },
  notes:        { title: 'Notes',        icon: 'note',     render: renderNotes },
  timer:        { title: 'Focus Timer',  icon: 'timer',    render: renderTimer },
  cards:        { title: 'Flashcards',   icon: 'cards',    render: renderCards },
  exams:        { title: 'Exams',        icon: 'exam',     render: renderExams },
  achievements: { title: 'Achievements', icon: 'trophy',   render: renderAchievements },
  settings:     { title: 'Settings',     icon: 'sliders',  render: renderSettings },
  grades:       { title: 'Grades',       icon: 'chart',    render: renderGrades },
  habits:       { title: 'Habits',       icon: 'repeat',   render: renderHabits }
};
const VIEW_ORDER = Object.keys(VIEWS);
let current = 'dashboard';
let mountToken = 0;

function mount(name, animate = true) {
  if (!VIEWS[name]) name = 'dashboard';
  const host = $('#viewHost'), old = host.firstElementChild, token = ++mountToken;
  const scroll = host.scrollTop;
  const sameView = name === current;
  current = name;

  $('#viewTitle').textContent = VIEWS[name].title;
  $$('.nav-item').forEach(b => { const on = b.dataset.view === name; b.classList.toggle('active', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  const add = $('#addBtn span');
  if (add) add.textContent = { notes: 'New Note', cards: 'New Deck', exams: 'New Exam', grades: 'New Grade', habits: 'New Habit' }[name] || 'New Task';

  const build = () => {
    if (token !== mountToken) return;
    const el = document.createElement('div');
    el.className = `view v-${name}${animate ? ' enter' : ''}`;
    rebuildAch(); VIEWS[name].render(el);
    host.replaceChildren(el);
    $$('.rise', el).forEach((n, i) => n.style.setProperty('--i', i));
    if (animate) runCountUps(el);
    host.scrollTop = animate && !sameView ? 0 : scroll;
    updateTimerUI();
  };
  if (animate && old && !reduceMotion) { old.classList.add('leave'); setTimeout(build, 130); } else build();
}
const rerender = () => mount(current, false);
function go(name) {
  if (!VIEWS[name]) name = 'dashboard';
  if (location.hash.slice(1) === name) { if (current !== name) mount(name); return; }
  location.hash = name;
}
window.addEventListener('hashchange', () => {
  const n = location.hash.slice(1);
  if (VIEWS[n] && n !== current) mount(n);
});

/* ---------- Shared task helpers ---------- */
function sortTasks(list, mode = 'smart') {
  const pr = t => PRI[t.priority].w, due = t => t.due || '9999-99-99';
  return list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (mode === 'deadline') return due(a).localeCompare(due(b)) || pr(a) - pr(b);
    if (mode === 'recent') return b.created - a.created;
    return pr(a) - pr(b) || due(a).localeCompare(due(b)) || b.created - a.created;
  });
}
function dueInfo(due, done) {
  if (!due) return null;
  const diff = Math.round((parseYmd(due) - parseYmd(todayStr())) / 864e5);
  let text, cls = '';
  if (diff < 0) { text = diff === -1 ? 'Yesterday' : `${-diff} days overdue`; cls = done ? '' : 'overdue'; }
  else if (diff === 0) { text = 'Today'; cls = 'today'; }
  else if (diff === 1) text = 'Tomorrow';
  else if (diff < 7) text = fmtDate(parseYmd(due), { weekday: 'long' });
  else text = fmtDate(parseYmd(due), { month: 'short', day: 'numeric' });
  return { text, cls };
}
function miniTask(t) {
  const di = dueInfo(t.due, t.done);
  const meta = [t.subject ? esc(t.subject) : '', di ? `<em class="${di.cls}">${di.text}</em>` : ''].filter(Boolean).join(' · ');
  return `<li class="mini-task pri-${t.priority} ${t.done ? 'done' : ''}">
    <button class="check" data-action="toggle:${t.id}" aria-label="${t.done ? 'Mark incomplete' : 'Complete'}: ${esc(t.title)}">${TICK}</button>
    <button class="mt-body" data-action="edit:${t.id}"><span class="mt-title">${esc(t.title)}</span><span class="mt-meta">${meta || 'No deadline'}</span></button>
  </li>`;
}

/* ---------- Dashboard ---------- */
function renderDashboard(el) {
  const s = state.settings, today = todayStr();
  const mToday = minutesOn(today), pct = clamp(mToday / s.goal, 0, 1);
  const st = streak(), total = totalMinutes();
  const weekAgo = Date.now() - 7 * 864e5;
  const doneWeek = state.tasks.filter(t => t.done && t.doneAt && t.doneAt >= weekAgo).length;
  const openTasks = state.tasks.filter(t => !t.done);
  const overdue = openTasks.filter(t => t.due && t.due < today).length;
  const upNext = sortTasks(openTasks).slice(0, 5);
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const name = s.name.trim();

  const days = [...Array(7)].map((_, i) => { const d = addDays(new Date(), i - 6); return { label: fmtDate(d, { weekday: 'short' }), min: minutesOn(ymd(d)), today: i === 6 }; });
  const max = Math.max(s.goal, ...days.map(d => d.min), 30) * 1.08;
  const GC = 2 * Math.PI * 62;
  const recent = ACH.filter(a => state.achievements[a.id]).sort((a, b) => state.achievements[b.id] - state.achievements[a.id]).slice(0, 5);

  const tile = (icon, g1, g2, label, value, fmt, sub) =>
    `<div class="card stat lift rise span-3" data-ic="${icon}"><div class="stat-ico" style="--g1:${g1};--g2:${g2}">${ic(icon)}</div>
      <div class="stat-val" data-count="${value}" ${fmt ? `data-fmt="${fmt}"` : ''}>${fmt === 'min' ? fmtMin(value) : value.toLocaleString()}</div>
      <div class="stat-label">${label}</div><div class="stat-sub">${sub}</div></div>`;

  const parts = {
    hero: () => `<div class="card hero rise span-12">
      <h2>${greet}${name ? `, ${esc(name)}` : ''}</h2>
      <p>${openTasks.length ? `You have ${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}${overdue ? `, ${overdue} overdue` : ' and nothing overdue'}.` : 'Your task list is clear — enjoy it, or plan something new.'} ${mToday ? `You've studied ${fmtMin(mToday)} today.` : 'A focus session is a great way to start.'}</p>
      <button class="btn glass" data-action="focus-now">${ic('play')} Start focus session</button>${totalDue() ? ` <button class="btn glass" data-action="study-all">${ic('cards')} Review ${plural(totalDue(), 'card')}</button>` : ''}
    </div>`,
    quick: () => quickAccess(),
    focus: () => `${tile('timer', '#30d158', '#00b8a9', 'Focus today', mToday, 'min', `Goal ${fmtMin(s.goal)}`)}`,
    streak: () => `${tile('flame', '#ff9f0a', '#ff453a', 'Day streak', st, '', st ? 'Keep it going!' : 'Study today to start one')}`,
    tasksdone: () => `${tile('check', '#0a84ff', '#5e5ce6', 'Tasks done this week', doneWeek, '', `${openTasks.length} still open`)}`,
    total: () => `${tile('trophy', '#bf5af2', '#ff375f', 'Total focus time', total, 'min', `${state.sessions.length} sessions`)}`,
    week: () => `<div class="card rise span-8">
      <div class="card-title"><h3>This week</h3><span class="sub" style="margin:0;font-size:13px">minutes per day</span></div>
      <div class="bars">
        <div class="goal-line" style="bottom:calc((100% - 39px) * ${(s.goal / max).toFixed(3)} + 25px)"><b>Goal ${s.goal}m</b></div>
        ${days.map((d, i) => `<div class="bar ${d.today ? 'today' : ''} ${d.min ? 'has' : ''}" title="${d.min} min">
          <div class="bar-track"><i style="--h:${((d.min / max) * 100).toFixed(1)}%;--k:${i}"></i></div><span>${d.label}</span></div>`).join('')}
      </div>
    </div>`,
    goal: () => `<div class="card rise span-4">
      <div class="card-title"><h3>Daily goal</h3></div>
      <div class="ring-sm">
        <svg viewBox="0 0 150 150"><defs><linearGradient id="gRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient></defs>
          <circle class="ring-bg" cx="75" cy="75" r="62" stroke-width="14"/>
          <circle class="ring-fg" cx="75" cy="75" r="62" stroke-width="14" stroke="url(#gRing)" stroke-dasharray="${GC.toFixed(2)}" style="--c:${GC.toFixed(2)};stroke-dashoffset:${(GC * (1 - pct)).toFixed(2)}"/></svg>
        <div class="ring-mid"><b>${Math.round(pct * 100)}%</b><span>${fmtMin(mToday)} / ${fmtMin(s.goal)}</span></div>
      </div>
      <p class="goal-note">${pct >= 1 ? 'Goal reached — brilliant! 🎉' : `${fmtMin(Math.max(0, s.goal - mToday))} to go today`}</p>
    </div>`,
    next: () => `<div class="card rise span-7">
      <div class="card-title"><h3>Up next</h3><button class="link" data-action="go:tasks">See all</button></div>
      ${upNext.length ? `<ul>${upNext.map(miniTask).join('')}</ul>` : `<div class="empty"><h4>All caught up</h4><p>Add a task to plan your next study block.</p><button class="btn primary sm" data-action="new-task">New Task</button></div>`}
    </div>`,
    ach: () => `<div class="card rise span-5">
      <div class="card-title"><h3>Achievements</h3><button class="link" data-action="go:achievements">View all</button></div>
      <p class="ach-count">${Object.keys(state.achievements).length} of ${ACH.length} unlocked</p>
      <div class="progress" style="margin-bottom:18px"><i style="--w:${(Object.keys(state.achievements).length / ACH.length * 100).toFixed(0)}%"></i></div>
      <div class="badge-row">${recent.length ? recent.map(a => `<div class="badge-mini" style="--g1:${a.g[0]};--g2:${a.g[1]}" title="${esc(a.name)}">${achIcon(a)}</div>`).join('') : '<p class="sub" style="margin:0">Complete a task or focus session to earn your first badge.</p>'}</div>
    </div>`,
    heat: () => heatmapCard(),
    exams: () => examsCard()
  };
  const shown = widgetList().filter(widgetShown);
  el.innerHTML = `<section class="grid">${shown.length ? shown.map(k => parts[k]()).join('') : `<div class="card span-12 empty rise"><h4>Your dashboard is empty</h4><p>Turn widgets back on in Settings → Layout.</p><button class="btn primary sm" data-action="go:settings">Open settings</button></div>`}</section>`;
}

/* ---------- Tasks ---------- */
const tasksUI = { filter: 'all', sort: 'smart' };

function renderTasks(el) {
  el.innerHTML = `
    <div class="page-head rise"><div><h2>Tasks</h2><p class="sub" id="taskSub"></p></div>
      <div class="head-actions"><select id="taskSort" aria-label="Sort tasks">
        <option value="smart">Sort: Priority</option><option value="deadline">Sort: Deadline</option><option value="recent">Sort: Newest</option></select></div></div>
    <form class="card quick-add rise" id="quickAdd" autocomplete="off">
      <span style="color:var(--accent);display:grid">${ic('plus')}</span>
      <input type="text" id="qaTitle" placeholder="Add a task and press Enter…" aria-label="New task title">
      <select id="qaPri" aria-label="Priority"><option value="med">Medium</option><option value="high">High</option><option value="low">Low</option></select>
      <input type="date" id="qaDue" aria-label="Due date">
      <button class="btn primary" type="submit">Add</button>
    </form>
    <div class="filters rise"><div class="seg" id="taskFilter" role="tablist"></div></div>
    <div class="card list rise" id="taskList"></div>`;
  $('#taskSort', el).value = tasksUI.sort;
  drawTasks(el);
}

function drawTasks(root = document) {
  const today = todayStr(), f = tasksUI.filter;
  const counts = {
    all: state.tasks.filter(t => !t.done).length,
    today: state.tasks.filter(t => !t.done && t.due && t.due <= today).length,
    upcoming: state.tasks.filter(t => !t.done && t.due && t.due > today).length,
    completed: state.tasks.filter(t => t.done).length
  };
  const labels = { all: 'All', today: 'Today', upcoming: 'Upcoming', completed: 'Completed' };
  const seg = $('#taskFilter', root); if (!seg) return;
  seg.innerHTML = Object.keys(labels).map(k => `<button role="tab" class="${f === k ? 'on' : ''}" aria-selected="${f === k}" data-action="tfilter:${k}">${labels[k]} <span class="n">${counts[k]}</span></button>`).join('');

  let list = state.tasks.filter(t => {
    if (f === 'completed') return t.done;
    if (t.done) return false;
    if (f === 'today') return t.due && t.due <= today;
    if (f === 'upcoming') return t.due && t.due > today;
    return true;
  });
  list = f === 'completed' ? list.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) : sortTasks(list, tasksUI.sort);

  $('#taskSub', root).textContent = `${counts.all} open · ${counts.completed} completed`;
  const empties = {
    all: ['No tasks yet', 'Add your first task above to get started.'], today: ['Nothing due today', 'Enjoy the breathing room.'],
    upcoming: ['No upcoming deadlines', 'Give a task a due date and it will show up here.'], completed: ['Nothing completed yet', 'Finished tasks will appear here.']
  };
  $('#taskList', root).innerHTML = list.length ? `<ul>${list.map(taskRow).join('')}</ul>` :
    `<div class="empty">${ic('check')}<h4>${empties[f][0]}</h4><p>${empties[f][1]}</p></div>`;
}

function taskRow(t) {
  const di = dueInfo(t.due, t.done);
  return `<li class="task pri-${t.priority} ${t.done ? 'done' : ''}">
    <button class="check" data-action="toggle:${t.id}" aria-label="${t.done ? 'Mark incomplete' : 'Complete'}: ${esc(t.title)}">${TICK}</button>
    <button class="task-body" data-action="edit:${t.id}">
      <span class="task-title">${esc(t.title)}</span>
      <span class="task-meta">
        <span class="pri-tag">${PRI[t.priority].label}</span>
        ${t.subject ? `<span class="chip-s">${esc(t.subject)}</span>` : ''}
        ${di ? `<span class="chip-due ${di.cls}">${ic('calendar').replace('class="ic ', 'style="width:13px;height:13px" class="ic ')}${di.text}</span>` : ''}
        ${t.focus ? `<span class="chip-due">${fmtMin(t.focus)} focused</span>` : ''}
      </span>
    </button>
    <span class="task-actions">
      <button class="icon-btn" data-action="focus-task:${t.id}" aria-label="Focus on this task" title="Focus on this">${ic('timer')}</button>
      <button class="icon-btn danger" data-action="delete-task:${t.id}" aria-label="Delete task" title="Delete">${ic('trash')}</button>
    </span>
  </li>`;
}

function openTaskModal(id, preset = {}) {
  const t = id ? byId(id) : null;
  const v = t || { title: '', subject: '', priority: 'med', due: preset.due || '', notes: '' };
  const subjects = [...new Set(state.tasks.map(x => x.subject).filter(Boolean))];
  const root = openModal(`<form class="sheet" id="taskForm" data-id="${t ? t.id : ''}" aria-label="${t ? 'Edit task' : 'New task'}">
    <header><h3>${t ? 'Edit Task' : 'New Task'}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Title</span><input type="text" name="title" required maxlength="140" value="${esc(v.title)}" placeholder="What do you need to do?" autofocus autocomplete="off"></label>
    <div class="row2">
      <label class="field"><span>Subject</span><input type="text" name="subject" list="subjectList" maxlength="40" value="${esc(v.subject)}" placeholder="e.g. Physics" autocomplete="off"></label>
      <label class="field"><span>Due date</span><input type="date" name="due" value="${esc(v.due)}"></label>
    </div>
    <datalist id="subjectList">${subjects.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="field"><span>Priority</span><div class="seg full" role="radiogroup">
      ${['high', 'med', 'low'].map(p => `<label class="seg-opt"><input type="radio" name="priority" value="${p}" ${v.priority === p ? 'checked' : ''}><span>${PRI[p].label}</span></label>`).join('')}
    </div></div>
    <label class="field"><span>Notes</span><textarea name="notes" placeholder="Add details, links or a plan…">${esc(v.notes)}</textarea></label>
    <footer>${t ? `<button type="button" class="btn danger" data-action="delete-task:${t.id}">Delete</button>` : ''}<span class="spacer"></span>
      <button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${t ? 'Save' : 'Add Task'}</button></footer>
  </form>`);
  return root;
}

function saveTaskForm(form) {
  const fd = new FormData(form), id = form.dataset.id;
  const data = { title: String(fd.get('title')).trim(), subject: String(fd.get('subject')).trim(), due: String(fd.get('due') || ''), priority: String(fd.get('priority') || 'med'), notes: String(fd.get('notes') || '').trim() };
  if (!data.title) return;
  if (id && byId(id)) Object.assign(byId(id), data);
  else state.tasks.push({ id: uid(), done: false, doneAt: null, created: Date.now(), focus: 0, ...data });
  save(); closeModal(); rerender();
}

function deleteTask(id) {
  const i = state.tasks.findIndex(t => t.id === id); if (i < 0) return;
  const [removed] = state.tasks.splice(i, 1);
  if (T.taskId === id) T.taskId = '';
  save(); closeModal(); rerender();
  toast({ title: 'Task deleted', msg: removed.title, icon: '🗑️', action: { label: 'Undo', fn: () => { state.tasks.splice(i, 0, removed); save(); rerender(); } } });
}

function toggleTask(id, btn) {
  const t = byId(id); if (!t) return;
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
  save();
  const row = btn && btn.closest('.task, .mini-task'); if (row) row.classList.toggle('done', t.done);
  checkAchievements();
  setTimeout(rerender, t.done && !reduceMotion ? 420 : 0);
}

/* ---------- Calendar ---------- */
const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: todayStr() };

function renderCalendar(el) {
  el.innerHTML = `
    <div class="page-head rise"><div><h2 id="calTitle"></h2><p class="sub">Click a day to see what's due. Double-click to add a task.</p></div>
      <div class="head-actions"><div class="seg">
        <button data-action="cal-prev" aria-label="Previous month">${ic('chev-l')}</button>
        <button data-action="cal-today">Today</button>
        <button data-action="cal-next" aria-label="Next month">${ic('chev-r')}</button></div></div></div>
    <div class="cal-layout"><div class="card cal rise" id="calGrid"></div><aside class="card cal-side rise" id="calSide" aria-live="polite"></aside></div>`;
  drawCal(el);
}

function drawCal(root = document) {
  const grid = $('#calGrid', root); if (!grid) return;
  const ws = state.settings.weekStart, today = todayStr();
  const first = new Date(cal.y, cal.m, 1);
  const offset = (first.getDay() - ws + 7) % 7;
  const dim = new Date(cal.y, cal.m + 1, 0).getDate();
  const cells = Math.ceil((offset + dim) / 7) * 7;
  const mins = sessionsByDay();
  const byDue = {}; state.tasks.forEach(t => { if (t.due) (byDue[t.due] = byDue[t.due] || []).push(t); });

  $('#calTitle', root).textContent = fmtDate(first, { month: 'long', year: 'numeric' });
  const heads = [...Array(7)].map((_, i) => `<span>${fmtDate(new Date(2023, 0, 1 + ((ws + i) % 7)), { weekday: 'short' })}</span>`).join('');
  let body = '';
  for (let i = 0; i < cells; i++) {
    const date = new Date(cal.y, cal.m, i - offset + 1), ds = ymd(date);
    const list = sortTasks(byDue[ds] || []);
    const cls = ['day', date.getMonth() !== cal.m ? 'other' : '', ds === today ? 'today' : '', ds === cal.sel ? 'sel' : ''].filter(Boolean).join(' ');
    body += `<button class="${cls}" data-action="cal-sel:${ds}" data-date="${ds}" aria-label="${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}${list.length ? `, ${list.length} due` : ''}">
      <span class="day-num">${date.getDate()}</span>${mins[ds] ? `<span class="study-min">${mins[ds]}m</span>` : ''}
      <span class="chips">${list.slice(0, 2).map(t => `<span class="chip pri-${t.priority} ${t.done ? 'done' : ''}">${esc(t.title)}</span>`).join('')}</span>
      ${list.length > 2 ? `<span class="more">+${list.length - 2} more</span>` : ''}
      <span class="dots-row">${list.slice(0, 3).map(t => `<i class="pri-${t.priority}"></i>`).join('')}</span></button>`;
  }
  grid.innerHTML = `<div class="cal-head">${heads}</div><div class="cal-body">${body}</div>`;
  drawCalSide(root);
}

function drawCalSide(root = document) {
  const side = $('#calSide', root); if (!side) return;
  const d = parseYmd(cal.sel), tasks = sortTasks(state.tasks.filter(t => t.due === cal.sel)), m = minutesOn(cal.sel);
  side.innerHTML = `<h3>${fmtDate(d, { weekday: 'long' })}</h3><p class="sub">${fmtDate(d, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    ${m ? `<div class="side-stat">${ic('timer')} ${fmtMin(m)} focused</div>` : ''}
    ${tasks.length ? `<ul>${tasks.map(miniTask).join('')}</ul>` : `<div class="empty" style="padding:26px 10px"><h4>Nothing due</h4><p>A free day — or plan ahead.</p></div>`}
    <button class="btn primary" data-action="cal-add">${ic('plus')} Add task for this day</button>`;
}
function shiftMonth(delta) {
  cal.m += delta;
  if (cal.m < 0) { cal.m = 11; cal.y--; } else if (cal.m > 11) { cal.m = 0; cal.y++; }
  drawCal();
}

/* ---------- Notes ---------- */
const notesUI = { id: null, open: false };
const sortedNotes = () => state.notes.slice().sort((a, b) => b.updated - a.updated);

function renderNotes(el) {
  el.classList.add('fill');
  if (!state.notes.find(n => n.id === notesUI.id)) { notesUI.id = sortedNotes()[0] ? sortedNotes()[0].id : null; notesUI.open = false; }
  el.innerHTML = `<div class="card notes rise ${notesUI.open ? 'show-editor' : ''}" id="notes">
    <div class="notes-list"><div class="notes-head"><h3>All Notes</h3><button class="icon-btn" data-action="new-note" aria-label="New note" title="New note (N)">${ic('plus')}</button></div><div id="noteItems"></div></div>
    <div class="notes-editor" id="noteEditor"></div></div>`;
  drawNoteList(el); drawEditor(el);
}
function drawNoteList(root = document) {
  const box = $('#noteItems', root); if (!box) return;
  const notes = sortedNotes();
  box.innerHTML = notes.length ? notes.map(n => `<button class="note-item ${n.id === notesUI.id ? 'on' : ''}" data-action="open-note:${n.id}">
      <b>${esc(n.title.trim() || 'New Note')}</b><small><span>${esc(fmtRel(n.updated))}</span><span>${esc((n.body.trim().split('\n')[0] || 'No additional text').slice(0, 60))}</span></small></button>`).join('')
    : `<div class="empty" style="padding:40px 12px"><h4>No notes</h4><p>Tap + to write your first note.</p></div>`;
}
function drawEditor(root = document) {
  const host = $('#noteEditor', root); if (!host) return;
  const n = state.notes.find(x => x.id === notesUI.id);
  if (!n) { host.innerHTML = `<div class="empty" style="margin:auto">${ic('note')}<h4>No note selected</h4><p>Capture summaries, formulas and ideas.</p><button class="btn primary" data-action="new-note">New Note</button></div>`; return; }
  host.innerHTML = `<div class="ed-head"><button class="icon-btn back-btn" data-action="note-back" aria-label="Back to notes">${ic('back')}</button>
      <span class="ed-date" id="noteDate">Edited ${esc(fmtRel(n.updated))}</span>
      <button class="icon-btn danger" data-action="delete-note:${n.id}" aria-label="Delete note" title="Delete note">${ic('trash')}</button></div>
    <input type="text" id="noteTitle" class="ed-title" placeholder="Title" maxlength="120" value="${esc(n.title)}" aria-label="Note title">
    <textarea id="noteBody" class="ed-body" placeholder="Start writing…" aria-label="Note body">${esc(n.body)}</textarea>
    <div class="ed-foot" id="noteStats"></div>`;
  updateNoteStats(n);
}
function updateNoteStats(n) {
  const el = $('#noteStats'); if (!el) return;
  const words = (n.body.trim().match(/\S+/g) || []).length;
  el.textContent = `${words} word${words === 1 ? '' : 's'} · ${n.body.length} characters`;
}
function newNote() {
  const n = { id: uid(), title: '', body: '', updated: Date.now() };
  state.notes.push(n); notesUI.id = n.id; notesUI.open = true; save();
  if (current === 'notes') {
    $('#notes').classList.add('show-editor'); drawNoteList(); drawEditor();
    const t = $('#noteTitle'); if (t) t.focus();
  } else go('notes');
}
function deleteNote(id) {
  const i = state.notes.findIndex(n => n.id === id); if (i < 0) return;
  const [removed] = state.notes.splice(i, 1);
  notesUI.id = null; notesUI.open = false; save(); rerender();
  toast({ title: 'Note deleted', msg: removed.title || 'Untitled', icon: '🗑️', action: { label: 'Undo', fn: () => { state.notes.splice(i, 0, removed); save(); if (current === 'notes') rerender(); } } });
}

/* ---------- Timer view ---------- */
function renderTimer(el) {
  const open = sortTasks(state.tasks.filter(t => !t.done));
  if (T.taskId && !open.find(t => t.id === T.taskId)) T.taskId = '';
  const today = state.sessions.filter(s => s.date === todayStr()).sort((a, b) => b.ts - a.ts).slice(0, 6);
  const todayMin = minutesOn(todayStr());
  el.innerHTML = `
    <div class="page-head rise"><div><h2>Focus Timer</h2><p class="sub">Work in focused sprints, then recharge. Press <kbd>Space</kbd> to start or pause.</p></div></div>
    <div class="timer-wrap">
      <div class="card timer-card rise" id="timerCard">
        <div class="seg" id="modes" role="tablist">
          <button role="tab" data-action="mode:focus">Focus</button><button role="tab" data-action="mode:short">Short Break</button><button role="tab" data-action="mode:long">Long Break</button></div>
        <div class="ring">
          <svg viewBox="0 0 300 300"><defs><linearGradient id="gTimer" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient></defs>
            <circle class="ring-bg" cx="150" cy="150" r="130"/>
            <circle class="ring-fg" id="ringProg" cx="150" cy="150" r="130" stroke="url(#gTimer)" style="stroke-dashoffset:0"/></svg>
          <div class="ring-center"><div class="time" id="timeText" role="timer">25:00</div><div class="mode-label" id="modeLabel">Focus</div></div>
        </div>
        <div class="controls">
          <button class="round" data-action="timer-reset" aria-label="Reset timer" title="Reset">${ic('reset')}</button>
          <button class="round big" id="playBtn" data-action="timer-toggle" aria-label="Start timer">${ic('play')}</button>
          <button class="round" data-action="timer-skip" aria-label="Skip to next phase" title="Skip">${ic('skip')}</button>
        </div>
        <div class="cycle-dots" id="cycleDots" aria-hidden="true"></div>
        <label class="field"><span>Working on</span><select id="timerTask"><option value="">No task selected</option>
          ${open.map(t => `<option value="${t.id}" ${t.id === T.taskId ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
        <label class="field"><span>Focus sound</span><select id="ambientSel" aria-label="Focus sound">
          ${[['off', 'Off'], ['brown', 'Brown noise'], ['white', 'White noise'], ['rain', 'Rain']].map(([v, l]) => `<option value="${v}" ${(state.settings.ambient || 'off') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card rise"><div class="card-title"><h3>Today</h3><span class="sub" style="margin:0;font-size:13px">${fmtMin(todayMin)} focused</span></div>
          ${today.length ? today.map(s => { const t = byId(s.taskId); return `<div class="sess"><div class="sess-ico">${ic('timer')}</div><div><b>${t ? esc(t.title) : 'Focus session'}</b><small>${fmtTime(s.ts)}</small></div><span class="sess-min">${s.minutes}m</span></div>`; }).join('') : '<p class="sub" style="margin:0">No sessions yet today. Your completed sprints will show up here.</p>'}</div>
        <div class="card rise"><div class="card-title"><h3>Tips</h3></div><ul class="tips">
          <li>Pick one task and silence notifications.</li><li>After ${state.settings.until} focus sessions, take a long break.</li><li>Tweak session lengths in Settings.</li></ul></div>
      </div>
    </div>`;
}

/* ---------- Achievements ---------- */
/* ---------- Settings ---------- */
function renderSettingsBase(el) {
  const s = state.settings;
  const num = (key, label, hint, unit) => `<div class="row"><label for="s-${key}">${label}${hint ? `<small>${hint}</small>` : ''}</label><div class="num"><input type="number" id="s-${key}" data-set="${key}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" value="${s[key]}" inputmode="numeric"> ${unit}</div></div>`;
  const swatch = { blue: ['#0a84ff', '#5e5ce6'], purple: ['#bf5af2', '#5e5ce6'], pink: ['#ff375f', '#ff9f0a'], orange: ['#ff9f0a', '#ff453a'], green: ['#30d158', '#00b8a9'] };
  const mod = isMac ? '⌘' : 'Ctrl';
  el.innerHTML = `<div class="page-head rise"><div><h2>Settings</h2><p class="sub">Make StudyFlow yours. Everything is saved on this device.</p></div></div>
  <div class="settings">
    ${accountSection()}<section class="rise"><h4>Profile</h4><div class="card group"><div class="row"><label for="setName">Your name<small>Used in your dashboard greeting</small></label><input type="text" id="setName" value="${esc(s.name)}" placeholder="Optional" maxlength="40" autocomplete="off"></div></div></section>
    <section class="rise"><h4>Appearance</h4><div class="card group">
      <div class="row"><span class="lbl">Theme</span><div class="seg">${['auto', 'light', 'dark'].map(t => `<button class="${s.theme === t ? 'on' : ''}" data-action="set-theme:${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
      <div class="row"><span class="lbl">Accent colour</span><div class="swatches">${Object.keys(swatch).map(k => `<button class="swatch ${s.accent === k ? 'on' : ''}" style="--c1:${swatch[k][0]};--c2:${swatch[k][1]}" data-action="set-accent:${k}" aria-label="${k}" title="${k}"></button>`).join('')}</div></div></div></section>
    <section class="rise"><h4>Focus timer</h4><div class="card group">
      ${num('focus', 'Focus session', '', 'min')}${num('short', 'Short break', '', 'min')}${num('long', 'Long break', '', 'min')}
      ${num('until', 'Long break after', 'Number of focus sessions', 'sessions')}${num('goal', 'Daily study goal', '', 'min')}
      <div class="row"><label for="s-sound">Completion sound</label><label class="switch"><input type="checkbox" id="s-sound" data-set="sound" ${s.sound ? 'checked' : ''}><i></i></label></div></div></section>
    <section class="rise"><h4>Calendar</h4><div class="card group"><div class="row"><span class="lbl">Week starts on</span><div class="seg"><button class="${s.weekStart === 0 ? 'on' : ''}" data-action="set-week:0">Sunday</button><button class="${s.weekStart === 1 ? 'on' : ''}" data-action="set-week:1">Monday</button></div></div></div></section>
    <section class="rise"><h4>Data</h4><div class="card group">
      <div class="row"><span class="lbl">Backup<small>Export or import everything as a JSON file</small></span><div class="btn-row"><button class="btn sm" data-action="export">Export</button><button class="btn sm" data-action="import">Import</button></div></div>
      <div class="row"><span class="lbl">Sample data<small>Reload the demo tasks, notes and stats</small></span><button class="btn sm" data-action="load-sample">Load sample</button></div>
      <div class="row"><span class="lbl">Erase everything<small>Deletes all tasks, notes and progress</small></span><button class="btn danger sm" data-action="reset-data">Erase all data</button></div></div></section>
    <section class="rise"><h4>Keyboard shortcuts</h4><div class="card group"><div class="sc-list">${shortcutRows(mod)}</div></div></section>
    <p class="about rise">StudyFlow · made for focused minds</p>
  </div>`;
}
function shortcutRows(mod) {
  const rows = [['Search', `<kbd>${mod}</kbd><kbd>K</kbd>`], ['Search (alternative)', '<kbd>/</kbd>'], ['New task / note', '<kbd>N</kbd>'], ['Go to page', '<kbd>1</kbd>–<kbd>9</kbd>'],
    ['Start / pause timer', '<kbd>Space</kbd>'], ['Flip card · rate (Flashcards)', '<kbd>Space</kbd><kbd>1</kbd>–<kbd>4</kbd>'], ['Toggle light / dark', '<kbd>D</kbd>'], ['Change calendar month', '<kbd>←</kbd><kbd>→</kbd>'], ['Show shortcuts', '<kbd>?</kbd>'], ['Close dialog / search', '<kbd>Esc</kbd>']];
  return rows.map(([a, b]) => `<span>${a}</span><div>${b}</div>`).join('');
}
function showShortcuts() {
  openModal(`<div class="sheet" role="dialog" aria-label="Keyboard shortcuts"><header><h3>Keyboard shortcuts</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header><div class="sc-list">${shortcutRows(isMac ? '⌘' : 'Ctrl')}</div></div>`);
}

/* ==========================================================================
   7. Data actions
   ========================================================================== */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `studyflow-backup-${todayStr()}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast({ title: 'Backup exported', msg: 'Saved to your downloads.', icon: '💾' });
}
function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.tasks)) throw new Error('Not a StudyFlow backup');
      state = normalize(parsed); flush(); applyTheme(); timerSetMode('focus'); updateChrome(); rerender();
      toast({ title: 'Backup imported', msg: `${state.tasks.length} tasks · ${state.notes.length} notes`, icon: '📥' });
    } catch (err) { toast({ title: 'Import failed', msg: 'That file doesn’t look like a StudyFlow backup.', icon: '⚠️' }); }
    $('#importFile').value = '';
  };
  reader.readAsText(file);
}
function replaceState(next, message) {
  state = next; rebuildAch(); renderNav(); checkAchievements(true); flush(); applyTheme(); timerSetMode('focus'); T.cycle = 0; T.taskId = '';
  notesUI.id = null; notesUI.open = false; updateChrome(); rerender();
  toast({ title: message, icon: '✅' });
}

/* ==========================================================================
   8. Search
   ========================================================================== */
const searchEl = $('#search'), resultsEl = $('#results');
let sItems = [], sIdx = -1;

function runSearch() {
  const q = searchEl.value.trim().toLowerCase();
  const has = (...f) => f.some(x => String(x || '').toLowerCase().includes(q));
  const items = [];
  if (q) {
    sortTasks(state.tasks).filter(t => has(t.title, t.subject, t.notes)).slice(0, 6).forEach(t =>
      items.push({ type: 'task', id: t.id, icon: 'check', title: t.title, sub: `${t.done ? 'Completed' : 'Task'}${t.subject ? ' · ' + t.subject : ''}${t.due ? ' · ' + fmtDate(parseYmd(t.due), { month: 'short', day: 'numeric' }) : ''}` }));
    sortedNotes().filter(n => has(n.title, n.body)).slice(0, 5).forEach(n =>
      items.push({ type: 'note', id: n.id, icon: 'note', title: n.title.trim() || 'New Note', sub: (n.body.trim().split('\n')[0] || 'Note').slice(0, 70) }));
    state.decks.forEach(dk => dk.cards.filter(c => has(c.front, c.back)).slice(0, 3).forEach(c =>
      items.push({ type: 'card', id: dk.id, icon: 'cards', title: c.front, sub: 'Flashcard · ' + dk.name })));
    state.exams.filter(x => has(x.title, x.subject, x.notes)).slice(0, 3).forEach(x =>
      items.push({ type: 'exam', id: x.id, icon: 'exam', title: x.title, sub: 'Exam · ' + fmtDate(parseYmd(x.date), { month: 'short', day: 'numeric' }) }));
  }
  VIEW_ORDER.filter(v => !q || VIEWS[v].title.toLowerCase().includes(q)).forEach(v =>
    items.push({ type: 'view', id: v, icon: VIEWS[v].icon, title: VIEWS[v].title, sub: 'Go to page' }));
  sItems = items; sIdx = items.length && q ? 0 : -1;
  drawResults(q);
}
function drawResults(q) {
  const groups = { task: 'Tasks', note: 'Notes', card: 'Flashcards', exam: 'Exams', view: q ? 'Pages' : 'Jump to' };
  let html = '', last = '';
  sItems.forEach((it, i) => {
    if (it.type !== last) { html += `<div class="res-group">${groups[it.type]}</div>`; last = it.type; }
    html += `<button class="res ${i === sIdx ? 'sel' : ''}" role="option" data-action="search-pick:${i}"><span class="res-ico">${ic(it.icon)}</span><span class="res-txt"><span class="res-t">${esc(it.title)}</span><span class="res-s">${esc(it.sub)}</span></span></button>`;
  });
  if (q && !sItems.some(i => i.type !== 'view')) html = `<div class="res-empty">No tasks or notes match “${esc(searchEl.value.trim())}”</div>` + html;
  resultsEl.innerHTML = html; resultsEl.hidden = false;
  searchEl.setAttribute('aria-expanded', 'true');
}
function closeSearch() { resultsEl.hidden = true; searchEl.setAttribute('aria-expanded', 'false'); sIdx = -1; }
function focusSearch() { searchEl.focus(); searchEl.select(); runSearch(); }
function pickResult(i) {
  const it = sItems[i]; if (!it) return;
  closeSearch(); searchEl.value = ''; searchEl.blur();
  if (it.type === 'view') go(it.id);
  else if (it.type === 'task') openTaskModal(it.id);
  else if (it.type === 'card') { cardsUI.deck = it.id; cardsUI.studying = false; showCards(); }
  else if (it.type === 'exam') go('exams');
  else { notesUI.id = it.id; notesUI.open = true; if (current === 'notes') { rerender(); } else go('notes'); }
}
searchEl.addEventListener('input', runSearch);
searchEl.addEventListener('focus', runSearch);
searchEl.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!sItems.length) return;
    sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + sItems.length) % sItems.length;
    $$('.res', resultsEl).forEach((r, i) => r.classList.toggle('sel', i === sIdx));
    const sel = $('.res.sel', resultsEl); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); pickResult(sIdx >= 0 ? sIdx : 0); }
  else if (e.key === 'Escape') { e.stopPropagation(); closeSearch(); searchEl.blur(); }
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.search')) closeSearch(); });

/* ==========================================================================
   9. Actions, events & shortcuts
   ========================================================================== */
const actions = {
  go: name => go(name),
  'focus-now': () => { go('timer'); if (!T.running) setTimeout(timerToggle, 350); },
  'new-task': () => openTaskModal(),
  toggle: (id, el) => toggleTask(id, el),
  edit: id => openTaskModal(id),
  'delete-task': id => deleteTask(id),
  'focus-task': id => { T.taskId = id; if (T.mode !== 'focus' && !T.running) timerSetMode('focus'); go('timer'); },
  tfilter: key => { tasksUI.filter = key; drawTasks(); },
  'close-modal': () => closeModal(),
  'cal-prev': () => shiftMonth(-1),
  'cal-next': () => shiftMonth(1),
  'cal-today': () => { const n = new Date(); cal.y = n.getFullYear(); cal.m = n.getMonth(); cal.sel = todayStr(); drawCal(); },
  'cal-sel': ds => { cal.sel = ds; const d = parseYmd(ds); if (d.getMonth() !== cal.m) { cal.m = d.getMonth(); cal.y = d.getFullYear(); drawCal(); } else { $$('.day').forEach(b => b.classList.toggle('sel', b.dataset.date === ds)); drawCalSide(); } },
  'cal-add': () => openTaskModal(null, { due: cal.sel }),
  'new-note': () => newNote(),
  'open-note': id => { notesUI.id = id; notesUI.open = true; $('#notes').classList.add('show-editor'); drawNoteList(); drawEditor(); },
  'note-back': () => { notesUI.open = false; $('#notes').classList.remove('show-editor'); },
  'delete-note': id => deleteNote(id),
  mode: m => timerSetMode(m),
  'timer-toggle': () => timerToggle(),
  'timer-reset': () => { timerSetMode(T.mode); },
  'timer-skip': () => timerSetMode(T.mode === 'focus' ? nextAfterFocus() : 'focus'),
  'set-theme': t => { state.settings.theme = t; save(); applyTheme(); rerender(); },
  'set-accent': a => { state.settings.accent = a; save(); applyTheme(); rerender(); },
  'set-week': w => { state.settings.weekStart = +w; save(); rerender(); },
  export: () => exportData(),
  import: () => $('#importFile').click(),
  'load-sample': () => confirmDialog({ title: 'Load sample data?', msg: 'This replaces your current tasks, notes and progress with demo content.', ok: 'Load sample' }, () => replaceState(sample(), 'Sample data loaded')),
  'reset-data': () => confirmDialog({ title: 'Erase all data?', msg: 'All tasks, notes, sessions and achievements will be permanently deleted. This can’t be undone.', ok: 'Erase everything', danger: true }, () => replaceState(blank(), 'All data erased')),
  'new-deck': () => openDeckModal(),
  'edit-deck': id => openDeckModal(id),
  'delete-deck': id => deleteDeck(id),
  'open-deck': id => { cardsUI.deck = id; rerender(); },
  'close-deck': () => { cardsUI.deck = null; rerender(); },
  study: id => { if (startStudy(id)) showCards(); },
  'study-all': () => { if (startStudy('all')) showCards(); },
  flip: () => flipCard(),
  rate: q => { if (cardsUI.flipped) rateCard(+q); },
  'exit-study': () => exitStudy(),
  'edit-card': arg => { const [d, c] = arg.split(':'); openCardModal(d, c); },
  'delete-card': arg => { const [d, c] = arg.split(':'); deleteCard(d, c); },
  'new-exam': () => openExamModal(),
  'edit-exam': id => openExamModal(id),
  'delete-exam': id => deleteExam(id),
  'edit-profile': () => openProfileModal(),
  'change-password': () => openPasswordModal(),
  'sign-out': () => confirmDialog({ title: 'Sign out?', msg: 'Your data stays saved on this device. Sign back in any time.', ok: 'Sign out' }, signOut),
  'delete-account': () => openDeleteModal(),
  'go-signin': () => { sessionSet('studyflow.authtab', 'signin'); endSession(); reloadApp(); },
  'go-signup': () => { sessionSet('studyflow.authtab', 'signup'); endSession(); reloadApp(); },
  'search-pick': i => pickResult(+i)
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const sep = t.dataset.action.indexOf(':');
  const name = sep < 0 ? t.dataset.action : t.dataset.action.slice(0, sep);
  const arg = sep < 0 ? undefined : t.dataset.action.slice(sep + 1);
  if (actions[name]) { e.preventDefault(); actions[name](arg, t, e); }
});
$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) go(b.dataset.view); });
$('#addBtn').addEventListener('click', addForView);
$('#themeBtn').addEventListener('click', toggleTheme);
modalRoot().addEventListener('pointerdown', e => { if (e.target === modalRoot()) closeModal(); });
document.addEventListener('dblclick', e => { const d = e.target.closest('.day'); if (d && d.dataset.date) openTaskModal(null, { due: d.dataset.date }); });

document.addEventListener('submit', e => {
  if (e.target.id === 'taskForm') { e.preventDefault(); saveTaskForm(e.target); }
  else if (e.target.id === 'deckForm') { e.preventDefault(); saveDeckForm(e.target); }
  else if (e.target.id === 'cardForm') { e.preventDefault(); saveCardForm(e.target); }
  else if (e.target.id === 'cardAdd') { e.preventDefault(); addQuickCard(e.target); }
  else if (e.target.id === 'examForm') { e.preventDefault(); saveExamForm(e.target); }
  else if (e.target.id === 'profileForm') { e.preventDefault(); saveProfile(e.target); }
  else if (e.target.id === 'pwForm') { e.preventDefault(); savePassword(e.target); }
  else if (e.target.id === 'delForm') { e.preventDefault(); deleteAccount(e.target); }
  else if (e.target.id === 'quickAdd') {
    e.preventDefault();
    const title = $('#qaTitle').value.trim(); if (!title) { $('#qaTitle').focus(); return; }
    state.tasks.push({ id: uid(), title, subject: '', priority: $('#qaPri').value, due: $('#qaDue').value, notes: '', done: false, doneAt: null, created: Date.now(), focus: 0 });
    save(); $('#qaTitle').value = ''; if (tasksUI.filter === 'completed') tasksUI.filter = 'all'; drawTasks(); $('#qaTitle').focus();
  }
});

document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'noteTitle' || id === 'noteBody') {
    const n = state.notes.find(x => x.id === notesUI.id); if (!n) return;
    if (id === 'noteTitle') n.title = e.target.value; else n.body = e.target.value;
    n.updated = Date.now(); save(); drawNoteList(); updateNoteStats(n);
    const d = $('#noteDate'); if (d) d.textContent = 'Edited just now';
    checkAchievements();
  } else if (id === 'setName') { state.settings.name = e.target.value; save(); }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset && el.dataset.set) {
    const k = el.dataset.set;
    if (el.type === 'checkbox') state.settings[k] = el.checked;
    else {
      let v = parseInt(el.value, 10); if (Number.isNaN(v)) v = DEFAULT_SETTINGS[k];
      v = clamp(v, LIMITS[k][0], LIMITS[k][1]); el.value = v; state.settings[k] = v;
    }
    save();
    if (['focus', 'short', 'long'].includes(k) && !T.running && T.remaining === T.total) timerSetMode(T.mode);
    if (k === 'until') updateTimerUI();
  } else if (el.id === 'ambientSel') { state.settings.ambient = el.value; save(); syncAmbient(); }
  else if (el.id === 'timerTask') T.taskId = el.value;
  else if (el.id === 'taskSort') { tasksUI.sort = el.value; drawTasks(); }
  else if (el.id === 'importFile') importData(el.files[0]);
});

document.addEventListener('keydown', e => {
  if (!KEY) return;
  const tag = (e.target.tagName || '').toUpperCase();
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
  const mod = e.metaKey || e.ctrlKey;

  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (modalOpen()) closeModal(); focusSearch(); return; }
  if (e.key === 'Escape') { if (modalOpen()) closeModal(); else if (!resultsEl.hidden) closeSearch(); else if (current === 'cards' && cardsUI.studying) exitStudy(); return; }
  if (modalOpen()) {
    if (mod && e.key === 'Enter') { const f = $('#taskForm'); if (f) { e.preventDefault(); saveTaskForm(f); } }
    return;
  }
  if (typing || mod || e.altKey) return;

  if (current === 'cards' && cardsUI.studying) {
    if (e.key === ' ') { e.preventDefault(); flipCard(); return; }
    if (/^[1-4]$/.test(e.key)) { if (cardsUI.flipped) rateCard(+e.key - 1); return; }
  }

  switch (e.key) {
    case '/': e.preventDefault(); focusSearch(); break;
    case 'n': case 'N': e.preventDefault(); addForView(); break;
    case 'd': case 'D': toggleTheme(); break;
    case '?': e.preventDefault(); showShortcuts(); break;
    case ' ': if (current === 'timer' && tag !== 'BUTTON') { e.preventDefault(); timerToggle(); } break;
    case 'ArrowLeft': if (current === 'calendar') { e.preventDefault(); shiftMonth(-1); } break;
    case 'ArrowRight': if (current === 'calendar') { e.preventDefault(); shiftMonth(1); } break;
    default: if (/^[1-9]$/.test(e.key)) { const v = visibleNav()[+e.key - 1]; if (v) go(v); }
  }
});

darkMQ.addEventListener && darkMQ.addEventListener('change', () => { if (state.settings.theme === 'auto') applyTheme(); });
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else if (T.running) tick(); });
window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { state = normalize(JSON.parse(e.newValue)); applyTheme(); updateChrome(); if (!['notes', 'timer'].includes(current)) rerender(); } catch (err) { /* ignore */ } } });

/* ==========================================================================
   9a. Flashcards, exams, activity heatmap, focus sounds
   ========================================================================== */
const DECK_COLORS = ['#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#40c8e0'];
const safeColor = c => (/^#[0-9a-f]{6}$/i.test(String(c)) ? c : DECK_COLORS[0]);
const cardsUI = { deck: null, studying: false, queue: [], flipped: false, total: 0, done: 0 };
const deckById = id => state.decks.find(d => d.id === id);
const newCard = (front, back, due = todayStr()) => ({ id: uid(), front, back, due, interval: 0, ease: 2.5, reps: 0, lapses: 0, created: Date.now() });
const isDue = c => c.due <= todayStr();
const deckDue = d => d.cards.filter(isDue).length;
const totalDue = () => state.decks.reduce((a, d) => a + deckDue(d), 0);
const totalCards = () => state.decks.reduce((a, d) => a + d.cards.length, 0);
const daysUntil = ds => Math.round((parseYmd(ds) - parseYmd(todayStr())) / 864e5);
const examColor = n => (n < 0 ? 'var(--text-3)' : n <= 3 ? 'var(--red)' : n <= 7 ? 'var(--orange)' : 'var(--accent)');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ---------- Spaced repetition (SM-2 style) ---------- */
// q: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
function schedule(card, q) {
  const c = { ...card };
  if (q === 0) { c.lapses++; c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, c.ease - 0.2); }
  else if (q === 1) { c.interval = Math.max(1, Math.round((c.interval || 1) * 1.2)); c.ease = Math.max(1.3, c.ease - 0.15); c.reps++; }
  else if (q === 2) { c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.interval * c.ease); c.reps++; }
  else { c.interval = Math.max(c.reps === 0 ? 3 : 4, Math.round(Math.max(c.interval, 1) * c.ease * 1.3)); c.ease += 0.15; c.reps++; }
  c.due = q === 0 ? todayStr() : ymd(addDays(new Date(), c.interval));
  return c;
}
function fmtInterval(d) {
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.round(d / 7)}w`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}
const findQ = h => { const deck = deckById(h.d), card = deck && deck.cards.find(c => c.id === h.c); return card ? { deck, card } : null; };

function startStudy(which) {
  const decks = which === 'all' ? state.decks : state.decks.filter(d => d.id === which);
  const q = [];
  decks.forEach(d => d.cards.filter(isDue).forEach(c => q.push({ d: d.id, c: c.id })));
  for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  if (!q.length) { toast({ title: 'Nothing due', msg: 'Come back later — or add more cards.', icon: '✅' }); return 0; }
  Object.assign(cardsUI, { studying: true, queue: q, flipped: false, total: q.length, done: 0 });
  return q.length;
}
const showCards = () => (current === 'cards' ? rerender() : go('cards'));
function flipCard() {
  cardsUI.flipped = !cardsUI.flipped;
  const f = $('#flash'), r = $('#rate');
  if (f) f.classList.toggle('flipped', cardsUI.flipped);
  if (r) r.classList.toggle('show', cardsUI.flipped);
}
function rateCard(q) {
  const head = cardsUI.queue[0]; if (!head) return;
  const hit = findQ(head);
  cardsUI.queue.shift();
  if (hit) {
    const i = hit.deck.cards.findIndex(c => c.id === hit.card.id);
    hit.deck.cards[i] = schedule(hit.card, q);
    state.meta.reviews = (state.meta.reviews || 0) + 1;
    if (q === 0) cardsUI.queue.push(head); else cardsUI.done++;
  }
  cardsUI.flipped = false;
  save();
  if (!cardsUI.queue.length) { cardsUI.studying = false; toast({ title: 'Session complete', msg: `${plural(cardsUI.done, 'card')} reviewed`, icon: '🎉' }); }
  checkAchievements();
  rerender();
}
function exitStudy() { cardsUI.studying = false; cardsUI.flipped = false; rerender(); }

/* ---------- Flashcards views ---------- */
function renderCards(el) {
  if (cardsUI.studying) {
    while (cardsUI.queue.length && !findQ(cardsUI.queue[0])) cardsUI.queue.shift();
    if (cardsUI.queue.length) return renderStudy(el);
    cardsUI.studying = false;
  }
  const deck = cardsUI.deck && deckById(cardsUI.deck);
  if (deck) return renderDeck(el, deck);
  cardsUI.deck = null;
  const due = totalDue();
  el.innerHTML = `<div class="page-head rise"><div><h2>Flashcards</h2><p class="sub">${due ? `${plural(due, 'card')} due for review today` : totalCards() ? 'You’re all caught up — nice work.' : 'Make a deck and let spaced repetition do the remembering.'}</p></div>
    <div class="head-actions">${due ? `<button class="btn primary" data-action="study-all">${ic('play')} Study ${due} due</button>` : ''}<button class="btn" data-action="new-deck">${ic('plus')} New Deck</button></div></div>
    ${state.decks.length ? `<div class="deck-grid">${state.decks.map(deckCard).join('')}</div>`
      : `<div class="card rise"><div class="empty">${ic('cards')}<h4>No decks yet</h4><p>Create a deck, add cards, and review them on a schedule.</p><button class="btn primary" data-action="new-deck">New Deck</button></div></div>`}`;
}
function deckCard(d) {
  const due = deckDue(d), mastered = d.cards.filter(c => c.interval >= 21).length;
  const pct = d.cards.length ? Math.round(mastered / d.cards.length * 100) : 0;
  return `<div class="card deck lift rise" style="--dc:${safeColor(d.color)}">
    <div class="deck-top"><span class="deck-ico">${ic('cards')}</span><div class="deck-name"><h3>${esc(d.name)}</h3><span>${plural(d.cards.length, 'card')}${due ? ` · <b>${due} due</b>` : ''}</span></div></div>
    <div><div class="progress"><i style="--w:${pct}%"></i></div><div class="deck-mastery">${pct}% mastered</div></div>
    <div class="deck-actions"><button class="btn primary sm" data-action="study:${d.id}" ${due ? '' : 'disabled'}>Study</button><button class="btn sm" data-action="open-deck:${d.id}">Manage</button></div></div>`;
}
function cardRow(d, c) {
  const n = daysUntil(c.due);
  return `<li class="task">
    <button class="task-body" data-action="edit-card:${d.id}:${c.id}"><span class="task-title">${esc(c.front)}</span>
      <span class="task-meta"><span class="chip-due">${esc(c.back.length > 70 ? c.back.slice(0, 70) + '…' : c.back)}</span><span class="chip-s">${n <= 0 ? 'Due now' : 'in ' + fmtInterval(n)}</span></span></button>
    <span class="task-actions"><button class="icon-btn danger" data-action="delete-card:${d.id}:${c.id}" aria-label="Delete card" title="Delete">${ic('trash')}</button></span></li>`;
}
function renderDeck(el, d) {
  const due = deckDue(d);
  el.innerHTML = `<div class="page-head rise"><div><button class="link" data-action="close-deck">‹ All decks</button><h2 style="margin-top:6px">${esc(d.name)}</h2><p class="sub">${plural(d.cards.length, 'card')} · ${due} due</p></div>
    <div class="head-actions">${due ? `<button class="btn primary" data-action="study:${d.id}">${ic('play')} Study ${due}</button>` : ''}<button class="btn" data-action="edit-deck:${d.id}">Rename</button><button class="btn danger" data-action="delete-deck:${d.id}">Delete</button></div></div>
    <form class="card quick-add rise" id="cardAdd" data-deck="${d.id}" autocomplete="off">
      <span style="color:var(--accent);display:grid">${ic('plus')}</span>
      <input type="text" id="caFront" placeholder="Front — question or term" aria-label="Card front" maxlength="300">
      <input type="text" id="caBack" placeholder="Back — answer" aria-label="Card back" maxlength="600">
      <button class="btn primary" type="submit">Add</button></form>
    <div class="card list rise">${d.cards.length ? `<ul>${d.cards.map(c => cardRow(d, c)).join('')}</ul>` : `<div class="empty">${ic('cards')}<h4>No cards yet</h4><p>Type a question and its answer above, then press Add.</p></div>`}</div>`;
}
function renderStudy(el) {
  const head = cardsUI.queue[0], { deck, card } = findQ(head);
  const pct = cardsUI.total ? Math.round(cardsUI.done / cardsUI.total * 100) : 0;
  const labels = ['Again', 'Hard', 'Good', 'Easy'];
  el.innerHTML = `<div class="study">
    <div class="study-top rise"><button class="btn sm" data-action="exit-study">${ic('x')} End session</button><div class="progress"><i style="--w:${pct}%"></i></div><span class="sub" style="margin:0">${cardsUI.done} / ${cardsUI.total}</span></div>
    <div class="flash rise ${cardsUI.flipped ? 'flipped' : ''}" id="flash" data-action="flip" role="button" tabindex="0" aria-label="Flip card" style="--dc:${safeColor(deck.color)}">
      <div class="flash-in">
        <div class="face front"><small>${esc(deck.name)} · Question</small><span>${esc(card.front)}</span></div>
        <div class="face back"><small>Answer</small><span>${esc(card.back)}</span></div>
      </div></div>
    <div class="rate ${cardsUI.flipped ? 'show' : ''}" id="rate">${labels.map((l, q) =>
      `<button class="r${q}" data-action="rate:${q}"><span>${l}</span><small>${q === 0 ? 'soon' : fmtInterval(schedule(card, q).interval)}</small></button>`).join('')}</div>
    <p class="study-hint">Click the card or press <kbd>Space</kbd> to flip · <kbd>1</kbd>–<kbd>4</kbd> to rate</p></div>`;
}

/* ---------- Deck & card dialogs ---------- */
function openDeckModal(id) {
  const d = id ? deckById(id) : null;
  const color = d ? safeColor(d.color) : DECK_COLORS[state.decks.length % DECK_COLORS.length];
  openModal(`<form class="sheet" id="deckForm" data-id="${d ? d.id : ''}" novalidate aria-label="${d ? 'Rename deck' : 'New deck'}">
    <header><h3>${d ? 'Edit Deck' : 'New Deck'}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Name</span><input type="text" name="name" maxlength="60" value="${esc(d ? d.name : '')}" placeholder="e.g. Spanish Basics" autofocus autocomplete="off"></label>
    <div class="field"><span>Colour</span><div class="swatches">${DECK_COLORS.map(c => `<label class="swatch-opt"><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span class="swatch" style="--c1:${c};--c2:${c}"></span></label>`).join('')}</div></div>
    <footer><span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${d ? 'Save' : 'Create Deck'}</button></footer></form>`);
}
function saveDeckForm(form) {
  const name = form.elements.name.value.trim();
  if (!name) { form.elements.name.focus(); return; }
  const color = (form.elements.color && form.elements.color.value) || DECK_COLORS[0], id = form.dataset.id;
  if (id && deckById(id)) Object.assign(deckById(id), { name, color });
  else { const d = { id: uid(), name, color, cards: [] }; state.decks.push(d); cardsUI.deck = d.id; }
  save(); closeModal(); checkAchievements(); showCards();
}
function deleteDeck(id) {
  const d = deckById(id); if (!d) return;
  confirmDialog({ title: `Delete “${d.name}”?`, msg: `This removes the deck and its ${plural(d.cards.length, 'card')}.`, ok: 'Delete deck', danger: true }, () => {
    state.decks = state.decks.filter(x => x.id !== id);
    if (cardsUI.deck === id) cardsUI.deck = null;
    cardsUI.queue = cardsUI.queue.filter(h => h.d !== id);
    save(); rerender();
  });
}
function openCardModal(deckId, cardId) {
  const d = deckById(deckId); if (!d) return;
  const c = d.cards.find(x => x.id === cardId);
  openModal(`<form class="sheet" id="cardForm" data-deck="${d.id}" data-id="${c ? c.id : ''}" novalidate aria-label="Edit card">
    <header><h3>Edit Card</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Front</span><textarea name="front" maxlength="300" autofocus>${esc(c ? c.front : '')}</textarea></label>
    <label class="field"><span>Back</span><textarea name="back" maxlength="600">${esc(c ? c.back : '')}</textarea></label>
    <footer>${c ? `<button type="button" class="btn danger" data-action="delete-card:${d.id}:${c.id}">Delete</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save</button></footer></form>`);
}
function saveCardForm(form) {
  const d = deckById(form.dataset.deck), front = form.elements.front.value.trim(), back = form.elements.back.value.trim();
  if (!d || !front || !back) { (!front ? form.elements.front : form.elements.back).focus(); return; }
  const c = d.cards.find(x => x.id === form.dataset.id);
  if (c) { c.front = front; c.back = back; } else d.cards.push(newCard(front, back));
  save(); closeModal(); checkAchievements(); rerender();
}
function addQuickCard(form) {
  const d = deckById(form.dataset.deck), f = $('#caFront'), b = $('#caBack');
  const front = f.value.trim(), back = b.value.trim();
  if (!d) return;
  if (!front) { f.focus(); return; }
  if (!back) { b.focus(); return; }
  d.cards.push(newCard(front, back));
  save(); checkAchievements(); rerender();
  const nf = $('#caFront'); if (nf) nf.focus();
}
function deleteCard(deckId, cardId) {
  const d = deckById(deckId); if (!d) return;
  const i = d.cards.findIndex(c => c.id === cardId); if (i < 0) return;
  const [removed] = d.cards.splice(i, 1);
  cardsUI.queue = cardsUI.queue.filter(h => h.c !== cardId);
  save(); closeModal(); rerender();
  toast({ title: 'Card deleted', msg: removed.front, icon: '🗑️', action: { label: 'Undo', fn: () => { d.cards.splice(i, 0, removed); save(); if (current === 'cards') rerender(); } } });
}

/* ---------- Exams ---------- */
function renderExams(el) {
  const list = state.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
  const up = list.filter(x => daysUntil(x.date) >= 0), past = list.filter(x => daysUntil(x.date) < 0).reverse();
  const nextN = up.length ? daysUntil(up[0].date) : 0;
  el.innerHTML = `<div class="page-head rise"><div><h2>Exams</h2><p class="sub">${up.length ? `Next: ${esc(up[0].title)} ${nextN === 0 ? 'is today' : `in ${plural(nextN, 'day')}`}` : 'Add your exams and watch the countdown.'}</p></div>
    <div class="head-actions"><button class="btn primary" data-action="new-exam">${ic('plus')} New Exam</button></div></div>
    ${up.length ? `<div class="exam-list">${up.map(examCard).join('')}</div>` : `<div class="card rise"><div class="empty">${ic('exam')}<h4>No upcoming exams</h4><p>Add an exam date to start a countdown and plan your revision.</p><button class="btn primary" data-action="new-exam">New Exam</button></div></div>`}
    ${past.length ? `<h3 class="sec-h rise">Past</h3><div class="exam-list past">${past.map(examCard).join('')}</div>` : ''}`;
}
function examCard(x) {
  const n = daysUntil(x.date);
  return `<div class="card exam lift rise" style="--ec:${examColor(n)}">
    <div class="days"><b>${Math.abs(n)}</b><span>${n === 0 ? 'today' : n < 0 ? (Math.abs(n) === 1 ? 'day ago' : 'days ago') : (n === 1 ? 'day' : 'days')}</span></div>
    <div class="exam-body"><h3>${esc(x.title)}</h3>
      <div class="task-meta">${x.subject ? `<span class="chip-s">${esc(x.subject)}</span>` : ''}<span class="chip-due">${ic('calendar').replace('class="ic ', 'style="width:13px;height:13px" class="ic ')}${fmtDate(parseYmd(x.date), { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
      ${x.notes ? `<p class="exam-notes">${esc(x.notes)}</p>` : ''}</div>
    <div class="task-actions" style="opacity:1"><button class="icon-btn" data-action="edit-exam:${x.id}" aria-label="Edit exam" title="Edit">${ic('edit')}</button><button class="icon-btn danger" data-action="delete-exam:${x.id}" aria-label="Delete exam" title="Delete">${ic('trash')}</button></div></div>`;
}
function openExamModal(id) {
  const x = id ? state.exams.find(e => e.id === id) : null;
  const subjects = [...new Set(state.tasks.map(t => t.subject).filter(Boolean))];
  openModal(`<form class="sheet" id="examForm" data-id="${x ? x.id : ''}" novalidate aria-label="${x ? 'Edit exam' : 'New exam'}">
    <header><h3>${x ? 'Edit Exam' : 'New Exam'}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Title</span><input type="text" name="title" maxlength="100" value="${esc(x ? x.title : '')}" placeholder="e.g. Physics midterm" autofocus autocomplete="off"></label>
    <div class="row2">
      <label class="field"><span>Subject</span><input type="text" name="subject" list="examSubjects" maxlength="40" value="${esc(x ? x.subject : '')}" autocomplete="off"></label>
      <label class="field"><span>Date</span><input type="date" name="date" value="${esc(x ? x.date : '')}"></label>
    </div>
    <datalist id="examSubjects">${subjects.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <label class="field"><span>Notes</span><textarea name="notes" placeholder="Topics, room, what to bring…">${esc(x ? x.notes : '')}</textarea></label>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer>${x ? `<button type="button" class="btn danger" data-action="delete-exam:${x.id}">Delete</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${x ? 'Save' : 'Add Exam'}</button></footer></form>`);
}
function saveExamForm(form) {
  const v = n => form.elements[n].value.trim(), err = $('#formErr');
  if (!v('title')) { err.textContent = 'Give the exam a title.'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v('date'))) { err.textContent = 'Pick the exam date.'; return; }
  const data = { title: v('title'), subject: v('subject'), date: v('date'), notes: v('notes') };
  const x = state.exams.find(e => e.id === form.dataset.id);
  if (x) Object.assign(x, data); else state.exams.push({ id: uid(), ...data });
  save(); closeModal(); checkAchievements(); rerender();
}
function deleteExam(id) {
  const i = state.exams.findIndex(e => e.id === id); if (i < 0) return;
  const [removed] = state.exams.splice(i, 1);
  save(); closeModal(); rerender();
  toast({ title: 'Exam deleted', msg: removed.title, icon: '🗑️', action: { label: 'Undo', fn: () => { state.exams.splice(i, 0, removed); save(); rerender(); } } });
}

/* ---------- Dashboard extras ---------- */
function heatmapCard() {
  const ws = state.settings.weekStart, today = new Date(); today.setHours(0, 0, 0, 0);
  const weeks = 16, mins = sessionsByDay();
  const start = addDays(addDays(today, -((today.getDay() - ws + 7) % 7)), -(weeks - 1) * 7);
  let cells = '', total = 0, active = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), m = mins[ymd(d)] || 0, future = d > today;
    if (m) { total += m; active++; }
    const lvl = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
    cells += `<i class="l${lvl}${future ? ' future' : ''}" title="${fmtDate(d, { month: 'short', day: 'numeric' })}: ${m} min"></i>`;
  }
  return `<div class="card rise span-7"><div class="card-title"><h3>Study activity</h3><span class="sub" style="margin:0;font-size:13px">${plural(active, 'active day')} · ${fmtMin(total)}</span></div>
    <div class="heat" style="--cols:${weeks}">${cells}</div>
    <div class="heat-legend"><span>Less</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>More</span></div></div>`;
}
function examsCard() {
  const up = state.exams.filter(x => daysUntil(x.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const rows = up.map(x => {
    const n = daysUntil(x.date);
    return `<div class="exam-mini" style="--ec:${examColor(n)}"><span class="days-mini"><b>${n}</b><small>${n === 1 ? 'day' : 'days'}</small></span>
      <div class="mt-body"><span class="mt-title">${esc(x.title)}</span><span class="mt-meta">${x.subject ? esc(x.subject) + ' · ' : ''}${fmtDate(parseYmd(x.date), { weekday: 'short', month: 'short', day: 'numeric' })}</span></div></div>`;
  }).join('');
  return `<div class="card rise span-5"><div class="card-title"><h3>Upcoming exams</h3><button class="link" data-action="go:exams">${state.exams.length ? 'See all' : 'Add'}</button></div>
    ${rows || '<p class="sub" style="margin:0">No exams scheduled. Add one to start a countdown.</p>'}</div>`;
}

/* ---------- Focus sounds (generated in the browser, no files) ---------- */
const Amb = { ctx: null, node: null, gain: null, kind: '' };
function ambientStop() {
  if (!Amb.node) return;
  const n = Amb.node, g = Amb.gain, ctx = Amb.ctx;
  try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.15); } catch (e) { /* ignore */ }
  setTimeout(() => { try { n.stop(); } catch (e) { /* ignore */ } }, 600);
  Amb.node = null; Amb.kind = '';
}
function ambientStart(kind) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    Amb.ctx = Amb.ctx || new AC();
    const ctx = Amb.ctx; if (ctx.state === 'suspended') ctx.resume();
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; data[i] = last * 3.5; } else data[i] = w;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const gain = ctx.createGain(); gain.gain.value = 0;
    let tail = src;
    if (kind === 'rain') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      src.connect(hp); hp.connect(lp); tail = lp;
    } else if (kind === 'white') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
      src.connect(lp); tail = lp;
    }
    tail.connect(gain); gain.connect(ctx.destination); src.start();
    gain.gain.setTargetAtTime(kind === 'brown' ? 0.22 : 0.1, ctx.currentTime, 0.4);
    Amb.node = src; Amb.gain = gain; Amb.kind = kind;
  } catch (e) { /* audio unavailable */ }
}
function syncAmbient() {
  const a = state.settings.ambient;
  const want = T.running && T.mode === 'focus' && a && a !== 'off' ? a : '';
  if (want === Amb.kind) return;
  ambientStop();
  if (want) ambientStart(want);
}

/* ---------- Add button / N shortcut depends on the page ---------- */
function addForView() {
  const f = { notes: newNote, cards: () => openDeckModal(), exams: () => openExamModal(), grades: () => openGradeModal(), habits: () => openHabitModal() }[current];
  if (f) f(); else openTaskModal();
}

/* ==========================================================================
   9b. Accounts (stored on this device only)
   ========================================================================== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const hasSubtle = () => !!(window.crypto && window.crypto.subtle && window.TextEncoder);
const randHex = n => {
  const a = new Uint8Array(n);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  return hex(a);
};
const initials = name => (String(name).trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('') || '?').toUpperCase();
const sessionGet = k => safeGet(sessionStorage, k);
const sessionSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } };

function weakHash(str) {          // only used when WebCrypto is unavailable (insecure context)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
async function hashPassword(pw, salt, algo = hasSubtle() ? 'pbkdf2' : 'weak') {
  if (algo === 'pbkdf2') {
    if (!hasSubtle()) throw new Error('This account needs a secure page (https:// or localhost) to sign in.');
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
    return 'pbkdf2:' + hex(bits);
  }
  return 'weak:' + weakHash(salt + ':' + pw);
}
const algoOf = acc => String(acc.hash).split(':')[0];

function startSession(id, remember) {
  try { localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY); (remember ? localStorage : sessionStorage).setItem(SESS_KEY, id); } catch (e) { /* ignore */ }
}
function endSession() { try { localStorage.removeItem(SESS_KEY); sessionStorage.removeItem(SESS_KEY); } catch (e) { /* ignore */ } }
const reloadApp = () => window.location.reload();

async function createAccount({ name, email, password, importExisting }) {
  const accounts = getAccounts();
  if (accounts.some(a => a.email === email)) throw new Error('An account with this email already exists. Try signing in.');
  const salt = randHex(16);
  const acc = { id: uid(), name, email, salt, hash: await hashPassword(password, salt), created: Date.now() };

  let data = null;
  if (importExisting) { try { data = normalize(JSON.parse(localStorage.getItem(KEY_BASE))); } catch (e) { data = null; } }
  if (!data) data = blank(); // new accounts start empty
  if (!String(data.settings.name || '').trim()) data.settings.name = name.split(/\s+/)[0];
  try {
    localStorage.setItem(`${KEY_BASE}.${acc.id}`, JSON.stringify(data));
    accounts.push(acc);
    localStorage.setItem(ACC_KEY, JSON.stringify(accounts));
  } catch (e) { throw new Error('Could not save — browser storage is full or blocked.'); }
  return acc;
}

async function verifyLogin(email, password) {
  const acc = getAccounts().find(a => a.email === email);
  if (!acc) { await hashPassword(password, 'x'); await sleep(350); throw new Error('Incorrect email or password.'); }
  const h = await hashPassword(password, acc.salt, algoOf(acc));
  if (h !== acc.hash) { await sleep(350); throw new Error('Incorrect email or password.'); }
  return acc;
}

function signOut() {
  flush(); endSession(); reloadApp();
}

/* ---------- Sign-in / create-account screen ---------- */
function pendingAuthTab() {
  const t = sessionGet('studyflow.authtab');
  try { sessionStorage.removeItem('studyflow.authtab'); } catch (e) { /* ignore */ }
  return t || 'signin';
}
function showFlash() {
  const m = sessionGet('studyflow.flash');
  if (!m) return;
  try { sessionStorage.removeItem('studyflow.flash'); } catch (e) { /* ignore */ }
  setTimeout(() => toast({ title: m, icon: '👋' }), 700);
}

function showAuth(tab = 'signin') {
  document.body.classList.add('locked');
  const hasAccounts = getAccounts().length > 0;
  if (!hasAccounts) tab = 'signup';
  const hasLegacy = !!safeGet(localStorage, KEY_BASE);
  const signup = tab === 'signup';
  let el = $('#auth');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth'; el.className = 'auth';
    document.body.append(el);
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-auth-tab]');
      if (t) { e.preventDefault(); showAuth(t.dataset.authTab); return; }
      if (e.target.closest('[data-pw-toggle]')) {
        e.preventDefault();
        const inp = $('input[name=password]', el), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password'; e.target.closest('[data-pw-toggle]').textContent = show ? 'Hide' : 'Show';
        return;
      }
      if (e.target.closest('#guestBtn')) { e.preventDefault(); startSession('guest', true); reloadApp(); }
    });
    el.addEventListener('submit', e => { e.preventDefault(); onAuthSubmit(e.target); });
  }
  el.innerHTML = `<div class="auth-card" role="dialog" aria-label="${signup ? 'Create your StudyFlow account' : 'Sign in to StudyFlow'}">
    <div class="auth-brand">
      <span class="logo"><svg viewBox="0 0 32 32"><path d="M5 20c4-8 8 8 11 0s7 8 11 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="9" r="3" fill="#fff"/></svg></span>
      <h2>${signup ? 'Create your account' : 'Welcome back'}</h2>
      <p>${signup ? 'Keep your tasks, notes and progress in your own workspace.' : 'Sign in to pick up where you left off.'}</p>
    </div>
    ${hasAccounts ? `<div class="seg full" role="tablist"><button type="button" role="tab" class="${signup ? '' : 'on'}" data-auth-tab="signin">Sign in</button><button type="button" role="tab" class="${signup ? 'on' : ''}" data-auth-tab="signup">Create account</button></div>` : ''}
    <form id="authForm" data-mode="${tab}" novalidate>
      ${signup ? '<label class="field"><span>Name</span><input type="text" name="name" maxlength="60" autocomplete="name" placeholder="Your name" autofocus></label>' : ''}
      <label class="field"><span>Email</span><input type="email" name="email" maxlength="120" autocomplete="${signup ? 'email' : 'username'}" placeholder="you@example.com" ${signup ? '' : 'autofocus'}></label>
      <label class="field"><span>Password</span><span class="pw-wrap"><input type="password" name="password" maxlength="128" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'At least 8 characters' : 'Your password'}"><button type="button" class="pw-toggle" data-pw-toggle>Show</button></span></label>
      <label class="check-row"><input type="checkbox" name="remember" checked> Keep me signed in on this device</label>
      ${signup && hasLegacy ? '<label class="check-row"><input type="checkbox" name="importExisting" checked> Import the tasks and notes already saved in this browser</label>' : ''}
      <p class="auth-err" id="authErr" role="alert"></p>
      <button class="btn primary block" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="auth-or"><span>or</span></div>
    <button class="btn block" type="button" id="guestBtn">Continue as guest</button>
    <p class="auth-note">Accounts are stored only in this browser — there’s no server and no password recovery. Use Settings → Export to keep a backup.</p>
  </div>`;
  const first = $('[autofocus]', el); if (first) setTimeout(() => first.focus(), 60);
}

async function onAuthSubmit(form) {
  const mode = form.dataset.mode, err = $('#authErr'), btn = $('button[type=submit]', form);
  const val = n => (form.elements[n] ? String(form.elements[n].value).trim() : '');
  const label = mode === 'signup' ? 'Create account' : 'Sign in';
  err.textContent = '';
  try {
    const email = val('email').toLowerCase(), password = form.elements.password.value;
    if (mode === 'signup' && !val('name')) throw new Error('Please enter your name.');
    if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
    if (mode === 'signup' && password.length < 8) throw new Error('Use at least 8 characters for your password.');
    if (!password) throw new Error('Enter your password.');
    btn.disabled = true; btn.textContent = 'Please wait…';
    let acc;
    if (mode === 'signup') {
      acc = await createAccount({ name: val('name'), email, password, importExisting: !!(form.elements.importExisting && form.elements.importExisting.checked) });
      sessionSet('studyflow.flash', `Welcome to StudyFlow, ${acc.name.split(/\s+/)[0]}`);
    } else {
      acc = await verifyLogin(email, password);
      sessionSet('studyflow.flash', `Welcome back, ${acc.name.split(/\s+/)[0]}`);
    }
    startSession(acc.id, !!form.elements.remember.checked);
    reloadApp();
  } catch (e) {
    err.textContent = e.message || 'Something went wrong.';
    btn.disabled = false; btn.textContent = label;
    const card = $('.auth-card'); if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
  }
}

/* ---------- In-app account management ---------- */
function drawAvatar() {
  const b = $('#avatarBtn'); if (!b) return;
  b.textContent = initials(account ? account.name : 'Guest');
  b.title = account ? `${account.name} — account settings` : 'Guest — account settings';
}

function accountSection() {
  const guest = !account, nm = guest ? 'Guest' : account.name;
  const rows = guest
    ? `<div class="row"><span class="lbl">Create an account<small>Keep your data in a private workspace</small></span><div class="btn-row"><button class="btn sm" data-action="go-signin">Sign in</button><button class="btn primary sm" data-action="go-signup">Create account</button></div></div>`
    : `<div class="row"><span class="lbl">Profile<small>Change your name or email</small></span><button class="btn sm" data-action="edit-profile">Edit</button></div>
       <div class="row"><span class="lbl">Password<small>Update your sign-in password</small></span><button class="btn sm" data-action="change-password">Change</button></div>
       <div class="row"><span class="lbl">Session<small>Your data stays saved on this device</small></span><button class="btn sm" data-action="sign-out">Sign out</button></div>
       <div class="row"><span class="lbl">Delete account<small>Removes this account and all of its data</small></span><button class="btn danger sm" data-action="delete-account">Delete…</button></div>`;
  return `<section class="rise"><h4>Account</h4><div class="card group">
    <div class="acct"><span class="avatar">${esc(initials(nm))}</span><div class="acct-txt"><b>${esc(nm)}</b><span>${guest ? 'Guest mode · data stays in this browser only' : esc(account.email)}</span></div></div>
    ${rows}</div></section>`;
}

function openProfileModal() {
  if (!account) return;
  openModal(`<form class="sheet" id="profileForm" novalidate aria-label="Edit profile">
    <header><h3>Edit Profile</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Name</span><input type="text" name="name" maxlength="60" value="${esc(account.name)}" autofocus></label>
    <label class="field"><span>Email</span><input type="email" name="email" maxlength="120" value="${esc(account.email)}"></label>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer><span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save</button></footer>
  </form>`);
}
function saveProfile(form) {
  const name = form.elements.name.value.trim(), email = form.elements.email.value.trim().toLowerCase(), err = $('#formErr');
  if (!name) { err.textContent = 'Please enter your name.'; return; }
  if (!EMAIL_RE.test(email)) { err.textContent = 'Enter a valid email address.'; return; }
  const accounts = getAccounts();
  if (accounts.some(a => a.id !== account.id && a.email === email)) { err.textContent = 'Another account already uses that email.'; return; }
  const i = accounts.findIndex(a => a.id === account.id); if (i < 0) return;
  accounts[i] = { ...accounts[i], name, email };
  if (!putAccounts(accounts)) { err.textContent = 'Could not save — browser storage is unavailable.'; return; }
  account = accounts[i];
  state.settings.name = name.split(/\s+/)[0]; save();
  closeModal(); drawAvatar(); rerender();
  toast({ title: 'Profile updated', icon: '✅' });
}

function openPasswordModal() {
  if (!account) return;
  openModal(`<form class="sheet" id="pwForm" novalidate aria-label="Change password">
    <header><h3>Change Password</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Current password</span><input type="password" name="current" autocomplete="current-password" autofocus></label>
    <label class="field"><span>New password</span><input type="password" name="next" autocomplete="new-password" placeholder="At least 8 characters"></label>
    <label class="field"><span>Confirm new password</span><input type="password" name="confirm" autocomplete="new-password"></label>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer><span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Update</button></footer>
  </form>`);
}
async function savePassword(form) {
  const err = $('#formErr'), cur = form.elements.current.value, next = form.elements.next.value, again = form.elements.confirm.value;
  err.textContent = '';
  try {
    if (!cur) throw new Error('Enter your current password.');
    if (next.length < 8) throw new Error('Use at least 8 characters for the new password.');
    if (next !== again) throw new Error('The new passwords don’t match.');
    const accounts = getAccounts(), i = accounts.findIndex(a => a.id === account.id);
    if (i < 0) throw new Error('Account not found.');
    if (await hashPassword(cur, accounts[i].salt, algoOf(accounts[i])) !== accounts[i].hash) throw new Error('Your current password is incorrect.');
    const salt = randHex(16);
    accounts[i] = { ...accounts[i], salt, hash: await hashPassword(next, salt) };
    if (!putAccounts(accounts)) throw new Error('Could not save — browser storage is unavailable.');
    account = accounts[i];
    closeModal(); toast({ title: 'Password updated', icon: '🔒' });
  } catch (e) { err.textContent = e.message; }
}

function openDeleteModal() {
  if (!account) return;
  openModal(`<form class="sheet small" id="delForm" novalidate aria-label="Delete account">
    <h3>Delete this account?</h3>
    <p class="sub">All tasks, notes and progress saved under <b>${esc(account.email)}</b> will be permanently removed from this browser. Enter your password to confirm.</p>
    <label class="field" style="text-align:left"><span>Password</span><input type="password" name="password" autocomplete="current-password" autofocus></label>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn danger">Delete account</button></footer>
  </form>`);
}
async function deleteAccount(form) {
  const err = $('#formErr'); err.textContent = '';
  try {
    const accounts = getAccounts(), acc = accounts.find(a => a.id === account.id);
    if (!acc) throw new Error('Account not found.');
    if (await hashPassword(form.elements.password.value, acc.salt, algoOf(acc)) !== acc.hash) throw new Error('Incorrect password.');
    putAccounts(accounts.filter(a => a.id !== acc.id));
    try { localStorage.removeItem(`${KEY_BASE}.${acc.id}`); } catch (e) { /* ignore */ }
    skipFlush = true; clearTimeout(saveTimer);
    endSession(); sessionSet('studyflow.flash', 'Your account was deleted');
    reloadApp();
  } catch (e) { err.textContent = e.message; }
}

/* ==========================================================================
   9c. Customisation — layout, appearance, editable achievements
   ========================================================================== */
const PAGE_GROUP = { dashboard: 'Overview', tasks: 'Study', calendar: 'Study', notes: 'Study', timer: 'Study', cards: 'Study', exams: 'Study', achievements: 'Progress', settings: 'Progress', grades: 'More', habits: 'More' };
const PAGE_COLORS = { dashboard: ['#0a84ff', '#5e5ce6'], tasks: ['#ff9f0a', '#ff6a00'], calendar: ['#ff453a', '#ff2d55'], notes: ['#ffd60a', '#ff9f0a'], timer: ['#30d158', '#00b8a9'], cards: ['#40c8e0', '#0a84ff'], exams: ['#ff375f', '#bf5af2'], achievements: ['#bf5af2', '#5e5ce6'], settings: ['#98989f', '#636366'], grades: ['#30b0c7', '#0a84ff'], habits: ['#34c759', '#a3e635'] };
const WIDGETS = { hero: 'Greeting', quick: 'Quick access', focus: 'Focus today', streak: 'Day streak', tasksdone: 'Tasks done this week', total: 'Total focus time', week: 'Weekly chart', goal: 'Daily goal ring', next: 'Up next', ach: 'Achievements', heat: 'Activity heatmap', exams: 'Exam countdowns' };
const FONTS = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
  serif: '"New York", "Iowan Old Style", "Palatino Linotype", Georgia, serif',
  mono: '"SF Mono", ui-monospace, Menlo, Consolas, monospace'
};

const orderedKeys = (saved, all) => { const s = (saved || []).filter(k => all.includes(k)); return [...new Set([...s, ...all])]; };
const navPages = () => orderedKeys(state.settings.navOrder, VIEW_ORDER);
const visibleNav = () => navPages().filter(k => k === 'settings' || !(state.settings.navHidden || []).includes(k));
const widgetList = () => orderedKeys(state.settings.widgetOrder, Object.keys(WIDGETS));
const widgetShown = k => !(state.settings.widgetHidden || []).includes(k);

function renderNav() {
  const nav = $('#nav'); if (!nav) return;
  let last = '', n = 0, out = '';
  visibleNav().forEach(k => {
    const g = PAGE_GROUP[k]; if (g !== last) { out += `<p class="nav-label">${g}</p>`; last = g; }
    n++;
    const c = PAGE_COLORS[k];
    out += `<button class="nav-item${k === current ? ' active' : ''}" data-view="${k}" title="${esc(VIEWS[k].title)}"><span class="nav-ico" style="--g1:${c[0]};--g2:${c[1]}">${ic(VIEWS[k].icon)}</span><span class="nav-text">${esc(VIEWS[k].title)}</span>${n <= 9 ? `<kbd>${n}</kbd>` : ''}</button>`;
  });
  nav.innerHTML = out;
}

/* ---------- Achievements: edit / add / hide ---------- */
function achColour(i) { return GRADS[i] || GRADS[0]; }
function openAchModal(id) {
  const all = buildAch(true), a = id ? all.find(x => x.id === id) : null;
  const metric = a ? a.metric : 'tasks', cur = a || { name: '', desc: '', goal: 5, icon: 'star', g: GRADS[3] };
  const gi = Math.max(0, GRADS.findIndex(g => g[0] === cur.g[0] && g[1] === cur.g[1]));
  openModal(`<form class="sheet" id="achForm" data-id="${a ? a.id : ''}" novalidate aria-label="${a ? 'Edit achievement' : 'New achievement'}">
    <header><h3>${a ? 'Edit achievement' : 'New achievement'}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Name</span><input type="text" name="name" maxlength="40" value="${esc(cur.name)}" placeholder="e.g. Night Owl" autocomplete="off"></label>
    <label class="field"><span>Description</span><input type="text" name="desc" maxlength="90" value="${esc(cur.desc)}" placeholder="What does it take?" autocomplete="off"></label>
    <div class="row2">
      <label class="field"><span>Tracks</span><select name="metric" ${a && a.base ? 'disabled' : ''}>${Object.entries(METRICS).map(([k, m]) => `<option value="${k}" ${k === metric ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      <label class="field"><span>Goal</span><input type="number" name="goal" min="1" max="100000" value="${cur.goal}" inputmode="numeric"></label>
    </div>
    <div class="field"><span>Icon</span><div class="pick-grid">${ACH_ICONS.map(n => `<label class="pick"><input type="radio" name="icon" value="${n}" ${n === cur.icon ? 'checked' : ''}><span>${ic(n)}</span></label>`).join('')}</div></div>
    <div class="field"><span>Colour</span><div class="pick-grid">${GRADS.map((g, i) => `<label class="pick"><input type="radio" name="grad" value="${i}" ${i === gi ? 'checked' : ''}><span class="sw" style="--g1:${g[0]};--g2:${g[1]}"></span></label>`).join('')}</div></div>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer>${a ? (a.base ? `<button type="button" class="btn" data-action="ach-hide:${a.id}">Hide</button>` : `<button type="button" class="btn danger" data-action="ach-delete:${a.id}">Delete</button>`) : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${a ? 'Save' : 'Add'}</button></footer></form>`);
}
function saveAchForm(form) {
  const f = new FormData(form), name = String(f.get('name') || '').trim();
  const err = $('#formErr', form);
  if (!name) { err.textContent = 'Give the achievement a name.'; return; }
  const goal = clamp(parseInt(f.get('goal'), 10) || 1, 1, 100000);
  const vals = { name, desc: String(f.get('desc') || '').trim(), goal, icon: ACH_ICONS.includes(f.get('icon')) ? f.get('icon') : 'star', g: achColour(+f.get('grad')) };
  const id = form.dataset.id, cfg = state.ach;
  if (!id) cfg.custom.push({ id: 'c-' + uid(), metric: METRICS[f.get('metric')] ? f.get('metric') : 'tasks', ...vals });
  else if (ACH_BASE.some(b => b.id === id)) cfg.over[id] = vals;
  else { const i = cfg.custom.findIndex(c => c.id === id); if (i >= 0) cfg.custom[i] = { ...cfg.custom[i], ...vals, metric: METRICS[f.get('metric')] ? f.get('metric') : cfg.custom[i].metric }; }
  save(); closeModal(); rebuildAch(); checkAchievements(); rerender();
}

function renderAchievements(el) {
  const all = buildAch(true), hid = all.filter(a => a.hidden);
  const unlocked = ACH.filter(a => state.achievements[a.id]).length;
  el.innerHTML = `
    <div class="page-head rise"><div><h2>Achievements</h2><p class="sub">Small wins add up. Edit, hide or add your own goals.</p></div>
      <div class="head-actions"><button class="btn primary sm" data-action="ach-new">${ic('plus')} New achievement</button></div></div>
    <div class="card ach-hero rise"><div class="big">${unlocked}<span style="font-size:22px;color:var(--text-3);font-weight:600"> / ${ACH.length}</span></div>
      <div><b>${ACH.length && unlocked === ACH.length ? 'You unlocked everything — legendary!' : 'Keep going!'}</b><div class="progress"><i style="--w:${ACH.length ? (unlocked / ACH.length * 100).toFixed(0) : 0}%"></i></div></div></div>
    <div class="ach-grid">${ACH.map(a => {
      const v = a.val(), ts = state.achievements[a.id], p = clamp(v / a.goal, 0, 1);
      const shown = a.time ? `${fmtMin(Math.min(v, a.goal))} / ${fmtMin(a.goal)}` : `${Math.min(v, a.goal)} / ${a.goal}`;
      return `<div class="card ach lift rise ${ts ? 'unlocked' : 'locked'}"><div class="ach-tools"><button class="icon-btn" data-action="ach-edit:${a.id}" aria-label="Edit ${esc(a.name)}" title="Edit">${ic('edit')}</button></div>
        <div class="ach-top"><div class="badge" style="--g1:${a.g[0]};--g2:${a.g[1]}">${achIcon(a)}</div><div><h4>${esc(a.name)}</h4><p>${esc(a.desc)}</p></div></div>
        <div class="progress"><i style="--w:${(p * 100).toFixed(0)}%"></i></div>
        <div class="ach-foot"><span>${shown}</span><span>${ts ? `Unlocked ${fmtDate(new Date(ts), { month: 'short', day: 'numeric' })}` : 'Locked'}</span></div></div>`;
    }).join('')}</div>
    ${hid.length ? `<h4 class="ach-sub rise">Hidden</h4><div class="chip-row rise">${hid.map(a => `<button class="chip" data-action="ach-show:${a.id}" title="Show again">${ic('plus')} ${esc(a.name)}</button>`).join('')}</div>` : ''}
    <p class="ach-reset rise"><button class="link" data-action="ach-reset">Reset achievements to defaults</button></p>`;
}

/* ---------- Settings ---------- */
const setUI = { tab: 'general' };
const SET_TABS = [['general', 'General'], ['appearance', 'Appearance'], ['layout', 'Layout'], ['timer', 'Timer'], ['data', 'Data']];

function listEditor(kind, keys, label, hidden) {
  return keys.map((k, i) => {
    const locked = kind === 'nav' && k === 'settings', on = locked || !hidden.includes(k);
    return `<div class="row li"><span class="lbl">${esc(label(k))}</span><div class="btn-row">
      <button class="icon-btn mv up" data-action="move:${kind}|${k}|-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${ic('chev-r')}</button>
      <button class="icon-btn mv dn" data-action="move:${kind}|${k}|1" aria-label="Move down" ${i === keys.length - 1 ? 'disabled' : ''}>${ic('chev-r')}</button>
      <label class="switch"><input type="checkbox" data-tgl="${kind}|${k}" aria-label="Show ${esc(label(k))}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''}><i></i></label></div></div>`;
  }).join('');
}

function renderSettings(el) {
  const s = state.settings;
  const tmp = document.createElement('div'); renderSettingsBase(tmp);
  const secs = [...tmp.querySelectorAll('.settings > section')];
  const title = n => (n.querySelector('h4') || {}).textContent || '';
  const take = re => secs.filter(n => re.test(title(n))).map(n => n.outerHTML).join('');
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(s[key]) === String(v) ? 'on' : ''}" data-action="pref:${key}=${v}">${l}</button>`).join('')}</div>`;
  const slider = (key, label, min, max, unit, hint) => `<div class="row"><label for="p-${key}">${label}${hint ? `<small>${hint}</small>` : ''}</label><div class="range"><input type="range" id="p-${key}" data-pref="${key}" data-num="1" data-unit="${unit}" min="${min}" max="${max}" value="${s[key]}"><output>${s[key]}${unit}</output></div></div>`;
  const toggle = (key, label, hint) => `<div class="row"><label for="p-${key}">${label}${hint ? `<small>${hint}</small>` : ''}</label><label class="switch"><input type="checkbox" id="p-${key}" data-pref="${key}" ${s[key] ? 'checked' : ''}><i></i></label></div>`;
  const swatch = { school: ['#f07a0a', '#ff9f45'], blue: ['#0a84ff', '#5e5ce6'], purple: ['#bf5af2', '#5e5ce6'], pink: ['#ff375f', '#ff9f0a'], orange: ['#ff9f0a', '#ff453a'], green: ['#30d158', '#00b8a9'] };
  let body = '';
  if (setUI.tab === 'general') body = take(/^(?!Appearance|Focus timer|Data|Keyboard)/);
  else if (setUI.tab === 'timer') body = take(/Focus timer/);
  else if (setUI.tab === 'data') body = take(/Data|Keyboard/);
  else if (setUI.tab === 'appearance') body = `
    <section class="rise"><h4>Colour</h4><div class="card group">
      <div class="row"><span class="lbl">Style<small>Campus is the school-app look</small></span>${seg('style', [['campus', 'Campus'], ['classic', 'Glass']])}</div>
      <div class="row"><span class="lbl">Theme</span>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
      <div class="row"><span class="lbl">Accent colour</span><div class="swatches">${Object.keys(swatch).map(k => `<button class="swatch ${s.accent === k ? 'on' : ''}" style="--c1:${swatch[k][0]};--c2:${swatch[k][1]}" data-action="set-accent:${k}" aria-label="${k}" title="${k}"></button>`).join('')}<label class="swatch custom ${s.accent === 'custom' ? 'on' : ''}" title="Custom colour" style="--c1:${s.customAccent || '#0a84ff'};--c2:${s.customAccent || '#0a84ff'}"><input type="color" id="p-customAccent" data-pref="customAccent" value="${esc(s.customAccent || '#0a84ff')}" aria-label="Custom accent colour"></label></div></div>
      <div class="row"><span class="lbl">Background</span>${seg('bg', [['aurora', 'Aurora'], ['sunset', 'Sunset'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['calm', 'Calm'], ['plain', 'Plain']])}</div></div></section>
    <section class="rise"><h4>Shape &amp; glass</h4><div class="card group">
      ${slider('blur', 'Glass blur', 0, 60, 'px', 'Frosted-glass strength')}${slider('radius', 'Corner radius', 6, 34, 'px')}
      <div class="row"><span class="lbl">Density</span>${seg('density', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']])}</div>
      ${toggle('windowFull', 'Fill the whole screen', 'Turn off the floating-window frame on large displays')}</div></section>
    <section class="rise"><h4>Text</h4><div class="card group">
      <div class="row"><span class="lbl">Font</span>${seg('font', [['system', 'System'], ['rounded', 'Rounded'], ['serif', 'Serif'], ['mono', 'Mono']])}</div>
      ${slider('fontSize', 'Text size', 12, 20, 'px')}</div></section>
    <section class="rise"><h4>Motion &amp; sidebar</h4><div class="card group">
      <div class="row"><span class="lbl">Animations</span>${seg('motion', [['auto', 'Automatic'], ['full', 'Full'], ['reduce', 'Reduced']])}</div>
      ${toggle('sidebarIcons', 'Icons-only sidebar', 'Hide the page names')}${toggle('sidebarKbd', 'Show shortcut numbers', 'The small 1–9 hints beside each page')}</div></section>
    <section class="rise"><div class="btn-row"><button class="btn" data-action="reset-appearance">Reset appearance</button></div></section>`;
  else if (setUI.tab === 'layout') body = `
    <section class="rise"><h4>Start</h4><div class="card group"><div class="row"><label for="p-startPage">Open StudyFlow on</label>
      <select id="p-startPage" data-pref="startPage">${VIEW_ORDER.map(k => `<option value="${k}" ${s.startPage === k ? 'selected' : ''}>${esc(VIEWS[k].title)}</option>`).join('')}</select></div></div></section>
    <section class="rise"><h4>Sidebar pages</h4><div class="card group">${listEditor('nav', navPages(), k => VIEWS[k].title, s.navHidden || [])}</div></section>
    <section class="rise"><h4>Dashboard widgets</h4><div class="card group">${listEditor('widget', widgetList(), k => WIDGETS[k], s.widgetHidden || [])}</div></section>
    <section class="rise"><div class="btn-row"><button class="btn" data-action="reset-layout">Reset layout</button></div></section>`;
  el.innerHTML = `<div class="page-head rise"><div><h2>Settings</h2><p class="sub">Make StudyFlow yours. Everything is saved on this device.</p></div></div>
    <div class="set-tabs rise"><div class="seg" role="tablist">${SET_TABS.map(([k, l]) => `<button role="tab" class="${setUI.tab === k ? 'on' : ''}" data-action="settings-tab:${k}">${l}</button>`).join('')}</div></div>
    <div class="settings">${body}<p class="about rise">StudyFlow · made for focused minds</p></div>`;
}

Object.assign(actions, {
  'settings-tab': t => { setUI.tab = t; rerender(); },
  pref: arg => {
    const i = arg.indexOf('='), k = arg.slice(0, i); let v = arg.slice(i + 1);
    if (/^-?\d+$/.test(v)) v = +v;
    state.settings[k] = v; save(); applyTheme(); rerender();
  },
  move: arg => {
    const [kind, key, d] = arg.split('|'), nav = kind === 'nav';
    const list = nav ? navPages() : widgetList(), i = list.indexOf(key), j = i + (+d);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    state.settings[nav ? 'navOrder' : 'widgetOrder'] = list; save(); if (nav) renderNav(); rerender();
  },
  'reset-layout': () => { Object.assign(state.settings, { navOrder: [], navHidden: [], widgetOrder: [], widgetHidden: [], startPage: 'dashboard' }); save(); renderNav(); rerender(); },
  'reset-appearance': () => {
    ['style', 'accent', 'customAccent', 'bg', 'blur', 'radius', 'density', 'windowFull', 'font', 'fontSize', 'motion', 'sidebarIcons', 'sidebarKbd'].forEach(k => { state.settings[k] = DEFAULT_SETTINGS[k]; });
    save(); applyTheme(); rerender();
  },
  'ach-new': () => openAchModal(''),
  'ach-edit': id => openAchModal(id),
  'ach-hide': id => { if (!state.ach.hidden.includes(id)) state.ach.hidden.push(id); save(); closeModal(); rebuildAch(); rerender(); },
  'ach-show': id => { state.ach.hidden = state.ach.hidden.filter(x => x !== id); save(); rebuildAch(); checkAchievements(true); rerender(); },
  'ach-delete': id => { state.ach.custom = state.ach.custom.filter(c => c.id !== id); delete state.achievements[id]; save(); closeModal(); rebuildAch(); rerender(); },
  'ach-reset': () => confirmDialog({ title: 'Reset achievements?', msg: 'Your edits, hidden badges and custom achievements are removed. Unlocked default badges stay unlocked.', ok: 'Reset' }, () => {
    state.ach.custom.forEach(c => delete state.achievements[c.id]);
    state.ach = { over: {}, hidden: [], custom: [] }; save(); rebuildAch(); rerender();
  })
});

function onPrefInput(e) {
  const el = e.target, k = el.dataset && el.dataset.pref; if (!k) return;
  let v = el.type === 'checkbox' ? el.checked : el.dataset.num ? +el.value : el.value;
  if (k === 'customAccent') state.settings.accent = 'custom';
  state.settings[k] = v; save(); applyTheme();
  const o = el.parentElement && el.parentElement.querySelector('output'); if (o) o.textContent = v + (el.dataset.unit || '');
  if (k === 'sidebarKbd') renderNav();
  if (e.type === 'change' && (k === 'customAccent' || k === 'startPage')) rerender();
}
document.addEventListener('input', onPrefInput);
document.addEventListener('change', onPrefInput);
document.addEventListener('change', e => {
  const t = e.target.dataset && e.target.dataset.tgl; if (!t) return;
  const [kind, key] = t.split('|'), prop = kind === 'nav' ? 'navHidden' : 'widgetHidden';
  const h = new Set(state.settings[prop] || []); e.target.checked ? h.delete(key) : h.add(key);
  state.settings[prop] = [...h]; save(); if (kind === 'nav') renderNav(); 
});
document.addEventListener('submit', e => { if (e.target.id === 'achForm') { e.preventDefault(); saveAchForm(e.target); } });

function quickAccess() {
  const pages = visibleNav().filter(k => k !== 'dashboard' && k !== 'settings');
  return `<div class="card rise span-12"><div class="card-title"><h3>Quick access</h3></div><div class="mod-grid">${pages.map(k => { const c = PAGE_COLORS[k]; return `<button class="mod" data-action="go:${k}"><i style="--g1:${c[0]};--g2:${c[1]}">${ic(VIEWS[k].icon)}</i><span>${esc(VIEWS[k].title)}</span></button>`; }).join('')}</div></div>`;
}

/* ==========================================================================
   9d. Grades & habits
   ========================================================================== */
const pctOf = (s, m) => (m > 0 ? s / m * 100 : 0);
const wavg = items => { const w = items.reduce((a, g) => a + (g.weight || 1), 0); return w ? items.reduce((a, g) => a + pctOf(g.score, g.max) * (g.weight || 1), 0) / w : 0; };
const letterOf = p => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
const gpaOf = p => (p >= 90 ? 4 : p >= 80 ? 3 : p >= 70 ? 2 : p >= 60 ? 1 : 0);
function gradeSubjects() {
  const m = {};
  state.grades.forEach(g => { (m[g.subject || 'General'] = m[g.subject || 'General'] || []).push(g); });
  return Object.entries(m).map(([name, items]) => ({ name, items: items.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')), avg: wavg(items) })).sort((a, b) => a.name.localeCompare(b.name));
}
function renderGrades(el) {
  const subs = gradeSubjects();
  const overall = subs.length ? subs.reduce((a, s) => a + s.avg, 0) / subs.length : 0;
  const gpa = subs.length ? subs.reduce((a, s) => a + gpaOf(s.avg), 0) / subs.length : 0;
  const best = subs.slice().sort((a, b) => b.avg - a.avg)[0];
  el.innerHTML = `<div class="page-head rise"><div><h2>Grades</h2><p class="sub">${subs.length ? `${plural(state.grades.length, 'result')} across ${plural(subs.length, 'subject')}` : 'Log marks to see averages and a GPA estimate.'}</p></div>
    <div class="head-actions"><button class="btn primary" data-action="new-grade">${ic('plus')} New Grade</button></div></div>
    ${subs.length ? `<div class="grid">
      <div class="card gstat rise span-4"><b>${overall.toFixed(1)}%</b><span>Overall average</span></div>
      <div class="card gstat rise span-4"><b>${gpa.toFixed(2)}</b><span>GPA estimate (4.0 scale)</span></div>
      <div class="card gstat rise span-4"><b>${esc(best.name)}</b><span>Strongest subject · ${best.avg.toFixed(0)}%</span></div>
      ${subs.map(s => `<div class="card rise span-6"><div class="g-head"><h3>${esc(s.name)}</h3><span class="g-letter">${letterOf(s.avg)}</span></div>
        <div class="g-avg"><b>${s.avg.toFixed(1)}%</b><div class="progress"><i style="--w:${clamp(s.avg, 0, 100).toFixed(0)}%"></i></div></div>
        ${s.items.map(g => `<button class="g-row" data-action="edit-grade:${g.id}"><span class="g-t">${esc(g.title)}${g.weight && g.weight !== 1 ? ` <small>×${g.weight}</small>` : ''}</span><span>${g.score}/${g.max}</span><b>${pctOf(g.score, g.max).toFixed(0)}%</b></button>`).join('')}</div>`).join('')}
    </div>` : `<div class="card rise"><div class="empty">${ic('chart')}<h4>No grades yet</h4><p>Add a test or assignment result to start tracking.</p><button class="btn primary sm" data-action="new-grade">New Grade</button></div></div>`}`;
}
function openGradeModal(id) {
  const g = id ? state.grades.find(x => x.id === id) : null;
  const subjects = [...new Set([...state.tasks.map(t => t.subject), ...state.grades.map(x => x.subject)].filter(Boolean))];
  openModal(`<form class="sheet" id="gradeForm" data-id="${g ? g.id : ''}" novalidate aria-label="${g ? 'Edit grade' : 'New grade'}">
    <header><h3>${g ? 'Edit Grade' : 'New Grade'}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Title</span><input type="text" name="title" maxlength="80" value="${esc(g ? g.title : '')}" placeholder="e.g. Unit test 2" autocomplete="off"></label>
    <div class="row2"><label class="field"><span>Subject</span><input type="text" name="subject" list="gradeSubjects" maxlength="40" value="${esc(g ? g.subject : '')}" autocomplete="off"></label>
      <label class="field"><span>Date</span><input type="date" name="date" value="${esc(g ? g.date : todayStr())}"></label></div>
    <datalist id="gradeSubjects">${subjects.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="row2"><label class="field"><span>Score</span><input type="number" name="score" step="any" min="0" value="${g ? g.score : ''}" inputmode="decimal"></label>
      <label class="field"><span>Out of</span><input type="number" name="max" step="any" min="1" value="${g ? g.max : 100}" inputmode="decimal"></label></div>
    <label class="field"><span>Weight<small> — how much it counts (1 = normal)</small></span><input type="number" name="weight" step="any" min="0.1" max="100" value="${g ? g.weight : 1}"></label>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer>${g ? `<button type="button" class="btn danger" data-action="del-grade:${g.id}">Delete</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${g ? 'Save' : 'Add'}</button></footer></form>`);
}
function saveGradeForm(form) {
  const f = n => form.elements[n].value.trim(), err = $('#formErr');
  const score = parseFloat(f('score')), max = parseFloat(f('max')), weight = parseFloat(f('weight')) || 1;
  if (!f('title')) { err.textContent = 'Give it a title.'; return; }
  if (!(score >= 0)) { err.textContent = 'Enter your score.'; return; }
  if (!(max > 0)) { err.textContent = '“Out of” must be above zero.'; return; }
  const data = { title: f('title'), subject: f('subject'), date: f('date'), score, max, weight: clamp(weight, 0.1, 100) };
  const g = state.grades.find(x => x.id === form.dataset.id);
  if (g) Object.assign(g, data); else state.grades.push({ id: uid(), ...data });
  save(); closeModal(); rerender();
}

const lastDays = n => [...Array(n)].map((_, i) => ymd(addDays(new Date(), i - n + 1)));
function habitStreak(h) {
  const set = new Set(h.days); let d = new Date(), n = 0;
  if (!set.has(ymd(d))) d = addDays(d, -1);
  while (set.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
function renderHabits(el) {
  const t = todayStr(), done = state.habits.filter(h => h.days.includes(t)).length, days = lastDays(7);
  el.innerHTML = `<div class="page-head rise"><div><h2>Habits</h2><p class="sub">${state.habits.length ? `${done} of ${state.habits.length} done today` : 'Build small daily routines and keep the streak alive.'}</p></div>
    <div class="head-actions"><button class="btn primary" data-action="new-habit">${ic('plus')} New Habit</button></div></div>
    ${state.habits.length ? `<div class="habit-list">${state.habits.map(h => { const c = h.g || GRADS[0], st = habitStreak(h);
      return `<div class="card habit rise" style="--g1:${c[0]};--g2:${c[1]}"><div class="h-top"><span class="h-dot">${ic('check')}</span><div class="h-name"><h3>${esc(h.name)}</h3><small>${st ? `${plural(st, 'day')} streak` : 'No streak yet'} · ${plural(h.days.length, 'check-in')}</small></div>
        <button class="icon-btn" data-action="edit-habit:${h.id}" aria-label="Edit ${esc(h.name)}">${ic('edit')}</button></div>
        <div class="h-days">${days.map(d => `<button class="h-day ${h.days.includes(d) ? 'on' : ''} ${d === t ? 'today' : ''}" data-action="habit-day:${h.id}|${d}" aria-pressed="${h.days.includes(d)}" aria-label="${esc(h.name)} ${d}"><em>${fmtDate(new Date(d + 'T12:00:00'), { weekday: 'narrow' })}</em><i>${ic('check')}</i></button>`).join('')}</div></div>`; }).join('')}</div>`
    : `<div class="card rise"><div class="empty">${ic('repeat')}<h4>No habits yet</h4><p>Try “Read 20 minutes” or “Review flashcards”.</p><button class="btn primary sm" data-action="new-habit">New Habit</button></div></div>`}`;
}
function openHabitModal(id) {
  const h = id ? state.habits.find(x => x.id === id) : null, c = h ? h.g || GRADS[0] : GRADS[0];
  const gi = Math.max(0, GRADS.findIndex(g => g[0] === c[0]));
  openModal(`<form class="sheet small" id="habitForm" data-id="${h ? h.id : ''}" novalidate aria-label="${h ? 'Edit habit' : 'New habit'}">
    <header><h3>${h ? 'Edit Habit' : 'New Habit'}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></header>
    <label class="field"><span>Name</span><input type="text" name="name" maxlength="50" value="${esc(h ? h.name : '')}" placeholder="e.g. Read for 20 minutes" autocomplete="off"></label>
    <div class="field"><span>Colour</span><div class="pick-grid">${GRADS.map((g, i) => `<label class="pick"><input type="radio" name="grad" value="${i}" ${i === gi ? 'checked' : ''}><span class="sw" style="--g1:${g[0]};--g2:${g[1]}"></span></label>`).join('')}</div></div>
    <p class="form-err" id="formErr" role="alert"></p>
    <footer>${h ? `<button type="button" class="btn danger" data-action="del-habit:${h.id}">Delete</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${h ? 'Save' : 'Add'}</button></footer></form>`);
}
function saveHabitForm(form) {
  const name = form.elements.name.value.trim(); if (!name) { $('#formErr').textContent = 'Give the habit a name.'; return; }
  const g = achColour(+(new FormData(form).get('grad'))), h = state.habits.find(x => x.id === form.dataset.id);
  if (h) { h.name = name; h.g = g; } else state.habits.push({ id: uid(), name, g, days: [], created: Date.now() });
  save(); closeModal(); rerender();
}
Object.assign(actions, {
  'new-grade': () => openGradeModal(), 'edit-grade': id => openGradeModal(id),
  'del-grade': id => { state.grades = state.grades.filter(g => g.id !== id); save(); closeModal(); rerender(); },
  'new-habit': () => openHabitModal(), 'edit-habit': id => openHabitModal(id),
  'del-habit': id => confirmDialog({ title: 'Delete this habit?', msg: 'Its check-in history will be removed.', ok: 'Delete', danger: true }, () => { state.habits = state.habits.filter(h => h.id !== id); save(); closeModal(); rerender(); }),
  'habit-day': arg => {
    const [id, day] = arg.split('|'), h = state.habits.find(x => x.id === id); if (!h || day > todayStr()) return;
    h.days = h.days.includes(day) ? h.days.filter(d => d !== day) : [...h.days, day]; save(); rerender();
  }
});
document.addEventListener('submit', e => {
  if (e.target.id === 'gradeForm') { e.preventDefault(); saveGradeForm(e.target); }
  else if (e.target.id === 'habitForm') { e.preventDefault(); saveHabitForm(e.target); }
});

/* ==========================================================================
   10. Boot
   ========================================================================== */
function init() {
  rebuildAch(); renderNav(); applyTheme();
  $('#kbdHint').textContent = isMac ? '⌘K' : 'Ctrl K';
  checkAchievements(true);
  timerSetMode('focus');
  updateChrome();
  drawAvatar();
  showFlash();
  const n = location.hash.slice(1);
  mount(VIEWS[n] ? n : (VIEWS[state.settings.startPage] ? state.settings.startPage : 'dashboard'), true);
}
if (KEY) init(); else showAuth(pendingAuthTab());

})();

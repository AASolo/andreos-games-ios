"use strict";

/* ================= Данные ================= */

const VERSION = "__VERSION__";
const SITE_URL = "https://aasolo.github.io/andreos-games-ios/";
// Внутри настоящего приложения (из .ipa) есть мост в Swift: window.AndreosNative
const native = window.AndreosNative || null;
const bridge = native && window.webkit?.messageHandlers?.app;
const post = msg => { try { bridge.postMessage(msg); } catch {} };
const RELEASE_PAGE = "https://github.com/AASolo/andreos-games-ios/releases/latest";
const standalone = !!native || navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;

const games = [
  { id: "doroga-v-okean", title: "Дорога в океан", cover: "og.jpg", accent: "#35d0ba",
    text: "Вырасти малька за 30 дней заботы и открой ему дорогу в океан.", tag: "Уютные" },
  { id: "ButerBashnya-1.0", title: "Бутербашня", cover: "og-image.png", accent: "#ffc42e",
    text: "Построй башню из бургеров до самого космоса.", tag: "Аркады" },
  { id: "kimchi-gleba", title: "Кимчи-кафе Глеба Ли", cover: "og.jpg", accent: "#ff7a2f",
    text: "Собери кимчи по рецепту и накорми гостей.", tag: "Кулинария" },
  { id: "HackQuest-3.0", title: "HackQuest", cover: "og-image.png", accent: "#2bff7a",
    text: "Хакерская игра: 30 миссий на Python и секретный проект OBELISK.", tag: "Обучение" },
];
const byId = Object.fromEntries(games.map(g => [g.id, g]));
const url = g => `games/${g.id}/index.html`;
const img = g => `games/${g.id}/${g.cover}`;

const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>';
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

/* ================= Хранилище ================= */

const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const settings = Object.assign({ haptics: true, sounds: true, music: true, motion: true }, store.get("ap:settings", {}));

// Статистика: { time: {id: мс}, plays: {id: n}, days: ["2026-10-13", ...], night, early }
function loadStats() {
  return Object.assign({ time: {}, plays: {}, days: [], night: false, early: false }, store.get("ap:stats", {}));
}
let stats = loadStats();
let recent = store.get("ap:recent", []);
let favs = new Set(store.get("ap:favs", []));

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function streak() {
  const days = new Set(stats.days);
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // серия не сгорает, пока не кончился сегодняшний день
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bestStreak() {
  const sorted = [...new Set(stats.days)].sort();
  let best = 0, cur = 0, prev = null;
  for (const k of sorted) {
    const t = new Date(k + "T12:00:00");
    cur = prev && (t - prev) / 864e5 === 1 ? cur + 1 : 1;
    best = Math.max(best, cur); prev = t;
  }
  return best;
}
const totalTime = () => Object.values(stats.time).reduce((a, b) => a + b, 0);
const totalPlays = () => Object.values(stats.plays).reduce((a, b) => a + b, 0);

function fmtTime(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return ms > 0 ? "< 1 мин" : "0 мин";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}

/* ================= Достижения ================= */

const awards = [
  { id: "first", icon: "🎮", title: "Первый шаг", text: "Запусти любую игру", goal: 1, val: () => totalPlays() },
  { id: "all", icon: "🗺️", title: "Исследователь", text: "Попробуй все игры", goal: games.length, val: () => games.filter(g => stats.plays[g.id]).length },
  { id: "fan", icon: "💜", title: "Фанат", text: "Запусти одну игру 10 раз", goal: 10, val: () => Math.max(0, ...Object.values(stats.plays)) },
  { id: "hour", icon: "⏱️", title: "Марафон", text: "Проведи в играх 1 час", goal: 60, val: () => Math.floor(totalTime() / 60000) },
  { id: "s3", icon: "🔥", title: "В ритме", text: "Играй 3 дня подряд", goal: 3, val: () => bestStreak() },
  { id: "s7", icon: "⚡", title: "Неделя силы", text: "Играй 7 дней подряд", goal: 7, val: () => bestStreak() },
  { id: "owl", icon: "🦉", title: "Ночная сова", text: "Сыграй после полуночи", goal: 1, val: () => +stats.night },
  { id: "bird", icon: "🐦", title: "Ранняя пташка", text: "Сыграй до 7 утра", goal: 1, val: () => +stats.early },
  { id: "love", icon: "❤️", title: "Любимчик", text: "Добавь игру в избранное", goal: 1, val: () => favs.size },
];
const isGot = a => a.val() >= a.goal;

// Выдаёт новые достижения с тостом и конфетти
function checkAwards() {
  const seen = new Set(store.get("ap:awards", []));
  const fresh = awards.filter(a => isGot(a) && !seen.has(a.id));
  if (!fresh.length) return;
  fresh.forEach(a => seen.add(a.id));
  store.set("ap:awards", [...seen]);
  store.set("ap:awardsNew", true);
  document.getElementById("awardsDot").hidden = false;
  fresh.forEach((a, i) => setTimeout(() => {
    toast(a.icon, "Новое достижение!", a.title);
    confetti();
    haptic([20, 60, 30]);
    sound("win");
  }, 700 + i * 1600));
}

/* ================= Отклик: вибрация и звук ================= */

// На iPhone нет navigator.vibrate, но Safari 18+ даёт лёгкий отклик при переключении
// системного свитча, поэтому незаметно «щёлкаем» скрытым свитчем.
const hapticSwitch = document.getElementById("hapticSwitch");
function haptic(p = 10) {
  if (!settings.haptics) return;
  try {
    if (bridge) { post({ type: "haptic", style: Array.isArray(p) && p.length > 2 ? "success" : (Array.isArray(p) || p >= 12 ? "medium" : "light") }); return; }
    if (navigator.vibrate) { navigator.vibrate(p); return; }
    hapticSwitch.click();
    // Двойной «тик» для важных событий
    if (Array.isArray(p) && p.length > 2) setTimeout(() => hapticSwitch.click(), 120);
  } catch {}
}
let actx;
function sound(kind = "tap") {
  if (!settings.sounds) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { tap: [[880, .04]], fav: [[660, .05], [990, .07]], win: [[523, .09], [659, .09], [784, .09], [1047, .18]], tab: [[740, .03]] }[kind];
    let t = actx.currentTime;
    for (const [f, d] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.08, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + d + .02);
      t += d * .8;
    }
  } catch {}
}
/* ================= Фоновая музыка ================= */

// Лёгкий спокойный эмбиент, который синтезируется прямо в телефоне (работает и без интернета):
// мягкие аккорды медленно сменяют друг друга, иногда звенят тихие колокольчики.
const music = (() => {
  const CHORDS = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 66]]; // Cmaj7 Am7 Fmaj7 G
  const BELLS = [72, 74, 76, 79, 81, 84];
  const VOL = .055, BAR = 9;
  const hz = n => 440 * 2 ** ((n - 69) / 12);
  let out = null, timer = 0, step = 0, playing = false;

  function graph() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    out = actx.createGain(); out.gain.value = 0;
    const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = .3;
    // Простое «эхо зала»
    const dl = actx.createDelay(1), fb = actx.createGain(), wet = actx.createGain();
    dl.delayTime.value = .38; fb.gain.value = .42; wet.gain.value = .35;
    out.connect(lp); lp.connect(actx.destination);
    lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(actx.destination);
  }
  function pad(n, t, dur) {
    for (const [type, det, g] of [["sine", 0, .5], ["triangle", 7, .18], ["sine", -6, .3]]) {
      const o = actx.createOscillator(), a = actx.createGain();
      o.type = type; o.frequency.value = hz(n); o.detune.value = det;
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(g / 4, t + dur * .35);
      a.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(a).connect(out); o.start(t); o.stop(t + dur + .1);
    }
  }
  function bell(n, t) {
    const o = actx.createOscillator(), a = actx.createGain();
    o.type = "sine"; o.frequency.value = hz(n);
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(.11, t + .02);
    a.gain.exponentialRampToValueAtTime(.0001, t + 3.5);
    o.connect(a).connect(out); o.start(t); o.stop(t + 3.6);
  }
  function tick() {
    const t = actx.currentTime + .05;
    CHORDS[step % CHORDS.length].forEach(n => pad(n, t, BAR * 1.5));
    for (let i = 0; i < 3; i++) if (Math.random() < .55) bell(BELLS[Math.floor(Math.random() * BELLS.length)], t + 1 + Math.random() * (BAR - 2));
    step++;
  }
  return {
    start() {
      if (playing) { actx.state !== "running" && actx.resume?.(); return; }
      if (!settings.music || document.hidden) return;
      try {
        if (!out) graph();
        actx.resume?.();
        playing = true;
        out.gain.cancelScheduledValues(actx.currentTime);
        out.gain.setTargetAtTime(VOL, actx.currentTime, 1.2);
        tick(); timer = setInterval(tick, BAR * 1000);
      } catch {}
    },
    stop(fast) {
      if (!playing) return;
      playing = false; clearInterval(timer);
      try { out.gain.cancelScheduledValues(actx.currentTime); out.gain.setTargetAtTime(0, actx.currentTime, fast ? .08 : .5); } catch {}
    },
  };
})();
// iPhone разрешает звук только после первого касания
["pointerdown", "keydown"].forEach(ev => addEventListener(ev, () => music.start(), { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => (document.hidden ? music.stop(true) : music.start()));
addEventListener("pagehide", () => music.stop(true));

function openExternal(u) {
  if (bridge) { post({ type: "open", url: u }); return; }
  try { window.open(u, "_blank", "noopener") || (location.href = u); } catch { location.href = u; }
}

/* ================= Учёт сессий ================= */

// Когда возвращаемся из игры, засчитываем время (не больше 3 часов за раз)
function closeSession() {
  const s = store.get("ap:session", null);
  if (!s) return;
  store.del("ap:session");
  const ms = Math.min(Math.max(Date.now() - s.t, 0), 3 * 3600e3);
  stats.time[s.id] = (stats.time[s.id] || 0) + ms;
  store.set("ap:stats", stats);
}
function openSession(g) {
  const now = new Date();
  stats.plays[g.id] = (stats.plays[g.id] || 0) + 1;
  if (!stats.days.includes(dayKey(now))) stats.days.push(dayKey(now));
  stats.days = stats.days.slice(-400);
  if (now.getHours() < 4) stats.night = true;
  if (now.getHours() >= 4 && now.getHours() < 7) stats.early = true;
  store.set("ap:stats", stats);
  store.set("ap:session", { id: g.id, t: Date.now() });
  recent = [g.id, ...recent.filter(x => x !== g.id)].slice(0, games.length);
  store.set("ap:recent", recent);
}

/* ================= Шапка ================= */

function renderHeader() {
  const h = new Date().getHours();
  document.getElementById("greet").textContent =
    h < 5 ? "Доброй ночи!" : h < 12 ? "Доброе утро!" : h < 18 ? "Добрый день!" : "Добрый вечер!";
  const s = streak();
  const chip = document.getElementById("streakChip");
  chip.innerHTML = `<span class="fire">🔥</span>${s}`;
  chip.classList.toggle("cold", s === 0);
  chip.title = s ? `Серия: ${s} ${plural(s, "день", "дня", "дней")} подряд` : "Сыграй сегодня, чтобы начать серию";
  chip.onclick = () => {
    haptic();
    toast("🔥", s ? `${s} ${plural(s, "день", "дня", "дней")} подряд!` : "Серии пока нет", s ? "Заходи завтра, чтобы не прервать серию" : "Сыграй сегодня, чтобы начать серию");
  };
}

/* ================= Вкладка «Игры» ================= */

function gameOfDay() {
  const d = new Date();
  const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return games[n % games.length];
}

function renderHero() {
  const last = byId[recent[0]];
  const g = last || gameOfDay();
  const hero = document.getElementById("hero");
  hero.style.setProperty("--accent", g.accent);
  const t = stats.time[g.id];
  hero.innerHTML = `
    <img class="backdrop" src="${img(g)}" alt="">
    <div class="frame">
      <img src="${img(g)}" alt="">
      <span class="pill"><span class="dot"></span>${last ? "Ты играл недавно" : "Игра дня"}</span>
    </div>
    <div class="body">
      <div class="text"><h2></h2><p></p>${last && t ? `<div class="meta">Ты уже провёл здесь ${fmtTime(t)}</div>` : ""}</div>
      <span class="play">${PLAY}${last ? "Продолжить" : "Играть"}</span>
    </div>`;
  hero.querySelector("h2").textContent = g.title;
  hero.querySelector("p").textContent = g.text;
  hero.onclick = () => launch(g, hero.querySelector(".frame img"));
}

let filter = store.get("ap:filter", "all");
function renderChips() {
  const tags = [...new Set(games.map(g => g.tag))];
  const items = [["all", "Все"], ["fav", "♥ Избранное"], ["recent", "Недавние"], ...tags.map(t => [t, t])];
  if (!items.some(([k]) => k === filter)) filter = "all";
  const box = document.getElementById("chips");
  box.innerHTML = "";
  for (const [k, label] of items) {
    const c = document.createElement("button");
    c.type = "button"; c.className = "chip" + (k === filter ? " on" : ""); c.textContent = label;
    c.onclick = () => {
      if (filter === k) return;
      filter = k; store.set("ap:filter", k);
      haptic(); sound("tab");
      box.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === c));
      c.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      renderGrid();
    };
    box.appendChild(c);
  }
}

function visibleGames() {
  if (filter === "all") return games;
  if (filter === "fav") return games.filter(g => favs.has(g.id));
  if (filter === "recent") return recent.map(id => byId[id]).filter(Boolean);
  return games.filter(g => g.tag === filter);
}

let io;
function renderGrid() {
  const list = visibleGames();
  const grid = document.getElementById("grid");
  const titles = { all: "Все игры", fav: "Избранное", recent: "Недавние" };
  document.getElementById("listTitle").textContent = titles[filter] || filter;
  document.getElementById("count").textContent = `${list.length} ${plural(list.length, "игра", "игры", "игр")}`;
  const empty = document.getElementById("empty");
  empty.hidden = list.length > 0;
  empty.querySelector("p").textContent = filter === "fav"
    ? "Нажми на сердечко у игры, и она появится здесь."
    : "Здесь появятся игры, в которые ты играл.";

  grid.innerHTML = "";
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -5% 0px" });

  list.forEach((g, i) => {
    const c = document.createElement("div");
    c.className = "card"; c.tabIndex = 0; c.setAttribute("role", "button");
    c.style.setProperty("--i", i);
    c.style.setProperty("--accent", g.accent);
    const t = stats.time[g.id], p = stats.plays[g.id];
    c.innerHTML = `
      <div class="cover-wrap">
        <img src="${img(g)}" alt="" loading="lazy">
        <span class="badge"></span>
        <button class="fav${favs.has(g.id) ? " on" : ""}" type="button" aria-label="В избранное">${HEART}</button>
      </div>
      <div class="info">
        <div class="text"><h4></h4><p></p>
          ${p ? `<div class="meta"><span>⏱ <b>${fmtTime(t || 0)}</b></span><span>▶ <b>${p}</b> ${plural(p, "запуск", "запуска", "запусков")}</span></div>` : ""}
        </div>
        <span class="go">${PLAY}</span>
      </div>`;
    c.querySelector("h4").textContent = g.title;
    c.querySelector("p").textContent = g.text;
    c.querySelector(".badge").textContent = recent[0] === g.id ? "Недавно" : g.tag;
    c.querySelector(".fav").onclick = e => { e.stopPropagation(); toggleFav(g, e.currentTarget, c); };
    c.onclick = () => launch(g, c.querySelector(".cover-wrap img"));
    grid.appendChild(c);
    io.observe(c);
  });
}

function toggleFav(g, btn, card) {
  const on = !favs.has(g.id);
  on ? favs.add(g.id) : favs.delete(g.id);
  store.set("ap:favs", [...favs]);
  btn.classList.toggle("on", on);
  btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
  haptic(on ? [10, 40, 15] : 8);
  sound(on ? "fav" : "tap");
  if (on) burst(btn);
  if (!on && filter === "fav") {
    card.classList.add("out");
    setTimeout(renderGrid, 300);
  }
  checkAwards();
}

/* ================= Запуск игры ================= */

let busy = false;
function launch(g, coverImg) {
  if (busy) return; busy = true;
  haptic(12); sound("tap");
  music.stop();
  openSession(g);

  const reduce = !settings.motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!coverImg || reduce) { location.href = url(g); return; }
  const r = coverImg.getBoundingClientRect();
  const z = document.createElement("div");
  z.className = "zoom";
  z.style.setProperty("--accent", g.accent);
  Object.assign(z.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: "24px" });
  z.innerHTML = `<img src="${coverImg.src}" alt=""><div class="veil"></div><div class="spinner"></div>`;
  document.body.appendChild(z);
  document.body.classList.add("leaving");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    z.classList.add("full");
    Object.assign(z.style, { left: 0, top: 0, width: "100vw", height: "100vh", borderRadius: 0 });
  }));
  setTimeout(() => { location.href = url(g); }, 560);
}

/* ================= Вкладка «Награды» ================= */

function renderAwards() {
  const got = awards.filter(isGot).length;
  document.getElementById("ringNum").textContent = got;
  document.querySelector(".ring-text span").textContent = `из ${awards.length}`;
  document.getElementById("awardsCount").textContent = `${got} из ${awards.length}`;
  const fg = document.getElementById("ringFg");
  fg.style.strokeDashoffset = 327;
  requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 327 * (1 - got / awards.length); }));

  const s = streak();
  document.getElementById("stats").innerHTML = [
    [fmtTime(totalTime()), "в играх"],
    [totalPlays(), plural(totalPlays(), "запуск", "запуска", "запусков")],
    [`${s} 🔥`, "серия дней"],
    [bestStreak(), "лучшая серия"],
  ].map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join("");

  const box = document.getElementById("awards");
  box.innerHTML = "";
  [...awards].sort((a, b) => isGot(b) - isGot(a)).forEach((a, i) => {
    const v = Math.min(a.val(), a.goal);
    const el = document.createElement("div");
    el.className = "award" + (isGot(a) ? " got" : "");
    el.style.setProperty("--i", i);
    el.innerHTML = `<div class="medal">${a.icon}</div>
      <div class="t"><b>${a.title}</b><small>${a.text}${a.goal > 1 ? ` · ${v}/${a.goal}` : ""}</small>
      <div class="prog"><i></i></div></div>`;
    box.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.querySelector(".prog i").style.width = `${(v / a.goal) * 100}%`; }));
  });

  const max = Math.max(1, ...games.map(g => stats.time[g.id] || 0));
  const bars = document.getElementById("bars");
  bars.innerHTML = "";
  [...games].sort((a, b) => (stats.time[b.id] || 0) - (stats.time[a.id] || 0)).forEach(g => {
    const t = stats.time[g.id] || 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.style.setProperty("--accent", g.accent);
    row.innerHTML = `<span class="name"></span><span class="track"><i></i></span><span class="val">${fmtTime(t)}</span>`;
    row.querySelector(".name").textContent = g.title;
    bars.appendChild(row);
    requestAnimationFrame(() => requestAnimationFrame(() => { row.querySelector("i").style.width = `${(t / max) * 100}%`; }));
  });

  store.del("ap:awardsNew");
  document.getElementById("awardsDot").hidden = true;
}

/* ================= Вкладка «Ещё» ================= */

function applySettings() {
  document.body.classList.toggle("calm", !settings.motion);
  document.querySelectorAll("[data-setting]").forEach(el => { el.checked = !!settings[el.dataset.setting]; });
}

function bindSettings() {
  document.querySelectorAll("[data-setting]").forEach(el => {
    el.onchange = () => {
      settings[el.dataset.setting] = el.checked;
      store.set("ap:settings", settings);
      applySettings();
      if (el.dataset.setting === "music") settings.music ? music.start() : music.stop();
      haptic(); sound("tap");
    };
  });
  document.querySelectorAll("[data-open]").forEach(el => { el.onclick = () => { haptic(); openExternal(el.dataset.open); }; });
  document.getElementById("shareBtn").onclick = () => {
    haptic();
    const text = "Залетай в Andreos Play: все игры Andreos в одном приложении 🎮";
    if (bridge) post({ type: "share", text, url: SITE_URL });
    else if (navigator.share) navigator.share({ title: "Andreos Play", text, url: SITE_URL }).catch(() => {});
    else navigator.clipboard?.writeText(`${text}\n${SITE_URL}`)
      .then(() => toast("📋", "Ссылка скопирована", "Отправь её другу"), () => {});
  };
  document.getElementById("updateBtn").onclick = () => { haptic(); checkUpdate(true); };
  document.getElementById("installBtn").onclick = () => {
    haptic();
    if (standalone) toast("✅", "Уже установлено", "Andreos Play на экране «Домой»");
    else showInstall();
  };
  document.getElementById("installLbl").textContent = standalone ? "Уже установлено ✓" : "Иконка как у обычного приложения";
  document.getElementById("resetBtn").onclick = () => {
    if (!confirm("Сбросить время, серии и достижения? Прогресс внутри игр останется.")) return;
    ["ap:stats", "ap:awards", "ap:recent", "ap:session", "ap:awardsNew"].forEach(store.del);
    stats = loadStats(); recent = [];
    haptic(20);
    renderAll();
    toast("🧹", "Статистика сброшена", "Начинаем с чистого листа");
  };
  if (native) document.getElementById("installBtn").hidden = true;
  document.getElementById("versionLbl").textContent = native ? `Версия ${native.version} (сборка ${native.build})` : `Версия ${VERSION.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)$/, "$3.$2.$1 $4:$5")}`;
}

/* ================= Обновления и офлайн ================= */

// Обновления приходят сами: service worker скачивает новую версию в фоне,
// а мы показываем баннер «Обновить».
let reg = null;
async function setupSW() {
  if (native) { offlineState({ done: 1, total: 1 }); return; } // в приложении всё уже внутри
  if (!("serviceWorker" in navigator)) { offlineState({ error: true }); return; }
  try {
    reg = await navigator.serviceWorker.register("sw.js");
    navigator.serviceWorker.addEventListener("message", e => { if (e.data?.type === "offline") offlineState(e.data); });
    const watch = w => w && w.addEventListener("statechange", () => {
      if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate();
    });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
    await navigator.serviceWorker.ready;
    (navigator.serviceWorker.controller || reg.active)?.postMessage("warm");
    navigator.storage?.persist?.().catch(() => {});
  } catch { offlineState({ error: true }); }
}
let reloading = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (reloading) return; reloading = true; location.reload();
});

// Приложение из .ipa: сравниваем номер сборки с последним релизом на GitHub
async function checkNativeUpdate(manual) {
  if (!manual && Date.now() - store.get("ap:updChecked", 0) < 6 * 3600e3) return;
  store.set("ap:updChecked", Date.now());
  try {
    const r = await fetch("https://api.github.com/repos/AASolo/andreos-games-ios/releases/latest", { cache: "no-store" });
    if (!r.ok) throw 0;
    const m = /сборка\s+(\d+)/i.exec((await r.json()).name || "");
    const latest = m ? +m[1] : 0;
    if (latest > native.build) {
      const b = document.getElementById("updateBanner");
      b.hidden = false;
      b.innerHTML = `<span style="font-size:26px">🚀</span><div class="txt"><b>Вышло обновление</b><small>Сборка ${latest} уже готова</small></div><button type="button">Скачать</button>`;
      b.querySelector("button").onclick = () => { haptic(); openExternal(RELEASE_PAGE); };
    } else if (manual) toast("✅", "У тебя последняя версия", `Сборка ${native.build}`);
  } catch {
    if (manual) toast("📡", "Не получилось проверить", "Нужен интернет");
  }
}

async function checkUpdate(manual) {
  if (native) return checkNativeUpdate(manual);
  if (!reg) { if (manual) toast("📡", "Не получилось проверить", "Открой приложение с интернетом"); return; }
  if (!manual) {
    const last = store.get("ap:updChecked", 0);
    if (Date.now() - last < 3600e3) return;
  }
  store.set("ap:updChecked", Date.now());
  try {
    await reg.update();
    if (reg.waiting || reg.installing) { if (manual) toast("🚀", "Нашлось обновление", "Скачиваем…"); }
    else if (manual) toast("✅", "У тебя последняя версия", document.getElementById("versionLbl").textContent);
  } catch {
    if (manual) toast("📡", "Не получилось проверить", "Нужен интернет");
  }
}
function showUpdate() {
  const b = document.getElementById("updateBanner");
  b.hidden = false;
  b.innerHTML = `<span style="font-size:26px">🚀</span><div class="txt"><b>Вышло обновление</b><small>Новая версия уже скачана</small></div><button type="button">Обновить</button>`;
  b.querySelector("button").onclick = () => {
    haptic();
    const w = reg?.waiting;
    if (w) w.postMessage("skipWaiting"); else location.reload();
  };
}

function offlineState(d) {
  const lbl = document.getElementById("offlineLbl"), ring = document.getElementById("offlineRing");
  if (d.error) { lbl.textContent = "Докачается, когда будет интернет"; return; }
  const p = d.total ? Math.round(d.done / d.total * 100) : 100;
  ring.style.setProperty("--p", p);
  const ok = p >= 100;
  ring.classList.toggle("ok", ok);
  lbl.textContent = ok ? "Все игры работают без сети" : `Скачиваем Python для HackQuest: ${p}%`;
  if (ok && !store.get("ap:offlineToast", false) && navigator.serviceWorker.controller) {
    store.set("ap:offlineToast", true);
    toast("✈️", "Готово для офлайна", "Теперь все игры работают без интернета");
  }
}

/* ================= Установка на экран «Домой» ================= */

function showInstall() {
  const sh = document.getElementById("installSheet"), back = document.getElementById("sheetBack");
  sh.hidden = back.hidden = false;
  sh.classList.remove("bye");
  const close = () => {
    haptic(); sh.classList.add("bye");
    store.set("ap:installSeen", Date.now());
    setTimeout(() => { sh.hidden = back.hidden = true; }, 300);
  };
  document.getElementById("sheetOk").onclick = close;
  back.onclick = close;
}
function maybeInstall() {
  if (standalone) return;
  const seen = store.get("ap:installSeen", 0);
  if (Date.now() - seen < 3 * 864e5) return;
  setTimeout(showInstall, 1400);
}

/* ================= Нижнее меню ================= */

let tab = "games";
function go(name, initial) {
  if (name === tab && !initial) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  tab = name;
  document.querySelectorAll(".tab").forEach(s => { s.hidden = s.dataset.tab !== name; });
  const btns = [...document.querySelectorAll(".tabbar button")];
  btns.forEach(b => b.classList.toggle("on", b.dataset.go === name));
  moveGlow();
  if (!initial) { haptic(8); sound("tab"); window.scrollTo({ top: 0 }); }
  if (name === "awards") renderAwards();
}
function moveGlow() {
  const b = document.querySelector(".tabbar button.on");
  const glow = document.getElementById("tabGlow");
  if (!b) return;
  glow.style.width = b.offsetWidth + "px";
  glow.style.transform = `translateX(${b.offsetLeft - 6}px)`;
}
document.querySelectorAll(".tabbar button").forEach(b => { b.onclick = () => go(b.dataset.go); });
addEventListener("resize", moveGlow);

/* ================= Тосты и конфетти ================= */

function toast(icon, title, sub) {
  const box = document.getElementById("toasts");
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="big">${icon}</span><div><b></b><small></small></div>`;
  t.querySelector("b").textContent = title;
  t.querySelector("small").textContent = sub || "";
  box.appendChild(t);
  const bye = () => { t.classList.add("bye"); setTimeout(() => t.remove(), 400); };
  t.onclick = bye;
  setTimeout(bye, 3200);
}

const cv = document.getElementById("confetti");
const cx = cv.getContext("2d");
let parts = [], raf = 0;
function confettiLoop() {
  cx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.vy += .25 * devicePixelRatio; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
    cx.globalAlpha = Math.min(1, p.life / 30);
    cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(confettiLoop) : 0;
}
function spawn(x, y, n, spread, power) {
  if (!settings.motion) return;
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  const colors = ["#8b5cff", "#ff4f9a", "#ffc42e", "#35d0ba", "#ffffff", "#2bff7a"];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - .5) * spread;
    const v = (Math.random() * .6 + .4) * power * devicePixelRatio;
    parts.push({ x: x * devicePixelRatio, y: y * devicePixelRatio, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: (Math.random() * 6 + 6) * devicePixelRatio,
      c: colors[i % colors.length], life: 90 + Math.random() * 40 });
  }
  if (!raf) raf = requestAnimationFrame(confettiLoop);
}
function confetti() { spawn(innerWidth / 2, innerHeight * .35, 140, Math.PI * 1.6, 16); }
function burst(el) { const r = el.getBoundingClientRect(); spawn(r.left + r.width / 2, r.top + r.height / 2, 24, Math.PI * 2, 7); }

/* ================= Старт ================= */

function renderAll() {
  renderHeader();
  renderHero();
  renderChips();
  renderGrid();
  if (tab === "awards") renderAwards();
  document.getElementById("awardsDot").hidden = !store.get("ap:awardsNew", false);
}

function hideSplash() {
  const sp = document.getElementById("splash");
  // Заставка один раз за запуск
  let first = true;
  try { first = !sessionStorage.getItem("ap:splash"); sessionStorage.setItem("ap:splash", "1"); } catch {}
  if (!first || !settings.motion) { sp.remove(); return; }
  setTimeout(() => { sp.classList.add("gone"); setTimeout(() => sp.remove(), 500); }, 900);
}

function boot() {
  hideSplash();
  closeSession();
  applySettings();
  bindSettings();
  renderAll();
  go("games", true);
  requestAnimationFrame(moveGlow);
  checkAwards();
  music.start();
  setupSW().then(() => setTimeout(() => checkUpdate(false), 1500));
  maybeInstall();

  // Запуск с ярлыка на иконке приложения: ?play=<id>
  const want = new URLSearchParams(location.search).get("play");
  if (want && byId[want]) {
    history.replaceState(null, "", location.pathname);
    openSession(byId[want]);
    location.replace(url(byId[want]));
  }
}

// Вернулись «Назад» из игры, а страница взялась из кэша
addEventListener("pageshow", e => {
  if (!e.persisted) return;
  busy = false;
  music.start();
  document.querySelectorAll(".zoom").forEach(z => z.remove());
  document.body.classList.remove("leaving");
  stats = loadStats(); recent = store.get("ap:recent", []);
  closeSession(); renderAll(); checkAwards();
});

boot();

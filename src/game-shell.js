// Кнопка «Домой» поверх игры: на iPhone в полноэкранном приложении нет кнопки «Назад».
// Её можно перетащить в любой угол, место запоминается.
(() => {
  const KEY = "ap:homePos";
  const css = `
  #ap-home{position:fixed;z-index:2147483647;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);
    background:rgba(20,16,36,.55);-webkit-backdrop-filter:blur(14px) saturate(1.6);backdrop-filter:blur(14px) saturate(1.6);
    box-shadow:0 6px 20px rgba(0,0,0,.35);display:grid;place-items:center;padding:0;touch-action:none;cursor:pointer;
    opacity:.75;transition:opacity .2s,transform .25s cubic-bezier(.34,1.56,.64,1),left .3s cubic-bezier(.16,1,.3,1),top .3s cubic-bezier(.16,1,.3,1);
    animation:ap-in .5s cubic-bezier(.34,1.56,.64,1) both;-webkit-tap-highlight-color:transparent}
  #ap-home.drag{transition:opacity .2s,transform .2s;opacity:1;transform:scale(1.12)}
  #ap-home:active{transform:scale(.9);opacity:1}
  #ap-home svg{width:22px;height:22px;fill:#fff}
  @keyframes ap-in{from{transform:scale(0);opacity:0}}
  #ap-leave{position:fixed;inset:0;z-index:2147483646;background:#0b0914;opacity:0;pointer-events:none;transition:opacity .25s}
  #ap-leave.on{opacity:1}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  const b = document.createElement("button");
  b.id = "ap-home"; b.type = "button"; b.setAttribute("aria-label", "В меню Andreos Play");
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3.2 2.8 11a1 1 0 0 0 1.3 1.5l.9-.8V19a2 2 0 0 0 2 2h3.5v-5.5h3V21H17a2 2 0 0 0 2-2v-7.3l.9.8a1 1 0 0 0 1.3-1.5z"/></svg>';
  const veil = document.createElement("div"); veil.id = "ap-leave";
  document.body.append(veil, b);

  // Безопасные отступы (чёлка, Dynamic Island, полоска «Домой»)
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const inset = () => { const s = getComputedStyle(probe); return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 }; };

  let pos;
  try { pos = JSON.parse(localStorage.getItem(KEY)); } catch {}
  pos = pos || { side: "left", y: 0 }; // y — доля высоты экрана, 0 = вверху
  const M = 10, S = 44;
  function place() {
    const i = inset();
    const minY = i.t + M, maxY = innerHeight - i.b - M - S;
    b.style.left = (pos.side === "left" ? i.l + M : innerWidth - i.r - M - S) + "px";
    b.style.top = Math.min(maxY, Math.max(minY, minY + pos.y * (maxY - minY))) + "px";
  }
  place();
  addEventListener("resize", place);
  addEventListener("orientationchange", () => setTimeout(place, 300));

  let start = null, moved = false;
  b.addEventListener("pointerdown", e => {
    start = { x: e.clientX, y: e.clientY, l: b.offsetLeft, t: b.offsetTop }; moved = false;
    b.setPointerCapture(e.pointerId);
  });
  b.addEventListener("pointermove", e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 8) return;
    moved = true; b.classList.add("drag");
    b.style.left = start.l + dx + "px"; b.style.top = start.t + dy + "px";
  });
  b.addEventListener("pointerup", e => {
    if (!start) return;
    start = null; b.classList.remove("drag");
    if (moved) {
      const i = inset();
      const minY = i.t + M, maxY = innerHeight - i.b - M - S;
      pos = { side: e.clientX < innerWidth / 2 ? "left" : "right", y: Math.min(1, Math.max(0, (b.offsetTop - minY) / Math.max(1, maxY - minY))) };
      try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch {}
      place();
      return;
    }
    veil.classList.add("on");
    setTimeout(() => { location.href = "../../index.html"; }, 200);
  });
  b.addEventListener("pointercancel", () => { start = null; b.classList.remove("drag"); place(); });

  // Вернулись «назад» в игру из кэша страниц
  addEventListener("pageshow", e => { if (e.persisted) veil.classList.remove("on"); });
})();

// Офлайн-режим Andreos Play: все игры и меню хранятся в кэше телефона.
importScripts("assets.js");

const VERSION = "__VERSION__";
const CORE = `ap-core-${VERSION}`;
const HEAVY = `ap-heavy-${VERSION}`;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(self.ASSETS.core.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = [CORE, HEAVY];
    for (const k of await caches.keys()) if (k.startsWith("ap-") && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function broadcast(msg) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg);
}

// Докачать тяжёлые файлы (Python для HackQuest) с прогрессом
let warming = null;
function warm() {
  warming ??= (async () => {
    const cache = await caches.open(HEAVY);
    const list = self.ASSETS.heavy;
    let done = 0;
    for (const u of list) {
      if (!(await cache.match(u))) {
        const r = await fetch(u, { cache: "reload" });
        if (!r.ok) throw new Error(u);
        await cache.put(u, r);
      }
      done++;
      broadcast({ type: "offline", done, total: list.length });
    }
    if (!list.length) broadcast({ type: "offline", done: 0, total: 0 });
  })().catch(() => { warming = null; broadcast({ type: "offline", error: true }); });
  return warming;
}

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "warm") e.waitUntil(warm());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    // Сначала кэш (без учёта ?параметров), потом сеть; удачные ответы докладываем в кэш
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && r.type === "basic") {
        const copy = r.clone();
        caches.open(url.pathname.includes("/pyodide/") ? HEAVY : CORE).then(c => c.put(req, copy));
      }
      return r;
    } catch (err) {
      if (req.mode === "navigate") return (await caches.match("./index.html")) || Response.error();
      throw err;
    }
  })());
});

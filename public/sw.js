<escape>/* MÜZİK MERKEZİ PRO - Service Worker */
const CACHE = "muzik-merkezi-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
event.waitUntil(
caches.open(CACHE).then((cache) => cache.addAll(SHELL))
);
self.skipWaiting();
});

self.addEventListener("activate", (event) => {
event.waitUntil(
caches.keys().then((keys) =>
Promise.all(
keys
.filter((key) => key !== CACHE)
.map((key) => caches.delete(key))
)
)
);
self.clients.claim();
});

self.addEventListener("fetch", (event) => {
const request = event.request;

if (request.method !== "GET") return;

const url = new URL(request.url);

if (url.origin !== self.location.origin) return;
if (url.pathname.startsWith("/api/")) return;

if (/.(mp3|m4a|aac|ogg|wav)(?|$)/i.test(url.href)) {
return;
}

event.respondWith(
fetch(request)
.then((response) => {
if (response.ok && request.mode === "navigate") {
const copy = response.clone();

      caches.open(CACHE).then((cache) => {
        cache.put("/", copy);
      });
    }

    return response;
  })
  .catch(async () => {
    return (
      (await caches.match(request)) ||
      (await caches.match("/"))
    );
  })

);
});</escape>

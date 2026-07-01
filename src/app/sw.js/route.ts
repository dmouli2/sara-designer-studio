// Served as a Route Handler (not a static /public file) so the cache version
// can be stamped automatically from the deployment commit at build time —
// every deploy gets a distinct cache name with no manual version bump.
export const dynamic = "force-static";

function buildSource(version: string) {
  return `
const VERSION = "${version}";
const STATIC_CACHE = "sara-studio-static-${version}";
const RUNTIME_CACHE = "sara-studio-runtime-${version}";
const SHELL = ["/", "/login", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Next.js build assets are content-hashed and immutable: cache-first is safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // Page navigations: always prefer the network so a new deploy shows up
  // immediately. Cache is only a fallback for offline use.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Same-origin static assets (manifest, icons): stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
`;
}

export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? String(Date.now());
  return new Response(buildSource(version), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}

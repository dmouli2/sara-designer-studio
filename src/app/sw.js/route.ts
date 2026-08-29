// Served as a Route Handler (not a static /public file) so the cache version
// can be stamped automatically from the deployment commit at build time —
// every deploy gets a distinct cache name with no manual version bump.
export const dynamic = "force-static";

function buildSource(version: string) {
  return `
const VERSION = "${version}";
const STATIC_CACHE = "sara-studio-static-${version}";
const RUNTIME_CACHE = "sara-studio-runtime-${version}";
const SHELL = ["/login", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/logo.png", "/logo-white.png"];

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

// Tells open windows that a fresh copy of a page they may have been served
// from cache has just landed, so they can re-fetch their data.
async function notifyNavUpdated(url) {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) client.postMessage({ type: "NAV_UPDATED", url });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js RSC/data fetches (router refreshes, prefetches) must always hit
  // the network — caching them would serve stale data forever.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

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

  if (request.mode === "navigate") {
    // "/" and "/login" are session-dependent redirect points: the proxy sends
    // a logged-in user elsewhere, so serving them cache-first would strand
    // users on the login screen. They're fast (static + edge-cached) —
    // network-first with an offline fallback.
    if (url.pathname === "/" || url.pathname === "/login") {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok && !res.redirected) {
              const clone = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return res;
          })
          .catch(() => caches.match(request).then((cached) => cached || caches.match("/login")))
      );
      return;
    }

    // App pages: paint the cached copy instantly, revalidate in the
    // background, and tell the page when fresh content has landed so it can
    // refresh its data. First visit (nothing cached) falls through to the
    // network with an offline fallback to the login shell.
    const cacheReady = caches.open(RUNTIME_CACHE);

    // Started here, and handed to waitUntil BEFORE respondWith settles.
    // Without that, serving the cached copy resolves the fetch event and the
    // browser is free to kill this worker mid-revalidation — the cache.put
    // never lands, and every later visit is served the same stale page
    // forever. That is exactly what happened: an order handed over on one
    // device kept reading as untouched on the next visit.
    const revalidate = cacheReady.then((cache) =>
      fetch(request).then(async (res) => {
        // A redirected response means the session no longer allows this page
        // — never cache it under this URL, but still notify so the open page
        // re-checks and follows the redirect.
        if (res.ok && !res.redirected) await cache.put(request, res.clone());
        return res;
      })
    );
    event.waitUntil(revalidate.catch(() => {}));

    event.respondWith(
      cacheReady
        .then((cache) => cache.match(request))
        .then((cached) => {
          if (!cached) return revalidate.catch(() => caches.match("/login"));
          // Tell the page once the fresh copy has actually landed.
          revalidate
            .then((res) => {
              if (res.ok) notifyNavUpdated(request.url);
            })
            .catch(() => {});
          return cached;
        })
    );
    return;
  }

  // Static assets (manifest, icons, images, fonts): stale-while-revalidate.
  if (/\\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(url.pathname) || url.pathname === "/manifest.json") {
    const assetCache = caches.open(RUNTIME_CACHE);
    const assetNetwork = assetCache.then((cache) =>
      fetch(request).then(async (res) => {
        if (res.ok) await cache.put(request, res.clone());
        return res;
      })
    );
    // Same reason as the navigation branch above: the put has to be allowed
    // to finish after the cached copy has already been served.
    event.waitUntil(assetNetwork.catch(() => {}));

    event.respondWith(
      assetCache
        .then((cache) => cache.match(request))
        .then((cached) => cached || assetNetwork)
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

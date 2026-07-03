"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const UPDATE_CHECK_INTERVAL_MS = 60_000;

export default function ServiceWorkerRegister() {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const sw = navigator.serviceWorker;
    let cancelled = false;
    let reloaded = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let onVisibilityChange: (() => void) | undefined;

    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      setUpdating(true);
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    // The worker serves app pages cache-first for an instant paint, then
    // posts NAV_UPDATED once the fresh copy has landed — re-fetch the data
    // for the page the user is actually looking at.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "NAV_UPDATED" && event.data.url === window.location.href) {
        router.refresh();
      }
    };
    sw.addEventListener("message", onMessage);

    sw.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        const checkForUpdate = () => registration.update().catch(() => {});
        checkForUpdate();

        interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
        onVisibilityChange = () => {
          if (document.visibilityState === "visible") checkForUpdate();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      sw.removeEventListener("controllerchange", onControllerChange);
      sw.removeEventListener("message", onMessage);
      if (interval) clearInterval(interval);
      if (onVisibilityChange) document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  if (!updating) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#0F0F0F] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
      Updating to the latest version…
    </div>
  );
}

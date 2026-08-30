"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return; // already installed
    if (sessionStorage.getItem("install-dismissed")) return;

    if (isIOS()) {
      // navigator.userAgent is unknowable during SSR, so this can't be the
      // useState initializer without risking a hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowIOS(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem("install-dismissed", "1");
    setDismissed(true);
    setShowIOS(false);
    setPrompt(null);
  }

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  }

  if (dismissed) return null;

  // Android — custom install button
  if (prompt) {
    return (
      <div className="mx-5 mb-4 bg-header rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-gold/20 rounded-xl flex items-center justify-center shrink-0">
          <Download size={16} color="#C9A84C" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Install App</p>
          <p className="text-fg-on-dark text-xs mt-0.5">Add to home screen for quick access</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-gold text-fg text-xs font-bold px-3 py-1.5 rounded-xl shrink-0"
        >
          Install
        </button>
        <button onClick={dismiss} className="text-fg-3 shrink-0">
          <X size={16} />
        </button>
      </div>
    );
  }

  // iOS — manual instructions
  if (showIOS) {
    return (
      <div className="mx-5 mb-4 bg-header rounded-2xl p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-white text-sm font-semibold">Install on iPhone</p>
          <button onClick={dismiss} className="text-fg-3">
            <X size={16} />
          </button>
        </div>
        <p className="text-fg-on-dark text-xs leading-relaxed">
          Tap the <span className="text-gold font-semibold">Share</span> button{" "}
          <span className="text-white">⎋</span> at the bottom of Safari, then tap{" "}
          <span className="text-gold font-semibold">&quot;Add to Home Screen&quot;</span>
        </p>
      </div>
    );
  }

  return null;
}

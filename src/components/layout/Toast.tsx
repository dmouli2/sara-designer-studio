"use client";

import { useEffect } from "react";

const AUTO_DISMISS_MS = 4000;

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

// Error feedback for failed Server Action calls — shop Wi-Fi is flaky, and a
// silently swallowed failure looks identical to success. Auto-dismisses, or
// tap to dismiss immediately.
export default function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px] bg-danger text-white text-[13px] font-medium px-4 py-3 rounded-xl shadow-lg text-center cursor-pointer"
    >
      {message}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Scissors } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default function LogoutPage() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    logoutAction();
  }, []);

  return (
    <div className="screen items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center text-accent-ink mx-auto mb-3">
          <Scissors size={20} aria-hidden="true" />
        </div>
        <p className="text-sm text-fg-2">Signing out…</p>
      </div>
    </div>
  );
}

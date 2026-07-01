"use client";

import { useEffect, useRef } from "react";
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
        <div className="w-12 h-12 rounded-full bg-[#FBF6E8] border border-[#EDD98A] flex items-center justify-center text-xl mx-auto mb-3">
          ✂️
        </div>
        <p className="text-sm text-[#9A9A9A]">Signing out…</p>
      </div>
    </div>
  );
}

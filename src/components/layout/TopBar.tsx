"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  // Use instead of `onBack` when rendering TopBar from a Server Component,
  // where a function prop can't cross the server/client boundary.
  backHref?: string;
  right?: React.ReactNode;
}

export default function TopBar({ title, subtitle, onBack, backHref, right }: TopBarProps) {
  return (
    <div className="bg-header text-white px-4 pt-13 pb-6 sticky top-0 z-40 shadow-[0_4px_20px_rgba(15,15,15,0.15)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 active:scale-95 transition-all"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          {!onBack && backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 active:scale-95 transition-all"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          )}
          <div>
            <h1 className="text-[17px] font-semibold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-[13px] text-gold mt-0.5 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div>{right}</div>}
      </div>
    </div>
  );
}

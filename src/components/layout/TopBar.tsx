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
    <div className="bg-[#0F0F0F] text-white px-4 pt-12 pb-5 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {!onBack && backHref && (
            <Link
              href={backHref}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-all"
            >
              <ArrowLeft size={16} />
            </Link>
          )}
          <div>
            <h1 className="text-base font-semibold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-[12px] text-[#C9A84C] mt-0.5 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div>{right}</div>}
      </div>
    </div>
  );
}

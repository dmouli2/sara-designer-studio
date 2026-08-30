"use client";

import { cn } from "@/lib/utils";

interface NavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface BottomNavProps {
  tabs: NavTab[];
  active: string;
  onChange: (id: string) => void;
}

export default function BottomNav({ tabs, active, onChange }: BottomNavProps) {
  return (
    <div className="bottom-nav safe-area-pb">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn("nav-item active:scale-95 transition-transform", active === tab.id && "active")}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

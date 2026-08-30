"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const initialState: LoginState = {};
const SPLASH_HOLD_MS = 350;
const SPLASH_FADE_MS = 300;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setSplashLeaving(true), SPLASH_HOLD_MS);
    const removeTimer = setTimeout(() => setSplashVisible(false), SPLASH_HOLD_MS + SPLASH_FADE_MS);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div className="screen">
      {splashVisible && (
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-[#0F0F0F] transition-opacity duration-500",
            splashLeaving ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <Image
            src="/logo-white.png"
            alt=""
            width={180}
            height={128}
            className={cn(
              "transition-all duration-700 ease-out",
              splashLeaving ? "scale-95 opacity-0" : "scale-100 opacity-100"
            )}
            priority
          />
        </div>
      )}

      <div
        className={cn(
          "transition-all duration-700 ease-out",
          splashLeaving ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )}
      >
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0F0F0F] via-[#1C1C1E] to-[#0F0F0F] px-6 pt-16 pb-14 text-white flex flex-col items-center text-center">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#C9A84C]/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-[#C9A84C]/10 blur-3xl" />
          <Image
            src="/logo-white.png"
            alt="Sara Designer Studio"
            width={190}
            height={135}
            className="mb-4 relative"
          />
          <p className="text-[#9A9A9A] text-[15px] relative">Sign in to manage orders</p>
        </div>

        <div className="flex-1 px-5 -mt-7 relative z-10">
        <form action={formAction} className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D5] p-6 space-y-5">
          <div>
            <label htmlFor="username" className="text-[13px] font-medium text-[#56524A] mb-1.5 block">
              Username
            </label>
            <div className="relative">
              <User size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E5518]" />
              <input
                id="username"
                name="username"
                className="input pl-11"
                autoComplete="username"
                autoFocus
                placeholder="Enter your username"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="text-[13px] font-medium text-[#56524A] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E5518]" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="input pl-11 pr-11"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#56524A] active:text-[#0F0F0F]"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {state?.error && (
            <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2.5">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {pending ? (
              "Signing in…"
            ) : (
              <>
                Sign in
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[12px] text-[#56524A] mt-6">
          Sara Designer Studio · Boutique order management
        </p>
        </div>
      </div>
    </div>
  );
}

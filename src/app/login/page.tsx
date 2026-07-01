"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="screen">
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
          priority
        />
        <p className="text-[#9A9A9A] text-sm relative">Sign in to manage orders</p>
      </div>

      <div className="flex-1 px-5 -mt-7 relative z-10">
        <form action={formAction} className="bg-white rounded-3xl shadow-xl border border-[#E5E0D5] p-5 space-y-4">
          <div>
            <label htmlFor="username" className="text-xs font-medium text-[#9A9A9A] mb-1.5 block">
              Username
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
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
            <label htmlFor="password" className="text-xs font-medium text-[#9A9A9A] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A] active:text-[#0F0F0F]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
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
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#9A9A9A] mt-6">
          Sara Designer Studio · Boutique order management
        </p>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-sm rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-6">
        <p className="mb-5 font-mono text-sm font-medium text-signal-400">
          KDS_OS
        </p>
        {sent ? (
          <p className="font-mono text-[13px] leading-relaxed text-ink-500">
            <span className="text-signal-400">›</span> 메일함을 확인하세요. 로그인
            링크를 보냈어요.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="name@email.com"
              className="h-9 rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 text-sm text-ink-700 outline-none focus:border-signal-400"
            />
            <button
              onClick={send}
              disabled={loading}
              className="h-9 rounded bg-signal-400 px-3 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "보내는 중…" : "로그인 링크 받기"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
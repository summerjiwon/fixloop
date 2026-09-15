"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const authRequired = process.env.NEXT_PUBLIC_AUTH_REQUIRED === "true";

export function AdminAccess({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!authRequired);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authRequired || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session))).catch(() => setReady(false));
  }, []);

  if (!authRequired) return <>{children}</>;
  if (!supabase) return <main className="mx-auto max-w-lg p-10 text-red-700">관리자 로그인을 위해 Supabase 공개 키 설정이 필요합니다.</main>;
  if (ready) return <>{children}</>;

  async function signIn() {
    const client = supabase;
    if (!client) return;
    setBusy(true); setError(null);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) setError("이메일 또는 비밀번호를 확인하세요.");
    else setReady(true);
    setBusy(false);
  }

  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5"><section className="w-full rounded-2xl bg-white p-6 shadow-sm"><p className="font-semibold text-brand">FixLoop 관리자</p><h1 className="mt-2 text-2xl font-bold">운영 대시보드 로그인</h1><p className="mt-2 text-sm text-slate-600">등록된 관리자 계정으로만 이슈를 조회하고 처리할 수 있습니다.</p><label className="mt-6 block text-sm font-semibold">이메일<input className="mt-2 w-full rounded-lg border p-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label className="mt-4 block text-sm font-semibold">비밀번호<input className="mt-2 w-full rounded-lg border p-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" onKeyDown={(event) => event.key === "Enter" && signIn()} /></label><button className="mt-6 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy || !email || !password} onClick={signIn}>{busy ? "로그인 중…" : "관리자 로그인"}</button>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</section></main>;
}

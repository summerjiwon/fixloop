"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const authRequired = process.env.NEXT_PUBLIC_AUTH_REQUIRED === "true";

export function AdminAccess({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!authRequired);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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
  async function signOut() {
    await supabase?.auth.signOut();
    window.location.assign("/dashboard");
  }

  if (ready) return <><div className="fixed right-4 top-4 z-10"><button className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold shadow-sm" onClick={signOut}>로그아웃</button></div>{children}</>;

  async function signIn() {
    const client = supabase;
    if (!client) return;
    setBusy(true); setError(null);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) setError("이메일 또는 비밀번호를 확인하세요.");
    else setReady(true);
    setBusy(false);
  }

  async function signUp() {
    const client = supabase;
    if (!client) return;
    setBusy(true); setError(null);
    const { error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (signUpError) setError(signUpError.message);
    else setError("가입 확인 이메일을 보냈습니다. 이메일 인증 후 로그인하세요.");
    setBusy(false);
  }

  async function sendPasswordReset() {
    const client = supabase;
    if (!client) return;
    if (!email) {
      setError("비밀번호를 재설정할 관리자 이메일을 입력하세요.");
      return;
    }
    setBusy(true); setError(null);
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setError("비밀번호 재설정 이메일을 보냈습니다. 메일의 링크를 열어 새 비밀번호를 설정하세요.");
    setBusy(false);
  }

  const signingUp = mode === "sign-up";
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5"><section className="w-full rounded-2xl bg-white p-6 shadow-sm"><p className="font-semibold text-brand">공간기록 관리자</p><h1 className="mt-2 text-2xl font-bold">{signingUp ? "관리자 계정 만들기" : "운영 대시보드 로그인"}</h1><p className="mt-2 text-sm text-slate-600">{signingUp ? "관리자 이메일로 가입한 뒤 이메일 인증을 완료하세요." : "등록된 관리자 계정으로만 이슈를 조회하고 처리할 수 있습니다."}</p><label className="mt-6 block text-sm font-semibold">이메일<input className="mt-2 w-full rounded-lg border p-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label className="mt-4 block text-sm font-semibold">비밀번호<input className="mt-2 w-full rounded-lg border p-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={signingUp ? "new-password" : "current-password"} onKeyDown={(event) => event.key === "Enter" && (signingUp ? signUp() : signIn())} /></label><button className="mt-6 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy || !email || !password} onClick={signingUp ? signUp : signIn}>{busy ? "처리 중…" : signingUp ? "회원가입" : "관리자 로그인"}</button>{!signingUp && <button className="mt-3 w-full text-sm font-semibold text-slate-600" disabled={busy || !email} onClick={sendPasswordReset}>비밀번호를 잊으셨나요?</button>}<button className="mt-4 w-full text-sm font-semibold text-brand" disabled={busy} onClick={() => { setMode(signingUp ? "sign-in" : "sign-up"); setError(null); }}>{signingUp ? "이미 계정이 있습니다. 로그인" : "관리자 계정이 없습니다. 회원가입"}</button>{error && <p className={`mt-4 rounded-lg p-3 text-sm ${error.includes("보냈습니다") ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>{error}</p>}</section></main>;
}

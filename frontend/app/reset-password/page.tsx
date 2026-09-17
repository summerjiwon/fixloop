"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setReady(Boolean(data.session))).catch(() => setReady(false));
  }, []);

  async function updatePassword() {
    if (!supabase) return;
    if (password.length < 8) return setMessage("비밀번호는 8자 이상으로 입력하세요.");
    if (password !== confirmation) return setMessage("비밀번호가 서로 일치하지 않습니다.");
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else {
      setMessage("새 비밀번호가 설정되었습니다. 대시보드로 이동합니다.");
      window.setTimeout(() => window.location.assign("/dashboard"), 1000);
    }
    setBusy(false);
  }

  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5"><section className="w-full rounded-2xl bg-white p-6 shadow-sm"><p className="font-semibold text-brand">공간기록 관리자</p><h1 className="mt-2 text-2xl font-bold">새 비밀번호 설정</h1>{!ready ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">재설정 이메일 안의 링크를 열어야 합니다. 링크가 만료됐다면 로그인 화면에서 새 이메일을 보내세요.</p> : <><p className="mt-2 text-sm text-slate-600">앞으로 사용할 새 비밀번호를 입력하세요.</p><label className="mt-6 block text-sm font-semibold">새 비밀번호<input className="mt-2 w-full rounded-lg border p-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label className="mt-4 block text-sm font-semibold">새 비밀번호 확인<input className="mt-2 w-full rounded-lg border p-3" type="password" value={confirmation} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" onKeyDown={(event) => event.key === "Enter" && updatePassword()} /></label><button className="mt-6 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy || !password || !confirmation} onClick={updatePassword}>{busy ? "저장 중…" : "새 비밀번호 저장"}</button></>}{message && <p className={`mt-4 rounded-lg p-3 text-sm ${message.includes("설정되었습니다") ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>{message}</p>}</section></main>;
}

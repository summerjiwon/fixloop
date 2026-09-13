"use client";

import { useState } from "react";
import { submitReport, type Issue } from "@/lib/api";

export function ReportForm({ locationId }: { locationId: string }) {
  const [image, setImage] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!image) return setError("사진 한 장을 선택해주세요.");
    setBusy(true); setError(null);
    try {
      setIssue(await submitReport(locationId, image, text));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "분석에 실패했습니다."); }
    finally { setBusy(false); }
  }

  if (issue) return <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">등록되었습니다</h2><p className="mt-2 text-slate-600">AI가 사진을 분석해 운영팀에 이슈를 등록했습니다. 운영자가 확인 후 처리합니다.</p><p className="mt-4 text-sm text-slate-500">접수 번호: {issue.id.slice(0, 8).toUpperCase()}</p></section>;

  return <section className="rounded-2xl bg-white p-6 shadow-sm">
    <label className="block text-sm font-semibold">현장 사진</label>
    <input className="mt-2 block w-full rounded-lg border p-3" type="file" accept="image/*" capture="environment" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
    <label className="mt-5 block text-sm font-semibold">설명 <span className="font-normal text-slate-500">(선택)</span></label>
    <textarea className="mt-2 min-h-24 w-full rounded-lg border p-3" value={text} onChange={(event) => setText(event.target.value)} placeholder="무엇이 문제인지 짧게 적어주세요." />
    <button className="mt-5 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={submit}>{busy ? "AI가 사진을 분석하고 등록하고 있습니다…" : "사진 신고 등록"}</button>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </section>;
}

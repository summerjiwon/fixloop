"use client";

import { useState } from "react";
import { analyzeReport, confirmReport, type Analysis, type Issue } from "@/lib/api";

export function ReportForm({ locationId }: { locationId: string }) {
  const [image, setImage] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!image) return setError("사진 한 장을 선택해주세요.");
    setBusy(true); setError(null);
    try {
      const result = await analyzeReport(locationId, image, text);
      setDraftId(result.draft_id); setAnalysis(result.analysis);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "분석에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!draftId) return;
    setBusy(true); setError(null);
    try { setIssue(await confirmReport(draftId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  if (issue) return <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">신고가 접수되었습니다</h2><p className="mt-2 text-slate-600">운영자가 사진과 분석 결과를 검토합니다.</p><p className="mt-4 break-all text-sm text-slate-500">Issue ID: {issue.id}</p></section>;

  return <section className="rounded-2xl bg-white p-6 shadow-sm">
    <label className="block text-sm font-semibold">현장 사진</label>
    <input className="mt-2 block w-full rounded-lg border p-3" type="file" accept="image/*" capture="environment" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
    <label className="mt-5 block text-sm font-semibold">설명 <span className="font-normal text-slate-500">(선택)</span></label>
    <textarea className="mt-2 min-h-24 w-full rounded-lg border p-3" value={text} onChange={(event) => setText(event.target.value)} placeholder="무엇이 문제인지 짧게 적어주세요." />
    {!analysis ? <button className="mt-5 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={submit}>{busy ? "AI가 사진을 분석하고 있습니다…" : "AI 분석 시작"}</button> : <div className="mt-6 rounded-xl bg-mist p-4"><p className="font-bold">AI 분석 결과</p><dl className="mt-3 space-y-2 text-sm"><div><dt className="inline font-semibold">대상: </dt><dd className="inline">{analysis.asset}</dd></div><div><dt className="inline font-semibold">문제: </dt><dd className="inline">{analysis.issue_type}</dd></div><div><dt className="inline font-semibold">심각도: </dt><dd className="inline">{analysis.severity}</dd></div><div><dt className="inline font-semibold">신뢰도: </dt><dd className="inline">{Math.round(analysis.confidence * 100)}%</dd></div></dl><p className="mt-3 text-sm text-slate-600">{analysis.description}</p><button className="mt-5 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={confirm}>{busy ? "저장 중…" : "이 결과로 신고 확정"}</button></div>}
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </section>;
}

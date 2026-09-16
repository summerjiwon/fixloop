"use client";

import { useEffect, useState } from "react";
import { addAfterImage, changeStatus, getIssue, markNoIssue, resolveIssue, verifyIssue, type Issue, type IssueStatus } from "@/lib/api";

const statusLabel: Record<IssueStatus, string> = { OPEN: "접수됨", IN_PROGRESS: "조치 중", VERIFYING: "확인 중", RESOLVED: "해결됨", NO_ISSUE: "문제 없음" };
const statusGuide: Record<IssueStatus, string> = {
  OPEN: "AI가 신고를 접수했습니다. 현장 문제 여부를 먼저 확인하세요.",
  IN_PROGRESS: "실제 문제를 확인했고 담당자가 조치 중입니다.",
  VERIFYING: "조치 후 사진 또는 현장 확인을 바탕으로 최종 판단하세요.",
  RESOLVED: "문제가 해결된 것으로 최종 승인되어 종결되었습니다.",
  NO_ISSUE: "현장 확인 결과 실제 시설 문제가 아닌 것으로 종결되었습니다.",
};

export function IssueDetailPanel({ issueId }: { issueId: string }) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => getIssue(issueId).then(setIssue).catch((caught: Error) => setError(caught.message));
  useEffect(() => { refresh(); }, [issueId]);
  async function run(action: () => Promise<Issue>) { setBusy(true); setError(null); try { setIssue(await action()); } catch (caught) { setError(caught instanceof Error ? caught.message : "작업에 실패했습니다."); } finally { setBusy(false); } }
  if (!issue) return <main className="mx-auto max-w-5xl p-10">{error ?? "이슈를 불러오는 중…"}</main>;
  const before = issue.images?.find((image) => image.type === "BEFORE");
  const after = issue.images?.filter((image) => image.type === "AFTER").at(-1);
  const isClosed = issue.status === "RESOLVED" || issue.status === "NO_ISSUE";
  const markAsNoIssue = () => {
    if (window.confirm("현장 확인 결과 실제 시설 문제가 아닌 경우에만 종결하세요. ‘문제 없음’으로 처리할까요?")) run(() => markNoIssue(issue.id));
  };

  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
    <p className="font-semibold text-brand">FixLoop 운영 이슈</p>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-brand">{issue.area}</p><h1 className="text-3xl font-bold">{issue.title}</h1><p className="mt-2 text-slate-600">{issue.description}</p></div><span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-bold">{statusLabel[issue.status]}</span></div>
    <section className="mt-5 rounded-xl bg-mist p-5"><h2 className="font-bold">현재 상태 기준</h2><p className="mt-2 text-slate-700">{statusGuide[issue.status]}</p></section>
    <section className="mt-5 rounded-xl bg-mist p-5"><h2 className="font-bold">관리자 코멘트</h2><p className="mt-2 text-slate-700">{issue.operator_comment}</p></section>
    {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">사진 증거</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[["신고 사진", before], ["조치 후 사진", after]].map(([label, image]) => <div key={String(label)}><p className="mb-2 text-sm font-semibold">{String(label)}</p>{image ? <img className="aspect-square w-full rounded-lg object-cover" src={(image as NonNullable<typeof before>).image_url} alt={`${label} 이슈 사진`} /> : <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">아직 사진 없음</div>}</div>)}</div><input className="mt-5 block w-full rounded-lg border p-2" type="file" accept="image/*" disabled={isClosed} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><button disabled={!file || busy || isClosed} onClick={() => file && run(() => addAfterImage(issue.id, file))} className="mt-3 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">조치 후 사진 등록</button></section>
      <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">운영 판단</h2><div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700"><p><b>접수됨</b>은 아직 실제 문제 여부를 확인하지 않은 상태입니다.</p><p className="mt-1"><b>문제 없음</b>은 현장 확인 후 실제 시설 문제가 아닐 때만 선택합니다.</p></div>{!isClosed && <div className="mt-4 flex flex-wrap gap-2">{issue.status === "OPEN" && <button disabled={busy} onClick={() => run(() => changeStatus(issue.id, "IN_PROGRESS"))} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">문제 확인 · 조치 시작</button>}{issue.status === "IN_PROGRESS" && <button disabled={busy} onClick={() => run(() => changeStatus(issue.id, "VERIFYING"))} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">조치 확인 단계로 이동</button>}{issue.status === "VERIFYING" && <button disabled={busy} onClick={() => run(() => changeStatus(issue.id, "IN_PROGRESS"))} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">조치 계속하기</button>}<button disabled={busy} onClick={markAsNoIssue} className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold disabled:opacity-50">현장 확인: 문제 없음</button></div>}<div className="mt-7 border-t pt-5"><h2 className="font-bold">AI 사진 비교</h2>{issue.verification ? <div className="mt-3 rounded-lg bg-mist p-4 text-sm"><p><b>동일 대상:</b> {issue.verification.same_asset ? "예" : "아니오"}</p><p className="mt-1"><b>사진상 해결 가능성:</b> {issue.verification.visible_issue_resolved ? "높음" : "확인 필요"}</p><p className="mt-1"><b>신뢰도:</b> {Math.round(issue.verification.confidence * 100)}%</p><p className="mt-3">{issue.verification.reason}</p><p className="mt-3 text-slate-600">한계: {issue.verification.limitations.join(" ")}</p></div> : <p className="mt-3 text-sm text-slate-500">조치 후 사진을 등록한 뒤 비교를 실행하세요.</p>}<button disabled={!after || busy || isClosed} onClick={() => run(() => verifyIssue(issue.id))} className="mt-4 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">AI 비교 실행</button><button disabled={!issue.verification || busy || issue.status !== "VERIFYING"} onClick={() => run(() => resolveIssue(issue.id))} className="ml-2 mt-4 rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">해결 완료 승인</button></div></section>
    </div>
    <section className="mt-5 rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">유사 과거 이슈 후보</h2>{issue.similar_issues?.length ? <ul className="mt-3 space-y-3">{issue.similar_issues.map((candidate) => <li key={candidate.issue_id} className="rounded-lg bg-slate-50 p-3"><b>{candidate.title}</b> · 유사도 {Math.round(candidate.similarity * 100)}% · {statusLabel[candidate.status]}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">표시할 유사 후보가 없습니다.</p>}</section>
  </main>;
}

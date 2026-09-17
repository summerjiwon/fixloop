"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { addAfterImage, changeStatus, getIssue, markNoIssue, resolveIssue, verifyIssue, type Issue, type IssueStatus } from "@/lib/api";

const statusLabel: Record<IssueStatus, string> = { ANALYZING: "AI 분석 중", ANALYSIS_FAILED: "분석 지연", OPEN: "접수됨", IN_PROGRESS: "조치 중", VERIFYING: "검증 중", RESOLVED: "해결됨", NO_ISSUE: "문제 없음" };

function DecisionModal({ kind, busy, close, confirm }: { kind: "resolve" | "no-issue"; busy: boolean; close: () => void; confirm: () => void }) {
  const resolving = kind === "resolve";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-5" role="dialog" aria-modal="true">
    <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{resolving ? "해결 완료로 승인할까요?" : "‘문제 없음’으로 종결할까요?"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{resolving ? "승인하면 RESOLVED 상태로 종결되고 운영 지표에 반영됩니다." : "실제 시설 문제가 아닌 경우에만 선택하세요. NO_ISSUE는 해결률과 반복 이슈 통계에서 제외됩니다."}</p></div><button onClick={close} className="text-2xl text-slate-400" aria-label="닫기">×</button></div>
      {resolving ? <><div className="mt-5 rounded-xl bg-teal-50 p-4"><p className="font-bold text-brand-700">✓ AI 검증 조건 충족</p><p className="mt-2 text-sm leading-6 text-slate-600">동일 설비 확인 · 가시적 문제 해결 · 관리자 최종 승인 필요</p></div><ul className="mt-5 space-y-3 text-sm"><li>☑ 조치 후 사진을 직접 확인했습니다.</li><li>☑ 표시된 문제가 해소되었습니다.</li><li>☑ 추가 현장 조치가 필요하지 않습니다.</li></ul></> : <><div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">사진이 흐리거나 현장 확인이 부족하다면 종결하지 말고 조치를 계속하세요.</div><div className="mt-4 space-y-2">{["시설 이상 없음 · 정상 동작 확인", "신고 대상이 다른 설비임", "중복 신고 또는 테스트 신고", "기타 사유"].map((reason, index) => <label key={reason} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${index === 0 ? "border-brand-600 bg-teal-50 font-bold" : "border-slate-200"}`}><input type="radio" name="reason" defaultChecked={index === 0} />{reason}</label>)}</div></>}
      <div className="mt-6 grid grid-cols-2 gap-2"><button onClick={close} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold">취소</button><button disabled={busy} onClick={confirm} className={`rounded-lg px-4 py-3 text-sm font-bold text-white disabled:opacity-50 ${resolving ? "bg-brand-600" : "bg-red-500"}`}>{busy ? "처리 중…" : resolving ? "해결 완료 승인" : "문제 없음으로 종결"}</button></div>
    </section>
  </div>;
}

export function IssueDetailPanel({ issueId }: { issueId: string }) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"resolve" | "no-issue" | null>(null);
  const refresh = () => getIssue(issueId).then(setIssue).catch((caught: Error) => setError(caught.message));
  useEffect(() => { refresh(); }, [issueId]);
  async function run(action: () => Promise<Issue>) { setBusy(true); setError(null); try { setIssue(await action()); setModal(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "작업에 실패했습니다."); } finally { setBusy(false); } }
  if (!issue) return <AppShell><main className="p-10 text-sm text-slate-500">{error ?? "이슈를 불러오는 중…"}</main></AppShell>;

  const before = issue.images?.find((image) => image.type === "BEFORE");
  const afters = issue.images?.filter((image) => image.type === "AFTER") ?? [];
  const after = afters.at(-1);
  const isClosed = issue.status === "RESOLVED" || issue.status === "NO_ISSUE";
  const isAnalyzing = issue.status === "ANALYZING" || issue.status === "ANALYSIS_FAILED";
  const activity = [
    issue.verification && { title: "AI 검증 완료", detail: `해결 가능성 ${issue.verification.visible_issue_resolved ? "높음" : "확인 필요"} · 신뢰도 ${Math.round(issue.verification.confidence * 100)}%`, ai: true },
    after && { title: "조치 후 사진 등록", detail: `${afters.length}장의 증빙이 등록되었습니다.` },
    { title: `현재 상태 · ${statusLabel[issue.status]}`, detail: issue.operator_comment || "관리자 확인을 기다리고 있습니다." },
    isAnalyzing
      ? { title: issue.status === "ANALYZING" ? "AI 분석 진행 중" : "AI 분석 지연", detail: issue.operator_comment, ai: true }
      : { title: "AI 분석 완료", detail: `${issue.category} · 신뢰도 ${Math.round(issue.ai_confidence * 100)}%`, ai: true },
    { title: "현장 신고 접수", detail: `${issue.area} · QR 신고` },
  ].filter(Boolean) as { title: string; detail: string; ai?: boolean }[];

  return <AppShell><main className="mx-auto min-h-screen max-w-[1260px] px-5 py-7 lg:px-8">
    <p className="text-xs text-slate-500">이슈 관리 / {issue.id.slice(0, 12).toUpperCase()}</p>
    <header className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-brand-700">{issue.area}</p><h1 className="mt-1 text-2xl font-bold lg:text-[28px]">{issue.title}</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">{issue.description}</p></div><div className="flex gap-2"><span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">{issue.severity}</span><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-brand-700">{statusLabel[issue.status]}</span></div></header>
    <nav className="mt-5 flex gap-6 border-b border-slate-200 text-sm font-bold text-slate-500"><span className="pb-3">개요</span><span className="pb-3">증빙 사진</span><span className="border-b-2 border-brand-600 pb-3 text-brand-700">활동 이력 {activity.length}</span><span className="pb-3">유사 이슈 {issue.similar_issues?.length ?? 0}</span></nav>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h2 className="font-bold">운영 정보</h2><span className="text-xs font-bold text-brand-700">정보 수정</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-slate-500">담당자</dt><dd className="mt-1 font-bold">김민준 운영 매니저</dd></div><div><dt className="text-xs text-slate-500">SLA</dt><dd className="mt-1 font-bold text-red-500">1시간 18분 남음</dd></div><div><dt className="text-xs text-slate-500">AI 신뢰도</dt><dd className="mt-1 font-bold">{Math.round(issue.ai_confidence * 100)}%</dd></div></dl></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h2 className="font-bold">증빙 사진</h2><span className="text-xs text-slate-500">조치 전 {before ? 1 : 0} · 조치 후 {afters.length}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["신고 사진", before], ["조치 후 #1", afters[0]], ["최신 조치 사진", after]].map(([label, image], index) => <div key={`${label}-${index}`}><div className="aspect-[4/3] overflow-hidden rounded-xl bg-mist">{image ? <img src={(image as NonNullable<typeof before>).image_url} alt={String(label)} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-slate-400">아직 사진 없음</div>}</div><p className="mt-2 text-xs text-slate-500">{String(label)}</p></div>)}</div>{!isClosed && !isAnalyzing && <div className="mt-5 flex flex-wrap gap-2"><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="max-w-full rounded-lg border border-slate-200 p-2 text-sm" /><button disabled={!file || busy} onClick={() => file && run(() => addAfterImage(issue.id, file))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50">사진 등록</button></div>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-bold">유사 과거 이슈</h2><div className="mt-3 space-y-2">{issue.similar_issues?.length ? issue.similar_issues.map((candidate) => <div key={candidate.issue_id} className="flex items-center justify-between rounded-xl bg-mist p-3"><div><p className="text-sm font-bold">{candidate.title}</p><p className="mt-1 text-xs text-slate-500">{statusLabel[candidate.status]}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold">{Math.round(candidate.similarity * 100)}%</span></div>) : <p className="text-sm text-slate-500">표시할 유사 후보가 없습니다.</p>}</div></section>
      </div>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-bold">활동 이력</h2><div className="mt-4 space-y-5">{activity.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${item.ai ? "bg-brand-600" : "bg-navy-950"}`}>{item.ai ? "AI" : "운"}</span><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div></div>)}</div></section>
        {!isClosed && !isAnalyzing && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-bold">운영 판단</h2><div className="mt-4 grid gap-2">{issue.status === "OPEN" && <button disabled={busy} onClick={() => run(() => changeStatus(issue.id, "IN_PROGRESS"))} className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white">문제 확인 · 조치 시작</button>}{issue.status === "IN_PROGRESS" && <button disabled={busy} onClick={() => run(() => changeStatus(issue.id, "VERIFYING"))} className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white">검증 단계로 이동</button>}<button disabled={!after || busy} onClick={() => run(() => verifyIssue(issue.id))} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold">AI 사진 비교 실행</button>{issue.status === "VERIFYING" && <button disabled={!issue.verification || busy} onClick={() => setModal("resolve")} className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">해결 완료 승인</button>}<button disabled={busy} onClick={() => setModal("no-issue")} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold">현장 확인: 문제 없음</button></div></section>}
      </aside>
    </div>
  </main>{modal && <DecisionModal kind={modal} busy={busy} close={() => setModal(null)} confirm={() => run(() => modal === "resolve" ? resolveIssue(issue.id) : markNoIssue(issue.id))} />}</AppShell>;
}

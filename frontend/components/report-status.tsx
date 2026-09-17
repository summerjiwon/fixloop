"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getPublicReportStatus, type IssueStatus, type PublicReportStatus } from "@/lib/api";

const statusCopy: Record<IssueStatus, string> = { ANALYZING: "AI가 사진을 분석하고 있습니다", ANALYSIS_FAILED: "AI 분석이 지연되고 있습니다", OPEN: "운영팀 확인 대기", IN_PROGRESS: "운영팀이 조치 중입니다", VERIFYING: "조치 결과를 검증하고 있습니다", RESOLVED: "조치가 완료되었습니다", NO_ISSUE: "문제 없음으로 분류되었습니다" };
const severityCopy = { LOW: "낮음", MEDIUM: "중간", HIGH: "높음", CRITICAL: "긴급" };

export function ReportStatus({ issueId }: { issueId: string }) {
  const [issue, setIssue] = useState<PublicReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => getPublicReportStatus(issueId).then((next) => { setIssue(next); setError(null); }).catch(() => setError("신고를 찾을 수 없습니다. 접수 링크를 다시 확인해 주세요.")), [issueId]);
  useEffect(() => { load(); const timer = window.setInterval(load, 8_000); return () => window.clearInterval(timer); }, [load]);
  return <main className="mx-auto min-h-[calc(100vh-60px)] max-w-md px-5 py-10"><p className="text-xs font-bold text-brand-700">FIXLOOP · 신고 확인</p><h1 className="mt-3 text-2xl font-bold">신고 처리 상태</h1>{error && <section className="mt-7 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</section>}{!issue && !error && <p className="mt-7 text-sm text-slate-500">신고 정보를 불러오는 중입니다…</p>}{issue && <><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><p className="text-xs font-bold text-brand-700">{issue.status}</p><h2 className="mt-2 text-xl font-bold">{statusCopy[issue.status]}</h2><p className="mt-2 text-sm text-slate-500">접수 번호 {issue.id.slice(0, 12).toUpperCase()}</p></section><section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><dl className="space-y-4 text-sm">{[["위치", issue.area], ["AI 분류", issue.category], ["설비", issue.asset_name], ["심각도", severityCopy[issue.severity]], ["AI 신뢰도", issue.status === "ANALYZING" ? "분석 중" : `${Math.round(issue.ai_confidence * 100)}%`]].map(([label, value]) => <div className="flex justify-between gap-4" key={label}><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold">{value}</dd></div>)}</dl></section><p className="mt-5 text-center text-xs text-slate-500">분석 중인 신고는 8초마다 자동으로 갱신됩니다.</p></>}<Link href="/report/00000000-0000-0000-0000-000000000001" className="mt-7 block rounded-xl bg-brand-600 px-4 py-3.5 text-center font-bold text-white">새 신고 작성</Link></main>;
}

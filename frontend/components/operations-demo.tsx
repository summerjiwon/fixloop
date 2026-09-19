"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPublicReportStatus, type PublicReportStatus, type Severity } from "@/lib/api";

type DemoIssue = { title: string; area: string; severity: string; status: string; confidence: string; tone: string; stateTone: string; newReport?: boolean };

const sampleIssues: DemoIssue[] = [
  { title: "사무실 탕비실 싱크대 하부 배관 누수", area: "본사 3층 · 탕비실", severity: "긴급", status: "조치 중", confidence: "98%", tone: "bg-red-50 text-red-600", stateTone: "text-brand-700" },
  { title: "회의실 A 프로젝터 화면 출력 불가", area: "본사 4층 · 회의실 A", severity: "높음", status: "검증 대기", confidence: "94%", tone: "bg-amber-100 text-amber-800", stateTone: "text-amber-700" },
  { title: "로비 출입문 자동 닫힘 지연", area: "본사 1층 · 로비", severity: "중간", status: "접수됨", confidence: "91%", tone: "bg-slate-100 text-slate-600", stateTone: "text-slate-700" },
];

const severityLabel: Record<Severity, string> = { LOW: "낮음", MEDIUM: "중간", HIGH: "높음", CRITICAL: "긴급" };
const severityTone: Record<Severity, string> = { LOW: "bg-slate-100 text-slate-600", MEDIUM: "bg-slate-100 text-slate-600", HIGH: "bg-amber-100 text-amber-800", CRITICAL: "bg-red-50 text-red-600" };
const statusLabel = { ANALYZING: "AI 분석 중", ANALYSIS_FAILED: "분석 지연", OPEN: "접수됨", IN_PROGRESS: "조치 중", VERIFYING: "검증 대기", RESOLVED: "해결됨", NO_ISSUE: "문제 없음" } as const;

function currentIssue(report: PublicReportStatus): DemoIssue {
  return { title: report.title || "방금 접수한 사진 신고", area: report.area || "AI 위치 분석 중", severity: severityLabel[report.severity], status: statusLabel[report.status], confidence: report.ai_confidence ? `${Math.round(report.ai_confidence * 100)}%` : "분석 중", tone: severityTone[report.severity], stateTone: report.status === "ANALYZING" ? "text-violet-700" : "text-brand-700", newReport: true };
}

export function OperationsDemo() {
  const searchParams = useSearchParams();
  const issueId = searchParams.get("issue");
  const [report, setReport] = useState<PublicReportStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issueId) return;
    let active = true;
    const load = async () => {
      try { const next = await getPublicReportStatus(issueId); if (active) setReport(next); }
      finally { if (active) setLoading(false); }
    };
    setLoading(true);
    load();
    const timer = window.setInterval(load, 8_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [issueId]);

  const issues = useMemo(() => report ? [currentIssue(report), ...sampleIssues] : sampleIssues, [report]);
  const urgentCount = report?.severity === "HIGH" || report?.severity === "CRITICAL" ? "8" : "7";

  return <main className="min-h-screen bg-canvas px-5 py-8 text-ink lg:px-8"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><img src="/brand-mark.png" alt="" className="size-8 object-contain" /><p className="text-xs font-bold text-brand-700">공간기록 · 운영 화면 체험</p></div><h1 className="mt-2 text-3xl font-bold tracking-tight">AI가 정리한 이슈를 운영자가 판단합니다</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">심사용 읽기 전용 예시입니다. 실제 고객 정보나 운영 데이터를 노출하거나 변경하지 않습니다.</p></div><Link href="/demo" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">데모 처음으로</Link></header>

    {issueId && <section className="mt-5 rounded-2xl border border-brand-100 bg-teal-50 p-5"><p className="font-bold text-brand-800">방금 접수한 신고를 운영 대기열에 표시했습니다</p><p className="mt-1 text-sm leading-6 text-slate-600">{loading && !report ? "신고 정보를 불러오는 중입니다…" : report?.status === "ANALYZING" ? "AI가 사진을 분석하는 동안에도 운영팀은 접수 사실을 바로 확인할 수 있습니다." : "AI 분석 결과가 반영됐습니다. 아래 첫 번째 항목에서 확인하세요."}</p></section>}

    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["전체 이슈", report ? "25" : "24", "text-ink"], ["높음 · 긴급", urgentCount, "text-red-500"], ["오늘 접수", report ? "10" : "9", "text-brand-600"], ["검증 대기", "3", "text-amber-600"]].map(([label, value, tone]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p></article>)}</section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"><div className="flex flex-wrap items-center justify-between gap-3 bg-mist px-5 py-4"><div><h2 className="font-bold">우선 처리 이슈</h2><p className="mt-1 text-xs text-slate-500">심각도와 AI 신뢰도를 함께 보고 조치 우선순위를 정합니다.</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-brand-700">읽기 전용 데모</span></div><div className="hidden grid-cols-[minmax(220px,2fr)_1fr_90px_110px_90px] gap-4 border-t border-slate-100 px-5 py-3 text-xs font-bold text-slate-500 md:grid"><span>이슈</span><span>위치</span><span>심각도</span><span>상태</span><span>AI 신뢰도</span></div>{issues.map((issue) => <article key={`${issue.title}-${issue.area}`} className={`grid gap-3 border-t border-slate-100 px-5 py-5 md:grid-cols-[minmax(220px,2fr)_1fr_90px_110px_90px] md:items-center ${issue.newReport ? "bg-teal-50/70" : ""}`}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{issue.title}</h3>{issue.newReport && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">방금 접수</span>}</div><p className="mt-1 text-xs text-slate-500">{issue.newReport && issue.status === "AI 분석 중" ? "사진 분석 진행 중 · 결과가 자동 반영됩니다" : "사진 분석 완료 · 유사 이슈 2건 참고"}</p></div><p className="text-sm">{issue.area}</p><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${issue.tone}`}>{issue.severity}</span><span className={`text-sm font-bold ${issue.stateTone}`}>{issue.status}</span><span className="text-sm font-bold">{issue.confidence}</span></article>)}</section>

    <section className="mt-5 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><p className="text-xs font-bold text-brand-700">운영 원칙</p><h2 className="mt-2 text-xl font-bold">분류는 AI가, 종결은 사람이</h2><p className="mt-3 text-sm leading-6 text-slate-600">AI는 사진에서 시설·문제 유형·심각도와 조치 제안을 구조화합니다. 최종 조치와 종결은 운영자가 사진 증빙을 확인한 뒤 결정합니다.</p></article><article className="rounded-2xl bg-navy-950 p-6 text-white"><p className="text-xs font-bold text-teal-100">공개 체험 범위</p><h2 className="mt-2 text-xl font-bold">신고부터 확인까지, 계정 없이</h2><p className="mt-3 text-sm leading-6 text-slate-200">공개 신고 페이지에서 사진을 제출하면 접수 번호와 확인 링크가 제공됩니다. 이슈 상태와 AI 분석 결과는 해당 링크에서 확인할 수 있습니다.</p><Link href="/report/00000000-0000-0000-0000-000000000001" className="mt-5 inline-block rounded-xl bg-white px-4 py-3 text-sm font-bold text-navy-950">사진 신고 체험하기</Link></article></section>
  </div></main>;
}

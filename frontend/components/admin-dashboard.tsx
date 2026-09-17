"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { changeStatus, listIssues, type Issue, type IssueStatus, type Severity } from "@/lib/api";

const statusLabel: Record<IssueStatus, string> = { ANALYZING: "AI 분석 중", ANALYSIS_FAILED: "분석 지연", OPEN: "접수됨", IN_PROGRESS: "조치 중", VERIFYING: "검증 중", RESOLVED: "해결됨", NO_ISSUE: "문제 없음" };
const severityLabel: Record<Severity, string> = { LOW: "낮음", MEDIUM: "중간", HIGH: "높음", CRITICAL: "긴급" };
const severityStyle: Record<Severity, string> = { LOW: "bg-slate-100 text-slate-600", MEDIUM: "bg-slate-100 text-slate-600", HIGH: "bg-amber-100 text-amber-800", CRITICAL: "bg-red-50 text-red-600" };
const statusStyle: Record<IssueStatus, string> = { ANALYZING: "text-violet-700", ANALYSIS_FAILED: "text-red-600", OPEN: "text-ink", IN_PROGRESS: "text-brand-600", VERIFYING: "text-amber-600", RESOLVED: "text-emerald-700", NO_ISSUE: "text-slate-500" };

export function AdminDashboard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<IssueStatus | "ALL" | "ACTION">("ACTION");
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listIssues().then(setIssues).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const refreshTimer = window.setInterval(load, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [load]);

  const advanceIssue = async (issue: Issue) => {
    const nextStatus: Partial<Record<IssueStatus, IssueStatus>> = {
      OPEN: "IN_PROGRESS",
      IN_PROGRESS: "VERIFYING",
    };
    const next = nextStatus[issue.status];
    if (!next) return;

    setUpdatingId(issue.id);
    setError(null);
    try {
      const updated = await changeStatus(issue.id, next);
      setIssues((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "상태 변경에 실패했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(() => issues.filter((issue) => {
    const queryMatch = `${issue.title} ${issue.asset_name} ${issue.area} ${issue.id}`.toLowerCase().includes(query.toLowerCase());
    const statusMatch = status === "ALL" || (status === "ACTION" ? !["RESOLVED", "NO_ISSUE"].includes(issue.status) : issue.status === status);
    return queryMatch && statusMatch && (severity === "ALL" || issue.severity === severity);
  }), [issues, query, status, severity]);

  const urgent = issues.filter((issue) => issue.severity === "HIGH" || issue.severity === "CRITICAL").length;
  const verifying = issues.filter((issue) => issue.status === "VERIFYING").length;
  const today = issues.filter((issue) => new Date(issue.created_at).toDateString() === new Date().toDateString()).length;

  const exportCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ["접수 번호", "제목", "구역", "설비", "심각도", "상태", "AI 신뢰도", "접수 시각"],
      ...filtered.map((issue) => [
        issue.id,
        issue.title,
        issue.area,
        issue.asset_name,
        severityLabel[issue.severity],
        statusLabel[issue.status],
        `${Math.round(issue.ai_confidence * 100)}%`,
        new Date(issue.created_at).toLocaleString("ko-KR"),
      ]),
    ];
    const blob = new Blob([`\ufeff${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gonggan-girok-issues-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <AppShell><main className="mx-auto min-h-screen max-w-[1260px] px-5 py-7 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">이슈 관리</h1><p className="mt-1 text-sm text-slate-500">현장 신고를 우선순위와 처리 상태에 따라 관리합니다.</p></div>
      <div className="flex gap-2"><button onClick={exportCsv} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">CSV 내보내기</button><button onClick={load} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">새로고침</button></div>
    </header>
    <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[{ label: "전체", value: issues.length }, { label: "높음·긴급", value: urgent, tone: "text-red-500" }, { label: "오늘 접수", value: today, tone: "text-brand-600" }, { label: "검증 대기", value: verifying, tone: "text-amber-500" }].map((item) => <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"><p className="text-xs text-slate-500">{item.label}</p><p className={`mt-1 text-2xl font-bold ${item.tone ?? ""}`}>{item.value}</p></article>)}
    </section>
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="grid gap-2 md:grid-cols-[minmax(220px,2fr)_1fr_1fr_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 rounded-lg bg-mist px-4 text-sm outline-none placeholder:text-slate-400" placeholder="제목, 설비명, 접수 번호 검색" />
        <select value={severity} onChange={(event) => setSeverity(event.target.value as Severity | "ALL")} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="ALL">전체 심각도</option><option value="CRITICAL">긴급</option><option value="HIGH">높음</option><option value="MEDIUM">중간</option><option value="LOW">낮음</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value as IssueStatus | "ALL" | "ACTION")} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="ACTION">조치 필요</option><option value="ALL">전체 상태</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <button onClick={() => { setQuery(""); setStatus("ACTION"); setSeverity("ALL"); }} className="h-11 rounded-lg px-4 text-sm font-bold text-brand-700">모두 초기화</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="font-bold text-slate-500">적용 중</span>{status !== "ALL" && <span className="rounded-full bg-amber-50 px-3 py-1.5 font-bold text-amber-800">{status === "ACTION" ? "OPEN · IN_PROGRESS · VERIFYING" : statusLabel[status]}</span>}{severity !== "ALL" && <span className="rounded-full bg-teal-50 px-3 py-1.5 font-bold text-brand-700">{severityLabel[severity]}</span>}</div>
    </section>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="hidden grid-cols-[minmax(240px,2fr)_1fr_110px_145px_90px_125px] bg-mist px-5 py-3 text-xs font-bold text-slate-500 lg:grid"><span>이슈</span><span>지점·구역</span><span>심각도</span><span>상태 관리</span><span>AI 신뢰도</span><span>접수 시각</span></div>
      {loading ? <p className="p-8 text-sm text-slate-500">이슈를 불러오는 중…</p> : filtered.map((issue) => {
        const actionLabel = issue.status === "OPEN" ? "조치 시작" : issue.status === "IN_PROGRESS" ? "검증 요청" : null;
        return <div key={issue.id} className="grid gap-3 border-t border-slate-100 px-5 py-4 transition hover:bg-teal-50/40 lg:grid-cols-[minmax(240px,2fr)_1fr_110px_145px_90px_125px] lg:items-center">
          <div><Link href={`/issues/${issue.id}`} className="font-bold text-navy-950 hover:text-brand-600 hover:underline">{issue.title}</Link><p className="mt-1 text-xs text-slate-500">{issue.category} · {issue.asset_name} · {issue.id.slice(0, 8).toUpperCase()}</p></div>
          <p className="text-sm">{issue.area}</p><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${severityStyle[issue.severity]}`}>{severityLabel[issue.severity]}</span>
          <div><span className={`text-sm font-bold ${statusStyle[issue.status]}`}>{statusLabel[issue.status]}</span>{actionLabel ? <button disabled={updatingId === issue.id} onClick={() => advanceIssue(issue)} className="mt-1.5 block text-xs font-bold text-brand-700 disabled:opacity-50">{updatingId === issue.id ? "변경 중…" : actionLabel}</button> : <Link href={`/issues/${issue.id}`} className="mt-1.5 block text-xs font-bold text-brand-700">상세 검토</Link>}</div>
          <span className="text-sm font-bold">{Math.round(issue.ai_confidence * 100)}%</span><span className="text-sm text-slate-500">{new Date(issue.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        </div>;
      })}
      {!loading && filtered.length === 0 && <div className="p-10 text-center"><p className="font-bold">조건에 맞는 이슈가 없습니다.</p><p className="mt-2 text-sm text-slate-500">필터를 초기화하거나 다른 검색어를 입력해보세요.</p></div>}
      <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>총 {filtered.length}건</span><span className="rounded-lg bg-brand-600 px-3 py-2 font-bold text-white">1</span></footer>
    </section>
  </main></AppShell>;
}

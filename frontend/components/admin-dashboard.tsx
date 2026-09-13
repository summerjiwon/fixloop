"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listIssues, type Issue, type IssueStatus } from "@/lib/api";

const statuses: (IssueStatus | "ALL")[] = ["ALL", "OPEN", "IN_PROGRESS", "VERIFYING", "RESOLVED"];
const severityClass: Record<Issue["severity"], string> = { LOW: "bg-slate-100 text-slate-700", MEDIUM: "bg-amber-100 text-amber-800", HIGH: "bg-orange-100 text-orange-800", CRITICAL: "bg-red-100 text-red-800" };

export function AdminDashboard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState<IssueStatus | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(true); listIssues(selected === "ALL" ? undefined : selected).then(setIssues).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)); }, [selected]);
  const urgent = issues.filter((issue) => issue.severity === "HIGH" || issue.severity === "CRITICAL").length;

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-10"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold text-brand">FixLoop Operations</p><h1 className="mt-1 text-3xl font-bold">운영 대시보드</h1></div><Link href="/insights" className="rounded-lg border bg-white px-4 py-2 font-semibold">AI 인사이트</Link></header><section className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">표시 이슈</p><p className="mt-2 text-3xl font-bold">{issues.length}</p></div><div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">긴급 이슈</p><p className="mt-2 text-3xl font-bold text-red-700">{urgent}</p></div><div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">운영 모드</p><p className="mt-2 font-bold">{process.env.NEXT_PUBLIC_SUPABASE_URL ? "Supabase Auth" : "로컬 데모"}</p></div></section><nav className="mt-8 flex flex-wrap gap-2">{statuses.map((item) => <button key={item} onClick={() => setSelected(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${selected === item ? "bg-brand text-white" : "bg-white text-slate-700"}`}>{item === "ALL" ? "전체" : item}</button>)}</nav>{error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}{loading ? <p className="mt-8 text-slate-500">이슈를 불러오는 중…</p> : <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-sm">{issues.length === 0 ? <p className="p-8 text-slate-500">아직 이슈가 없습니다. 현장 신고 데모에서 첫 이슈를 등록하세요.</p> : issues.map((issue) => <Link key={issue.id} href={`/issues/${issue.id}`} className="block border-b p-5 last:border-0 hover:bg-slate-50"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-slate-500">{issue.asset_name} · {issue.category}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClass[issue.severity]}`}>{issue.severity}</span></div><div className="mt-4 flex gap-3 text-sm text-slate-500"><span>{issue.status}</span><span>AI 신뢰도 {Math.round(issue.ai_confidence * 100)}%</span><span>{new Date(issue.created_at).toLocaleString("ko-KR")}</span></div></Link>)}</section>}</main>;
}

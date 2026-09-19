"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { submitReport, type Issue } from "@/lib/api";

async function optimizeForUpload(file: File): Promise<File> {
  if (file.size <= 1_500_000 || !file.type.startsWith("image/")) return file;
  try {
    const source = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
    source.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified }) : file;
  } catch {
    return file;
  }
}

export function ReportForm({ locationId }: { locationId: string }) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissionStarted, setSubmissionStarted] = useState(false);
  const [busyLabel, setBusyLabel] = useState("사진을 업로드하고 접수하는 중…");

  useEffect(() => { if (!image) { setPreview(null); return; } const url = URL.createObjectURL(image); setPreview(url); return () => URL.revokeObjectURL(url); }, [image]);
  async function submit() { if (!image) return setError("사진 한 장을 선택해주세요."); setBusy(true); setSubmissionStarted(true); setError(null); try { setBusyLabel("사진을 전송하기 좋게 준비하는 중…"); const uploadImage = await optimizeForUpload(image); setBusyLabel("사진을 업로드하고 접수하는 중…"); setIssue(await submitReport(locationId, uploadImage, text)); } catch (caught) { setSubmissionStarted(false); setError(caught instanceof Error ? caught.message : "신고 접수에 실패했습니다."); } finally { setBusy(false); } }
  function reset() { setImage(null); setText(""); setIssue(null); setError(null); setSubmissionStarted(false); }

  if (issue) { const analyzing = issue.status === "ANALYZING"; return <main className="mx-auto min-h-[calc(100vh-60px)] max-w-md px-5 py-10"><section className="text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-brand-600 text-4xl font-bold text-white">✓</span><h1 className="mt-7 text-2xl font-bold">{analyzing ? "신고가 접수됐습니다" : "신고가 등록되었습니다"}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{analyzing ? "사진은 안전하게 저장됐고 AI가 분석 중입니다. 분석 결과는 운영팀 화면에 자동으로 반영됩니다." : "운영팀이 내용을 확인한 뒤 조치를 시작합니다. 별도 로그인은 필요하지 않습니다."}</p></section><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-bold">접수 정보</h2><dl className="mt-4 space-y-4 text-sm">{[["접수 번호", issue.id.slice(0, 12).toUpperCase()], ["위치", analyzing ? "AI 위치 분석 중" : issue.area], ["AI 분류", analyzing ? "사진 분석 중" : `${issue.category} · ${issue.severity}`], ["현재 상태", analyzing ? "ANALYZING · AI 분석 중" : "OPEN · 운영팀 확인 대기"]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold">{value}</dd></div>)}</dl></section><section className="mt-5 rounded-2xl bg-teal-50 p-5"><h2 className="font-bold">방금 접수한 신고를 확인하세요</h2><p className="mt-2 text-sm leading-6 text-slate-600">운영 화면에서 이 신고가 어떻게 분류되고 처리 대기열에 들어가는지 볼 수 있습니다.</p><Link href={`/demo/operations?issue=${issue.id}`} className="mt-4 block rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-bold text-white">운영 화면에서 확인하기</Link><Link href={`/report-status/${issue.id}`} className="mt-3 block text-center text-sm font-bold text-brand-700 underline underline-offset-4">내 신고 처리 상태만 확인하기</Link></section><button onClick={reset} className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 font-bold text-ink">새 신고 작성</button><p className="mt-5 text-center text-xs text-slate-500">이 창을 닫아도 신고와 AI 분석은 계속 진행됩니다.</p></main>; }

  if (submissionStarted) return <main className="mx-auto min-h-[calc(100vh-60px)] max-w-md px-5 py-10"><section className="text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-brand-50 text-3xl font-bold text-brand-700">↗</span><h1 className="mt-7 text-2xl font-bold">신고 접수를 시작했습니다</h1><p className="mt-3 text-sm leading-6 text-slate-500">사진을 안전하게 전송하고 있습니다. 전송이 끝나는 즉시 AI 분석이 시작됩니다.</p></section><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center gap-3"><span className="size-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /><div><p className="font-bold">{busyLabel}</p><p className="mt-1 text-xs text-slate-500">이 화면을 유지해 주세요.</p></div></div></section></main>;

  return <main className="mx-auto min-h-[calc(100vh-60px)] max-w-md px-5 py-7"><p className="text-xs font-bold text-brand-700">현장 사진 신고 · 1/3</p><h1 className="mt-4 text-2xl font-bold leading-tight">문제가 보이도록 사진을 올려주세요</h1><p className="mt-4 text-sm leading-6 text-slate-500">한 장의 사진만으로 접수할 수 있습니다. 설비 전체와 문제 부위가 함께 보이면 분석 정확도가 높아집니다.</p>
    <label className={`mt-8 grid min-h-44 cursor-pointer place-items-center rounded-2xl border border-dashed bg-white p-5 text-center ${error && !image ? "border-red-400" : "border-slate-300"}`}><input className="sr-only" type="file" accept="image/*" onChange={(event) => { setImage(event.target.files?.[0] ?? null); setError(null); }} />{preview ? <img src={preview} alt="선택한 신고 사진 미리보기" className="max-h-56 w-full rounded-xl object-cover" /> : <div><span className="text-4xl font-light text-brand-600">＋</span><p className="mt-3 font-bold">카메라로 촬영하거나 사진 선택</p><p className="mt-2 text-xs text-slate-500">JPG, PNG · 최대 10MB · 1장</p></div>}</label>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">! {error}</div>}
    <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" open><summary className="cursor-pointer text-sm font-bold">설명 추가 <span className="font-normal text-slate-500">(선택)</span></summary><textarea className="mt-4 min-h-24 w-full resize-none rounded-xl bg-mist p-3 text-sm outline-none" value={text} onChange={(event) => setText(event.target.value)} placeholder="언제부터, 어떤 문제가 있었는지 적어주세요. 입력하지 않아도 신고할 수 있습니다." /></details>
    <div className="mt-4 flex gap-2 rounded-xl bg-teal-50 p-3 text-xs leading-5 text-slate-600"><span className="font-bold text-brand-600">✓</span><p>로그인 없이 접수됩니다. 위치와 사진은 이슈 처리 목적으로만 사용됩니다.</p></div>
    <button className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3.5 font-bold text-white disabled:bg-slate-300" disabled={busy} onClick={submit}>{busy ? busyLabel : "사진만으로 신고 등록"}</button>
  </main>;
}

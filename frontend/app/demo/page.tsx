import Link from "next/link";

const steps = [
  ["01", "사진 신고 접수", "QR 링크에서 사진 한 장과 선택 설명을 등록합니다.", "완료"],
  ["02", "Gemini Vision 구조화", "공간·설비·문제 유형·심각도를 추출하고, 유사 이슈를 탐색합니다.", "AI 완료"],
  ["03", "운영팀 조치·검증", "담당자는 사진 증빙을 확인해 조치, 검증, 종결을 판단합니다.", "진행 중"],
];

export default function DemoPage() {
  return <main className="min-h-screen bg-mist px-5 py-8 text-ink lg:px-8"><div className="mx-auto max-w-5xl"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-brand-700">FIXLOOP · AI FLOW</p><h1 className="mt-2 text-3xl font-bold tracking-tight">사진 신고부터 조치 검증까지</h1><p className="mt-2 text-sm leading-6 text-slate-600">예시 이슈를 통해 사진 한 장이 운영 가능한 업무로 바뀌는 과정을 확인해 보세요.</p></div><Link href="/report/00000000-0000-0000-0000-000000000001" className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white">직접 사진 신고 체험</Link></header>

    <section className="mt-7 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-red-600">CRITICAL · OPEN</p><h2 className="mt-2 text-xl font-bold">사무실 탕비실 싱크대 하부 배관 누수</h2><p className="mt-2 text-sm leading-6 text-slate-500">바닥에 물이 고여 미끄럼 위험이 있어 신속한 조치가 필요한 사례입니다.</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">AI 신뢰도 98%</span></div><dl className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-mist p-4"><dt className="text-xs text-slate-500">공간</dt><dd className="mt-1 font-bold">사무실 탕비실</dd></div><div className="rounded-xl bg-mist p-4"><dt className="text-xs text-slate-500">설비</dt><dd className="mt-1 font-bold">싱크대 배수관</dd></div><div className="rounded-xl bg-mist p-4"><dt className="text-xs text-slate-500">분류</dt><dd className="mt-1 font-bold">배관 · 누수</dd></div></dl></article>
      <aside className="rounded-2xl bg-brand-700 p-6 text-white"><p className="text-xs font-bold text-brand-100">AI 사용 방식</p><h2 className="mt-2 text-xl font-bold">분류는 AI가, 종결은 사람이</h2><p className="mt-3 text-sm leading-6 text-brand-50">Vision AI는 사진을 운영 가능한 이슈로 바꾸고, 운영자는 사진 증빙을 바탕으로 RESOLVED 또는 NO_ISSUE를 최종 판단합니다.</p></aside></section>

    <section className="mt-5 grid gap-3 md:grid-cols-3">{steps.map(([number, title, detail, state]) => <article key={number} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><p className="text-xs font-bold text-brand-700">{number}</p><h2 className="mt-2 font-bold">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p><span className="mt-4 inline-block rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-brand-700">{state}</span></article>)}</section>

  </div></main>;
}

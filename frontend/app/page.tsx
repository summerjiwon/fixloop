import Link from "next/link";

export default function HomePage() {
  return <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16"><p className="font-semibold text-brand">FixLoop</p><h1 className="mt-3 max-w-3xl text-5xl font-bold tracking-tight text-ink">사진으로 시작해, 원격으로 끝내는 운영.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">다지점 공간의 시설 문제를 QR 신고, AI 분석, 사진 검증, 관리자 승인으로 하나의 루프로 관리합니다.</p><div className="mt-10 flex flex-wrap gap-3"><Link href="/report/00000000-0000-0000-0000-000000000001" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">현장 신고 데모</Link><Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-ink">운영 대시보드</Link></div><p className="mt-8 text-sm text-slate-500">로컬 API 기본 주소: http://localhost:8000</p></main>;
}

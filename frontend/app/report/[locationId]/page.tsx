import { ReportForm } from "@/components/report-form";

export default async function ReportPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  return <main className="mx-auto min-h-screen max-w-lg bg-slate-50 px-5 py-10"><p className="text-sm font-semibold text-brand">FixLoop 현장 신고</p><h1 className="mt-2 text-3xl font-bold">문제를 사진으로 알려주세요</h1><p className="mt-3 mb-6 text-slate-600">로그인 없이 접수할 수 있습니다. AI 결과는 확인 후 확정됩니다.</p><ReportForm locationId={locationId} /></main>;
}

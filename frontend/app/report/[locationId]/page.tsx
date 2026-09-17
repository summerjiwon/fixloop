import { ReportForm } from "@/components/report-form";

export default async function ReportPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  return <div className="min-h-screen bg-canvas"><header className="flex h-[60px] items-center justify-between border-b border-slate-100 bg-white px-5"><span className="flex items-center gap-2 text-lg font-bold"><img src="/brand-mark.png" alt="" className="size-7 object-contain" />공간기록</span><span className="text-xs text-slate-500">강남 1호점</span></header><ReportForm locationId={locationId} /></div>;
}

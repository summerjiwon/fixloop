import { ReportStatus } from "@/components/report-status";

export default async function ReportStatusPage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <div className="min-h-screen bg-canvas"><header className="flex h-[60px] items-center justify-between border-b border-slate-100 bg-white px-5"><span className="flex items-center gap-2 text-lg font-bold"><span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">F</span>FixLoop</span><span className="text-xs text-slate-500">신고 확인</span></header><ReportStatus issueId={issueId} /></div>;
}

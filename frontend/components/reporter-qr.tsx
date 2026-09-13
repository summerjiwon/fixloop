"use client";

import { QRCodeSVG } from "qrcode.react";

const demoLocationId = "00000000-0000-0000-0000-000000000001";

export function ReporterQr() {
  const baseUrl = process.env.NEXT_PUBLIC_REPORT_BASE_URL ?? "http://127.0.0.1:3000";
  const reportUrl = `${baseUrl}/report/${demoLocationId}`;

  return <section className="mt-8 rounded-xl bg-white p-5 shadow-sm"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="rounded-lg border bg-white p-3"><QRCodeSVG value={reportUrl} size={156} includeMargin /></div><div><p className="font-semibold text-brand">현장 신고 QR</p><h2 className="mt-1 text-xl font-bold">휴대폰으로 스캔해 갤러리 사진을 등록하세요</h2><p className="mt-2 text-sm leading-6 text-slate-600">사진 한 장만 제출하면 AI가 자동 분석하고 운영 대시보드에 신규 이슈를 생성합니다. 설명은 선택 사항입니다.</p><p className="mt-3 break-all rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">{reportUrl}</p></div></div></section>;
}

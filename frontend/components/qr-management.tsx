"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";

const defaultLocation = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "기본 신고 위치",
  description: "현장 이슈 접수용 QR",
};

const storageKey = "fixloop.qr-inventory.v1";

type QrRecord = {
  id: string;
  placement: string;
  description: string;
  createdAt: string;
  reportUrl: string;
  status: "ACTIVE";
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function QrManagement() {
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<QrRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_REPORT_BASE_URL ?? "";
  const reportUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/report/${defaultLocation.id}`
    : "";

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as QrRecord[];
        if (Array.isArray(parsed)) {
          setRecords(parsed);
          setSelectedId(parsed[0]?.id ?? null);
        }
      }
    } catch {
      setNotice("저장된 QR 목록을 불러오지 못했습니다.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [loaded, records]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0] ?? null,
    [records, selectedId],
  );
  const locationCount = new Set(records.map((record) => record.placement)).size;

  const generate = () => {
    if (!reportUrl) {
      setNotice("신고 페이지 주소가 설정되지 않았습니다. 환경 설정을 확인해 주세요.");
      return;
    }
    const newRecord: QrRecord = {
      id: makeId(),
      placement: placement.trim() || "배포 위치 미지정",
      description: description.trim() || "기본 신고 위치",
      createdAt: new Date().toISOString(),
      reportUrl,
      status: "ACTIVE",
    };
    setRecords((current) => [newRecord, ...current]);
    setSelectedId(newRecord.id);
    setPlacement("");
    setDescription("");
    setNotice(`QR ${records.length + 1}건째를 발급했습니다. 목록에서 배포 위치를 확인할 수 있습니다.`);
  };

  const copyUrl = async () => {
    if (!selectedRecord) return;
    try {
      await navigator.clipboard.writeText(selectedRecord.reportUrl);
      setNotice("신고 URL을 클립보드에 복사했습니다.");
    } catch {
      setNotice("URL 복사에 실패했습니다. 아래 주소를 직접 복사해 주세요.");
    }
  };

  const downloadQr = () => {
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg || !selectedRecord) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fixloop-${selectedRecord.placement.replace(/[^a-zA-Z0-9가-힣]+/g, "-")}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("QR SVG 파일을 다운로드했습니다.");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">QR MANAGEMENT</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-950">현장 신고 QR 관리</h1>
            <p className="mt-2 text-sm text-slate-500">발급한 QR의 배포 위치와 수량을 한곳에서 확인합니다.</p>
          </div>
          <button className="button-primary" onClick={generate} type="button">QR 생성</button>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            { label: "발급 QR", value: records.length, tone: "text-navy-950" },
            { label: "활성 QR", value: records.filter((record) => record.status === "ACTIVE").length, tone: "text-emerald-700" },
            { label: "배포 위치", value: locationCount, tone: "text-brand-600" },
          ].map((item) => (
            <article key={item.label} className="surface-card p-4">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className={`mt-1 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="surface-card p-6">
            <p className="section-kicker">새 QR 발급</p>
            <h2 className="mt-3 text-xl font-extrabold text-navy-950">{defaultLocation.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{defaultLocation.description}</p>
            <label className="mt-6 block text-sm font-bold text-slate-700">
              QR 배포 위치
              <input value={placement} onChange={(event) => setPlacement(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" placeholder="예: 본관 1층 안내데스크" />
            </label>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              위치 설명 <span className="font-normal text-slate-400">(선택)</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" placeholder="예: 방문객 입구 오른쪽" />
            </label>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-700">연결 신고 위치</p>
              <p className="mt-1 leading-6">모든 발급 QR은 현재 등록된 기본 신고 위치로 연결되며, 위 입력값은 실물 QR의 배포 위치를 관리하기 위한 정보입니다.</p>
            </div>
            <button className="button-primary mt-6 w-full" onClick={generate} type="button">위치 정보와 함께 QR 생성</button>
          </div>

          <div className="surface-card min-h-[440px] p-6 sm:p-8">
            {selectedRecord ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="status-chip bg-emerald-50 text-emerald-700">활성 QR</span>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" ref={qrContainerRef}>
                  <QRCodeSVG includeMargin level="M" size={220} value={selectedRecord.reportUrl} />
                </div>
                <p className="mt-5 text-base font-extrabold text-navy-950">{selectedRecord.placement}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedRecord.description}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(selectedRecord.createdAt).toLocaleString("ko-KR")} 발급</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button className="button-secondary" onClick={copyUrl} type="button">URL 복사</button>
                  <button className="button-primary" onClick={downloadQr} type="button">SVG 다운로드</button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-2xl font-extrabold text-teal-700">QR</div>
                <h2 className="mt-5 text-xl font-extrabold text-navy-950">발급 QR이 없습니다</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">배포 위치를 적고 QR을 생성하면 이 화면과 아래 목록에서 언제든 확인할 수 있습니다.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between bg-mist px-5 py-4">
            <div><h2 className="font-extrabold text-navy-950">발급 QR 목록</h2><p className="mt-1 text-xs text-slate-500">항목을 선택하면 해당 QR을 다시 확인하고 다운로드할 수 있습니다.</p></div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{records.length}건</span>
          </div>
          {records.length > 0 ? records.map((record, index) => (
            <button key={record.id} onClick={() => setSelectedId(record.id)} className={`grid w-full gap-3 border-t border-slate-100 px-5 py-4 text-left transition hover:bg-teal-50/40 lg:grid-cols-[70px_minmax(200px,2fr)_1fr_130px_90px] lg:items-center ${selectedRecord?.id === record.id ? "bg-teal-50/50" : ""}`} type="button">
              <span className="text-sm font-extrabold text-brand-700">QR-{String(records.length - index).padStart(3, "0")}</span>
              <span><span className="block font-bold text-navy-950">{record.placement}</span><span className="mt-1 block text-xs text-slate-500">{record.description}</span></span>
              <span className="text-sm text-slate-600">{defaultLocation.name}</span>
              <span className="text-xs text-slate-500">{new Date(record.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="status-chip w-fit bg-emerald-50 text-emerald-700">활성</span>
            </button>
          )) : <div className="p-10 text-center"><p className="font-bold text-navy-950">아직 발급 이력이 없습니다.</p><p className="mt-2 text-sm text-slate-500">첫 QR을 생성하면 배포 위치와 함께 이 목록에 추가됩니다.</p></div>}
        </section>

        {notice && <p className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{notice}</p>}
      </div>
    </AppShell>
  );
}

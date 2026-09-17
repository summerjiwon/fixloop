"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "이슈 관리" },
  { href: "/insights", label: "인사이트" },
  { href: "/qr", label: "QR 관리" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const syncClock = () => setNow(new Date());
    syncClock();
    const timer = window.setInterval(syncClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const liveTime = now
    ? `${now.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" })} ${now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`
    : "시간 동기화 중";
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-950 px-5 py-7 text-white lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-bold">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm">F</span>
          FixLoop
        </Link>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.12em] text-teal-100/80">CENTRAL CITY · 8개 지점</p>
        <nav className="mt-5 space-y-2">
          {navigation.map((item, index) => {
            const active = index === 0 ? pathname === "/dashboard" : pathname.startsWith(item.href) && item.href !== "/dashboard";
            return (
              <Link key={`${item.label}-${index}`} href={item.href} className={`flex h-11 items-center justify-between rounded-xl px-3.5 text-sm font-semibold transition ${active ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5"}`}>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="text-sm font-bold">김민준 운영 매니저</p>
          <p className="mt-1 text-xs text-teal-100">오늘 09:42 동기화</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold"><span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">F</span>FixLoop</Link>
          <nav className="flex gap-3 text-sm font-semibold"><Link href="/dashboard">이슈</Link><Link href="/insights">인사이트</Link></nav>
        </header>
        {children}
      </div>
      <div aria-live="polite" className="fixed bottom-4 right-4 z-40 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-right shadow-card backdrop-blur">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Live time</p>
        <time className="mt-0.5 block text-xs font-bold tabular-nums text-slate-700">{liveTime}</time>
      </div>
    </div>
  );
}

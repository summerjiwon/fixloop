import { OperationsDemo } from "@/components/operations-demo";
import { Suspense } from "react";

export default function OperationsDemoPage() {
  return <Suspense fallback={<main className="min-h-screen bg-canvas p-8 text-slate-500">운영 화면을 불러오는 중…</main>}><OperationsDemo /></Suspense>;
}

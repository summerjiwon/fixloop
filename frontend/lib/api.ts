export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "VERIFYING" | "RESOLVED";

export type Analysis = {
  asset: string;
  issue_type: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: number;
};

export type Issue = {
  id: string;
  location_id: string;
  area: string;
  title: string;
  description: string;
  category: string;
  asset_name: string;
  severity: Severity;
  status: IssueStatus;
  ai_confidence: number;
  operator_comment: string;
  created_at: string;
  resolved_at?: string | null;
  images?: { id: string; image_url: string; type: "BEFORE" | "AFTER"; created_at: string }[];
  similar_issues?: { issue_id: string; title: string; severity: Severity; status: IssueStatus; similarity: number }[];
  verification?: {
    same_asset: boolean;
    visible_issue_resolved: boolean;
    confidence: number;
    reason: string;
    limitations: string[];
    created_at: string;
  } | null;
};

export type Insights = {
  period_days: number;
  total_issues: number;
  by_location: Record<string, number>;
  by_category: Record<string, number>;
  insights: { kind: string; title: string; detail: string; metric: string }[];
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const authRequired = process.env.NEXT_PUBLIC_AUTH_REQUIRED === "true";

async function request<T>(path: string, init?: RequestInit, admin = false): Promise<T> {
  const headers = new Headers(init?.headers);
  if (admin && authRequired) {
    const { supabase } = await import("@/lib/supabase");
    const sessionResult = supabase ? await supabase.auth.getSession() : null;
    const token = sessionResult?.data.session?.access_token;
    if (!token) throw new Error("관리자 로그인이 필요합니다.");
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store", ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "요청을 처리하지 못했습니다.");
  }
  return response.json() as Promise<T>;
}

export async function analyzeReport(locationId: string, image: File, reporterText: string) {
  const form = new FormData();
  form.set("location_id", locationId);
  form.set("reporter_text", reporterText);
  form.set("image", image);
  return request<{ draft_id: string; analysis: Analysis }>("/api/reports/analyze", { method: "POST", body: form });
}

export async function submitReport(locationId: string, image: File, reporterText: string) {
  const form = new FormData();
  form.set("location_id", locationId);
  form.set("reporter_text", reporterText);
  form.set("image", image);
  return request<Issue>("/api/reports", { method: "POST", body: form });
}

export const confirmReport = (draftId: string) => request<Issue>(`/api/reports/${draftId}/confirm`, { method: "POST" }, true);
export const listIssues = (status?: IssueStatus) => request<Issue[]>(`/api/issues${status ? `?status_filter=${status}` : ""}`, undefined, true);
export const getIssue = (id: string) => request<Issue>(`/api/issues/${id}`, undefined, true);
export const changeStatus = (id: string, status: IssueStatus) => request<Issue>(`/api/issues/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }, true);
export const addAfterImage = (id: string, image: File) => { const form = new FormData(); form.set("image", image); return request<Issue>(`/api/issues/${id}/after`, { method: "POST", body: form }, true); };
export const verifyIssue = (id: string) => request<Issue>(`/api/issues/${id}/verify`, { method: "POST" }, true);
export const resolveIssue = (id: string) => request<Issue>(`/api/issues/${id}/resolve`, { method: "POST" }, true);
export const getInsights = () => request<Insights>("/api/insights", undefined, true);

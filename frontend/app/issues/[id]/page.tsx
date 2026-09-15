import { IssueDetailPanel } from "@/components/issue-detail";
import { AdminAccess } from "@/components/admin-access";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AdminAccess><IssueDetailPanel issueId={id} /></AdminAccess>; }

import { AdminAccess } from "@/components/admin-access";
import { QrManagement } from "@/components/qr-management";

export default function QrPage() {
  return (
    <AdminAccess>
      <QrManagement />
    </AdminAccess>
  );
}

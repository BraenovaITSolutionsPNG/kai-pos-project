import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformAdmin } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePlatformAdmin();

  return (
    <AdminShell
      userName={user.full_name ?? user.email}
      userEmail={user.email}
    >
      {children}
    </AdminShell>
  );
}
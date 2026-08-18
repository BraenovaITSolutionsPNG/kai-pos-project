import { AppShell } from "@/components/app-shell";
import { getSessionContext } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();

  return (
    <AppShell
      restaurantName={ctx.restaurant.name}
      userName={ctx.user.full_name ?? ctx.user.email}
      userRole={ctx.staff.role}
      userEmail={ctx.user.email}
      isPlatformAdmin={Boolean(ctx.user.is_platform_admin)}
    >
      {children}
    </AppShell>
  );
}
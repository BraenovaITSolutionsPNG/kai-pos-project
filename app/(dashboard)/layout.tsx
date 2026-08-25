import { AppShell } from "@/components/app-shell";
import { getSessionContext } from "@/lib/queries";
import type { PlanName } from "@/lib/plans";

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
      plan={ctx.business?.plan as PlanName}
      isPlatformAdmin={Boolean(ctx.user.is_platform_admin)}
    >
      {children}
    </AppShell>
  );
}
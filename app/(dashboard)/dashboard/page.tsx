import { getDashboardStats, getNotifications } from "@/lib/queries";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { NotificationsBanner } from "@/components/dashboard/notifications-banner";

export default async function DashboardPage() {
  const [stats, notifications] = await Promise.all([
    getDashboardStats(),
    getNotifications(),
  ]);

  return (
    <div className="space-y-6">
      <NotificationsBanner notifications={notifications} />
      <DashboardView initialStats={stats} />
    </div>
  );
}

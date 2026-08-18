import type { Metadata } from "next";
import { UsersClient } from "@/components/admin/users-client";
import { getAdminUsers } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Users",
};

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return <UsersClient users={users} />;
}
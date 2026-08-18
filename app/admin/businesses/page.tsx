import type { Metadata } from "next";
import { BusinessesClient } from "@/components/admin/businesses-client";
import { getAdminBusinesses } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Businesses",
};

export default async function AdminBusinessesPage() {
  const businesses = await getAdminBusinesses();

  return <BusinessesClient businesses={businesses} />;
}
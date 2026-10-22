"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatKina, formatDateTime } from "@/lib/format";
import type { RestaurantWithStats } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Building2, ShoppingBag, Wallet, Users, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

interface OwnerClientProps {
  businessName: string;
  initialRestaurants: RestaurantWithStats[];
}

export function OwnerClient({ businessName, initialRestaurants }: OwnerClientProps) {
  const router = useRouter();
  const [restaurants] = useState<RestaurantWithStats[]>(initialRestaurants);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totalOrders = restaurants.reduce((sum, r) => sum + r.today_orders, 0);
  const totalRevenue = restaurants.reduce((sum, r) => sum + r.today_revenue, 0);
  const totalActiveShifts = restaurants.reduce((sum, r) => sum + r.active_shifts, 0);

  const switchToRestaurant = (restaurantId: string) => {
    router.push(`/dashboard?restaurant=${restaurantId}`);
  };

  const refresh = () => {
    router.refresh();
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {businessName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-branch overview — {restaurants.length} location{restaurants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <Loader2 className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restaurants.length}</div>
            <p className="text-xs text-muted-foreground">Active locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Across all branches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Revenue</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKina(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Paid orders only</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveShifts}</div>
            <p className="text-xs text-muted-foreground">Staff currently clocked in</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : restaurants.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No branches found for this business.
            </div>
          ) : (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Orders Today</TableHead>
                    <TableHead className="text-right">Revenue Today</TableHead>
                    <TableHead className="text-right">Active Shifts</TableHead>
                    <TableHead className="text-right">Avg/Order</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(r.id)}
                          className="h-8 w-8"
                        >
                          {expanded[r.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right font-mono">{r.today_orders}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatKina(r.today_revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.active_shifts > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            {r.active_shifts} active
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.today_orders > 0
                          ? formatKina(r.today_revenue / r.today_orders)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => switchToRestaurant(r.id)}
                        >
                          <ArrowRight className="mr-1 h-3.5 w-3.5" />
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {restaurants.some((r) => expanded[r.id]) && (
                <div className="mt-4 space-y-2 border-t pt-4">
                  {restaurants
                    .filter((r) => expanded[r.id])
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border bg-muted/50 p-4 text-sm"
                      >
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Address</p>
                            <p>{r.address || "Not set"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Currency</p>
                            <p>{r.currency}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Created</p>
                            <p>{formatDateTime(r.created_at)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Branch ID</p>
                            <p className="font-mono text-xs">{r.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
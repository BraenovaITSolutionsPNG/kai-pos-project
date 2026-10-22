"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKina, formatDateTime } from "@/lib/format";
import type { Customer, LoyaltyTransaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Plus, Edit, Loader2, Award, Coins, ArrowUp, ArrowDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoyaltySettings {
  loyalty_enabled: boolean;
  loyalty_points_per_kina: number;
  loyalty_kina_per_point: number;
  loyalty_min_points_redeem: number;
}

interface LoyaltyClientProps {
  restaurantId: string;
}

export function LoyaltyClient({ restaurantId }: LoyaltyClientProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings>({
    loyalty_enabled: false,
    loyalty_points_per_kina: 1,
    loyalty_kina_per_point: 1,
    loyalty_min_points_redeem: 100,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "redeem" | "adjust" | "settings">("add");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [custRes, transRes, setRes] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("loyalty_points", { ascending: false }),
      supabase
        .from("loyalty_transactions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("restaurants")
        .select("loyalty_enabled, loyalty_points_per_kina, loyalty_kina_per_point, loyalty_min_points_redeem")
        .eq("id", restaurantId)
        .single(),
    ]);
    if (custRes.data) setCustomers(custRes.data as unknown as Customer[]);
    if (transRes.data) setTransactions(transRes.data as unknown as LoyaltyTransaction[]);
    if (setRes.data) setSettings(setRes.data as unknown as LoyaltySettings);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadData();
  }, [loadData]);

  const openDialog = (mode: "add" | "redeem" | "adjust" | "settings", customer?: Customer) => {
    setDialogMode(mode);
    setSelectedCustomer(customer ?? null);
    setPoints("");
    setDescription("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!points || Number(points) <= 0) return;
    if (dialogMode !== "settings" && !selectedCustomer) return;

    setBusy(true);
    const supabase = createClient();
    const pts = Number(points);

    try {
      if (dialogMode === "add") {
        const { error } = await supabase.rpc("adjust_loyalty_points", {
          p_customer_id: selectedCustomer!.id,
          p_points: pts,
          p_description: description || "Manual bonus",
        });
        if (error) throw error;
        toast.success(`${pts} points added to ${selectedCustomer!.name}`);
      } else if (dialogMode === "redeem") {
        const { data, error } = await supabase.rpc("redeem_loyalty_points", {
          p_customer_id: selectedCustomer!.id,
          p_points: pts,
          p_description: description || "Redemption",
        });
        if (error) throw error;
        if (!data) throw new Error("Insufficient points or below minimum");
        toast.success(`${pts} points redeemed for ${selectedCustomer!.name}`);
      } else if (dialogMode === "adjust") {
        const { error } = await supabase.rpc("adjust_loyalty_points", {
          p_customer_id: selectedCustomer!.id,
          p_points: pts,
          p_description: description || "Manual adjustment",
        });
        if (error) throw error;
        toast.success(`Points adjusted for ${selectedCustomer!.name}`);
      } else if (dialogMode === "settings") {
        const { error } = await supabase
          .from("restaurants")
          .update({
            loyalty_enabled: settings.loyalty_enabled,
            loyalty_points_per_kina: Number(settings.loyalty_points_per_kina),
            loyalty_kina_per_point: Number(settings.loyalty_kina_per_point),
            loyalty_min_points_redeem: Number(settings.loyalty_min_points_redeem),
          })
          .eq("id", restaurantId);
        if (error) throw error;
        toast.success("Loyalty settings saved");
      }
      closeDialog();
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await handleSubmit(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const totalPoints = customers.reduce((sum, c) => sum + c.loyalty_points, 0);
  const activeCustomers = customers.filter((c) => c.loyalty_points > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-500" />
            Loyalty Program
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage customer loyalty points and rewards
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openDialog("settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button onClick={() => openDialog("add")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Points
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
            <p className="text-xs text-muted-foreground">Customers with points</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">Registered customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Program Status</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                settings.loyalty_enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              )}>
                {settings.loyalty_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => openDialog("add")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Points
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No customers found.
            </div>
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.phone && <div>{c.phone}</div>}
                        {c.email && <div>{c.email}</div>}
                        {!c.phone && !c.email && <span>—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-amber-600">
                        {c.loyalty_points.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatKina(c.loyalty_points * settings.loyalty_kina_per_point)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDateTime(c.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog("add", c)}
                            className="h-8 w-8"
                            title="Add points"
                          >
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog("redeem", c)}
                            disabled={c.loyalty_points < settings.loyalty_min_points_redeem}
                            className="h-8 w-8"
                            title="Redeem points"
                          >
                            <ArrowDown className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog("adjust", c)}
                            className="h-8 w-8"
                            title="Adjust points"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No loyalty transactions yet.
            </div>
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const customer = customers.find((c) => c.id === t.customer_id);
                    const isPositive = t.points > 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{formatDateTime(t.created_at)}</TableCell>
                        <TableCell className="font-medium">
                          {customer?.name ?? t.customer_id.slice(0, 8) + "..."}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            t.type === "earned" && "bg-green-100 text-green-800",
                            t.type === "redeemed" && "bg-blue-100 text-blue-800",
                            t.type === "adjusted" && "bg-amber-100 text-amber-800",
                            t.type === "bonus" && "bg-purple-100 text-purple-800",
                            t.type === "expired" && "bg-red-100 text-red-800"
                          )}>
                            {isPositive ? (
                              <>
                                <ArrowUp className="mr-1 h-3 w-3" />
                                {t.type}
                              </>
                            ) : (
                              <>
                                <ArrowDown className="mr-1 h-3 w-3" />
                                {t.type}
                              </>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {isPositive ? "+" : ""}{t.points.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {t.balance_after.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {t.description || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Redeem/Adjust Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "settings"
                ? "Loyalty Settings"
                : dialogMode === "add"
                ? "Add Points"
                : dialogMode === "redeem"
                ? "Redeem Points"
                : "Adjust Points"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "settings"
                ? "Configure how customers earn and redeem points"
                : dialogMode === "add"
                ? `Add loyalty points for ${selectedCustomer?.name}`
                : dialogMode === "redeem"
                ? `Redeem points for ${selectedCustomer?.name} (min ${settings.loyalty_min_points_redeem} points)`
                : `Adjust points for ${selectedCustomer?.name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={dialogMode === "settings" ? saveSettings : handleSubmit} className="space-y-4">
            {dialogMode === "settings" ? (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Input
                      type="checkbox"
                      checked={settings.loyalty_enabled}
                      onChange={(e) => setSettings((s) => ({ ...s, loyalty_enabled: e.target.checked }))}
                    />
                    Enable Loyalty Program
                  </Label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="points_per_kina">Points per Kina spent</Label>
                    <Input
                      id="points_per_kina"
                      type="number"
                      step="0.1"
                      min="0"
                      value={settings.loyalty_points_per_kina}
                      onChange={(e) => setSettings((s) => ({ ...s, loyalty_points_per_kina: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kina_per_point">Kina value per point</Label>
                    <Input
                      id="kina_per_point"
                      type="number"
                      step="0.01"
                      min="0"
                      value={settings.loyalty_kina_per_point}
                      onChange={(e) => setSettings((s) => ({ ...s, loyalty_kina_per_point: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_points">Minimum points to redeem</Label>
                  <Input
                    id="min_points"
                    type="number"
                    min="0"
                    value={settings.loyalty_min_points_redeem}
                    onChange={(e) => setSettings((s) => ({ ...s, loyalty_min_points_redeem: Number(e.target.value) || 0 }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="points">Points</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Birthday bonus, Order #1234"
                  />
                </div>
                {dialogMode === "redeem" && selectedCustomer && (
                  <div className="rounded-lg border bg-amber-50 p-3 text-amber-800 text-sm">
                    Available: <strong>{selectedCustomer.loyalty_points.toLocaleString()}</strong> points
                    ({formatKina(selectedCustomer.loyalty_points * settings.loyalty_kina_per_point)} value)
                  </div>
                )}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || savingSettings}>
                {busy || savingSettings ? "Saving…" : dialogMode === "settings" ? "Save Settings" : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
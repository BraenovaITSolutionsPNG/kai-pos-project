"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKina, formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Plus, Users, Phone, Mail, Clock, CheckCircle, XCircle, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  tables?: { label: string } | null;
}

interface TableOption {
  id: string;
  label: string;
  capacity: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-orange-100 text-orange-800",
};

export function ReservationsClient({
  restaurantId,
  tables,
}: {
  restaurantId: string;
  tables: TableOption[];
}) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    party_size: "2",
    reservation_date: new Date().toISOString().slice(0, 10),
    reservation_time: "19:00",
    duration_minutes: "90",
    table_id: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select("*, tables(label)")
      .eq("restaurant_id", restaurantId)
      .eq("reservation_date", selectedDate)
      .order("reservation_time", { ascending: true });
    if (data) setReservations(data as unknown as Reservation[]);
    setLoading(false);
  }, [restaurantId, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("reservations").insert({
      restaurant_id: restaurantId,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      party_size: Number(form.party_size),
      reservation_date: form.reservation_date,
      reservation_time: form.reservation_time,
      duration_minutes: Number(form.duration_minutes),
      table_id: form.table_id || null,
      notes: form.notes || null,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reservation created");
    setShowForm(false);
    setForm({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      party_size: "2",
      reservation_date: selectedDate,
      reservation_time: "19:00",
      duration_minutes: "90",
      table_id: "",
      notes: "",
    });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated");
    load();
  }

  const todayReservations = reservations.filter((r) => r.reservation_date === selectedDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="size-6" />
            Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage table reservations
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4" />
          New Reservation
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-48"
        />
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Reservation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Party Size</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.party_size}
                    onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.reservation_date}
                    onChange={(e) => setForm({ ...form, reservation_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={form.reservation_time}
                    onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Table</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.table_id}
                  onChange={(e) => setForm({ ...form, table_id: e.target.value })}
                >
                  <option value="">No specific table</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} (cap: {t.capacity})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Creating..." : "Create Reservation"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : todayReservations.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No reservations for this date</p>
      ) : (
        <div className="space-y-3">
          {todayReservations.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.customer_name}</span>
                    <Badge className={STATUS_COLORS[r.status] || "bg-gray-100"}>
                      {r.status}
                    </Badge>
                    {r.tables?.label && (
                      <Badge variant="outline">Table {r.tables.label}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {r.reservation_time.slice(0, 5)} ({r.duration_minutes}min)
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {r.party_size} guests
                    </span>
                    {r.customer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {r.customer_phone}
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                </div>
                <div className="flex gap-2">
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "confirmed")}>
                      <CheckCircle className="size-4" />
                      Confirm
                    </Button>
                  )}
                  {r.status === "confirmed" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "seated")}>
                      <UserCheck className="size-4" />
                      Seat
                    </Button>
                  )}
                  {r.status === "seated" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "completed")}>
                      <CheckCircle className="size-4" />
                      Complete
                    </Button>
                  )}
                  {!["completed", "cancelled", "no_show"].includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "cancelled")}>
                      <XCircle className="size-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


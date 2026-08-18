"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export function NotificationsBanner({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  const [items, setItems] = useState(notifications);
  const [busy, setBusy] = useState(false);
  const unread = items.filter((n) => !n.read_at);

  if (unread.length === 0) return null;

  async function markRead() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("mark_notifications_read");
    setBusy(false);
    if (error) return;
    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          {unread.slice(0, 5).map((n) => (
            <div key={n.id} className="text-sm">
              <p>{n.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {unread.length > 5 && (
            <p className="text-xs text-muted-foreground">
              +{unread.length - 5} more
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button size="sm" variant="outline" onClick={() => void markRead()} disabled={busy}>
            {busy ? "Marking…" : "Mark all read"}
          </Button>
          {unread.some((n) => n.link) && (
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/settings" />}>
              View plan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
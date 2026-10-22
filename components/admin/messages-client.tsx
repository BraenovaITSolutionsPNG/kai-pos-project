"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "archived";
  created_at: string;
}

interface MessagesClientProps {
  initialMessages: ContactMessage[];
}

export function MessagesClient({ initialMessages }: MessagesClientProps) {
  const [messages, setMessages] = useState<ContactMessage[]>(initialMessages);
  const supabase = createClient();

  async function handleRead(id: string) {
    const { error } = await supabase
      .from("messages")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "read" } : m))
      );
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  }

  return (
    <section className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Inquiries and messages submitted through the website contact form.
          </p>
        </div>
        <Badge variant="outline">{messages.length} messages</Badge>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No messages received yet.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <a href={`mailto:${m.email}`} className="text-primary hover:underline">
                      {m.email}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">{m.subject}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {m.message}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === "new" ? "default" : "secondary"}>
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {m.status !== "read" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRead(m.id)}
                      >
                        Mark Read
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(m.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
export default MessagesClient;
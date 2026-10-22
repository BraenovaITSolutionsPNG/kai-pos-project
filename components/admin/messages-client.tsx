"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Eye, Trash2, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessagesClientProps {
  messages: Message[];
}

export function MessagesClient({ messages: initialMessages }: MessagesClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={cn(
        status === "new" && "bg-blue-100 text-blue-800",
        status === "read" && "bg-green-100 text-green-800",
        status === "archived" && "bg-gray-100 text-gray-800"
      )}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  async function updateStatus(messageId: string, newStatus: "read" | "archived") {
    const supabase = createClient();
    const updates: { status: string; read_at?: string } = { status: newStatus };
    if (newStatus === "read") {
      updates.read_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("messages")
      .update(updates)
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    toast.success(`Message marked as ${newStatus}`);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: newStatus, read_at: newStatus === "read" ? new Date().toISOString() : m.read_at } : m
      )
    );
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("messages").delete().eq("id", messageId);

    if (error) {
      toast.error("Failed to delete message");
      return;
    }

    toast.success("Message deleted");
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setViewDialogOpen(false);
  }

  function openView(message: Message) {
    setSelectedMessage(message);
    setViewDialogOpen(true);
    if (message.status === "new") {
      updateStatus(message.id, "read");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Contact form submissions from the website
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
            New: {messages.filter((m) => m.status === "new").length}
          </Badge>
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
            Read: {messages.filter((m) => m.status === "read").length}
          </Badge>
          <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">
            Archived: {messages.filter((m) => m.status === "archived").length}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No messages yet.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message) => (
                <TableRow key={message.id} className={cn(message.status === "new" && "bg-blue-50/50")}>
                  <TableCell>
                    <Mail className={cn("size-4 mx-auto", message.status === "new" && "text-blue-600", message.status !== "new" && "text-muted-foreground")} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{message.name}</p>
                    <p className="text-sm text-muted-foreground">{message.email}</p>
                    {message.restaurant && (
                      <p className="text-xs text-muted-foreground">From: {message.restaurant.name}</p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{message.subject}</TableCell>
                  <TableCell>{getStatusBadge(message.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(message.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openView(message)}
                        className="h-8 w-8"
                        title="View"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {message.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateStatus(message.id, "archived")}
                          className="h-8 w-8"
                          title="Archive"
                        >
                          <Archive className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMessage(message.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
            <DialogDescription>
              From {selectedMessage?.name} <{selectedMessage?.email}> · {formatDateTime(selectedMessage?.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted p-4 whitespace-pre-wrap text-sm">
              {selectedMessage?.message}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Status: </span>
              {getStatusBadge(selectedMessage?.status ?? "new")}
              {selectedMessage?.restaurant && (
                <>
                  <span className="mx-1">|</span>
                  <span>Restaurant: {selectedMessage.restaurant.name}</span>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            {selectedMessage?.status !== "archived" && (
              <Button variant="outline" onClick={() => updateStatus(selectedMessage!.id, "archived")}>
                <Archive className="mr-2 size-4" />
                Archive
              </Button>
            )}
            <Button variant="destructive" onClick={() => deleteMessage(selectedMessage!.id)}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
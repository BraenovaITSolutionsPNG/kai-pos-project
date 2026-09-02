"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { assertAccess } from "@/lib/permissions";

export default function AdminMessagesPage() {
  assertAccess(role, "/messages", "professional"); // will refine

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from("public.messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessages([]);
    } else {
      setMessages(data);
    }
    setLoading(false);
  }

  async function handleRead(id: string) {
    await supabase.from("public.messages").update({ status: "read", read_at: new Date() }).eq("id", id);
    fetchMessages();
  }

  async function handleDelete(id: string) {
    await supabase.from("public.messages").delete().eq("id", id);
    fetchMessages();
  }

  if (loading) return <p>Loading messages…</p>;

  return (
    <section className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <h1 className="font-heading text-2xl font-semibold mb-6">Messages</h1>

      <Table
        columns={[
          { accessorKey: "id", header: "ID" },
          { accessorKey: "name", header: "Name" },
          { accessorKey: "email", header: "Email" },
          { accessorKey: "subject", header: "Subject" },
          { accessorKey: "status", header: "Status" },
          { accessorKey: "created_at", header: "Date" },
          { accessorKey: "actions", header: "Actions" },
        ]}
        data={messages}
      >
        {({ row }) => (
          <tr>
            <td>{row.id}</td>
            <td>{row.name}</td>
            <td>{row.email}</td>
            <td>{row.subject}</td>
            <td>
              {row.status === "read" ? "Read" : <span className="text-primary">Unread</span>}
            </td>
            <td>{new Date(row.created_at).toLocaleDateString()}</td>
            <td>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRead(row.id)}
              >
                Mark Read
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(row.id)}
              >
                Delete
              </Button>
            </td>
          </tr>
        )}
      </Table>
    </section>
  );
}
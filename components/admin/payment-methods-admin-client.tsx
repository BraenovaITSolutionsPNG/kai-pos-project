"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Trash2, Plus, X, Loader2 } from "lucide-react";

interface PaymentMethod {
  name: string;
  logo_url: string | null;
}

export function PaymentMethodsAdminClient() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadMethods();
  }, []);

  async function loadMethods() {
    setLoading(true);
    const { data } = await supabase
      .from("site_content")
      .select("value")
      .eq("key", "payment_methods")
      .single();
    if (data?.value) {
      setMethods(data.value as PaymentMethod[]);
    } else {
      // Default methods
      setMethods([
        { name: "BSP", logo_url: null },
        { name: "Kina Bank", logo_url: null },
        { name: "ANZ", logo_url: null },
        { name: "Westpac", logo_url: null },
        { name: "EFTPOS", logo_url: null },
        { name: "Cash", logo_url: null },
      ]);
    }
    setLoading(false);
  }

  async function saveMethods(updated: PaymentMethod[]) {
    setMethods(updated);
    const { error } = await supabase
      .from("site_content")
      .upsert({ key: "payment_methods", value: updated }, { onConflict: "key" });
    if (error) {
      toast.error(error.message);
    }
  }

  async function handleUpload(file: File, methodName: string) {
    setUploading(methodName);
    const ext = file.name.split(".").pop();
    const path = `payment-methods/${methodName.toLowerCase().replace(/\\s+/g, "-")}.${ext}`;
    const { error } = await supabase.storage
      .from("payment-method-logos")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      setUploading(null);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("payment-method-logos")
      .getPublicUrl(path);
    const updated = methods.map((m) =>
      m.name === methodName ? { ...m, logo_url: urlData.publicUrl } : m
    );
    await saveMethods(updated);
    toast.success("Logo uploaded");
    setUploading(null);
  }

  async function handleRemove(methodName: string) {
    const updated = methods.filter((m) => m.name !== methodName);
    await saveMethods(updated);
    toast.success("Payment method removed");
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    if (methods.some((m) => m.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error("Already exists");
      return;
    }
    const updated = [...methods, { name: newName.trim(), logo_url: null }];
    await saveMethods(updated);
    setNewName("");
    toast.success("Payment method added");
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="size-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Payment Methods
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage payment method logos shown on the landing page
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. BSP, ANZ, Cash"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {methods.map((m) => (
          <Card key={m.name}>
            <CardContent className="flex flex-col items-center gap-3 p-4">
              <div className="flex h-16 w-full items-center justify-center rounded-lg border bg-muted/30">
                {m.logo_url ? (
                  <img src={m.logo_url} alt={m.name} className="h-12 object-contain" />
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground">{m.name}</span>
                )}
              </div>
              <p className="font-medium">{m.name}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading === m.name}
                  onClick={() => {
                    setUploadTarget(m.name);
                    fileInputRef.current?.click();
                  }}
                >
                  {uploading === m.name ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload Logo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => handleRemove(m.name)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTarget) {
            handleUpload(file, uploadTarget);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}


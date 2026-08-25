"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Promo {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export function PromotionsClient({
  restaurantId,
  initialPromotions,
}: {
  restaurantId: string;
  initialPromotions: Promo[];
}) {
  const [promos, setPromos] = useState<Promo[]>(initialPromotions);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("promotions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");
    setPromos((data as Promo[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setSortOrder(promos.length);
    setIsActive(true);
  }

  function startEdit(p: Promo) {
    setEditing(p);
    setTitle(p.title);
    setSubtitle(p.subtitle ?? "");
    setImageUrl(p.image_url ?? "");
    setSortOrder(p.sort_order);
    setIsActive(p.is_active);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json?.data?.url) {
        setImageUrl(json.data.url);
        toast.success("Image uploaded");
      } else {
        toast.error(json?.error?.message ?? "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const supabase = createClient();
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      image_url: imageUrl || null,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    };
    if (editing) {
      await supabase.from("promotions").update(payload).eq("id", editing.id);
      toast.success("Promotion updated");
    } else {
      await supabase
        .from("promotions")
        .insert({ ...payload, restaurant_id: restaurantId });
      toast.success("Promotion added");
    }
    resetForm();
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this promotion?")) return;
    const supabase = createClient();
    await supabase.from("promotions").delete().eq("id", id);
    toast.success("Promotion deleted");
    load();
  }

  async function toggle(p: Promo) {
    const supabase = createClient();
    await supabase
      .from("promotions")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Promotions
        </h1>
        <p className="mt-1 text-muted-foreground">
          Slides shown in the banner on your digital menu. Add a title, an
          optional subtitle, and an image. Inactive or image-less slides show a
          placeholder until you add one.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? "Edit Promotion" : "Add Promotion"}
          </CardTitle>
          <CardDescription>
            {editing
              ? "Update this slide."
              : "Create a new slide for the menu banner."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="promo-title">Title</Label>
            <Input
              id="promo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Today's Specials"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promo-subtitle">Subtitle</Label>
            <textarea
              id="promo-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Ask your waiter for the chef's recommendations"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promo-image">Image</Label>
            <div className="flex items-center gap-3">
              <Input
                id="promo-image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && (
                <span className="text-xs text-muted-foreground">Uploading...</span>
              )}
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Preview"
                className="h-24 w-full rounded-md object-cover"
              />
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="promo-sort">Sort order</Label>
              <Input
                id="promo-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              Active (visible on menu)
            </label>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={uploading}>
              {editing ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" /> Update
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Add Promotion
                </>
              )}
            </Button>
            {editing && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-lg font-semibold">Current Slides</h2>
        {promos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No promotions yet. The menu shows placeholder slides until you add
            some.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promos.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <div className="relative h-44 w-full bg-gradient-to-r from-slate-700 to-slate-900">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/70">
                      <ImagePlus className="mr-1.5 h-4 w-4" /> No image yet
                    </div>
                  )}
                  {!p.is_active && (
                    <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      Hidden
                    </span>
                  )}
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-tight">{p.title}</h3>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {p.subtitle && (
                    <p className="text-sm text-muted-foreground">{p.subtitle}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(p)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggle(p)}
                    >
                      {p.is_active ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(p.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

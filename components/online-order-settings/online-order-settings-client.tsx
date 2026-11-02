"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, ExternalLink, QrCode, Share2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function OnlineOrderSettingsClient({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://kai-pos-project.vercel.app";
  const orderUrl = `${baseUrl}/order/${restaurantId}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function shareUrl() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurantName} - Online Order`,
          text: `Order online from ${restaurantName}`,
          url: orderUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      copyUrl();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Globe className="size-6" />
          Online Ordering
        </h1>
        <p className="text-sm text-muted-foreground">
          Share your online ordering link with customers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Online Order Link</CardTitle>
          <CardDescription>
            Share this link with customers to let them order online
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Restaurant</Label>
            <p className="text-sm font-medium">{restaurantName}</p>
          </div>

          <div className="space-y-2">
            <Label>Order URL</Label>
            <div className="flex gap-2">
              <Input value={orderUrl} readOnly className="font-mono text-sm" />
              <Button onClick={copyUrl} variant="outline">
                <Copy className="size-4" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={shareUrl} variant="outline">
              <Share2 className="size-4" />
              Share
            </Button>
            <Button variant="outline" onClick={() => window.open(orderUrl, "_blank")}>
              <ExternalLink className="size-4" />
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Share</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. <strong>Copy the link</strong> above and share it via WhatsApp, Facebook, or SMS</p>
          <p>2. <strong>Print a QR code</strong> - use any free QR code generator with your order URL</p>
          <p>3. <strong>Add to your website</strong> - embed the link as a button on your restaurant website</p>
          <p>4. <strong>Social media</strong> - post the link on your Facebook/Instagram page</p>
          <p className="text-xs mt-4">
            Customers who visit the link can browse your menu, add items to cart, and place orders without creating an account.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>
            Online orders appear in your Orders page and Kitchen Display
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>- Online orders are tagged with source "online" in the Orders page</p>
          <p>- Delivery orders show delivery address and status tracking</p>
          <p>- Kitchen Display shows online orders alongside POS orders</p>
          <p>- Delivery status: Pending ? Preparing ? Out for Delivery ? Delivered</p>
        </CardContent>
      </Card>
    </div>
  );
}


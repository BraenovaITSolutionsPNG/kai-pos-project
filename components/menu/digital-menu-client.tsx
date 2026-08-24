"use client";

import { useState } from "react";
import { QrCode, Copy, Check, ExternalLink, Table as TableIcon, Globe, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Table {
  id: string;
  label: string;
  status: string;
  capacity: number;
}

export function DigitalMenuClient({
  baseUrl,
  tables,
  restaurantName,
}: {
  baseUrl: string;
  tables: Table[];
  restaurantName: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`Copied ${label} link`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Digital Menu Links</h1>
        <p className="text-muted-foreground mt-1">
          Generate QR codes for your tables. Customers scan to view the menu and order from their phones.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base Menu Link</CardTitle>
          <CardDescription>
            This link shows the full menu. Customers must select their table when ordering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              readOnly
              value={baseUrl}
              className="flex-1"
              onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            />
            <Button
              variant="outline"
              onClick={() => copyToClipboard(baseUrl, "Base menu")}
              disabled={copied === "Base menu"}
            >
              {copied === "Base menu" ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <a
              href={baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Use this link for a general menu QR code (e.g., at the entrance or on a table tent).
          </p>
        </CardContent>
      </Card>

      {tables.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Per-Table Links (Pre-selected Table)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Each table gets a unique link that pre-selects that table. Print QR codes and stick on each table.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => {
              const tableUrl = `${baseUrl}?table=${table.id}`;
              return (
                <Card key={table.id} className="relative">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TableIcon className="h-5 w-5" />
                      {table.label}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Capacity: {table.capacity} · Status:{" "}
                      <Badge
                        variant={
                          table.status === "available"
                            ? "default"
                            : table.status === "occupied"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {table.status}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={tableUrl}
                        className="flex-1 text-xs"
                        onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(tableUrl, `Table ${table.label}`)}
                        disabled={copied === `Table ${table.label}`}
                      >
                        {copied === `Table ${table.label}` ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      <span>Scan QR → Order → Pay on exit</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card className="border-amber-500/50 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Generate QR codes from these links using any QR code generator (e.g., qr.io, qr-code-generator.com).</li>
            <li>Print and laminate the QR codes. Place one on each table (use the per-table links).</li>
            <li>Customers scan the QR code, browse the menu, add items to cart, and place their order.</li>
            <li>The order appears instantly on the Kitchen Display and notifies waiters/cashiers when ready.</li>
            <li>Customers eat, then pay on their way out at the counter. Staff use the <strong>Bills</strong> page to charge the table.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, MessageSquare, GitBranch, Plus, ExternalLink } from "lucide-react";

interface MarketingContent {
  id: string;
  title: string;
  type: string;
  status?: string;
  url?: string;
  lastEditedTime?: string;
}

interface ClientFeedback {
  id: string;
  title: string;
  clientName?: string;
  restaurantName?: string;
  feedback?: string;
  status: string;
  priority: string;
  url?: string;
  createdTime?: string;
}

interface ChangelogEntry {
  id: string;
  title: string;
  version?: string;
  type: string;
  description?: string;
  releasedAt?: string;
  url?: string;
}

export function NotionIntegrationClient() {
  const [marketingDb, setMarketingDb] = useState("");
  const [feedbackDb, setFeedbackDb] = useState("");
  const [changelogDb, setChangelogDb] = useState("");
  
  const [marketing, setMarketing] = useState<MarketingContent[]>([]);
  const [feedback, setFeedback] = useState<ClientFeedback[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    title: "",
    clientName: "",
    restaurantName: "",
    feedback: "",
    priority: "medium",
  });

  const loadData = async () => {
    if (!marketingDb && !feedbackDb && !changelogDb) {
      toast.error("Please enter at least one database ID");
      return;
    }
    
    setLoading(true);
    try {
      const promises = [];
      
      if (marketingDb) {
        promises.push(
          fetch(`/api/notion?type=marketing&marketingDb=${marketingDb}`)
            .then((res) => res.json())
            .then((data) => setMarketing(data.content || []))
        );
      }
      
      if (feedbackDb) {
        promises.push(
          fetch(`/api/notion?type=feedback&feedbackDb=${feedbackDb}`)
            .then((res) => res.json())
            .then((data) => setFeedback(data.feedback || []))
        );
      }
      
      if (changelogDb) {
        promises.push(
          fetch(`/api/notion?type=changelog&changelogDb=${changelogDb}`)
            .then((res) => res.json())
            .then((data) => setChangelog(data.changelog || []))
        );
      }
      
      await Promise.all(promises);
      toast.success("Data loaded from Notion");
    } catch (error) {
      toast.error("Failed to load data from Notion");
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackDb) {
      toast.error("Feedback database ID required");
      return;
    }
    
    if (!feedbackForm.title || !feedbackForm.feedback) {
      toast.error("Title and feedback are required");
      return;
    }
    
    try {
      const res = await fetch("/api/notion/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackDb, ...feedbackForm }),
      });
      
      if (res.ok) {
        toast.success("Feedback submitted to Notion");
        setShowFeedbackForm(false);
        setFeedbackForm({ title: "", clientName: "", restaurantName: "", feedback: "", priority: "medium" });
        loadData();
      } else {
        toast.error("Failed to submit feedback");
      }
    } catch (error) {
      toast.error("Failed to submit feedback");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "done":
      case "released":
        return "bg-green-500";
      case "in-progress":
      case "planned":
        return "bg-blue-500";
      case "reviewing":
        return "bg-yellow-500";
      case "new":
        return "bg-gray-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
        return "bg-red-600";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Notion Integration
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage Marketing Content, Client Feedback, and Changelog & Releases via Notion
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Database Configuration</CardTitle>
          <CardDescription>
            Enter your Notion database IDs for each section
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="marketingDb">Marketing Content Database ID</Label>
            <Input
              id="marketingDb"
              value={marketingDb}
              onChange={(e) => setMarketingDb(e.target.value)}
              placeholder="e.g., abc123def456..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedbackDb">Client Feedback Database ID</Label>
            <Input
              id="feedbackDb"
              value={feedbackDb}
              onChange={(e) => setFeedbackDb(e.target.value)}
              placeholder="e.g., abc123def456..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="changelogDb">Changelog & Releases Database ID</Label>
            <Input
              id="changelogDb"
              value={changelogDb}
              onChange={(e) => setChangelogDb(e.target.value)}
              placeholder="e.g., abc123def456..."
            />
          </div>
          <Button onClick={loadData} disabled={loading}>
            {loading ? "Loading..." : "Load Data"}
          </Button>
        </CardContent>
      </Card>

      {feedbackDb && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-5" />
                  Client Feedback
                </CardTitle>
                <CardDescription>Track and manage client feedback</CardDescription>
              </div>
              <Button onClick={() => setShowFeedbackForm(!showFeedbackForm)} size="sm">
                <Plus className="size-4" />
                Add Feedback
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showFeedbackForm && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="feedbackTitle">Title *</Label>
                    <Input
                      id="feedbackTitle"
                      value={feedbackForm.title}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                      placeholder="Feature request or issue"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={feedbackForm.priority} onValueChange={(v: string | null) => setFeedbackForm({ ...feedbackForm, priority: v ?? "medium" })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      value={feedbackForm.clientName}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, clientName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restaurantName">Restaurant Name</Label>
                    <Input
                      id="restaurantName"
                      value={feedbackForm.restaurantName}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, restaurantName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedbackText">Feedback *</Label>
                  <Textarea
                    id="feedbackText"
                    value={feedbackForm.feedback}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={submitFeedback} size="sm">Submit</Button>
                  <Button onClick={() => setShowFeedbackForm(false)} variant="outline" size="sm">Cancel</Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {feedback.map((item) => (
                <div key={item.id} className="flex items-start justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{item.title}</h4>
                      <Badge className={getPriorityColor(item.priority) + " text-white text-xs"}>
                        {item.priority}
                      </Badge>
                      <Badge className={getStatusColor(item.status) + " text-white text-xs"}>
                        {item.status}
                      </Badge>
                    </div>
                    {(item.clientName || item.restaurantName) && (
                      <p className="text-sm text-muted-foreground">
                        {item.clientName && <span>{item.clientName}</span>}
                        {item.clientName && item.restaurantName && <span> • </span>}
                        {item.restaurantName && <span>{item.restaurantName}</span>}
                      </p>
                    )}
                    {item.feedback && (
                      <p className="text-sm">{item.feedback}</p>
                    )}
                  </div>
                  {item.url && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(item.url, "_blank")}>
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {feedback.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No feedback found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {marketingDb && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-5" />
              Marketing Content
            </CardTitle>
            <CardDescription>Landing page copy, campaigns, and marketing materials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {marketing.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.type} {item.status && `• ${item.status}`}</p>
                  </div>
                  {item.url && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(item.url, "_blank")}>
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {marketing.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No marketing content found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {changelogDb && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="size-5" />
              Changelog & Releases
            </CardTitle>
            <CardDescription>Track product updates and releases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {changelog.map((item) => (
                <div key={item.id} className="flex items-start justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{item.title}</h4>
                      {item.version && <Badge variant="outline">{item.version}</Badge>}
                      <Badge className={getStatusColor(item.type) + " text-white text-xs"}>
                        {item.type}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    )}
                    {item.releasedAt && (
                      <p className="text-xs text-muted-foreground">Released: {item.releasedAt}</p>
                    )}
                  </div>
                  {item.url && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(item.url, "_blank")}>
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {changelog.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No changelog entries found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

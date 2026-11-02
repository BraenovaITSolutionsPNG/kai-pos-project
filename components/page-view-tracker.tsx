"use client";

import { useEffect } from "react";

export function PageViewTracker() {
  useEffect(() => {
    const visitorId = localStorage.getItem("visitor_id") || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    if (!localStorage.getItem("visitor_id")) {
      localStorage.setItem("visitor_id", visitorId);
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, visitorId }),
    }).catch(() => {});
  }, []);

  return null;
}


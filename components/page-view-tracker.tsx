"use client";

import { useEffect } from "react";

export function PageViewTracker() {
  useEffect(() => {
    const visitorId = localStorage.getItem("visitor_id") || crypto.randomUUID();
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


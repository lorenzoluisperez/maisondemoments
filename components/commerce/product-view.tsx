"use client";

import { useEffect } from "react";

export function ProductView({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const key = `mdm-product-view:${slug}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      void fetch("/api/commerce/metrics/view", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }), keepalive: true,
      }).then((response) => { if (!response.ok) sessionStorage.removeItem(key); }).catch(() => { sessionStorage.removeItem(key); });
    } catch { /* Browsing remains available when storage or metrics are unavailable. */ }
  }, [slug]);
  return null;
}

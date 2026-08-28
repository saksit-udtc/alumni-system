"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Anonymous page-view logging for the public side of the site only.
 * Fires once per path change; never logs anything under /admin (those
 * actions go through the admin audit log instead, tied to a real admin).
 * Uses sendBeacon where available so it doesn't block/delay navigation.
 */
export default function PageViewLogger() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const payload = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/log-view", blob);
      } else {
        fetch("/api/log-view", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
      }
    } catch {
      // best-effort only — never let logging break the page
    }
  }, [pathname]);

  return null;
}

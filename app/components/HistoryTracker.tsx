"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageChange } from "@/lib/navHistory";

export default function HistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageChange(pathname);
  }, [pathname]);

  return null;
}

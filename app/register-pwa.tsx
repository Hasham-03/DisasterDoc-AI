"use client";

import { useEffect } from "react";
import type { Serwist } from "@serwist/window";

declare global {
  interface Window {
    serwist?: Serwist;
  }
}

export default function RegisterPWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator && typeof window !== "undefined") {
      void window.serwist?.register();
    }
  }, []);

  return null;
}

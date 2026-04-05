/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // In development, @serwist/next defaults to a catch-all NetworkOnly strategy,
  // which throws `no-response` when localhost requests briefly fail.
  runtimeCaching: process.env.NODE_ENV === "production" ? defaultCache : [],
});

serwist.addEventListeners();
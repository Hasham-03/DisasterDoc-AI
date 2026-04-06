import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "path";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
};

export default withSerwist(nextConfig);
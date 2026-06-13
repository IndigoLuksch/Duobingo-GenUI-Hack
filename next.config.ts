import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    optimizePackageImports: [
      "@copilotkit/react-core",
      "@copilotkit/react-ui",
      "@copilotkit/runtime",
    ],
  },
};

export default nextConfig;

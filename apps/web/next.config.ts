import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kak-fit/api", "@kak-fit/db"],
  // Webpack dev (no Turbopack): polling avoids Linux inotify exhaustion in pnpm monorepos.
  webpack: (config, { dev }) => {
    if (dev) {
      const usePolling = process.env.WATCHPACK_POLLING === "true";
      config.watchOptions = {
        ...(usePolling ? { poll: 1000 } : {}),
        aggregateTimeout: 300,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.turbo/**",
          "**/apps/mobile/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;

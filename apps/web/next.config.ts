import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kak-fit/api", "@kak-fit/db"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/tour",
        destination: "/tour/index.html",
      },
    ];
  },
};

export default nextConfig;

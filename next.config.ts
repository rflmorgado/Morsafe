import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/tour",
        destination: "https://claude.ai/artifact/6T2yfNs1yoSppU2yyhRF27",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

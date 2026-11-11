import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/tour",
        destination: "/tour/index.html",
      },
      // Demonstração interativa (empresa fictícia, entrega + assinatura + ficha)
      // — public/demo/index.html, mesma técnica do /tour acima.
      {
        source: "/demo",
        destination: "/demo/index.html",
      },
    ];
  },
};

export default nextConfig;

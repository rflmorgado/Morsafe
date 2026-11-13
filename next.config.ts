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
      // Calculadora de economia com EPI — public/calculadora/index.html,
      // mesma técnica do /tour e do /demo acima.
      {
        source: "/calculadora",
        destination: "/calculadora/index.html",
      },
    ];
  },
};

export default nextConfig;

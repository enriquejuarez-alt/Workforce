import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // El import de historico de agentes acepta CSVs de varios cientos de MB
    // (ver historial-agente/page.tsx) - el limite por defecto de Next.js para
    // requests que pasan por rewrites()/proxy es de 10MB.
    proxyClientMaxBodySize: "300mb",
  },
  async rewrites() {
    return [
      { source: "/api/:path*",     destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;

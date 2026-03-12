import type { NextConfig } from "next";

const backendOrigin = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

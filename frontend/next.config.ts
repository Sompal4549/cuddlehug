import type { NextConfig } from "next";

const API_TARGET = (process.env.API_PROXY_TARGET ?? "http://localhost:5000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Same-origin API: the browser only ever talks to this server.
      { source: "/api/:path*", destination: `${API_TARGET}/api/:path*` },
      // Locally uploaded images (backend serves /uploads in development).
      { source: "/uploads/:path*", destination: `${API_TARGET}/uploads/:path*` },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.razorpay.com" },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

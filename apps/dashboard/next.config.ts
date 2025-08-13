import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  // Enable strict mode for better development experience
  reactStrictMode: true,
};

export default nextConfig;

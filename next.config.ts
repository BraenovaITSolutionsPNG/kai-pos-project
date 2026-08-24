import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product/payment images live in Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;

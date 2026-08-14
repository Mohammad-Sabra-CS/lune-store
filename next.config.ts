import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Branded 404 for URLs outside every root layout — this app has no single
    // root layout ([locale] and admin each own <html>), which is exactly the
    // case app/global-not-found.tsx exists for.
    globalNotFound: true,
    serverActions: {
      // Admin image uploads go through a server action; the 1 MB default
      // rejects any real product photo.
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);

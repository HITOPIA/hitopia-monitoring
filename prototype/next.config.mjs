/** @type {import('next').NextConfig} */
const nextConfig = {
  // Full-stack app: route handlers under app/api/** serve the contract API
  // backed by Postgres/Prisma. (Static export removed — the app now has a server.)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Keep heavy server-only packages out of the bundle; load them at runtime.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "bullmq",
    "ioredis",
    "puppeteer",
    "googleapis",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;

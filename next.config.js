/** @type {import('next').NextConfig} */
const nextConfig = {
  // distDir конфігурований: деплой будує у .next-build і атомарно свопає → без chunk-mismatch
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
  },
};
module.exports = nextConfig;

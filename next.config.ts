import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: './.next',
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
};

export default nextConfig;

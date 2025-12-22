import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  images: {
    unoptimized: true,
  },
  // reactCompiler: true, // Descomentar si usas Next.js 15 RC con soporte
};

export default nextConfig;

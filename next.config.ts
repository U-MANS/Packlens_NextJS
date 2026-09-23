import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Evita que Next intente pre-renderizar el SPA catch-all
  typescript: {
    // Durante la migración conviene ver errores; no ignorar en CI
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

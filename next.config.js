/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
    // ADVERTENCIA: Esto permite que los despliegues a producción se completen
    // aunque tu proyecto tenga errores de ESLint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

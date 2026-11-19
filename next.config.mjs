/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['100.65.5.66'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
}
export default nextConfig;

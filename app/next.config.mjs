/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: '.',
  },
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;

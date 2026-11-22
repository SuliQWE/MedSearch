/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } }, // загрузка картинок препаратов (лимит самой картинки 3 МБ)
};

export default nextConfig;

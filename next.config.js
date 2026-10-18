/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  distDir: "out",
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;

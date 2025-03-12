/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  }
}

const { withPlausibleProxy } = require('next-plausible')

module.exports = withPlausibleProxy()(nextConfig)

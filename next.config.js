/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true, // TODO: Remove; this is a temporary fix for wagmi typescript errors
  },
}

const { withPlausibleProxy } = require('next-plausible')

module.exports = withPlausibleProxy()(nextConfig)

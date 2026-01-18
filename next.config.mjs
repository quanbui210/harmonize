/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Enable instrumentation hook (required for instrumentation.ts)
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;


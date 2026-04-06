const remotePatterns = [
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
  },
];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    remotePatterns.push({
      protocol: "https",
      hostname: supabaseHostname,
    });
  } catch {
    // Ignore invalid URL and keep default image hosts.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    // Allow multi-image uploads in Server Actions (default can trigger 413 for larger files).
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns,
  },
};

export default nextConfig;

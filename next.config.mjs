/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set explicit workspace root to prevent lockfile detection issues
  outputFileTracingRoot: process.cwd(),

  // Empty turbopack config to silence the webpack/turbopack conflict warning
  // We use webpack for DuckDB-WASM compatibility
  turbopack: {},

  // ============================================================================
  // SharedArrayBuffer Support (Required for DuckDB-WASM)
  // ============================================================================
  // DuckDB-WASM uses multi-threading via SharedArrayBuffer, which requires
  // Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP)
  // headers to be set on all responses.
  // ============================================================================

  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },

  // ============================================================================
  // Webpack Configuration for DuckDB-WASM
  // ============================================================================

  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Prevent server-side bundling of DuckDB (client-only)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@duckdb/duckdb-wasm');
    }

    // Fix for resolving .wasm files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },

  // ============================================================================
  // Experimental Features
  // ============================================================================

  experimental: {
    // Enable server actions (default in Next.js 15, but explicit for clarity)
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // ============================================================================
  // Image Optimization
  // ============================================================================

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },

  // ============================================================================
  // TypeScript
  // ============================================================================

  typescript: {
    // Allow production builds even with type errors (for CI flexibility)
    // Set to true for strict builds
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

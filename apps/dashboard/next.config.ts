import type { NextConfig } from "next";

// Get current environment
const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'development';
const isProduction = environment === 'production';

const nextConfig: NextConfig = {
  // Remove powered-by header for security
  poweredByHeader: false,
  
  // Enable compression for better performance
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: [],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Environment-specific optimizations
  experimental: {
    // Enable optimization for production
    optimizeCss: isProduction,
  },
  
  // Security headers
  async headers() {
    const headers = [];
    
    // Apply security headers in production
    if (isProduction) {
      headers.push({
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      });
    }
    
    return headers;
  },
  
  // Environment variables validation
  env: {
    CHRONICLE_VERSION: '1.0.0',
    CHRONICLE_BUILD_TIME: new Date().toISOString(),
  },
  
  // Webpack configuration for better bundle analysis
  webpack: (config, { dev, isServer }) => {
    // Only in production
    if (!dev && !isServer) {
      // Analyze bundle in production builds
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase',
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
  
  // Output configuration
  output: isProduction ? 'standalone' : undefined,
  
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: isProduction ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

export default nextConfig;

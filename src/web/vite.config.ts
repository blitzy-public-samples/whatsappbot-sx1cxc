import { defineConfig } from 'vite'; // ^4.0.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import checker from 'vite-plugin-checker'; // ^0.6.0
import path from 'path';

// Configuration for development and production environments
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  
  return {
    // Server Configuration
    server: {
      port: 3000,
      host: true,
      // HTTPS Configuration for secure development
      https: {
        key: './certs/key.pem',
        cert: './certs/cert.pem',
      },
      // Proxy Configuration for API and WebSocket
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: 'ws://localhost:3000',
          ws: true,
          secure: false,
        },
      },
      // CORS Configuration
      cors: {
        origin: [
          'http://localhost:3000',
          'https://localhost:3000',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
      },
    },

    // Build Configuration
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'terser',
      target: 'esnext',
      chunkSizeWarningLimit: 1000,
      // Terser Options for Production Build
      terserOptions: {
        compress: {
          drop_console: !isDevelopment,
          drop_debugger: !isDevelopment,
        },
      },
      // Rollup Options for Chunk Splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Core vendor chunks
            vendor: ['react', 'react-dom', '@mui/material'],
            // State management chunk
            redux: ['@reduxjs/toolkit', 'react-redux'],
            // Utility libraries chunk
            utils: ['date-fns', 'lodash'],
            // Form handling chunk
            forms: ['react-hook-form', 'yup'],
          },
        },
      },
    },

    // Plugins Configuration
    plugins: [
      // React Plugin Configuration
      react({
        fastRefresh: true,
        babel: {
          plugins: ['@emotion/babel-plugin'],
        },
      }),
      // TypeScript and ESLint Checker
      checker({
        typescript: true,
        overlay: true,
        eslint: {
          lintCommand: 'eslint ./src --ext .ts,.tsx',
        },
      }),
    ],

    // Resolution Configuration
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@store': path.resolve(__dirname, 'src/store'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@config': path.resolve(__dirname, 'src/config'),
        '@layouts': path.resolve(__dirname, 'src/layouts'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@api': path.resolve(__dirname, 'src/api'),
      },
    },

    // Environment Variables Configuration
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    },

    // Dependency Optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@mui/material',
        '@reduxjs/toolkit',
      ],
      exclude: ['@firebase/app'], // Exclude specific dependencies from optimization
    },

    // CSS Configuration
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/styles/variables.scss";',
        },
      },
    },

    // Preview Configuration
    preview: {
      port: 3000,
      host: true,
      strictPort: true,
    },
  };
});
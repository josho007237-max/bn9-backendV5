import { defineConfig, loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

type ProxyConfig = Record<string, string | ProxyOptions>;

function createProxyConfig(apiBase: string | undefined): ProxyConfig | undefined {
  if (!apiBase) {
    return undefined;
  }

  return {
    '/api': { target: apiBase, changeOrigin: true },
    '/health': { target: apiBase, changeOrigin: true },
    '/webhook': { target: apiBase, changeOrigin: true },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_API_BASE || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: createProxyConfig(apiBase),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});

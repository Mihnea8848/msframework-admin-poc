// Temporary, untracked: lets the F2 branch run beside another backend. Delete after use.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5174, strictPort: true,
    proxy: { '/api': { target: 'http://localhost:8091', changeOrigin: true } } },
})

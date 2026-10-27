import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Separate user entry. The console build remains in dist and is served by 5088.
// changeOrigin changes Host only; Origin/Sec-Fetch-Site and cookies are preserved.
export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react(), {
    name: 'crm5-user-api-only',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (path.startsWith('/api/') && !/^\/api\/client\/v1(?:\/|$)/.test(path)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ code: 'CRM5_CLIENT_ROUTE_NOT_AVAILABLE' }))
          return
        }
        next()
      })
    },
  }],
  server: {
    host: 'localhost', port: 5173, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
    proxy: {
      '^/api/client/v1(?:/|$)': { target: 'http://127.0.0.1:5088', changeOrigin: true },
    },
  },
  build: { outDir: '../dist-client', emptyOutDir: true },
})


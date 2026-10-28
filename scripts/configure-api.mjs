import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Run once before committing/deploying. Vercel reads routing configuration before build.
const input = process.argv[2];
let url;
try { url = new URL(input); } catch { throw new Error('Usage: node scripts/configure-api.mjs https://YOUR-API-HOST[:PORT]'); }
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*') ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Provide a public HTTPS origin without credentials, query or path. A trusted TLS certificate is required.');
}
const path = fileURLToPath(new URL('../vercel.json', import.meta.url));
const config = JSON.parse(readFileSync(path, 'utf8'));
config.rewrites = [
  { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
  ...(config.rewrites ?? []).filter(rule => rule.source !== '/api/:path*'),
];
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('API proxy configured. Review vercel.json, then commit and deploy.');

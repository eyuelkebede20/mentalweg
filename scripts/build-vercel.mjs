import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const clientDist = path.join(rootDir, 'dist', 'client');
const publicAppDist = path.join(rootDir, 'public-app', 'dist');
const adminDist = path.join(rootDir, 'admin', 'dist');

console.log('[Vercel Build] Packaging static client assets...');

// Clean and create dist/client
if (fs.existsSync(clientDist)) {
  fs.rmSync(clientDist, { recursive: true, force: true });
}
fs.mkdirSync(clientDist, { recursive: true });

// 1. Copy public-app/dist to dist/client (root /)
if (fs.existsSync(publicAppDist)) {
  fs.cpSync(publicAppDist, clientDist, { recursive: true });
  console.log('✓ Copied public-app/dist -> dist/client');
} else {
  console.error('Error: public-app/dist does not exist. Run "npm run build --prefix public-app" first.');
  process.exit(1);
}

// 2. Copy admin/dist to dist/client/admin (/admin/)
const adminTarget = path.join(clientDist, 'admin');
if (fs.existsSync(adminDist)) {
  fs.mkdirSync(adminTarget, { recursive: true });
  fs.cpSync(adminDist, adminTarget, { recursive: true });
  console.log('✓ Copied admin/dist -> dist/client/admin');
} else {
  console.error('Error: admin/dist does not exist. Run "npm run build --prefix admin" first.');
  process.exit(1);
}

console.log('[Vercel Build] Output directory dist/client is ready!');

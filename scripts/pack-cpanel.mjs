import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const stageDir = path.join(rootDir, 'dist-cpanel');
const rootAppDir = path.join(stageDir, 'mentalweg');
const bundleDir = path.join(rootAppDir, 'app'); // Subfolder avoids CloudLinux root node_modules collision
const zipFile = path.join(rootDir, 'mentalweg-cpanel-bundle.zip');

console.log('🚀 Starting MentalWeg CloudLinux/Passenger Packager for mentalweg.senaycreatives.com...');

// 1. Check & build all workspace applications
console.log('🔨 Step 1: Checking and building workspace projects...');
const publicDist = path.join(rootDir, 'public-app', 'dist');
const adminDist = path.join(rootDir, 'admin', 'dist');
const serverDist = path.join(rootDir, 'dist');

console.log('🔨 Building public-app (Public Booking & Patient Portal)...');
execSync('npm run build --prefix public-app', { stdio: 'inherit', cwd: rootDir, shell: true });

console.log('🔨 Building admin (Practitioner POS & Management Portal)...');
execSync('npm run build --prefix admin', { stdio: 'inherit', cwd: rootDir, shell: true });

console.log('🔨 Compiling Fastify backend server (TypeScript -> CommonJS)...');
execSync('npx tsc', { stdio: 'inherit', cwd: rootDir, shell: true });

// 2. Clean previous staging directories and old bundle zip
console.log('🧹 Step 2: Preparing clean staging directories...');
try {
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
} catch (e) {
  console.warn('⚠️ Staging directory locked, continuing with clean overwrite.');
}

try {
  if (fs.existsSync(zipFile)) {
    fs.rmSync(zipFile, { force: true, maxRetries: 3, retryDelay: 200 });
  }
} catch (e) {}

fs.mkdirSync(bundleDir, { recursive: true });

// 3. Copy compiled server dist to bundleDir/dist
console.log('📦 Step 3: Copying compiled backend server to app/dist...');
fs.cpSync(serverDist, path.join(bundleDir, 'dist'), { recursive: true });

// 4. Copy frontends into app/
console.log('📦 Step 4: Staging frontend applications...');
// Stage public-app
const appPublicDist = path.join(bundleDir, 'public-app', 'dist');
fs.mkdirSync(appPublicDist, { recursive: true });
fs.cpSync(publicDist, appPublicDist, { recursive: true });

// Stage admin
const appAdminDist = path.join(bundleDir, 'admin', 'dist');
fs.mkdirSync(appAdminDist, { recursive: true });
fs.cpSync(adminDist, appAdminDist, { recursive: true });

// Also stage client fallback directory (public at root, admin at /admin)
const appClientDist = path.join(bundleDir, 'client');
fs.mkdirSync(appClientDist, { recursive: true });
fs.cpSync(publicDist, appClientDist, { recursive: true });
const appClientAdminDist = path.join(appClientDist, 'admin');
fs.mkdirSync(appClientAdminDist, { recursive: true });
fs.cpSync(adminDist, appClientAdminDist, { recursive: true });

// 5. Generate clean standalone production package.json
console.log('📦 Step 5: Generating production package.json...');
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const prodPkg = {
  name: 'mentalweg-server',
  version: rootPkg.version || '1.0.0',
  main: 'dist/server.js',
  scripts: {
    start: 'node dist/server.js'
  },
  dependencies: { ...rootPkg.dependencies }
};
// tsx is dev-only runtime; production runs node directly
delete prodPkg.dependencies.tsx;

fs.writeFileSync(path.join(bundleDir, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf8');

// 6. Install self-contained production node_modules with Linux x64 binaries
console.log('📦 Step 6: Installing production node_modules inside app/node_modules...');
execSync('npm install --omit=dev --no-audit --no-fund --os=linux --cpu=x64', {
  cwd: bundleDir,
  stdio: 'inherit',
  shell: true
});

// 7. Populate Root Directory files (at api/mentalweg/)
console.log('📦 Step 7: Configuring Passenger shim and persistent mounts...');

// Create persistent uploads directory at application root
const uploadsDir = path.join(rootAppDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), '', 'utf8');

// Create persistent data directory for SQLite database
const dataDir = path.join(rootAppDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, '.gitkeep'), '', 'utf8');

// Create tmp/restart.txt for Passenger restart trigger
const tmpDir = path.join(rootAppDir, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const gitSha = process.env.GITHUB_SHA || '';
fs.writeFileSync(path.join(tmpDir, 'restart.txt'), `restart ${gitSha || 'release'}\n`, 'utf8');

// Create app.cjs startup file at application root
const appCjs = `// Phusion Passenger / CloudLinux Node.js Selector startup shim
// CloudLinux owns root 'node_modules' as a symlink to its virtualenv.
// Our real production bundle lives in './app', safely isolated.
const path = require('node:path');
const fs = require('node:fs');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.HOSTNAME = '0.0.0.0';

const appDir = path.resolve(__dirname, 'app');
const appNodeModules = path.join(appDir, 'node_modules');

// 1. Prepend app/node_modules to NODE_PATH
process.env.NODE_PATH = [appNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
require('node:module').Module._initPaths();

// 2. Load .env file from application root, parent, or app subfolder first
try {
  const dotenvPath = path.join(appNodeModules, 'dotenv');
  if (fs.existsSync(dotenvPath)) {
    const candidates = [
      path.join(__dirname, '.env'),
      path.join(appDir, '.env'),
      path.resolve(__dirname, '..', '.env')
    ];
    for (const envFile of candidates) {
      if (fs.existsSync(envFile)) {
        require(dotenvPath).config({ path: envFile, override: true });
        console.log('[cPanel Startup] Loaded environment from:', envFile);
        break;
      }
    }
  }
} catch (_) {}

// 3. Ensure persistent storage folders exist at root
const persistentDataDir = path.join(__dirname, 'data');
const persistentUploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(persistentDataDir)) fs.mkdirSync(persistentDataDir, { recursive: true });
  if (!fs.existsSync(persistentUploadsDir)) fs.mkdirSync(persistentUploadsDir, { recursive: true });
} catch (e) {
  console.warn('Could not create storage directories:', e);
}

// 4. Set DATA_DIR to root data directory if not already set by .env or cPanel UI
if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = persistentDataDir;
}

// 5. Switch working directory to app/
try {
  process.chdir(appDir);
} catch (e) {
  console.warn('Could not chdir to app directory:', e);
}

// 6. Boot the compiled Fastify server
const serverEntry = path.join(appDir, 'dist', 'server.js');
require(serverEntry);
`;
fs.writeFileSync(path.join(rootAppDir, 'app.cjs'), appCjs, 'utf8');

// Fallback entrypoint bridge in case cPanel defaulted to app.js
const appJs = `// cPanel Default Entrypoint Bridge
// If cPanel Node.js Selector is pointing to app.js instead of app.cjs,
// this forwards directly to app.cjs so MentalWeg runs either way.
require('./app.cjs');
`;
fs.writeFileSync(path.join(rootAppDir, 'app.js'), appJs, 'utf8');

// Create .env.example
const envExample = `# ==============================================================================
# MentalWeg Environment Configuration
# Deployment URL: https://mentalweg.senaycreatives.com
# ==============================================================================

# Canonical Base URL
BASE_URL=https://mentalweg.senaycreatives.com

# Server Runtime & Port (CloudLinux / Passenger assigns PORT automatically)
NODE_ENV=production
PORT=3000

# Secure Session Secret (Generate a unique 32+ character string)
SESSION_SECRET=change-this-to-a-very-secure-random-32-char-secret-string

# Persistent Storage Directory (stores data.db and uploads safely)
DATA_DIR=./data

# Verifier API Configuration (Bank receipt verification)
VERIFIER_BASE_URL=https://verifier.senaycreatives.com
VERIFIER_API_KEY=senaycreatives-verifier-key-2026

# SMTP Email Configuration (Patient approvals, reminders & password resets)
SMTP_HOST=mail.senaycreatives.com
SMTP_PORT=465
SMTP_USER=no-reply@senaycreatives.com
SMTP_PASS=YourEmailPasswordHere

# Optional Cloudflare Turnstile
TURNSTILE_SECRET=

# Optional Web Push Notifications (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
`;
fs.writeFileSync(path.join(rootAppDir, '.env.example'), envExample, 'utf8');

// Copy standalone database schema.sql to application root
const schemaSqlSource = path.join(rootDir, 'schema.sql');
if (fs.existsSync(schemaSqlSource)) {
  fs.copyFileSync(schemaSqlSource, path.join(rootAppDir, 'schema.sql'));
}

// 8. Create Zip Bundle (Optional offline archive)
console.log('🗜️ Step 8: Generating mentalweg-cpanel-bundle.zip archive...');
try {
  if (fs.existsSync(zipFile)) {
    fs.rmSync(zipFile, { force: true });
  }
  execSync(`tar -a -c -f "${zipFile}" -C "${stageDir}" "mentalweg"`, {
    stdio: 'ignore',
    cwd: rootDir,
    shell: true
  });
  console.log(`🎉 SUCCESS: Generated ${zipFile}`);
} catch (err) {
  console.log('ℹ️ Note: Staged directory dist-cpanel/mentalweg is ready for direct FTP upload.');
}

console.log(`
========================================================================
✅ CLOUDLINUX / CPANEL COMPLIANT BUNDLE READY FOR MENTALWEG!
========================================================================
Archive: mentalweg-cpanel-bundle.zip
Folder:  dist-cpanel/mentalweg/

On-disk layout inside /api/mentalweg/:
  /api/mentalweg/                 ◄── Application Root (CloudLinux owns root node_modules symlink)
  ├── app.cjs                     ◄── Passenger startup shim (boots ./app/dist/server.js)
  ├── app.js                      ◄── Fallback forwarder to app.cjs
  ├── tmp/restart.txt             ◄── Touch to restart app
  ├── data/                       ◄── Persistent SQLite database (data.db)
  ├── uploads/                    ◄── Persistent uploads
  ├── .env.example
  └── app/                        ◄── Real production bundle in subfolder (NO symlink collisions!)
      ├── package.json
      ├── dist/                   ◄── Compiled Fastify server (server.js, app.js, routes, etc.)
      ├── public-app/dist/        ◄── Public App SPA (mentalweg.senaycreatives.com)
      ├── admin/dist/             ◄── Admin Portal SPA (mentalweg.senaycreatives.com/admin/)
      └── node_modules/           ◄── Real production dependencies with Linux x64 binaries
========================================================================
`);

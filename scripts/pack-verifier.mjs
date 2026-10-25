import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const verifierDir = path.join(rootDir, 'verifier-api');
const stageDir = path.join(rootDir, 'dist-cpanel-verifier');
const zipFile = path.join(rootDir, 'verifier-cpanel-bundle.zip');

console.log('🚀 Starting Verifier-API Packager for verifier.senaycreatives.com...');

// 1. Ensure schema.prisma has Linux binary targets for cPanel
console.log('🔧 Step 1: Checking Prisma binaryTargets for Linux/CloudLinux...');
const prismaSchemaPath = path.join(verifierDir, 'prisma', 'schema.prisma');
let schemaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
if (!schemaContent.includes('binaryTargets')) {
  schemaContent = schemaContent.replace(
    /provider\s*=\s*"prisma-client-js"/,
    'provider      = "prisma-client-js"\r\n    binaryTargets = ["native", "rhel-openssl-3.0.x", "debian-openssl-3.0.x"]'
  );
  fs.writeFileSync(prismaSchemaPath, schemaContent, 'utf8');
  console.log('✅ Added binaryTargets ["native", "rhel-openssl-3.0.x", "debian-openssl-3.0.x"] to schema.prisma');
} else {
  console.log('✅ schema.prisma already includes binaryTargets.');
}

// 2. Generate Prisma Client with Linux engines
console.log('🔨 Step 2: Generating Prisma Client with multi-platform engines...');
execSync('npx prisma generate', { cwd: verifierDir, stdio: 'inherit', shell: true });

// 3. Compile TypeScript to JavaScript (dist/)
console.log('🔨 Step 3: Compiling TypeScript to JavaScript (dist/)...');
execSync('npx tsc', { cwd: verifierDir, stdio: 'inherit', shell: true });

// 4. Prepare clean staging directory
console.log('🧹 Step 4: Preparing staging directory...');
if (fs.existsSync(stageDir)) {
  fs.rmSync(stageDir, { recursive: true, force: true });
}
if (fs.existsSync(zipFile)) {
  fs.rmSync(zipFile, { force: true });
}
fs.mkdirSync(stageDir, { recursive: true });

// 5. Copy compiled dist/
console.log('📦 Step 5: Copying compiled dist/ to staging...');
fs.cpSync(path.join(verifierDir, 'dist'), path.join(stageDir, 'dist'), { recursive: true });

// Copy prisma directory (schema & migrations)
console.log('📦 Step 6: Copying prisma schema...');
fs.cpSync(path.join(verifierDir, 'prisma'), path.join(stageDir, 'prisma'), { recursive: true });

// Copy eng.traineddata if it exists (Tesseract OCR)
const trainedData = path.join(verifierDir, 'eng.traineddata');
if (fs.existsSync(trainedData)) {
  fs.cpSync(trainedData, path.join(stageDir, 'eng.traineddata'));
}

// 6. Create production package.json without devDependencies
console.log('📦 Step 7: Generating clean production package.json...');
const verifierPkg = JSON.parse(fs.readFileSync(path.join(verifierDir, 'package.json'), 'utf8'));
const prodPkg = {
  name: 'verifier-api',
  version: verifierPkg.version || '3.0.3',
  main: 'dist/index.js',
  scripts: {
    start: 'node dist/index.js'
  },
  dependencies: { ...verifierPkg.dependencies }
};
// Clean up development tools
delete prodPkg.dependencies['nodemon'];
delete prodPkg.dependencies['ts-node'];

fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf8');

// 7.5 Install real production node_modules with Linux binary engines into staging
console.log('📦 Step 7.5: Installing self-contained production node_modules for Linux/cPanel...');
try {
  execSync('npm install --omit=dev --force --no-audit --no-fund', {
    cwd: stageDir,
    stdio: 'inherit',
    shell: true
  });
  console.log('🔨 Generating Prisma client inside staging bundle...');
  execSync('npx prisma generate', {
    cwd: stageDir,
    stdio: 'inherit',
    shell: true
  });
} catch (err) {
  console.warn('⚠️ Warning during staging npm install:', err.message);
}

// 7. Create CloudLinux / Phusion Passenger Startup Shim
console.log('📦 Step 8: Creating Passenger startup shim (app.cjs & app.js)...');
const appCjs = `// Phusion Passenger / CloudLinux / LiteSpeed Node.js Selector startup shim
// Boots compiled dist/index.js
const path = require('node:path');
const fs = require('node:fs');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Prepend app node_modules to NODE_PATH so resolution works regardless of cwd
const nodeModules = path.join(__dirname, 'node_modules');
process.env.NODE_PATH = [nodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
require('node:module').Module._initPaths();

// Load .env if present
try {
  const dotenvPath = path.join(__dirname, 'node_modules', 'dotenv');
  if (fs.existsSync(dotenvPath)) {
    const envFile = path.join(__dirname, '.env');
    if (fs.existsSync(envFile)) {
      require(dotenvPath).config({ path: envFile });
    }
  }
} catch (_) {}

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
} catch (_) {}

// Boot compiled server
require(path.join(__dirname, 'dist', 'index.js'));
`;
fs.writeFileSync(path.join(stageDir, 'app.cjs'), appCjs, 'utf8');

const appJs = `// cPanel Default Entrypoint Bridge
require('./app.cjs');
`;
fs.writeFileSync(path.join(stageDir, 'app.js'), appJs, 'utf8');

// Create .env.example
const envExample = `# ==============================================================================
# Verifier API Environment Configuration
# Deployment URL: https://verifier.senaycreatives.com
# ==============================================================================

NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database URL (MySQL database on cPanel)
# Format: mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME
DATABASE_URL=mysql://your_db_user:your_db_password@localhost:3306/your_db_name

# Security Secrets
ADMIN_SECRET=senaycreatives-admin-secret-2026
DASHBOARD_SECRET=senaycreatives-dashboard-secret-2026
STATUS_MONITOR_SECRET=senaycreatives-status-secret-2026

# Verifier Settings
VERITAS_APP_URL=https://verifier.senaycreatives.com
SKIP_PRIMARY_VERIFICATION=false

# Optional Redis (if running BullMQ queues, leave empty if not used)
REDIS_URL=
`;
fs.writeFileSync(path.join(stageDir, '.env.example'), envExample, 'utf8');

// Create logs directory
fs.mkdirSync(path.join(stageDir, 'logs'), { recursive: true });

// Create tmp/restart.txt
const tmpDir = path.join(stageDir, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'restart.txt'), 'restart\n', 'utf8');

// 8. Pack into zip archive
console.log('🗜️ Step 9: Creating verifier-cpanel-bundle.zip archive...');
try {
  execSync(`tar -a -c -f "${zipFile}" -C "${stageDir}" .`, {
    stdio: 'ignore',
    cwd: rootDir,
    shell: true
  });
  console.log(`🎉 SUCCESS: Generated ${zipFile}`);
} catch (err) {
  console.warn('Could not create zip archive automatically:', err.message);
}

console.log(`
========================================================================
✅ VERIFIER-API PRE-COMPILED BUNDLE IS READY FOR CPANEL!
========================================================================
Archive: verifier-cpanel-bundle.zip
Folder:  dist-cpanel-verifier/

How to deploy on cPanel:
1. Upload and extract 'verifier-cpanel-bundle.zip' inside '/api/verifier/'
2. In cPanel -> "Setup Node.js App":
   - Application Root: api/verifier
   - Application Startup File: app.cjs (or app.js)
   - Application URL: verifier.senaycreatives.com
   - Click "Run NPM Install" (it installs only production dependencies!)
3. Create '.env' in '/api/verifier/.env' with your DATABASE_URL and secrets
4. Click "Restart" in cPanel Node.js App!
========================================================================
`);

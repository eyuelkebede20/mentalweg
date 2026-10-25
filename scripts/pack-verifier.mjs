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
  console.log('✅ Added binaryTargets to schema.prisma');
} else {
  console.log('✅ schema.prisma already includes binaryTargets.');
}

// 2. Generate Prisma Client with Linux engines
console.log('🔨 Step 2: Generating Prisma Client with multi-platform engines...');
execSync('npx prisma generate', { cwd: verifierDir, stdio: 'inherit', shell: true });

// 3. Compile TypeScript to JavaScript (dist/)
console.log('🔨 Step 3: Compiling TypeScript to JavaScript (dist/)...');
execSync('npx tsc', { cwd: verifierDir, stdio: 'inherit', shell: true });

// 4. Prepare staging directory
console.log('🧹 Step 4: Staging dist, prisma, and shims...');
if (!fs.existsSync(stageDir)) fs.mkdirSync(stageDir, { recursive: true });

// Copy compiled dist/
fs.cpSync(path.join(verifierDir, 'dist'), path.join(stageDir, 'dist'), { recursive: true });

// Inject LiteSpeed/CloudLinux path resolver at top of dist/index.js
const indexPath = path.join(stageDir, 'dist', 'index.js');
let indexContent = fs.readFileSync(indexPath, 'utf8');
const bootstrapHeader = `"use strict";
// LiteSpeed / CloudLinux node_modules path resolver
try {
    const _path = require('path');
    const _rootModules = _path.resolve(__dirname, '..', 'node_modules');
    const _distModules = _path.resolve(__dirname, 'node_modules');
    const _candidates = [_rootModules, _distModules];
    if (process.env.NODE_PATH) _candidates.push(process.env.NODE_PATH);
    process.env.NODE_PATH = _candidates.join(_path.delimiter);
    require('module').Module._initPaths();
} catch (_) {}
`;
if (!indexContent.includes('_rootModules')) {
  indexContent = indexContent.replace('"use strict";', bootstrapHeader);
  fs.writeFileSync(indexPath, indexContent, 'utf8');
}

// Copy prisma directory
fs.cpSync(path.join(verifierDir, 'prisma'), path.join(stageDir, 'prisma'), { recursive: true });

// Copy eng.traineddata
const trainedData = path.join(verifierDir, 'eng.traineddata');
if (fs.existsSync(trainedData)) {
  fs.cpSync(trainedData, path.join(stageDir, 'eng.traineddata'));
}

// Create clean production package.json
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
delete prodPkg.dependencies['nodemon'];
delete prodPkg.dependencies['ts-node'];
// Use puppeteer-core alias to prevent cPanel out-of-memory when downloading Chromium
prodPkg.dependencies['puppeteer'] = 'npm:puppeteer-core@^24.8.2';
fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf8');

// Ensure .npmrc suppresses browser downloads on cPanel
fs.writeFileSync(
  path.join(stageDir, '.npmrc'),
  'puppeteer_skip_download=true\r\npuppeteer_skip_chromium_download=true\r\n',
  'utf8'
);

// Pack into zip archive (now including node_modules!)
console.log('🗜️ Step 5: Creating self-contained verifier-cpanel-bundle.zip (including Linux node_modules)...');
if (fs.existsSync(zipFile)) {
  fs.rmSync(zipFile, { force: true });
}

execSync(`tar -a -c -f "${zipFile}" -C "${stageDir}" .`, {
  stdio: 'ignore',
  cwd: rootDir,
  shell: true
});

console.log(`🎉 SUCCESS: Generated ${zipFile}`);

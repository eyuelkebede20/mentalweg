import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface AppVersionInfo {
  version: string;
  gitCommit: string;
  gitCommitFull: string;
  gitBranch: string;
  gitCommitDate: string;
  gitCommitMessage: string;
  gitAuthor: string;
  buildTime: string;
  nodeEnv: string;
  label: string;
}

let cachedVersionInfo: AppVersionInfo | null = null;

export function getAppVersionInfo(): AppVersionInfo {
  // Return cached in production, but in development refresh to track new commits
  if (cachedVersionInfo && process.env.NODE_ENV === 'production') {
    return cachedVersionInfo;
  }

  // 1. Read package.json version
  let pkgVersion = '1.0.0';
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) pkgVersion = pkg.version;
    }
  } catch {
    // fallback
  }

  // 2. Read git details
  let gitCommit = 'unknown';
  let gitCommitFull = 'unknown';
  let gitBranch = 'unknown';
  let gitCommitDate = new Date().toISOString();
  let gitCommitMessage = 'Initial release';
  let gitAuthor = 'System';

  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    gitCommit = process.env.GIT_COMMIT || 'dev';
  }

  try {
    gitCommitFull = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    gitCommitFull = process.env.GIT_COMMIT_FULL || gitCommit;
  }

  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    gitBranch = process.env.GIT_BRANCH || 'master';
  }

  try {
    gitCommitDate = execSync('git log -1 --format="%cd"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // fallback
  }

  try {
    gitCommitMessage = execSync('git log -1 --format="%s"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // fallback
  }

  try {
    gitAuthor = execSync('git log -1 --format="%an"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // fallback
  }

  const buildTime = new Date().toISOString();
  const nodeEnv = process.env.NODE_ENV || 'development';
  const label = `v${pkgVersion} (#${gitCommit})`;

  cachedVersionInfo = {
    version: pkgVersion,
    gitCommit,
    gitCommitFull,
    gitBranch,
    gitCommitDate,
    gitCommitMessage,
    gitAuthor,
    buildTime,
    nodeEnv,
    label,
  };

  return cachedVersionInfo;
}

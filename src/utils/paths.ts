import path from 'node:path';
import fs from 'node:fs';

/**
 * Returns the uploads directory path.
 * In production with a persistent volume (e.g. Railway /data),
 * uploads are placed in ${DATA_DIR}/uploads so they persist across redeployments.
 */
export function getUploadsDir(): string {
  const baseDir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp' : process.cwd());
  const dir = path.resolve(baseDir, 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

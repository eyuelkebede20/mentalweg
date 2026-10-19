import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app';

let appPromise: any = null;

async function getFastify() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = await buildApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getFastify();
  app.server.emit('request', req, res);
}

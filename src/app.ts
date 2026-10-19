import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import fs from 'fs';
import { env } from './env';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';
import { getAppVersionInfo } from './utils/version';
import { getUploadsDir } from './utils/paths';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
    hook: 'onRequest',
  });

  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  app.register(authRoutes);
  app.register(adminRoutes);
  app.register(publicRoutes);

  // Version metadata route
  app.get('/api/version', async () => {
    return getAppVersionInfo();
  });

  // Health check route
  app.get('/health', async () => {
    const v = getAppVersionInfo();
    return {
      status: 'ok',
      version: v.version,
      commit: v.gitCommit,
      branch: v.gitBranch,
      timestamp: new Date().toISOString(),
    };
  });

  // Serve uploads
  const uploadsDir = getUploadsDir();
  app.register(require('@fastify/static'), {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Never cache Service Worker registration scripts
  app.addHook('onSend', async (request, reply) => {
    const url = request.raw.url || '';
    if (url.includes('sw.js') || url.includes('registerSW.js') || url.includes('manifest.webmanifest')) {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  });

  // 1. Serve admin app (Must register /admin/ before root / to prevent prefix shadowing)
  const adminDist = path.join(__dirname, '../admin/dist');
  if (fs.existsSync(adminDist)) {
    app.register(require('@fastify/static'), {
      root: adminDist,
      prefix: '/admin/',
      decorateReply: false,
    });
  }

  // 2. Redirects for /admin and common typo /amdin
  app.get('/amdin', async (req, reply) => {
    return reply.redirect('/admin/');
  });
  app.get('/amdin/', async (req, reply) => {
    return reply.redirect('/admin/');
  });
  app.get('/amdin/*', async (req, reply) => {
    const target = (req.raw.url || '').replace(/^\/amdin/, '/admin');
    return reply.redirect(target.startsWith('/admin') ? target : '/admin/');
  });
  app.get('/admin', async (req, reply) => {
    return reply.redirect('/admin/');
  });

  // 3. Serve public app at root /
  const publicDist = path.join(__dirname, '../public-app/dist');
  if (fs.existsSync(publicDist)) {
    app.register(require('@fastify/static'), {
      root: publicDist,
      prefix: '/',
    });
  }

  // SPA fallback for non-API routes
  app.setNotFoundHandler(async (req, reply) => {
    const url = req.raw.url || '';

    // Handle common typo /amdin
    if (url.startsWith('/amdin')) {
      const target = url.replace(/^\/amdin/, '/admin');
      return reply.redirect(target.startsWith('/admin') ? target : '/admin/');
    }

    if (url.startsWith('/admin')) {
      const adminIndex = path.join(__dirname, '../admin/dist/index.html');
      if (fs.existsSync(adminIndex)) {
        reply.type('text/html');
        return fs.createReadStream(adminIndex);
      }
      return reply.status(503).send({
        error: 'Admin application not built. Run "npm run build --prefix admin" or access the admin dev server at http://localhost:5174/admin/.'
      });
    }

    if (!url.startsWith('/api') && !url.startsWith('/auth') && !url.startsWith('/uploads')) {
      const publicIndex = path.join(__dirname, '../public-app/dist/index.html');
      if (fs.existsSync(publicIndex)) {
        reply.type('text/html');
        return fs.createReadStream(publicIndex);
      }
    }

    return reply.status(404).send({ error: 'Not Found' });
  });

  return app;
}

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import fs from 'fs';
import { env } from './env';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';

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

  // Health check route
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Serve uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.register(require('@fastify/static'), {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Serve public app
  const publicDist = path.join(__dirname, '../public-app/dist');
  if (fs.existsSync(publicDist)) {
    app.register(require('@fastify/static'), {
      root: publicDist,
      prefix: '/',
    });
  }
  
  // Serve admin app
  const adminDist = path.join(__dirname, '../admin/dist');
  if (fs.existsSync(adminDist)) {
    app.get('/admin', async (req, reply) => {
      return reply.redirect('/admin/');
    });

    app.register(require('@fastify/static'), {
      root: adminDist,
      prefix: '/admin/',
      decorateReply: false,
    });
  }

  // SPA fallback for non-API routes
  app.setNotFoundHandler(async (req, reply) => {
    const url = req.raw.url || '';
    if (url.startsWith('/admin')) {
      const adminIndex = path.join(__dirname, '../admin/dist/index.html');
      if (fs.existsSync(adminIndex)) {
        reply.type('text/html');
        return fs.createReadStream(adminIndex);
      }
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

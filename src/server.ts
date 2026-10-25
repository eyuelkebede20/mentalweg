import { buildApp } from './app';
import { env } from './env';
import { startCronJobs } from './cron';
import { seedContent } from './db/seedContent';
import { seedInitialAdmin } from './seed';

async function start() {
  const app = await buildApp();

  try {
    await seedInitialAdmin();
    await seedContent();
    startCronJobs();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server listening on ${env.BASE_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

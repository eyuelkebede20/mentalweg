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

    // Passenger / CloudLinux socket or port support
    const rawPort = process.env.PORT;
    if (rawPort && (rawPort.startsWith('/') || rawPort.startsWith('\\\\.\\pipe\\'))) {
      await app.listen({ path: rawPort });
      console.log(`Server listening on Passenger socket: ${rawPort}`);
    } else {
      const portNum = rawPort && !isNaN(Number(rawPort)) ? parseInt(rawPort, 10) : (env.PORT || 3000);
      await app.listen({ port: portNum, host: '0.0.0.0' });
      console.log(`Server listening on port ${portNum} (${env.BASE_URL})`);
    }
  } catch (err) {
    app.log.error(err);
    console.error('[Server Boot Error]', err);
    process.exit(1);
  }
}

start();

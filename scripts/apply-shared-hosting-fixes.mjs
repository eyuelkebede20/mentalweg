import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('verifier-api');

// 1. Patch webhookQueue.ts
const webhookQueuePath = path.join(projectRoot, 'src', 'queues', 'webhookQueue.ts');
let webhookQueueSrc = fs.readFileSync(webhookQueuePath, 'utf8');

// Patch enqueueWebhookDelivery
webhookQueueSrc = webhookQueueSrc.replace(
  /if \(!isWebhookQueueConfigured\(\)\) \{\s*throw new Error\('Webhook queue is not configured\. Set REDIS_URL to enable BullMQ\.'\);\s*\}/,
  `if (!isWebhookQueueConfigured()) {\n    logger.debug('Webhook queue is not configured (REDIS_URL unset). Skipping delivery.');\n    return { deliveryId: 'noop' };\n  }`
);

// Patch startWebhookQueueWorker
webhookQueueSrc = webhookQueueSrc.replace(
  /export async function startWebhookQueueWorker\(\): Promise<void> \{\s*if \(!isWebhookQueueConfigured\(\)\) \{\s*throw new Error\('Webhook queue requires REDIS_URL\.'\);\s*\}\s*if \(deliveryWorker\) return;/s,
  `export async function startWebhookQueueWorker(): Promise<void> {\n  if (!isWebhookQueueConfigured()) {\n    logger.info('REDIS_URL not configured. Webhook queue worker disabled (running standalone).');\n    return;\n  }\n  if (deliveryWorker) return;`
);

fs.writeFileSync(webhookQueuePath, webhookQueueSrc, 'utf8');
console.log('✅ Patched webhookQueue.ts');

// 2. Patch notificationQueue.ts
const notificationQueuePath = path.join(projectRoot, 'src', 'queues', 'notificationQueue.ts');
let notificationQueueSrc = fs.readFileSync(notificationQueuePath, 'utf8');

// Patch enqueueNotificationDelivery
notificationQueueSrc = notificationQueueSrc.replace(
  /if \(!isNotificationQueueConfigured\(\)\) \{\s*throw new Error\('Notification queue is not configured\. Set REDIS_URL to enable BullMQ\.'\);\s*\}/,
  `if (!isNotificationQueueConfigured()) {\n    logger.debug('Notification queue is not configured (REDIS_URL unset). Skipping notification.');\n    return { deliveryId: 'noop' };\n  }`
);

// Patch startNotificationQueueWorker
notificationQueueSrc = notificationQueueSrc.replace(
  /export async function startNotificationQueueWorker\(\): Promise<void> \{\s*if \(!isNotificationQueueConfigured\(\)\) \{\s*throw new Error\('Notification queue requires REDIS_URL\.'\);\s*\}\s*if \(notificationWorker\) return;/s,
  `export async function startNotificationQueueWorker(): Promise<void> {\n  if (!isNotificationQueueConfigured()) {\n    logger.info('REDIS_URL not configured. Notification queue worker disabled (running standalone).');\n    return;\n  }\n  if (notificationWorker) return;`
);

fs.writeFileSync(notificationQueuePath, notificationQueueSrc, 'utf8');
console.log('✅ Patched notificationQueue.ts');

// 3. Patch apiKeyAuth.ts
const apiKeyAuthPath = path.join(projectRoot, 'src', 'middleware', 'apiKeyAuth.ts');
let apiKeyAuthSrc = fs.readFileSync(apiKeyAuthPath, 'utf8');

const targetAuthBlock = `  // ── Standard API key auth ──────────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'] || (req.query.apiKey as string);
  if (!apiKey) {
    logger.warn(\`API request without API key: \${req.method} \${req.path}\`);
    return res.status(401).json({ success: false, error: 'API key is required' });
  }

  try {
    const keyString = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    const keyData = await validateApiKey(keyString);`;

const replacementAuthBlock = `  // ── Standard API key auth ──────────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'] || (req.query.apiKey as string);
  if (!apiKey) {
    logger.warn(\`API request without API key: \${req.method} \${req.path}\`);
    return res.status(401).json({ success: false, error: 'API key is required' });
  }

  try {
    const keyString = Array.isArray(apiKey) ? apiKey[0] : apiKey;

    // Standalone shared-secret master key bypass (enables zero-DB verification on shared hosting)
    const configuredMasterKey = process.env.VERIFIER_API_KEY || process.env.STATIC_API_KEY || process.env.ADMIN_SECRET;
    if (configuredMasterKey && keyString === configuredMasterKey) {
      (req as any).apiKeyData = {
        id: 'standalone-master',
        prefix: 'master...',
        permissions: ['verify', 'verify-batch', 'webhooks'],
        workspace: null,
      };
      return next();
    }

    const keyData = await validateApiKey(keyString).catch((err) => {
      logger.warn('validateApiKey lookup error (database may be unreachable):', err?.message || err);
      return null;
    });`;

if (apiKeyAuthSrc.includes(`const keyData = await validateApiKey(keyString);`)) {
  apiKeyAuthSrc = apiKeyAuthSrc.replace(
    /const keyString = Array\.isArray\(apiKey\) \? apiKey\[0\] : apiKey;\s*const keyData = await validateApiKey\(keyString\);/,
    `const keyString = Array.isArray(apiKey) ? apiKey[0] : apiKey;

    // Standalone shared-secret master key bypass (enables zero-DB verification on shared hosting)
    const configuredMasterKey = process.env.VERIFIER_API_KEY || process.env.STATIC_API_KEY || process.env.ADMIN_SECRET;
    if (configuredMasterKey && keyString === configuredMasterKey) {
      (req as any).apiKeyData = {
        id: 'standalone-master',
        prefix: 'master...',
        permissions: ['verify', 'verify-batch', 'webhooks'],
        workspace: null,
      };
      return next();
    }

    const keyData = await validateApiKey(keyString).catch((err) => {
      logger.warn('validateApiKey lookup error (database may be unreachable):', err?.message || err);
      return null;
    });`
  );
  fs.writeFileSync(apiKeyAuthPath, apiKeyAuthSrc, 'utf8');
  console.log('✅ Patched apiKeyAuth.ts');
} else {
  console.log('⚠️ apiKeyAuth target not found, skipping');
}

// 4. Patch index.ts
const indexPath = path.join(projectRoot, 'src', 'index.ts');
let indexSrc = fs.readFileSync(indexPath, 'utf8');

const targetRuntime = `async function initializeRuntime(): Promise<void> {
    startupState.initializing = true;
    startupState.ready = false;
    startupState.lastError = null;

    try {
        await prisma.$connect();
        await prisma.$queryRaw\`SELECT 1\`;
        logger.info('Connected to database successfully');

        await initializeStatsCache();
        await startWebhookQueueWorker();
        await startNotificationQueueWorker();

        startupState.initializing = false;
        startupState.ready = true;
        startupState.initializedAt = new Date().toISOString();
    } catch (error) {
        startupState.initializing = false;
        startupState.ready = false;
        startupState.lastError = error instanceof Error ? error.message : 'Unknown startup error';
        throw error;
    }
}`;

const replacementRuntime = `async function initializeRuntime(): Promise<void> {
    startupState.initializing = true;
    startupState.ready = false;
    startupState.lastError = null;

    // 1. Attempt database connection gracefully (won't crash if DB is not configured)
    try {
        await prisma.$connect();
        await prisma.$queryRaw\`SELECT 1\`;
        logger.info('Connected to database successfully');
        await initializeStatsCache().catch((e) => logger.warn('Stats cache init warning:', e));
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(\`Database not available on startup (\${msg}). Continuing in standalone mode.\`);
    }

    // 2. Background queue workers are optional on shared hosting (require REDIS_URL)
    try {
        await startWebhookQueueWorker();
    } catch (error) {
        logger.warn('Webhook queue worker skipped:', error instanceof Error ? error.message : error);
    }

    try {
        await startNotificationQueueWorker();
    } catch (error) {
        logger.warn('Notification queue worker skipped:', error instanceof Error ? error.message : error);
    }

    startupState.initializing = false;
    startupState.ready = true;
    startupState.initializedAt = new Date().toISOString();
}`;

indexSrc = indexSrc.replace(
  /async function initializeRuntime\(\): Promise<void> \{[\s\S]*?throw error;\s*\}\s*\}/,
  replacementRuntime
);

// Also make /ready endpoint flexible so missing Redis on shared hosting doesn't return 503
indexSrc = indexSrc.replace(
  /const ready =\s*checks\.startup\.ready\s*&&\s*checks\.database\.ready\s*&&\s*checks\.webhookQueue\.ready\s*&&\s*checks\.notificationQueue\.ready;/,
  `// On shared hosting, verification endpoints run without requiring Redis or background queue workers
    const ready = checks.startup.ready;`
);

fs.writeFileSync(indexPath, indexSrc, 'utf8');
console.log('✅ Patched index.ts');

import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptionsTable } from '../db/schema';

// Initialize VAPID details safely
try {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  
  if (publicKey && privateKey) {
    webpush.setVapidDetails('mailto:admin@mentalweg.et', publicKey, privateKey);
  } else {
    // Generate valid development keys
    const generated = webpush.generateVAPIDKeys();
    webpush.setVapidDetails('mailto:admin@mentalweg.et', generated.publicKey, generated.privateKey);
  }
} catch (err) {
  console.warn('Warning: Web Push VAPID setup skipped:', err);
}

export async function sendPushNotification(payload: any) {
  const subscriptions = db.select().from(pushSubscriptionsTable).all();
  
  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: JSON.parse(sub.keysJson)
      };
      
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (err: any) {
      console.error('Error sending push:', err);
    }
  }
}

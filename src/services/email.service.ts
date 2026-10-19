import nodemailer from 'nodemailer';
import { env } from '../env';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

try {
  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
} catch (err) {
  console.warn('SMTP transporter initialization skipped/failed:', err);
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  // Always log in development
  console.log(`[Email Service] Sending email to ${options.to} | Subject: "${options.subject}"`);
  console.log(`[Email Content]:\n${options.text}`);

  if (!transporter) {
    console.log('[Email Service] No SMTP transporter configured. Simulated send succeeded.');
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"Practice Appointments" <${env.SMTP_USER || 'no-reply@mentalweg.et'}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return true;
  } catch (err: any) {
    console.error('[Email Service] Failed to deliver email:', err.message);
    // Don't crash caller in dev; report false
    return false;
  }
}

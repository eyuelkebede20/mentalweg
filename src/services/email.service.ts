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

export async function sendPatientApprovalEmail(to: string, displayName: string, loginUrl: string): Promise<boolean> {
  const subject = 'Your Patient Portal Access has been Approved — Mentalweg';
  const text = `Dear ${displayName},

Your patient account registration at Mentalweg Psychology Practice has been approved by Dr. Hana Almaz.

You can now log in to your patient portal to manage appointments, view your schedule, and book sessions:
${loginUrl}

Warm regards,
Mentalweg Psychology Practice
Addis Ababa, Ethiopia`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1c1917; line-height: 1.6;">
      <h2 style="color: #24574a; margin-top: 0;">Patient Portal Access Approved</h2>
      <p>Dear ${displayName},</p>
      <p>Your registration at <strong>Mentalweg Psychology Practice</strong> has been reviewed and approved by Dr. Hana Almaz.</p>
      <div style="margin: 28px 0;">
        <a href="${loginUrl}" style="background-color: #24574a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">
          Log In to Patient Portal
        </a>
      </div>
      <p style="font-size: 13px; color: #78716c;">
        Or copy and open this link directly in your browser:<br/>
        <a href="${loginUrl}" style="color: #24574a;">${loginUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
      <p style="font-size: 12px; color: #a8a29e; margin: 0;">
        Mentalweg Practice · Bulgaria area, near the African Union, Addis Ababa
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendPatientPasswordResetEmail(to: string, displayName: string, resetUrl: string): Promise<boolean> {
  const subject = 'Password Reset Request — Mentalweg Patient Portal';
  const text = `Dear ${displayName},

We received a request to reset your password for your Mentalweg patient portal.

Please click the link below to set a new password. This single-use link expires in 30 minutes:
${resetUrl}

If you did not request this reset, you can safely ignore this email.

Warm regards,
Mentalweg Psychology Practice`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1c1917; line-height: 1.6;">
      <h2 style="color: #24574a; margin-top: 0;">Password Reset Request</h2>
      <p>Dear ${displayName},</p>
      <p>We received a request to reset the password for your Mentalweg patient portal account.</p>
      <div style="margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #24574a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">
          Reset My Password
        </a>
      </div>
      <p style="font-size: 13px; color: #78716c;">
        This single-use link will expire in <strong>30 minutes</strong>.<br/>
        Direct link: <a href="${resetUrl}" style="color: #24574a;">${resetUrl}</a>
      </p>
      <p style="font-size: 12px; color: #a8a29e; margin-top: 24px;">
        If you did not request a password reset, please disregard this email.
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

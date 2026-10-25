import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const adminTable = sqliteTable('admin', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  notesKeySalt: text('notes_key_salt'),
  notesKeyCheck: text('notes_key_check'),
  ...timestamps,
});

export const settingsTable = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  data: text('data', { mode: 'json' }).notNull(),
  ...timestamps,
});

export const paymentAccountsTable = sqliteTable('payment_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(), // 'telebirr', 'cbe', 'cbebirr', 'dashen', 'abyssinia'
  accountNumber: text('account_number'),
  holderName: text('holder_name'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const holidaysTable = sqliteTable('holidays', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const blocksTable = sqliteTable('blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startUtc: integer('start_utc', { mode: 'timestamp' }).notNull(),
  endUtc: integer('end_utc', { mode: 'timestamp' }).notNull(),
  reason: text('reason'),
  ...timestamps,
});

export const clientsTable = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().unique(), // e.g. C-0001
  displayName: text('display_name').notNull(),
  phoneE164: text('phone_e164').notNull().unique(),
  email: text('email'),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  guardianName: text('guardian_name'),
  note: text('note'),
  bookingToken: text('booking_token').unique(),
  passwordHash: text('password_hash'),
  approvalStatus: text('approval_status').notNull().default('approved'), // 'pending', 'approved', 'rejected'
  googleId: text('google_id'),
  resetToken: text('reset_token'),
  resetTokenExpiresAt: integer('reset_token_expires_at', { mode: 'timestamp' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  ...timestamps,
});

export const seriesTable = sqliteTable('series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').notNull().references(() => clientsTable.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(),
  startLocalTime: text('start_local_time').notNull(),
  durationMin: integer('duration_min').notNull(),
  startsOn: text('starts_on').notNull(),
  endsOn: text('ends_on'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const sessionsTable = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').notNull().references(() => clientsTable.id, { onDelete: 'cascade' }),
  seriesId: integer('series_id').references(() => seriesTable.id, { onDelete: 'set null' }),
  startUtc: integer('start_utc', { mode: 'timestamp' }).notNull(),
  durationMin: integer('duration_min').notNull(),
  status: text('status').notNull(), // 'held', 'awaiting_payment', 'confirmed', 'attended', 'no_show', 'cancelled', 'expired', 'needs_review'
  source: text('source').notNull(), // 'public', 'manual', 'series'
  feeDueCents: integer('fee_due_cents').notNull(),
  feeWaived: integer('fee_waived', { mode: 'boolean' }).notNull().default(false),
  holdExpiresAt: integer('hold_expires_at', { mode: 'timestamp' }),
  originalStartUtc: integer('original_start_utc', { mode: 'timestamp' }),
  consentAcceptedAt: integer('consent_accepted_at', { mode: 'timestamp' }),
  consentVersion: text('consent_version'),
  ...timestamps,
});

export const sessionChangesTable = sqliteTable('session_changes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessionsTable.id, { onDelete: 'cascade' }),
  fromStartUtc: integer('from_start_utc', { mode: 'timestamp' }).notNull(),
  toStartUtc: integer('to_start_utc', { mode: 'timestamp' }).notNull(),
  by: text('by').notNull(), // 'client', 'admin'
  at: integer('at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
});

export const paymentsTable = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').references(() => sessionsTable.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  reference: text('reference').notNull(),
  amountCents: integer('amount_cents').notNull(),
  receiverAccount: text('receiver_account'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  method: text('method').notNull(), // 'auto', 'manual'
  rawResponseJson: text('raw_response_json'),
  screenshotPath: text('screenshot_path'),
  ...timestamps,
}, (t) => ({
  unq: unique().on(t.provider, t.reference),
}));

export const pushSubscriptionsTable = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  endpoint: text('endpoint').notNull(),
  keysJson: text('keys_json').notNull(),
  ...timestamps,
});

export const remindersTable = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessionsTable.id, { onDelete: 'cascade' }),
  dueAt: integer('due_at', { mode: 'timestamp' }).notNull(),
  notifiedAt: integer('notified_at', { mode: 'timestamp' }),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  channel: text('channel').notNull(), // 'email', 'sms'
  ...timestamps,
});

export const auditLogTable = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: integer('at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  ...timestamps,
});

export const postsTable = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  category: text('category').notNull().default('Therapy & Insights'),
  authorName: text('author_name').notNull().default('Dr. Hana Almaz'),
  coverImageUrl: text('cover_image_url'),
  readTimeMin: integer('read_time_min').notNull().default(4),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  tags: text('tags'),
  ...timestamps,
});

export const materialsTable = sqliteTable('materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: text('file_size').notNull().default('1.0 MB'),
  fileType: text('file_type').notNull().default('pdf'),
  category: text('category').notNull().default('Clinical Worksheet'),
  downloadCount: integer('download_count').notNull().default(0),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

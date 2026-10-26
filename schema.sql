-- ==============================================================================
-- Mentalweg Clinical & Practice Management System - Database Schema (SQLite)
-- Deployment Target: https://mentalweg.senaycreatives.com
-- Engine: SQLite 3 with WAL Journal Mode
-- ==============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------------------------
-- 1. Practitioners & Admin Authentication
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` TEXT NOT NULL UNIQUE,
  `password_hash` TEXT NOT NULL,
  `notes_key_salt` TEXT,
  `notes_key_check` TEXT,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `admin_email_unique` ON `admin` (`email`);

-- ------------------------------------------------------------------------------
-- 2. Practice Clinical Settings & Hours Configuration
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `data` TEXT NOT NULL, -- JSON blob conforming to SettingsSchema
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. Payment Accounts (Telebirr, CBE, CBE Birr, Dashen, Abyssinia)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_accounts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `provider` TEXT NOT NULL, -- 'telebirr', 'cbe', 'cbebirr', 'dashen', 'abyssinia'
  `account_number` TEXT,
  `holder_name` TEXT,
  `active` INTEGER DEFAULT 1 NOT NULL,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. Ethiopian National & Clinical Holidays
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` TEXT NOT NULL, -- 'YYYY-MM-DD'
  `name` TEXT NOT NULL,
  `active` INTEGER DEFAULT 1 NOT NULL,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. Time Blocks (Lunch, Breaks, Leave, Clinical Supervision)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blocks` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `start_utc` INTEGER NOT NULL, -- Unix timestamp (seconds or ms)
  `end_utc` INTEGER NOT NULL,
  `reason` TEXT,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. Patients & Clients
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `clients` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `public_id` TEXT NOT NULL UNIQUE, -- e.g. C-0001
  `display_name` TEXT NOT NULL,
  `phone_e164` TEXT NOT NULL UNIQUE, -- e.g. +251911234567
  `email` TEXT,
  `is_verified` INTEGER DEFAULT 0 NOT NULL,
  `guardian_name` TEXT,
  `note` TEXT,
  `booking_token` TEXT UNIQUE,
  `password_hash` TEXT,
  `approval_status` TEXT DEFAULT 'approved' NOT NULL, -- 'pending', 'approved', 'rejected'
  `google_id` TEXT,
  `reset_token` TEXT,
  `reset_token_expires_at` INTEGER,
  `deleted_at` INTEGER,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `clients_public_id_unique` ON `clients` (`public_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `clients_phone_e164_unique` ON `clients` (`phone_e164`);
CREATE UNIQUE INDEX IF NOT EXISTS `clients_booking_token_unique` ON `clients` (`booking_token`);

-- ------------------------------------------------------------------------------
-- 7. Recurring Weekly Series (Weekly recurring therapy sessions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `series` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `client_id` INTEGER NOT NULL REFERENCES `clients`(`id`) ON DELETE CASCADE,
  `weekday` INTEGER NOT NULL, -- 0 = Sun, 1 = Mon ... 6 = Sat
  `start_local_time` TEXT NOT NULL, -- 'HH:mm' (e.g. '10:00')
  `duration_min` INTEGER NOT NULL, -- e.g. 60
  `starts_on` TEXT NOT NULL, -- 'YYYY-MM-DD'
  `ends_on` TEXT, -- 'YYYY-MM-DD' (optional horizon)
  `active` INTEGER DEFAULT 1 NOT NULL,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. Therapy Sessions & Appointments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `client_id` INTEGER NOT NULL REFERENCES `clients`(`id`) ON DELETE CASCADE,
  `series_id` INTEGER REFERENCES `series`(`id`) ON DELETE SET NULL,
  `start_utc` INTEGER NOT NULL,
  `duration_min` INTEGER NOT NULL,
  `status` TEXT NOT NULL, -- 'held', 'awaiting_payment', 'confirmed', 'attended', 'no_show', 'cancelled', 'expired', 'needs_review'
  `source` TEXT NOT NULL, -- 'public', 'manual', 'series'
  `fee_due_cents` INTEGER NOT NULL, -- ETB cents (e.g. 120000 = 1,200 ETB)
  `fee_waived` INTEGER DEFAULT 0 NOT NULL,
  `hold_expires_at` INTEGER,
  `original_start_utc` INTEGER,
  `consent_accepted_at` INTEGER,
  `consent_version` TEXT,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 9. Session Rescheduling & Audit Changes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `session_changes` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` INTEGER NOT NULL REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  `from_start_utc` INTEGER NOT NULL,
  `to_start_utc` INTEGER NOT NULL,
  `by` TEXT NOT NULL, -- 'client', 'admin'
  `at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 10. Financial Transactions & Payment Receipts (Telebirr, CBE, etc.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` INTEGER REFERENCES `sessions`(`id`) ON DELETE SET NULL,
  `provider` TEXT NOT NULL, -- 'telebirr', 'cbe', 'cbebirr', 'dashen', 'abyssinia'
  `reference` TEXT NOT NULL, -- Bank / Telebirr transaction code
  `amount_cents` INTEGER NOT NULL,
  `receiver_account` TEXT,
  `paid_at` INTEGER,
  `verified` INTEGER DEFAULT 0 NOT NULL,
  `method` TEXT NOT NULL, -- 'auto', 'manual'
  `raw_response_json` TEXT,
  `screenshot_path` TEXT,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
  UNIQUE(`provider`, `reference`)
);

CREATE UNIQUE INDEX IF NOT EXISTS `payments_provider_reference_unique` ON `payments` (`provider`, `reference`);

-- ------------------------------------------------------------------------------
-- 11. Web Push Notification Subscriptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `endpoint` TEXT NOT NULL,
  `keys_json` TEXT NOT NULL,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 12. Automated Appointment Reminders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reminders` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` INTEGER NOT NULL REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  `due_at` INTEGER NOT NULL,
  `notified_at` INTEGER,
  `sent_at` INTEGER,
  `channel` TEXT NOT NULL, -- 'email', 'sms'
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 13. System & Administrative Audit Log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
  `actor` TEXT NOT NULL,
  `action` TEXT NOT NULL,
  `entity` TEXT NOT NULL,
  `entity_id` INTEGER,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 14. Psychoeducation Articles & Blog Posts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `posts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` TEXT NOT NULL,
  `slug` TEXT NOT NULL UNIQUE,
  `excerpt` TEXT,
  `content` TEXT NOT NULL,
  `category` TEXT DEFAULT 'Therapy & Insights' NOT NULL,
  `author_name` TEXT DEFAULT 'Dr. Hana Almaz' NOT NULL,
  `cover_image_url` TEXT,
  `read_time_min` INTEGER DEFAULT 4 NOT NULL,
  `published` INTEGER DEFAULT 1 NOT NULL,
  `published_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
  `tags` TEXT,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `posts_slug_unique` ON `posts` (`slug`);

-- ------------------------------------------------------------------------------
-- 15. Downloadable Clinical Worksheets & Self-Help Materials
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `materials` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` TEXT NOT NULL,
  `description` TEXT,
  `file_url` TEXT NOT NULL,
  `file_name` TEXT NOT NULL,
  `file_size` TEXT DEFAULT '1.0 MB' NOT NULL,
  `file_type` TEXT DEFAULT 'pdf' NOT NULL,
  `category` TEXT DEFAULT 'Clinical Worksheet' NOT NULL,
  `download_count` INTEGER DEFAULT 0 NOT NULL,
  `published` INTEGER DEFAULT 1 NOT NULL,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- ==============================================================================
-- INITIAL DEFAULT SEED DATA
-- ==============================================================================

-- Default Primary Administrator (Email: admin@example.com / Password: admin123)
-- Password hash generated using argon2id (compatible with Mentalweg authentication)
INSERT OR IGNORE INTO `admin` (`id`, `email`, `password_hash`)
VALUES
  (1, 'admin@example.com', '$argon2id$v=19$m=65536,p=4,t=3$R98yJhiko8VHvEUZ5UCG1g$Ubc3s76tARr21fx+CWAF5977A41qtHS90R1NPcw0wQw');

-- Default Payment Accounts (Telebirr & Commercial Bank of Ethiopia)
INSERT OR IGNORE INTO `payment_accounts` (`id`, `provider`, `account_number`, `holder_name`, `active`)
VALUES
  (1, 'telebirr', '0911234567', 'Mentalweg Psychology Practice', 1),
  (2, 'cbe', '1000123456789', 'Mentalweg Clinical Services', 1);

-- Default Ethiopian Public Holidays
INSERT OR IGNORE INTO `holidays` (`id`, `date`, `name`, `active`)
VALUES
  (1, '2026-09-11', 'Enkutatash (Ethiopian New Year)', 1),
  (2, '2026-09-27', 'Meskel (Finding of True Cross)', 1),
  (3, '2026-01-07', 'Genna (Ethiopian Christmas)', 1),
  (4, '2026-01-19', 'Timkat (Ethiopian Epiphany)', 1),
  (5, '2026-03-02', 'Victory of Adwa Day', 1),
  (6, '2026-05-01', 'International Labour Day', 1),
  (7, '2026-05-05', 'Patriots Victory Day', 1),
  (8, '2026-05-28', 'Derg Downfall Day', 1);

-- Default Psychoeducation Post
INSERT OR IGNORE INTO `posts` (`id`, `title`, `slug`, `excerpt`, `content`, `category`, `author_name`, `read_time_min`, `published`)
VALUES
  (1, 'Understanding Anxiety & Cognitive Grounding', 'understanding-anxiety-grounding', 'A clinical guide to somatic grounding techniques and practical emotional regulation during high stress.', 'Anxiety often presents as somatic dysregulation. When sympathetic nervous arousal peaks, grounding through the 5-4-3-2-1 sensory method provides cognitive re-centering...', 'Therapy & Insights', 'Dr. Hana Almaz', 4, 1);

-- Default Clinical Worksheet Material
INSERT OR IGNORE INTO `materials` (`id`, `title`, `description`, `file_url`, `file_name`, `file_size`, `file_type`, `category`, `published`)
VALUES
  (1, 'Daily Thought Record & Cognitive Distortion Matrix', 'Standard clinical cognitive restructuring worksheet for tracking automatic negative thoughts.', '/uploads/worksheets/cbt-thought-record.pdf', 'cbt-thought-record.pdf', '245 KB', 'pdf', 'Clinical Worksheet', 1);

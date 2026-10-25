import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists before opening SQLite database
const resolvedDbDir = process.env.DATA_DIR 
  ? path.resolve(process.env.DATA_DIR)
  : (process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data'));

try {
  fs.mkdirSync(resolvedDbDir, { recursive: true });
} catch (e) {
  console.warn('[Database] Could not create data directory:', resolvedDbDir, e);
}

const dbPath = path.join(resolvedDbDir, 'data.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Self-healing schema migration: ensure all tables exist on boot
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    notes_key_salt TEXT,
    notes_key_check TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    provider TEXT NOT NULL,
    account_number TEXT,
    holder_name TEXT,
    active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    start_utc INTEGER NOT NULL,
    end_utc INTEGER NOT NULL,
    reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    public_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    phone_e164 TEXT NOT NULL UNIQUE,
    email TEXT,
    is_verified INTEGER DEFAULT 0 NOT NULL,
    guardian_name TEXT,
    note TEXT,
    booking_token TEXT UNIQUE,
    password_hash TEXT,
    approval_status TEXT DEFAULT 'approved' NOT NULL,
    google_id TEXT,
    reset_token TEXT,
    reset_token_expires_at INTEGER,
    deleted_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    start_local_time TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    starts_on TEXT NOT NULL,
    ends_on TEXT,
    active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    series_id INTEGER REFERENCES series(id) ON DELETE SET NULL,
    start_utc INTEGER NOT NULL,
    duration_min INTEGER NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    fee_due_cents INTEGER NOT NULL,
    fee_waived INTEGER DEFAULT 0 NOT NULL,
    hold_expires_at INTEGER,
    original_start_utc INTEGER,
    consent_accepted_at INTEGER,
    consent_version TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    from_start_utc INTEGER NOT NULL,
    to_start_utc INTEGER NOT NULL,
    by TEXT NOT NULL,
    at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    receiver_account TEXT,
    paid_at INTEGER,
    verified INTEGER DEFAULT 0 NOT NULL,
    method TEXT NOT NULL,
    raw_response_json TEXT,
    screenshot_path TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    UNIQUE(provider, reference)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    endpoint TEXT NOT NULL,
    keys_json TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    due_at INTEGER NOT NULL,
    notified_at INTEGER,
    sent_at INTEGER,
    channel TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Therapy & Insights',
    author_name TEXT NOT NULL DEFAULT 'Dr. Hana Almaz',
    cover_image_url TEXT,
    read_time_min INTEGER NOT NULL DEFAULT 4,
    published INTEGER NOT NULL DEFAULT 1,
    published_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    tags TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size TEXT NOT NULL DEFAULT '1.0 MB',
    file_type TEXT NOT NULL DEFAULT 'pdf',
    category TEXT NOT NULL DEFAULT 'Clinical Worksheet',
    download_count INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

// Safe incremental columns for clients table (patient authentication & approval)
try { sqlite.exec("ALTER TABLE clients ADD COLUMN password_hash TEXT;"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved';"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN google_id TEXT;"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN reset_token TEXT;"); } catch {}
try { sqlite.exec("ALTER TABLE clients ADD COLUMN reset_token_expires_at INTEGER;"); } catch {}

export const db = drizzle(sqlite, { schema });

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const dbPath = process.env.DATA_DIR ? `${process.env.DATA_DIR}/data.db` : './data.db';

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Ensure content and materials tables exist
sqlite.exec(`
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

export const db = drizzle(sqlite, { schema });

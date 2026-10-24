DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  job_url TEXT,
  board TEXT,
  location TEXT,
  work_type TEXT,
  salary_text TEXT,
  status TEXT NOT NULL DEFAULT 'saved',
  applied_date INTEGER,
  deadline INTEGER,
  next_step TEXT,
  notes TEXT,
  saved_search_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL,
  location TEXT,
  board TEXT,
  url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  blob_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

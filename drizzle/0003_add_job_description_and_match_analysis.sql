ALTER TABLE applications ADD COLUMN job_description TEXT;
--> statement-breakpoint
ALTER TABLE applications ADD COLUMN match_percent INTEGER;
--> statement-breakpoint
ALTER TABLE applications ADD COLUMN match_checked_at INTEGER;
--> statement-breakpoint
CREATE TABLE match_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  resume_id INTEGER,
  resume_name TEXT,
  match_percent INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  summary TEXT NOT NULL,
  matched_keywords TEXT NOT NULL DEFAULT '[]',
  missing_keywords TEXT NOT NULL DEFAULT '[]',
  strengths TEXT NOT NULL DEFAULT '[]',
  gaps TEXT NOT NULL DEFAULT '[]',
  suggestions TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

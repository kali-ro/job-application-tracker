// Drizzle schema for the Job Application Tracker.
//
// Tables:
//   applications  — one row per tracked job, moving through pipeline stages;
//                   carries the saved job description and the latest
//                   resume-match percentage for board display
//   savedSearches — the user's named job searches (keywords/board/location)
//   resumes       — resume versions, optionally tailored to an application;
//                   file bytes are NOT stored here (see documents)
//   documents     — uploaded files (resume PDFs, cover letters, …). Binary
//                   payloads live in ctx.blobs; only the blob key is kept here.
//   matchAnalyses — one row per resume-vs-job-description check: the
//                   percentage, keyword overlap, strengths/gaps, and the
//                   per-job edit suggestions generated for that pairing.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company: text("company").notNull(),
  title: text("title").notNull(),
  jobUrl: text("job_url"),
  board: text("board"),
  location: text("location"),
  workType: text("work_type", {
    enum: ["remote", "hybrid", "onsite"],
  }),
  salaryText: text("salary_text"),
  status: text("status", { enum: APPLICATION_STATUSES })
    .notNull()
    .default("saved"),
  appliedDate: integer("applied_date", { mode: "timestamp_ms" }),
  deadline: integer("deadline", { mode: "timestamp_ms" }),
  nextStep: text("next_step"),
  notes: text("notes"),
  jobDescription: text("job_description"),
  matchPercent: integer("match_percent"),
  matchCheckedAt: integer("match_checked_at", { mode: "timestamp_ms" }),
  savedSearchId: integer("saved_search_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const savedSearches = sqliteTable("saved_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  keywords: text("keywords").notNull(),
  location: text("location"),
  board: text("board"),
  url: text("url"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const resumes = sqliteTable("resumes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id"),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const matchAnalyses = sqliteTable("match_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull(),
  resumeId: integer("resume_id"),
  resumeName: text("resume_name"),
  matchPercent: integer("match_percent").notNull(),
  verdict: text("verdict").notNull(),
  summary: text("summary").notNull(),
  // JSON-encoded string arrays / suggestion objects — read as a unit,
  // never filtered on, so they live as text rather than join tables.
  matchedKeywords: text("matched_keywords").notNull().default("[]"),
  missingKeywords: text("missing_keywords").notNull().default("[]"),
  strengths: text("strengths").notNull().default("[]"),
  gaps: text("gaps").notNull().default("[]"),
  suggestions: text("suggestions").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id"),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  blobKey: text("blob_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

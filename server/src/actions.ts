// Actions for the Job Application Tracker.
//
// All state is user-entered: applications, saved job searches, resume
// versions (text), and uploaded files (bytes in ctx.blobs, metadata here).
// The only model call is `tailorResume`, which rewrites a resume against a
// job description the user pastes in — it returns suggestions and a draft,
// never writes anything by itself.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { asc, desc, eq, isNull } from "drizzle-orm";
import * as schema from "./schema";

const statusEnum = z.enum(schema.APPLICATION_STATUSES);
const workTypeEnum = z.enum(["remote", "hybrid", "onsite"]);

const applicationOut = z.object({
  id: z.number(),
  company: z.string(),
  title: z.string(),
  jobUrl: z.string().nullable(),
  board: z.string().nullable(),
  location: z.string().nullable(),
  workType: workTypeEnum.nullable(),
  salaryText: z.string().nullable(),
  status: statusEnum,
  appliedDate: z.string().nullable(),
  deadline: z.string().nullable(),
  nextStep: z.string().nullable(),
  notes: z.string().nullable(),
  jobDescription: z.string().nullable(),
  matchPercent: z.number().nullable(),
  matchCheckedAt: z.string().nullable(),
  savedSearchId: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type ApplicationRow = typeof schema.applications.$inferSelect;

function appToOut(row: ApplicationRow): z.infer<typeof applicationOut> {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    jobUrl: row.jobUrl,
    board: row.board,
    location: row.location,
    workType: row.workType,
    salaryText: row.salaryText,
    status: row.status,
    appliedDate: row.appliedDate ? row.appliedDate.toISOString() : null,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    nextStep: row.nextStep,
    notes: row.notes,
    jobDescription: row.jobDescription,
    matchPercent: row.matchPercent,
    matchCheckedAt: row.matchCheckedAt
      ? row.matchCheckedAt.toISOString()
      : null,
    savedSearchId: row.savedSearchId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const applicationInput = z.object({
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  jobUrl: z.string().trim().max(1000).optional(),
  board: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  workType: workTypeEnum.optional(),
  salaryText: z.string().trim().max(200).optional(),
  status: statusEnum.default("saved"),
  appliedDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  nextStep: z.string().trim().max(500).optional(),
  notes: z.string().max(10000).optional(),
  jobDescription: z.string().max(50000).optional(),
  savedSearchId: z.number().int().positive().nullable().optional(),
});

function inputToValues(args: z.infer<typeof applicationInput>) {
  return {
    company: args.company,
    title: args.title,
    jobUrl: args.jobUrl || null,
    board: args.board || null,
    location: args.location || null,
    workType: args.workType ?? null,
    salaryText: args.salaryText || null,
    status: args.status,
    appliedDate: args.appliedDate ? new Date(args.appliedDate) : null,
    deadline: args.deadline ? new Date(args.deadline) : null,
    nextStep: args.nextStep || null,
    notes: args.notes || null,
    jobDescription: args.jobDescription?.trim() || null,
    savedSearchId: args.savedSearchId ?? null,
  };
}

const okResponse = z.object({ ok: z.literal(true) });

const savedSearchOut = z.object({
  id: z.number(),
  name: z.string(),
  keywords: z.string(),
  location: z.string().nullable(),
  board: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type SavedSearchRow = typeof schema.savedSearches.$inferSelect;

function searchToOut(row: SavedSearchRow): z.infer<typeof savedSearchOut> {
  return {
    id: row.id,
    name: row.name,
    keywords: row.keywords,
    location: row.location,
    board: row.board,
    url: row.url,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const resumeOut = z.object({
  id: z.number(),
  applicationId: z.number().nullable(),
  name: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type ResumeRow = typeof schema.resumes.$inferSelect;

function resumeToOut(row: ResumeRow): z.infer<typeof resumeOut> {
  return {
    id: row.id,
    applicationId: row.applicationId,
    name: row.name,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const editSuggestion = z.object({
  section: z.string(),
  original: z.string(),
  revised: z.string(),
  reason: z.string(),
});

const matchAnalysisOut = z.object({
  id: z.number(),
  applicationId: z.number(),
  resumeId: z.number().nullable(),
  resumeName: z.string().nullable(),
  matchPercent: z.number(),
  verdict: z.string(),
  summary: z.string(),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  suggestions: z.array(editSuggestion),
  createdAt: z.string(),
});

type MatchAnalysisRow = typeof schema.matchAnalyses.$inferSelect;

function parseStringArray(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function parseSuggestions(raw: string): z.infer<typeof editSuggestion>[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is z.infer<typeof editSuggestion> =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as { section?: unknown }).section === "string" &&
        typeof (x as { original?: unknown }).original === "string" &&
        typeof (x as { revised?: unknown }).revised === "string" &&
        typeof (x as { reason?: unknown }).reason === "string",
    );
  } catch {
    return [];
  }
}

function analysisToOut(
  row: MatchAnalysisRow,
): z.infer<typeof matchAnalysisOut> {
  return {
    id: row.id,
    applicationId: row.applicationId,
    resumeId: row.resumeId,
    resumeName: row.resumeName,
    matchPercent: row.matchPercent,
    verdict: row.verdict,
    summary: row.summary,
    matchedKeywords: parseStringArray(row.matchedKeywords),
    missingKeywords: parseStringArray(row.missingKeywords),
    strengths: parseStringArray(row.strengths),
    gaps: parseStringArray(row.gaps),
    suggestions: parseSuggestions(row.suggestions),
    createdAt: row.createdAt.toISOString(),
  };
}

const documentOut = z.object({
  id: z.number(),
  applicationId: z.number().nullable(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  url: z.string(),
  createdAt: z.string(),
});

async function listDocumentsFor(
  ctx: Ctx,
  applicationId: number | null,
): Promise<z.infer<typeof documentOut>[]> {
  const db = ctx.db<typeof schema>();
  const rows =
    applicationId === null
      ? await db
          .select()
          .from(schema.documents)
          .where(isNull(schema.documents.applicationId))
          .orderBy(desc(schema.documents.id))
      : await db
          .select()
          .from(schema.documents)
          .where(eq(schema.documents.applicationId, applicationId))
          .orderBy(desc(schema.documents.id));
  const out: z.infer<typeof documentOut>[] = [];
  for (const row of rows) {
    out.push({
      id: row.id,
      applicationId: row.applicationId,
      name: row.name,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      url: await ctx.blobs.getUrl(row.blobKey),
      createdAt: row.createdAt.toISOString(),
    });
  }
  return out;
}

export const Actions = {
  // ---------- Applications ----------

  listApplications: defineAction({
    request: z.object({}),
    response: z.object({ applications: z.array(applicationOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .orderBy(desc(schema.applications.updatedAt));
      return { applications: rows.map(appToOut) };
    },
  }),

  createApplication: defineAction({
    request: applicationInput,
    response: z.object({ application: applicationOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const result = await db
        .insert(schema.applications)
        .values({ ...inputToValues(args), createdAt: now, updatedAt: now })
        .returning();
      const row = result[0];
      if (!row) throw new Error("createApplication: insert returned no rows");
      ctx.invalidateQueries();
      return { application: appToOut(row) };
    },
  }),

  updateApplication: defineAction({
    request: applicationInput.extend({ id: z.number().int().positive() }),
    response: z.object({ application: applicationOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .update(schema.applications)
        .set({ ...inputToValues(args), updatedAt: new Date() })
        .where(eq(schema.applications.id, args.id))
        .returning();
      const row = result[0];
      if (!row) throw new Error("updateApplication: application not found");
      ctx.invalidateQueries();
      return { application: appToOut(row) };
    },
  }),

  updateApplicationStatus: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      status: statusEnum,
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const patch: Partial<ApplicationRow> = {
        status: args.status,
        updatedAt: new Date(),
      };
      // Stamping the applied date the first time a job enters "applied"
      // keeps the timeline honest without the user having to type it.
      if (args.status === "applied") {
        const existing = await db
          .select({ appliedDate: schema.applications.appliedDate })
          .from(schema.applications)
          .where(eq(schema.applications.id, args.id))
          .limit(1);
        if (existing[0] && existing[0].appliedDate === null) {
          patch.appliedDate = new Date();
        }
      }
      await db
        .update(schema.applications)
        .set(patch)
        .where(eq(schema.applications.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteApplication: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      // Files attached to this application lose their link but are kept in
      // the library; resumes keep their link cleared the same way.
      await db
        .update(schema.documents)
        .set({ applicationId: null })
        .where(eq(schema.documents.applicationId, args.id));
      await db
        .update(schema.resumes)
        .set({ applicationId: null })
        .where(eq(schema.resumes.applicationId, args.id));
      await db
        .delete(schema.matchAnalyses)
        .where(eq(schema.matchAnalyses.applicationId, args.id));
      await db
        .delete(schema.applications)
        .where(eq(schema.applications.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Saved searches ----------

  listSavedSearches: defineAction({
    request: z.object({}),
    response: z.object({ searches: z.array(savedSearchOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.savedSearches)
        .orderBy(asc(schema.savedSearches.name));
      return { searches: rows.map(searchToOut) };
    },
  }),

  createSavedSearch: defineAction({
    request: z.object({
      name: z.string().trim().min(1).max(200),
      keywords: z.string().trim().min(1).max(500),
      location: z.string().trim().max(200).optional(),
      board: z.string().trim().max(100).optional(),
      url: z.string().trim().max(1000).optional(),
      notes: z.string().max(5000).optional(),
    }),
    response: z.object({ search: savedSearchOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const result = await db
        .insert(schema.savedSearches)
        .values({
          name: args.name,
          keywords: args.keywords,
          location: args.location || null,
          board: args.board || null,
          url: args.url || null,
          notes: args.notes || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("createSavedSearch: insert returned no rows");
      ctx.invalidateQueries();
      return { search: searchToOut(row) };
    },
  }),

  deleteSavedSearch: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.applications)
        .set({ savedSearchId: null })
        .where(eq(schema.applications.savedSearchId, args.id));
      await db
        .delete(schema.savedSearches)
        .where(eq(schema.savedSearches.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Resumes ----------

  listResumes: defineAction({
    request: z.object({}),
    response: z.object({ resumes: z.array(resumeOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.resumes)
        .orderBy(desc(schema.resumes.updatedAt));
      return { resumes: rows.map(resumeToOut) };
    },
  }),

  createResume: defineAction({
    request: z.object({
      name: z.string().trim().min(1).max(200),
      content: z.string().max(100000).default(""),
      applicationId: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ resume: resumeOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const result = await db
        .insert(schema.resumes)
        .values({
          name: args.name,
          content: args.content,
          applicationId: args.applicationId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("createResume: insert returned no rows");
      ctx.invalidateQueries();
      return { resume: resumeToOut(row) };
    },
  }),

  updateResume: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(200),
      content: z.string().max(100000),
      applicationId: z.number().int().positive().nullable(),
    }),
    response: z.object({ resume: resumeOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .update(schema.resumes)
        .set({
          name: args.name,
          content: args.content,
          applicationId: args.applicationId,
          updatedAt: new Date(),
        })
        .where(eq(schema.resumes.id, args.id))
        .returning();
      const row = result[0];
      if (!row) throw new Error("updateResume: resume not found");
      ctx.invalidateQueries();
      return { resume: resumeToOut(row) };
    },
  }),

  deleteResume: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.resumes).where(eq(schema.resumes.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  tailorResume: defineAction({
    request: z.object({
      resumeContent: z.string().trim().min(20).max(100000),
      jobTitle: z.string().trim().max(200).optional(),
      company: z.string().trim().max(200).optional(),
      jobDescription: z.string().trim().min(20).max(50000),
    }),
    response: z.object({
      suggestions: z.array(
        z.object({
          section: z.string(),
          original: z.string(),
          revised: z.string(),
          reason: z.string(),
        }),
      ),
      tailoredResume: z.string(),
    }),
    async handler(ctx, args) {
      const target = [args.jobTitle, args.company]
        .filter(Boolean)
        .join(" at ");
      const result = await ctx.inference.complete(
        [
          "You are an expert resume editor. Tailor the resume below for the job described.",
          target ? `Target role: ${target}.` : "",
          "",
          "Rules:",
          "- Never invent experience, employers, dates, degrees, or metrics the resume does not contain.",
          "- Reorder, reword, and emphasize what is already there so the most relevant material leads.",
          "- Mirror the job description's terminology only where the resume genuinely supports it.",
          "- Keep the resume's plain-text structure (section headings, bullets) so it can be pasted back into a document.",
          "",
          "For each meaningful change, produce one suggestion: the section it belongs to, the original text, the revised text, and a one-sentence reason tied to the job description.",
          "Also produce the full tailored resume text with all suggestions applied.",
          "",
          "=== RESUME ===",
          args.resumeContent,
          "",
          "=== JOB DESCRIPTION ===",
          args.jobDescription,
        ].join("\n"),
        {
          schema: z.object({
            suggestions: z.array(
              z.object({
                section: z.string(),
                original: z.string(),
                revised: z.string(),
                reason: z.string(),
              }),
            ),
            tailoredResume: z.string(),
          }),
        },
      );
      return result;
    },
  }),

  // ---------- Resume match check ----------

  listMatchAnalyses: defineAction({
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({ analyses: z.array(matchAnalysisOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.matchAnalyses)
        .where(eq(schema.matchAnalyses.applicationId, args.applicationId))
        .orderBy(desc(schema.matchAnalyses.id));
      return { analyses: rows.map(analysisToOut) };
    },
  }),

  analyzeResumeMatch: defineAction({
    request: z.object({
      applicationId: z.number().int().positive(),
      resumeId: z.number().int().positive(),
    }),
    response: z.object({ analysis: matchAnalysisOut }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const appRows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = appRows[0];
      if (!app) throw new Error("analyzeResumeMatch: application not found");
      const jd = (app.jobDescription ?? "").trim();
      if (jd.length < 20) {
        throw new Error(
          "analyzeResumeMatch: save the job description for this job first",
        );
      }
      const resumeRows = await db
        .select()
        .from(schema.resumes)
        .where(eq(schema.resumes.id, args.resumeId))
        .limit(1);
      const resume = resumeRows[0];
      if (!resume) throw new Error("analyzeResumeMatch: resume not found");
      if (resume.content.trim().length < 20) {
        throw new Error(
          "analyzeResumeMatch: the selected resume has no text yet",
        );
      }

      const result = await ctx.inference.complete(
        [
          "You are an expert recruiter and resume analyst. Compare the resume below against the job description and score how well it matches.",
          `Target role: ${app.title} at ${app.company}.`,
          "",
          "Scoring rules:",
          "- matchPercent is an integer 0-100 reflecting how strongly the resume evidences the job description's core requirements: required skills and technologies, relevant experience, seniority, and domain fit. Weight core requirements heavily; nice-to-haves lightly.",
          "- Be honest and calibrated: a resume missing several core requirements should score below 60; a strong, well-evidenced match scores 80+.",
          "- Judge only what the resume actually says. Never credit experience, skills, or metrics that are not in the resume text.",
          "- matchedKeywords: the job description's important skills/terms that the resume genuinely evidences (short phrases, max 10).",
          "- missingKeywords: important skills/terms from the job description that the resume does not evidence (short phrases, max 10).",
          "- strengths: 2-4 short points where the resume aligns especially well with this posting.",
          "- gaps: 2-4 short points naming the most important mismatches or missing evidence.",
          "- suggestions: concrete edits to THIS resume for THIS job. Each has the section, the original text (quote the resume briefly; use an empty string when the suggestion adds new material drawn from elsewhere in the resume), the revised text, and a one-sentence reason tied to the job description. Never invent experience, employers, dates, degrees, or metrics. Order by impact, most valuable first, max 5.",
          "- verdict: one short label such as 'Strong match', 'Good match', 'Partial match', or 'Weak match'.",
          "- summary: 2 sentences a job seeker can act on.",
          "",
          "=== RESUME ===",
          resume.content,
          "",
          "=== JOB DESCRIPTION ===",
          jd,
        ].join("\n"),
        {
          schema: z.object({
            matchPercent: z.number().int().min(0).max(100),
            verdict: z.string(),
            summary: z.string(),
            matchedKeywords: z.array(z.string()),
            missingKeywords: z.array(z.string()),
            strengths: z.array(z.string()),
            gaps: z.array(z.string()),
            suggestions: z.array(editSuggestion),
          }),
        },
      );

      const now = new Date();
      const inserted = await db
        .insert(schema.matchAnalyses)
        .values({
          applicationId: app.id,
          resumeId: resume.id,
          resumeName: resume.name,
          matchPercent: result.matchPercent,
          verdict: result.verdict,
          summary: result.summary,
          matchedKeywords: JSON.stringify(result.matchedKeywords),
          missingKeywords: JSON.stringify(result.missingKeywords),
          strengths: JSON.stringify(result.strengths),
          gaps: JSON.stringify(result.gaps),
          suggestions: JSON.stringify(result.suggestions),
          createdAt: now,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("analyzeResumeMatch: insert returned no rows");
      // Denormalize the latest score onto the application for the board.
      await db
        .update(schema.applications)
        .set({
          matchPercent: result.matchPercent,
          matchCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.applications.id, app.id));
      ctx.invalidateQueries();
      return { analysis: analysisToOut(row) };
    },
  }),

  // ---------- Documents / files ----------

  listAllDocuments: defineAction({
    request: z.object({}),
    response: z.object({ documents: z.array(documentOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.documents)
        .orderBy(desc(schema.documents.id));
      const out: z.infer<typeof documentOut>[] = [];
      for (const row of rows) {
        out.push({
          id: row.id,
          applicationId: row.applicationId,
          name: row.name,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          url: await ctx.blobs.getUrl(row.blobKey),
          createdAt: row.createdAt.toISOString(),
        });
      }
      return { documents: out };
    },
  }),

  listApplicationDocuments: defineAction({
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({ documents: z.array(documentOut) }),
    async handler(ctx, args) {
      return { documents: await listDocumentsFor(ctx, args.applicationId) };
    },
  }),

  uploadDocument: defineAction({
    request: z.object({
      name: z.string().trim().min(1).max(300),
      mimeType: z.string().trim().min(1).max(200),
      dataBase64: z.string().min(1),
      applicationId: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ document: documentOut }),
    async handler(ctx, args) {
      const bytes = Buffer.from(args.dataBase64, "base64");
      if (bytes.length === 0) throw new Error("uploadDocument: empty file");
      if (bytes.length > 15 * 1024 * 1024) {
        throw new Error("uploadDocument: file is larger than 15 MB");
      }
      const blobKey = `documents/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      await ctx.blobs.put(blobKey, bytes, { contentType: args.mimeType });
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.documents)
        .values({
          name: args.name,
          mimeType: args.mimeType,
          sizeBytes: bytes.length,
          blobKey,
          applicationId: args.applicationId ?? null,
          createdAt: new Date(),
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("uploadDocument: insert returned no rows");
      ctx.invalidateQueries();
      return {
        document: {
          id: row.id,
          applicationId: row.applicationId,
          name: row.name,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          url: await ctx.blobs.getUrl(row.blobKey),
          createdAt: row.createdAt.toISOString(),
        },
      };
    },
  }),

  setDocumentApplication: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      applicationId: z.number().int().positive().nullable(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.documents)
        .set({ applicationId: args.applicationId })
        .where(eq(schema.documents.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteDocument: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ blobKey: schema.documents.blobKey })
        .from(schema.documents)
        .where(eq(schema.documents.id, args.id))
        .limit(1);
      const row = rows[0];
      if (row) {
        await ctx.blobs.delete(row.blobKey);
        await db
          .delete(schema.documents)
          .where(eq(schema.documents.id, args.id));
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),
} satisfies ActionsModule;

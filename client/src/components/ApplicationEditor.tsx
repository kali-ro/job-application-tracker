import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fileToBase64 } from "@hatch/space-sdk/client";
import { api } from "../api";
import {
STAGES,
fmtDate,
fmtSize,
fromDateInput,
inputCls,
labelCls,
matchColor,
selectCls,
toDateInput,
type Application,
type DocFile,
type Resume,
type SavedSearch,
type Status,
} from "../shared";
import { FilePreview } from "./FilePreview";
import { MatchAnalysisCard } from "./MatchAnalysisCard";

export type AppFormInitial = {
  application?: Application;
  prefill?: {
    board?: string;
    location?: string;
    savedSearchId?: number | null;
  };
};

export function ApplicationEditor({
  initial,
  searches,
  onClose,
  onTailor,
}: {
  initial: AppFormInitial;
  searches: SavedSearch[];
  onClose: () => void;
  onTailor: (applicationId: number) => void;
}) {
  const app = initial.application;
  const queryClient = useQueryClient();
  const [company, setCompany] = useState(app?.company ?? "");
  const [title, setTitle] = useState(app?.title ?? "");
  const [jobUrl, setJobUrl] = useState(app?.jobUrl ?? "");
  const [board, setBoard] = useState(app?.board ?? initial.prefill?.board ?? "");
  const [location, setLocation] = useState(
    app?.location ?? initial.prefill?.location ?? "",
  );
  const [workType, setWorkType] = useState<string>(app?.workType ?? "");
  const [salaryText, setSalaryText] = useState(app?.salaryText ?? "");
  const [status, setStatus] = useState<Status>(app?.status ?? "saved");
  const [appliedDate, setAppliedDate] = useState(toDateInput(app?.appliedDate ?? null));
  const [deadline, setDeadline] = useState(toDateInput(app?.deadline ?? null));
  const [nextStep, setNextStep] = useState(app?.nextStep ?? "");
  const [notes, setNotes] = useState(app?.notes ?? "");
  const [jobDescription, setJobDescription] = useState(
    app?.jobDescription ?? "",
  );
  const [savedSearchId, setSavedSearchId] = useState<string>(
    app?.savedSearchId != null
      ? String(app.savedSearchId)
      : initial.prefill?.savedSearchId != null
        ? String(initial.prefill.savedSearchId)
        : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const workTypeValue: "remote" | "hybrid" | "onsite" | undefined =
        workType === "remote" || workType === "hybrid" || workType === "onsite"
          ? workType
          : undefined;
      const payload = {
        company: company.trim(),
        title: title.trim(),
        jobUrl: jobUrl.trim() || undefined,
        board: board.trim() || undefined,
        location: location.trim() || undefined,
        workType: workTypeValue,
        salaryText: salaryText.trim() || undefined,
        status,
        appliedDate: fromDateInput(appliedDate),
        deadline: fromDateInput(deadline),
        nextStep: nextStep.trim() || undefined,
        notes: notes || undefined,
        jobDescription: jobDescription.trim() || undefined,
        savedSearchId: savedSearchId ? Number(savedSearchId) : null,
      };
      return app
        ? api.updateApplication({ id: app.id, ...payload })
        : api.createApplication(payload);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteApplication({ id: app!.id }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!company.trim() || !title.trim()) {
      setError("Company and job title are required.");
      return;
    }
    save.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={app ? `Edit ${app.title} at ${app.company}` : "Add a job"}
    >
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 pb-safe sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">
            {app ? "Application details" : "Add a job"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="app-company" className={labelCls}>
                Company *
              </label>
              <input
                id="app-company"
                className={inputCls}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Example Company"
                required
              />
            </div>
            <div>
              <label htmlFor="app-title" className={labelCls}>
                Job title *
              </label>
              <input
                id="app-title"
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product Designer"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="app-status" className={labelCls}>
              Stage
            </label>
            <select
              id="app-status"
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="app-url" className={labelCls}>
              Posting URL
            </label>
            <input
              id="app-url"
              type="url"
              className={inputCls}
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div>
            <label htmlFor="app-jd" className={labelCls}>
              Job description
            </label>
            <textarea
              id="app-jd"
              className={inputCls}
              rows={7}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job posting here. It's saved with this job and powers the resume match check and edit suggestions below."
            />
            <p className="mt-1 text-xs text-[var(--dim)]">
              {jobDescription.trim().length > 0
                ? `${jobDescription.trim().length.toLocaleString()} characters saved with this job.`
                : "No description saved yet — paste it once and the match check can use it any time."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="app-board" className={labelCls}>
                Found on (board / source)
              </label>
              <input
                id="app-board"
                className={inputCls}
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                placeholder="LinkedIn, Indeed, referral…"
              />
            </div>
            <div>
              <label htmlFor="app-location" className={labelCls}>
                Location
              </label>
              <input
                id="app-location"
                className={inputCls}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, ST"
              />
            </div>
            <div>
              <label htmlFor="app-worktype" className={labelCls}>
                Work type
              </label>
              <select
                id="app-worktype"
                className={selectCls}
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div>
              <label htmlFor="app-salary" className={labelCls}>
                Salary (as posted)
              </label>
              <input
                id="app-salary"
                className={inputCls}
                value={salaryText}
                onChange={(e) => setSalaryText(e.target.value)}
                placeholder="$90k–$120k"
              />
            </div>
            <div>
              <label htmlFor="app-applied" className={labelCls}>
                Date applied
              </label>
              <input
                id="app-applied"
                type="date"
                className={inputCls}
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="app-deadline" className={labelCls}>
                Deadline / next date
              </label>
              <input
                id="app-deadline"
                type="date"
                className={inputCls}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="app-nextstep" className={labelCls}>
              Next step
            </label>
            <input
              id="app-nextstep"
              className={inputCls}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Keep it short — e.g. Apply today"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "Apply today",
                "Send follow-up to recruiter",
                "Prep for interview",
                "Send thank-you note",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setNextStep(suggestion)}
                  aria-pressed={nextStep === suggestion}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    nextStep === suggestion
                      ? "bg-[var(--accent)] text-[var(--accent-text)]"
                      : "border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)]"
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {searches.length > 0 && (
            <div>
              <label htmlFor="app-search" className={labelCls}>
                Found via saved search
              </label>
              <select
                id="app-search"
                className={selectCls}
                value={savedSearchId}
                onChange={(e) => setSavedSearchId(e.target.value)}
              >
                <option value="">None</option>
                {searches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="app-notes" className={labelCls}>
              Notes
            </label>
            <textarea
              id="app-notes"
              className={inputCls}
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contacts, interview notes, things to follow up on…"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : app ? "Save changes" : "Add job"}
            </button>
            {app?.jobUrl && (
              <a
                href={app.jobUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]"
              >
                Open posting
              </a>
            )}
            {app && (
              <button
                type="button"
                onClick={() => onTailor(app.id)}
                className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]"
              >
                Tailor a resume for this job
              </button>
            )}
            {app &&
              (confirmDelete ? (
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-[var(--danger)]">
                    Delete this application?
                  </span>
                  <button
                    type="button"
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending}
                    className="rounded-[var(--radius)] bg-[var(--danger)] px-3 py-2 text-sm font-semibold text-[#fdf6e3] disabled:opacity-50"
                  >
                    {remove.isPending ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)]"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="ml-auto rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-[var(--danger)]"
                >
                  Delete
                </button>
              ))}
          </div>
        </form>

        {app && <JobResumeWorkspace key={app.id} application={app} />}

        {app && <ApplicationAttachments applicationId={app.id} />}
      </div>
    </div>
  );
}

function ApplicationAttachments({ applicationId }: { applicationId: number }) {
  const queryClient = useQueryClient();
  const docs = useQuery({
    queryKey: ["documents", "app", applicationId],
    queryFn: () => api.listApplicationDocuments({ applicationId }),
  });
  const [preview, setPreview] = useState<DocFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { dataBase64, mimeType } = await fileToBase64(file);
      return api.uploadDocument({
        name: file.name,
        mimeType: file.type || mimeType,
        dataBase64,
        applicationId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents", "app", applicationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) =>
      setUploadError(e instanceof Error ? e.message : String(e)),
  });

  const removeDoc = useMutation({
    mutationFn: (id: number) => api.deleteDocument({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["documents", "app", applicationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  return (
    <section className="mt-6 border-t border-[var(--border)] pt-4">
      <h3 className="text-sm font-bold text-[var(--text)]">Files for this job</h3>
      {docs.isPending ? (
        <p className="mt-2 text-sm text-[var(--dim)]">Loading files…</p>
      ) : docs.data && docs.data.documents.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {docs.data.documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3 py-2"
            >
              <button
                type="button"
                onClick={() => setPreview(d)}
                className="min-w-0 flex-1 text-left"
                aria-label={`Preview ${d.name}`}
              >
                <span className="block truncate text-sm font-medium text-[var(--text)]">
                  {d.name}
                </span>
                <span className="block text-xs text-[var(--dim)]">
                  {fmtSize(d.sizeBytes)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeDoc.mutate(d.id)}
                aria-label={`Remove ${d.name}`}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-[var(--danger)]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--dim)]">
          No files attached yet — attach the exact resume or cover letter you
          sent for this job.
        </p>
      )}
      <label className="mt-3 inline-block cursor-pointer rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)]">
        {upload.isPending ? "Uploading…" : "Attach a file"}
        <input
          type="file"
          className="sr-only"
          aria-label="Attach a file to this application"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setUploadError(null);
              upload.mutate(f);
            }
            e.target.value = "";
          }}
        />
      </label>
      {uploadError && (
        <p role="alert" className="mt-2 text-sm font-medium text-[var(--danger)]">
          {uploadError}
        </p>
      )}
      {preview && <FilePreview doc={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

/**
 * Per-job resume workspace: the customized resume stored with this job,
 * the saved job description's match check (percentage + keyword overlap),
 * and per-job edit suggestions with a one-click tailored draft.
 */
function JobResumeWorkspace({ application }: { application: Application }) {
  const queryClient = useQueryClient();
  const resumesQ = useQuery({
    queryKey: ["resumes"],
    queryFn: () => api.listResumes({}),
  });
  const analysesQ = useQuery({
    queryKey: ["analyses", application.id],
    queryFn: () => api.listMatchAnalyses({ applicationId: application.id }),
  });

  const resumes: Resume[] = resumesQ.data?.resumes ?? [];
  const linked = resumes.filter((r) => r.applicationId === application.id);
  const analyses = analysesQ.data?.analyses ?? [];
  const latest = analyses[0] ?? null;

  const [pickedResumeId, setPickedResumeId] = useState("");
  const [viewAnalysisId, setViewAnalysisId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Resume | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<{
    tailoredResume: string;
  } | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const effectiveResumeId =
    pickedResumeId ||
    (latest?.resumeId != null
      ? String(latest.resumeId)
      : linked[0]
        ? String(linked[0].id)
        : resumes[0]
          ? String(resumes[0].id)
          : "");
  const selectedResume = resumes.find(
    (r) => r.id === Number(effectiveResumeId),
  );
  const viewedAnalysis =
    analyses.find((a) => a.id === viewAnalysisId) ?? latest;

  const jd = (application.jobDescription ?? "").trim();
  const hasJd = jd.length >= 20;

  const invalidateAnalyses = () => {
    void queryClient.invalidateQueries({
      queryKey: ["analyses", application.id],
    });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const analyze = useMutation({
    mutationFn: () =>
      api.analyzeResumeMatch({
        applicationId: application.id,
        resumeId: Number(effectiveResumeId),
      }),
    onSuccess: (data) => {
      setViewAnalysisId(data.analysis.id);
      setTailorResult(null);
      setSavedNote(null);
      invalidateAnalyses();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const tailor = useMutation({
    mutationFn: () =>
      api.tailorResume({
        resumeContent: selectedResume!.content,
        jobTitle: application.title,
        company: application.company,
        jobDescription: jd,
      }),
    onSuccess: (data) => {
      setTailorResult({ tailoredResume: data.tailoredResume });
      setSavedNote(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const saveTailored = useMutation({
    mutationFn: () =>
      api.createResume({
        name: `${selectedResume!.name} — tailored for ${application.company}`,
        content: tailorResult!.tailoredResume,
        applicationId: application.id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setSavedNote(
        "Saved below as this job's customized resume. Run the match check again to see the new score.",
      );
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const canAnalyze =
    hasJd &&
    !!selectedResume &&
    selectedResume.content.trim().length >= 20 &&
    !analyze.isPending;

  return (
    <section className="mt-6 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-[var(--text)]">
          Resume for this job
        </h3>
        {application.matchPercent != null && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold text-[#fdf6e3]"
            style={{
              backgroundColor: matchColor(application.matchPercent),
            }}
          >
            {application.matchPercent}% match
          </span>
        )}
      </div>

      {/* Customized resume stored with this job */}
      {resumesQ.isPending ? (
        <p className="mt-2 text-sm text-[var(--dim)]">Loading resumes…</p>
      ) : linked.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {linked.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--surface-alt)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--text)]">
                  {r.name}
                </span>
                <span className="block text-xs text-[var(--dim)]">
                  Updated {fmtDate(r.updatedAt)} · {r.content.length}{" "}
                  characters
                  {latest?.resumeId === r.id
                    ? ` · last checked at ${latest.matchPercent}%`
                    : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditing(r)}
                aria-label={`Edit resume ${r.name}`}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-[var(--text)]"
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--dim)]">
          No customized resume stored for this job yet — create one from
          your base resume and it stays attached here.
        </p>
      )}

      {editing ? (
        <JobResumeEditor
          resume={editing === "new" ? null : editing}
          resumes={resumes}
          application={application}
          onClose={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="mt-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)]"
        >
          New customized resume for this job
        </button>
      )}

      {/* Match check */}
      <div className="mt-5 rounded-[var(--radius)] border border-[var(--border)] p-3">
        <h4 className="text-sm font-bold text-[var(--text)]">
          Resume match check
        </h4>
        {!hasJd ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            Save the job description in the form above first — the check
            compares your resume against it and scores the match.
          </p>
        ) : resumes.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            Add a resume (above, or in the Resumes tab) to run the check.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="match-resume" className={labelCls}>
                  Resume to check
                </label>
                <select
                  id="match-resume"
                  className={selectCls}
                  value={effectiveResumeId}
                  onChange={(e) => setPickedResumeId(e.target.value)}
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.applicationId === application.id
                        ? " (for this job)"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!canAnalyze}
                onClick={() => {
                  setError(null);
                  analyze.mutate();
                }}
                className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50"
              >
                {analyze.isPending
                  ? "Checking… this can take a moment"
                  : latest
                    ? "Re-run match check"
                    : "Check match"}
              </button>
            </div>
            {selectedResume &&
              selectedResume.content.trim().length < 20 && (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  The selected resume has no text yet — add its text before
                  checking.
                </p>
              )}
          </>
        )}

        {analyses.length > 1 && (
          <div className="mt-3">
            <label htmlFor="match-history" className={labelCls}>
              Past checks ({analyses.length})
            </label>
            <select
              id="match-history"
              className={selectCls}
              value={viewedAnalysis ? String(viewedAnalysis.id) : ""}
              onChange={(e) => setViewAnalysisId(Number(e.target.value))}
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {fmtDate(a.createdAt)} — {a.matchPercent}% ·{" "}
                  {a.resumeName ?? "Resume"}
                </option>
              ))}
            </select>
          </div>
        )}

        {viewedAnalysis && (
          <div className="mt-3">
            <MatchAnalysisCard analysis={viewedAnalysis} />
          </div>
        )}

        {/* Per-job suggestions → tailored draft */}
        {viewedAnalysis && hasJd && selectedResume && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="text-sm text-[var(--dim)]">
              Turn this job's suggestions into a full tailored draft based
              on{" "}
              <span className="font-medium text-[var(--text)]">
                {selectedResume.name}
              </span>
              , then save it as this job's customized resume.
            </p>
            <button
              type="button"
              disabled={tailor.isPending || !selectedResume}
              onClick={() => {
                setError(null);
                tailor.mutate();
              }}
              className="mt-2 rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
            >
              {tailor.isPending
                ? "Generating draft…"
                : "Generate tailored draft from suggestions"}
            </button>
            {tailorResult && (
              <div className="mt-3 space-y-2">
                <label htmlFor="job-tailor-output" className={labelCls}>
                  Tailored resume draft
                </label>
                <textarea
                  id="job-tailor-output"
                  className={`${inputCls} font-mono`}
                  rows={12}
                  value={tailorResult.tailoredResume}
                  onChange={(e) =>
                    setTailorResult({ tailoredResume: e.target.value })
                  }
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saveTailored.isPending}
                    onClick={() => saveTailored.mutate()}
                    className="rounded-[var(--radius)] bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-[var(--cta-text)] disabled:opacity-50"
                  >
                    {saveTailored.isPending
                      ? "Saving…"
                      : "Save as this job's customized resume"}
                  </button>
                  {savedNote && (
                    <span className="text-sm font-medium text-[var(--accent)]">
                      {savedNote}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-2 text-sm font-medium text-[var(--danger)]"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function JobResumeEditor({
  resume,
  resumes,
  application,
  onClose,
}: {
  resume: Resume | null;
  resumes: Resume[];
  application: Application;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(
    resume?.name ?? `Resume for ${application.company} — ${application.title}`,
  );
  const [content, setContent] = useState(resume?.content ?? "");
  const [copyFrom, setCopyFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["resumes"] });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        content,
        applicationId: application.id as number | null,
      };
      return resume
        ? api.updateResume({ id: resume.id, ...payload })
        : api.createResume(payload);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteResume({ id: resume!.id }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
          setError("Give this resume version a name.");
          return;
        }
        save.mutate();
      }}
      className="mt-3 space-y-3 rounded-[var(--radius)] border border-[var(--border)] p-3"
    >
      <h4 className="text-sm font-bold text-[var(--text)]">
        {resume ? `Edit — ${resume.name}` : "New customized resume"}
      </h4>
      <div>
        <label htmlFor="job-resume-name" className={labelCls}>
          Version name *
        </label>
        <input
          id="job-resume-name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      {!resume && resumes.length > 0 && (
        <div>
          <label htmlFor="job-resume-copy" className={labelCls}>
            Start from an existing version
          </label>
          <select
            id="job-resume-copy"
            className={selectCls}
            value={copyFrom}
            onChange={(e) => {
              setCopyFrom(e.target.value);
              const src = resumes.find(
                (r) => r.id === Number(e.target.value),
              );
              if (src) setContent(src.content);
            }}
          >
            <option value="">Blank</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="job-resume-content" className={labelCls}>
          Resume text
        </label>
        <textarea
          id="job-resume-content"
          className={`${inputCls} font-mono`}
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the resume text you customized for this job…"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save resume"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]"
        >
          Cancel
        </button>
        {resume &&
          (confirmDelete ? (
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="rounded-[var(--radius)] bg-[var(--danger)] px-3 py-2 text-sm font-semibold text-[#fdf6e3] disabled:opacity-50"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-2 text-sm font-medium text-[var(--text)]"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto px-3 py-2 text-sm font-medium text-[var(--danger)]"
            >
              Delete
            </button>
          ))}
      </div>
    </form>
  );
}

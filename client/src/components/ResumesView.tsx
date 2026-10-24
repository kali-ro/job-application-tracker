import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "../api";
import {
fmtDate,
inputCls,
labelCls,
matchColor,
type Application,
type Resume,
} from "../shared";
import { MatchAnalysisCard } from "./MatchAnalysisCard";

type TailorResult = ApiResponse<typeof api, "tailorResume">;

export function ResumesView({
  resumes,
  applications,
  tailorAppId,
  onTailorHandled,
}: {
  resumes: Resume[];
  applications: Application[];
  tailorAppId: number | null;
  onTailorHandled: () => void;
}) {
  const [editing, setEditing] = useState<Resume | "new" | null>(null);
  const [showTailor, setShowTailor] = useState(false);

  useEffect(() => {
    if (tailorAppId != null) {
      setShowTailor(true);
      setEditing(null);
    }
  }, [tailorAppId]);

  const appLabel = (id: number | null) => {
    if (id == null) return "General version";
    const a = applications.find((x) => x.id === id);
    return a ? `For ${a.company} — ${a.title}` : "For a removed application";
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--dim)]">
          Keep your base resume and the tailored version for each job side by
          side.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              setShowTailor((v) => !v);
              setEditing(null);
            }}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
          >
            {showTailor ? "Close tailor" : "Tailor a resume"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing("new");
              setShowTailor(false);
            }}
            className="rounded-[var(--radius)] bg-[var(--cta)] px-3 py-2 text-sm font-semibold text-[var(--cta-text)]"
          >
            New resume
          </button>
        </div>
      </div>

      {showTailor && (
        <TailorPanel
          resumes={resumes}
          applications={applications}
          initialAppId={tailorAppId}
          onDone={() => {
            setShowTailor(false);
            onTailorHandled();
          }}
        />
      )}

      {editing && (
        <ResumeEditor
          resume={editing === "new" ? null : editing}
          resumes={resumes}
          applications={applications}
          onClose={() => setEditing(null)}
        />
      )}

      {resumes.length === 0 && !editing && !showTailor ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--text)]">
            No resumes yet.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--dim)]">
            Add your base resume as text, then tailor a copy for each job —
            the original stays untouched, and each version stays linked to its
            application.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {resumes.map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <button
                type="button"
                onClick={() => {
                  setEditing(r);
                  setShowTailor(false);
                }}
                className="block w-full text-left"
                aria-label={`Edit resume ${r.name}`}
              >
                <h3 className="font-bold text-[var(--text)]">{r.name}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--cta)]">
                  {appLabel(r.applicationId)}
                  {(() => {
                    const linkedApp = applications.find(
                      (a) => a.id === r.applicationId,
                    );
                    return linkedApp?.matchPercent != null ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold text-[#fdf6e3]"
                        style={{
                          backgroundColor: matchColor(linkedApp.matchPercent),
                        }}
                      >
                        {linkedApp.matchPercent}% match
                      </span>
                    ) : null;
                  })()}
                </p>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-[var(--dim)]">
                  {r.content || "No text yet — tap to add."}
                </p>
                <p className="mt-2 text-xs text-[var(--dim)]">
                  Updated {fmtDate(r.updatedAt)} · {r.content.length} characters
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResumeEditor({
  resume,
  resumes,
  applications,
  onClose,
}: {
  resume: Resume | null;
  resumes: Resume[];
  applications: Application[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(resume?.name ?? "");
  const [content, setContent] = useState(resume?.content ?? "");
  const [applicationId, setApplicationId] = useState<string>(
    resume?.applicationId != null ? String(resume.applicationId) : "",
  );
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
        applicationId: applicationId ? Number(applicationId) : null,
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give this resume version a name.");
      return;
    }
    save.mutate();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h3 className="font-bold text-[var(--text)]">
        {resume ? `Edit — ${resume.name}` : "New resume"}
      </h3>
      <div>
        <label htmlFor="resume-name" className={labelCls}>
          Version name *
        </label>
        <input
          id="resume-name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Base resume, or Example Company — tailored"
          required
        />
      </div>
      {!resume && resumes.length > 0 && (
        <div>
          <label htmlFor="resume-copy" className={labelCls}>
            Start from an existing version
          </label>
          <select
            id="resume-copy"
            className={inputCls}
            value={copyFrom}
            onChange={(e) => {
              setCopyFrom(e.target.value);
              const src = resumes.find((r) => r.id === Number(e.target.value));
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
        <label htmlFor="resume-app" className={labelCls}>
          Linked application
        </label>
        <select
          id="resume-app"
          className={inputCls}
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
        >
          <option value="">General version (no specific job)</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company} — {a.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="resume-content" className={labelCls}>
          Resume text
        </label>
        <textarea
          id="resume-content"
          className={`${inputCls} font-mono`}
          rows={14}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your resume text here…"
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

function TailorPanel({
  resumes,
  applications,
  initialAppId,
  onDone,
}: {
  resumes: Resume[];
  applications: Application[];
  initialAppId: number | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [resumeId, setResumeId] = useState<string>(
    resumes[0] ? String(resumes[0].id) : "",
  );
  const [appId, setAppId] = useState<string>(
    initialAppId != null ? String(initialAppId) : "",
  );
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<TailorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const baseResume = resumes.find((r) => r.id === Number(resumeId));
  const targetApp = applications.find((a) => a.id === Number(appId));

  // When a job with a saved description is picked, the tailor box starts
  // from that saved text instead of asking for a fresh paste.
  useEffect(() => {
    if (targetApp?.jobDescription) {
      setJobDescription(targetApp.jobDescription);
    }
    // Only re-sync when the selected job changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const analysesQ = useQuery({
    queryKey: ["analyses", targetApp?.id ?? 0],
    queryFn: () =>
      api.listMatchAnalyses({ applicationId: targetApp!.id }),
    enabled: !!targetApp,
  });
  const latestAnalysis = analysesQ.data?.analyses[0] ?? null;

  const analyze = useMutation({
    mutationFn: () =>
      api.analyzeResumeMatch({
        applicationId: targetApp!.id,
        resumeId: baseResume!.id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["analyses", targetApp!.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const canAnalyze =
    !!targetApp &&
    !!baseResume &&
    baseResume.content.trim().length >= 20 &&
    (targetApp.jobDescription ?? "").trim().length >= 20;

  const tailor = useMutation({
    mutationFn: () =>
      api.tailorResume({
        resumeContent: baseResume!.content,
        jobTitle: targetApp?.title,
        company: targetApp?.company,
        jobDescription: jobDescription.trim(),
      }),
    onSuccess: (data) => {
      setResult(data);
      setSavedNote(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const saveVersion = useMutation({
    mutationFn: () =>
      api.createResume({
        name: targetApp
          ? `${baseResume!.name} — tailored for ${targetApp.company}`
          : `${baseResume!.name} — tailored`,
        content: result!.tailoredResume,
        applicationId: targetApp ? targetApp.id : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setSavedNote("Saved as a new resume version below.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const canRun =
    !!baseResume &&
    baseResume.content.trim().length >= 20 &&
    jobDescription.trim().length >= 20;

  return (
    <section
      aria-label="Tailor a resume for a job"
      className="mb-4 space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h3 className="font-bold text-[var(--text)]">Tailor a resume</h3>
      <p className="text-sm text-[var(--dim)]">
        Pick a resume and paste the job description. You'll get concrete edits
        and a full tailored draft — nothing is saved until you say so, and the
        editor never invents experience that isn't in your resume.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tailor-resume" className={labelCls}>
            Resume to tailor
          </label>
          <select
            id="tailor-resume"
            className={inputCls}
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
          >
            {resumes.length === 0 && <option value="">No resumes yet</option>}
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tailor-app" className={labelCls}>
            Target job (optional)
          </label>
          <select
            id="tailor-app"
            className={inputCls}
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          >
            <option value="">No specific application</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} — {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="tailor-jd" className={labelCls}>
          Job description
        </label>
        <textarea
          id="tailor-jd"
          className={inputCls}
          rows={8}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job posting text here…"
        />
        {targetApp?.jobDescription && (
          <p className="mt-1 text-xs text-[var(--dim)]">
            Pre-filled from the description saved with this job. Edits here
            are only for this tailoring run — update the saved copy from the
            job's details in the Pipeline.
          </p>
        )}
      </div>

      {targetApp && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-[var(--text)]">
              Match check
            </h4>
            {targetApp.matchPercent != null && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold text-[#fdf6e3]"
                style={{ backgroundColor: matchColor(targetApp.matchPercent) }}
              >
                {targetApp.matchPercent}% match
              </span>
            )}
            <button
              type="button"
              disabled={!canAnalyze || analyze.isPending}
              onClick={() => {
                setError(null);
                analyze.mutate();
              }}
              className="ml-auto rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50"
            >
              {analyze.isPending
                ? "Checking…"
                : latestAnalysis
                  ? "Re-run match check"
                  : "Check match"}
            </button>
          </div>
          {!canAnalyze && !analyze.isPending && (
            <p className="mt-1 text-sm text-[var(--dim)]">
              {(targetApp.jobDescription ?? "").trim().length < 20
                ? "This job has no saved description yet — add one from its details in the Pipeline to run the check."
                : "The selected resume needs text before it can be checked."}
            </p>
          )}
          {latestAnalysis && (
            <div className="mt-3">
              <MatchAnalysisCard analysis={latestAnalysis} />
            </div>
          )}
        </div>
      )}
      {baseResume && baseResume.content.trim().length < 20 && (
        <p className="text-sm text-[var(--dim)]">
          The selected resume has no text yet — add its text first, then
          tailor.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!canRun || tailor.isPending}
        onClick={() => {
          setError(null);
          tailor.mutate();
        }}
        className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50"
      >
        {tailor.isPending ? "Tailoring… this can take a moment" : "Tailor resume"}
      </button>

      {result && (
        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--text)]">
              Suggested edits ({result.suggestions.length})
            </h4>
            {result.suggestions.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--dim)]">
                No changes suggested — this resume already fits the posting
                well.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {result.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-[var(--radius)] bg-[var(--surface-alt)] p-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      {s.section}
                    </p>
                    <p className="mt-1 text-sm text-[var(--dim)] line-through decoration-[var(--danger)]/50">
                      {s.original}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--text)]">
                      {s.revised}
                    </p>
                    <p className="mt-1 text-xs italic text-[var(--dim)]">
                      {s.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="tailor-output" className={labelCls}>
              Tailored resume draft
            </label>
            <textarea
              id="tailor-output"
              className={`${inputCls} font-mono`}
              rows={12}
              value={result.tailoredResume}
              onChange={(e) =>
                setResult({ ...result, tailoredResume: e.target.value })
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saveVersion.isPending}
              onClick={() => saveVersion.mutate()}
              className="rounded-[var(--radius)] bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-[var(--cta-text)] disabled:opacity-50"
            >
              {saveVersion.isPending
                ? "Saving…"
                : "Save as a new resume version"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]"
            >
              Done
            </button>
            {savedNote && (
              <span className="text-sm font-medium text-[var(--accent)]">
                {savedNote}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

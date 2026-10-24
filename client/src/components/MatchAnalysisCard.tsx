import { fmtDate, matchColor, type MatchAnalysis } from "../shared";

/**
 * Renders one resume-vs-job-description match check: the percentage,
 * keyword overlap, strengths/gaps, and the per-job edit suggestions.
 * Shared by the application editor's per-job workspace and the
 * Resumes tab tailor panel.
 */
export function MatchAnalysisCard({ analysis }: { analysis: MatchAnalysis }) {
  const pct = analysis.matchPercent;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-4">
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full text-[#fdf6e3]"
          style={{ backgroundColor: matchColor(pct) }}
          aria-label={`Match score ${pct} percent`}
        >
          <span className="text-lg font-extrabold leading-none">{pct}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            match
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[var(--text)]">{analysis.verdict}</p>
          <p className="mt-0.5 text-sm text-[var(--dim)]">{analysis.summary}</p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            {analysis.resumeName ? `Resume: ${analysis.resumeName} · ` : ""}
            Checked {fmtDate(analysis.createdAt)}
          </p>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-alt)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Resume match percentage"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: matchColor(pct) }}
        />
      </div>

      {(analysis.matchedKeywords.length > 0 ||
        analysis.missingKeywords.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
              In your resume
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {analysis.matchedKeywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-[#859900] px-2 py-0.5 text-xs font-semibold text-[#fdf6e3]"
                >
                  {k}
                </span>
              ))}
              {analysis.matchedKeywords.length === 0 && (
                <span className="text-sm text-[var(--dim)]">None found.</span>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
              Missing from your resume
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {analysis.missingKeywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-[#dc322f] px-2 py-0.5 text-xs font-semibold text-[#fdf6e3]"
                >
                  {k}
                </span>
              ))}
              {analysis.missingKeywords.length === 0 && (
                <span className="text-sm text-[var(--dim)]">
                  Nothing major missing.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {(analysis.strengths.length > 0 || analysis.gaps.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
              Strengths for this job
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
              {analysis.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
              Gaps to close
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
              {analysis.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-bold text-[var(--text)]">
            Suggested edits for this job ({analysis.suggestions.length})
          </h4>
          <ul className="mt-2 space-y-3">
            {analysis.suggestions.map((s, i) => (
              <li
                key={i}
                className="rounded-[var(--radius)] bg-[var(--surface-alt)] p-3"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                  {s.section}
                </p>
                {s.original && (
                  <p className="mt-1 text-sm text-[var(--dim)] line-through decoration-[var(--danger)]/50">
                    {s.original}
                  </p>
                )}
                <p className="mt-1 text-sm font-medium text-[var(--text)]">
                  {s.revised}
                </p>
                <p className="mt-1 text-xs italic text-[var(--dim)]">
                  {s.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

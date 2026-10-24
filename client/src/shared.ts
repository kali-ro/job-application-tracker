import { api, type ApiResponse } from "./api";

export type Application =
  ApiResponse<typeof api, "listApplications">["applications"][number];
export type SavedSearch =
  ApiResponse<typeof api, "listSavedSearches">["searches"][number];
export type Resume = ApiResponse<typeof api, "listResumes">["resumes"][number];
export type DocFile =
  ApiResponse<typeof api, "listAllDocuments">["documents"][number];
export type MatchAnalysis =
  ApiResponse<typeof api, "listMatchAnalyses">["analyses"][number];
export type EditSuggestion = MatchAnalysis["suggestions"][number];

/** Color for a 0–100 match score: green ≥75, amber ≥50, red below. */
export function matchColor(percent: number): string {
  if (percent >= 75) return "#859900";
  if (percent >= 50) return "#b58900";
  return "#dc322f";
}
export type Status = Application["status"];

export const STAGES: { value: Status; label: string; color: string }[] = [
  { value: "saved", label: "Saved", color: "#93a1a1" },
  { value: "applied", label: "Applied", color: "#268bd2" },
  { value: "screening", label: "Screening", color: "#b58900" },
  { value: "interview", label: "Interview", color: "#cb4b16" },
  { value: "offer", label: "Offer", color: "#859900" },
  { value: "rejected", label: "Rejected", color: "#dc322f" },
  { value: "withdrawn", label: "Withdrawn", color: "#6c71c4" },
];

/**
 * Shorten a stored next step for the board card: keep just the first short
 * clause ("Phone screen Tuesday, send thank-you note" → "Phone screen
 * Tuesday") so every card's next-step line stays one short line. The full
 * text still lives on the application and shows in the editor.
 */
export function shortNextStep(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const head = clean.split(/[,;—]|\s-\s|\.\s/)[0]?.trim() ?? "";
  const candidate = head.length >= 3 ? head : clean;
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

/** Short, simple next step suggested for a stage when none is written yet. */
export function defaultNextStep(status: Status): string {
  switch (status) {
    case "saved":
      return "Apply today";
    case "applied":
    case "screening":
      return "Send follow-up to recruiter";
    case "interview":
      return "Prep for the interview";
    case "offer":
      return "Review the offer";
    default:
      return "No next step";
  }
}

export const ACTIVE_STAGES = STAGES.slice(0, 5);

export function stageMeta(status: Status) {
  return STAGES.find((s) => s.value === status) ?? STAGES[0]!;
}

export function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** yyyy-mm-dd for <input type="date">, in local time. */
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local date-input value -> ISO instant (local noon, avoids TZ edge cases). */
export function fromDateInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(iso);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86400000);
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const inputCls =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

/**
 * Dropdowns sized exactly like the single-line text boxes beside them:
 * same full width, same padding/font, and the same fixed height
 * (text-sm line-height 20px + py-2 16px + border 2px = 38px), so a
 * <select> never renders shorter or narrower than an <input>.
 */
export const selectCls = `${inputCls} h-[38px]`;

export const labelCls =
  "block text-xs font-semibold uppercase tracking-wide text-[var(--dim)] mb-1";

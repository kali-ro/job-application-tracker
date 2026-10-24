import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import {
inputCls,
labelCls,
type Application,
type SavedSearch,
} from "../shared";

export function SearchesView({
  searches,
  applications,
  onTrackJob,
}: {
  searches: SavedSearch[];
  applications: Application[];
  onTrackJob: (search: SavedSearch) => void;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [board, setBoard] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createSavedSearch({
        name: name.trim(),
        keywords: keywords.trim(),
        location: location.trim() || undefined,
        board: board.trim() || undefined,
        url: url.trim() || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["searches"] });
      setShowForm(false);
      setName("");
      setKeywords("");
      setLocation("");
      setBoard("");
      setUrl("");
      setNotes("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteSavedSearch({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["searches"] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      setConfirmDeleteId(null);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !keywords.trim()) {
      setError("Give the search a name and the keywords you search with.");
      return;
    }
    create.mutate();
  };

  const countFor = (id: number) =>
    applications.filter((a) => a.savedSearchId === id).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--dim)]">
          The searches you run again and again — keep them in one place, and
          track the jobs they turn up.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="ml-3 shrink-0 rounded-[var(--radius)] bg-[var(--cta)] px-3 py-2 text-sm font-semibold text-[var(--cta-text)]"
        >
          {showForm ? "Cancel" : "New search"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div>
            <label htmlFor="search-name" className={labelCls}>
              Search name *
            </label>
            <input
              id="search-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Remote product roles"
              required
            />
          </div>
          <div>
            <label htmlFor="search-keywords" className={labelCls}>
              Keywords *
            </label>
            <input
              id="search-keywords"
              className={inputCls}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="product designer, UX, design systems"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="search-location" className={labelCls}>
                Location filter
              </label>
              <input
                id="search-location"
                className={inputCls}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote — US"
              />
            </div>
            <div>
              <label htmlFor="search-board" className={labelCls}>
                Board
              </label>
              <input
                id="search-board"
                className={inputCls}
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                placeholder="LinkedIn"
              />
            </div>
          </div>
          <div>
            <label htmlFor="search-url" className={labelCls}>
              Saved search URL
            </label>
            <input
              id="search-url"
              type="url"
              className={inputCls}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste the board's filtered results URL"
            />
          </div>
          <div>
            <label htmlFor="search-notes" className={labelCls}>
              Notes
            </label>
            <textarea
              id="search-notes"
              className={inputCls}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Filters that work, alerts set, boards to skip…"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--danger)]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Save search"}
          </button>
        </form>
      )}

      {searches.length === 0 && !showForm ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--text)]">
            No saved searches yet.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--dim)]">
            Save the keyword searches you run on job boards so you can re-run
            them in one tap and see which applications came from each.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {searches.map((s) => (
            <li
              key={s.id}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-[var(--text)]">{s.name}</h3>
                  <p className="mt-0.5 text-sm text-[var(--dim)]">{s.keywords}</p>
                  <p className="mt-1 text-xs text-[var(--dim)]">
                    {[s.board, s.location].filter(Boolean).join(" · ") ||
                      "Any board"}
                    {" · "}
                    {countFor(s.id)}{" "}
                    {countFor(s.id) === 1 ? "job" : "jobs"} tracked
                  </p>
                  {s.notes && (
                    <p className="mt-2 text-sm text-[var(--text)]">{s.notes}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-text)]"
                  >
                    Run search
                  </a>
                ) : (
                  <span className="text-xs text-[var(--dim)]">
                    Add a results URL to re-run this search in one tap.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onTrackJob(s)}
                  className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)]"
                >
                  Track a job from this search
                </button>
                {confirmDeleteId === s.id ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => remove.mutate(s.id)}
                      className="rounded-[var(--radius)] bg-[var(--danger)] px-3 py-1.5 text-sm font-semibold text-[#fdf6e3]"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1.5 text-sm font-medium text-[var(--text)]"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(s.id)}
                    className="px-2 py-1.5 text-sm font-medium text-[var(--danger)]"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
